mod animation_arena;
mod append_transform_solver;
mod ik_chain_info;
mod ik_solver;
mod mmd_morph_controller;
pub(crate) mod mmd_runtime_bone;

use std::num::NonZeroUsize;
use std::ptr::NonNull;
use animation_arena::AnimationArena;
use append_transform_solver::{AppendTransformSolver, AppendTransformSolverArena};
use ik_solver::{IkSolver, IkSolverArena};
use mmd_morph_controller::MmdMorphController;
use mmd_runtime_bone::{MmdRuntimeBone, MmdRuntimeBoneArena};

use crate::diagnostic::Diagnostic;
use crate::mmd_model_metadata::{BoneFlag, BoneMetadataReader, MetadataBuffer, RigidbodyPhysicsMode};

use crate::mmd_model_metadata::PhysicsInfoKind;
use crate::physics::physics_runtime::physics_model_context;
#[cfg(feature = "physics")]
use crate::{
    physics::physics_runtime::PhysicsRuntime,
    physics::physics_runtime::physics_model_context::PhysicsModelContext,
};

use crate::animation::mmd_runtime_animation::MmdRuntimeAnimation;

use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};

pub(crate) struct MmdModel {
    runtime_animation: Option<NonZeroUsize>,
    animation_arena: AnimationArena,
    bone_arena: MmdRuntimeBoneArena,
    append_transform_solver_arena: AppendTransformSolverArena,
    ik_solver_arena: IkSolverArena,
    morph_controller: MmdMorphController,
    sorted_runtime_bones: Box<[u32]>,
    bone_stack: Option<Vec<u32>>,
    external_physics: bool,

    #[cfg(feature = "physics")]
    physics_model_context: Option<PhysicsModelContext>,
}

impl MmdModel {
    pub(crate) fn new(
        buffer: MetadataBuffer,
        
        #[cfg(feature = "physics")]
        physics_runtime: &mut PhysicsRuntime,
        
        diagnostic: &mut Diagnostic
    ) -> Self {
        let reader = BoneMetadataReader::new(buffer);

        let mut bone_arena: Vec<MmdRuntimeBone> = Vec::with_capacity(reader.bone_count() as usize);
        for i in 0..reader.bone_count() {
            bone_arena.push(MmdRuntimeBone::new(i));
        }
        let mut bone_arena = bone_arena.into_boxed_slice();

        let mut append_transform_solver_arena = Vec::with_capacity(reader.append_transform_count() as usize);
        let mut ik_solver_arena = Vec::with_capacity(reader.ik_count() as usize);

        let mut diagnostic = diagnostic.writer();
        
        let reader = reader.enumerate(|i, metadata| {
            {
                let bone = &mut bone_arena[i as usize];
                bone.rest_position = metadata.rest_position;
                bone.absolute_inverse_bind_matrix = metadata.absolute_inverse_bind_matrix;
                bone.transform_order = metadata.transform_order;
                bone.transform_after_physics = metadata.flag & BoneFlag::TransformAfterPhysics as u16 != 0;
                bone.axis_limit = metadata.axis_limit.map(|axis_limit| axis_limit.normalize_or_zero().into());
            }

            if 0 <= metadata.parent_bone_index && metadata.parent_bone_index < bone_arena.len() as i32 {
                let parent_bone = &mut bone_arena[metadata.parent_bone_index as usize];
                parent_bone.child_bones.push(i);
                let bone: &mut MmdRuntimeBone = &mut bone_arena[i as usize];
                bone.parent_bone = Some(metadata.parent_bone_index as u32);
            }
            
            if let Some(append_transform) = metadata.append_transform {
                let target_bone_index = append_transform.parent_index;
                if 0 <= target_bone_index && target_bone_index < bone_arena.len() as i32 {
                    let append_transform_solver = AppendTransformSolver::new(
                        target_bone_index as u32,
                        metadata.flag,
                        append_transform.ratio,
                    );
                    let bone = &mut bone_arena[i as usize];
                    bone.append_transform_solver = Some(append_transform_solver_arena.len() as u32);
                    append_transform_solver_arena.push(append_transform_solver);
                } else {
                    diagnostic.error(format!("Invalid append transform target bone index: {}", target_bone_index));
                }
            }

            if let Some(ik) = metadata.ik {
                if 0 <= ik.target && ik.target < bone_arena.len() as i32 {
                    let mut ik_solver = IkSolver::new(
                        ik.iteration,
                        ik.rotation_constraint,
                        i,
                        ik.target as u32,
                        ik.links.len() as u32,
                    );

                    for link in ik.links {
                        if 0 <= link.target && link.target < bone_arena.len() as i32 {
                            ik_solver.add_ik_chain(
                                UncheckedSliceMut::new(&mut bone_arena),
                                link.target as u32,
                                link.limits,
                            );
                        } else {
                            diagnostic.error(format!("Invalid IK link bone index: {}", link.target));
                        }
                    }
                    bone_arena[i as usize].ik_solver = Some(ik_solver_arena.len() as u32);
                    ik_solver_arena.push(ik_solver);
                } else {
                    diagnostic.error(format!("Invalid IK target bone index: {}", ik.target));
                }
            }
        });
    
        let (morphs, mut reader) = reader.read();
        let animation_arena = AnimationArena::new(&bone_arena, ik_solver_arena.len() as u32, morphs.len() as u32);
        let morph_controller = MmdMorphController::new(morphs.into_boxed_slice());

        let mut is_physics_bone = vec![false; bone_arena.len()];
        
        reader.for_each(|metadata| {
            if metadata.physics_mode != RigidbodyPhysicsMode::FollowBone as u8 && 0 <= metadata.bone_index && metadata.bone_index < bone_arena.len() as i32 {
                is_physics_bone[metadata.bone_index as usize] = true;
            }
        });

        #[cfg(feature = "physics")]
        let mut physics_model_context = None;

        #[cfg(not(feature = "physics"))]
        {
            if let PhysicsInfoKind::FullPhysics = reader.physics_info_kind() {
                diagnostic.error("This wasm runtime does not support integrated physics. Please use other binary e.g. MmdWasmInstanceTypeMPR".to_string());
            }
        }
        #[cfg(feature = "physics")]
        {
            let build_physics = if let PhysicsInfoKind::FullPhysics = reader.physics_info_kind()  { true } else { false };
            if build_physics {
                reader.rewind();
                physics_model_context = Some(
                    physics_runtime.build_physics_object(&bone_arena, reader, diagnostic)
                );
            }
        }

        for ik_solver in ik_solver_arena.iter_mut() {
            ik_solver.initialize_ik_skip_flag(UncheckedSlice::new(&is_physics_bone));
        }

        let mut sorted_runtime_bones = Vec::with_capacity(bone_arena.len());
        for i in 0..bone_arena.len() as u32 {
            sorted_runtime_bones.push(i);
        }
        sorted_runtime_bones.sort_by(|a, b| {
            let a = &bone_arena[(*a) as usize];
            let b = &bone_arena[(*b) as usize];
            a.transform_order.cmp(&b.transform_order)
        });

        let mut bone_max_depth = 0;
        for i in 0..bone_arena.len() {
            let bone = &bone_arena[sorted_runtime_bones[i] as usize];
            if bone.parent_bone.is_none() {
                fn calc_depth(bone_arena: &[MmdRuntimeBone], bone: u32, depth: u32) -> u32 {
                    let bone = &bone_arena[bone as usize];
                    let mut max_depth = depth;
                    for child_bone in &bone.child_bones {
                        max_depth = max_depth.max(calc_depth(bone_arena, *child_bone, depth + 1));
                    }
                    max_depth
                }
                bone_max_depth = bone_max_depth.max(calc_depth(&bone_arena, sorted_runtime_bones[i], 1));
            }
        }

        MmdModel {
            runtime_animation: None,
            animation_arena,
            bone_arena: MmdRuntimeBoneArena::new(bone_arena),
            append_transform_solver_arena: AppendTransformSolverArena::new(append_transform_solver_arena.into_boxed_slice()),
            ik_solver_arena: IkSolverArena::new(ik_solver_arena.into_boxed_slice()),
            morph_controller,
            sorted_runtime_bones: sorted_runtime_bones.into_boxed_slice(),
            bone_stack: Some(Vec::with_capacity(bone_max_depth as usize)),
            external_physics: false,

            #[cfg(feature = "physics")]
            physics_model_context,
        }
    }

    #[inline]
    pub(crate) fn runtime_animation_mut(&mut self) -> &mut Option<NonNull<MmdRuntimeAnimation>> {
        unsafe {
            &mut *(&mut self.runtime_animation as *mut Option<NonZeroUsize> as *mut Option<NonNull<MmdRuntimeAnimation>>)
        }
    }

    #[inline]
    pub(crate) fn animation_arena_mut(&mut self) -> &mut AnimationArena {
        &mut self.animation_arena
    }

    #[inline]
    pub(crate) fn bone_arena(&self) -> &MmdRuntimeBoneArena {
        &self.bone_arena
    }

    #[inline]
    pub(crate) fn bone_arena_mut(&mut self) -> &mut MmdRuntimeBoneArena {
        &mut self.bone_arena
    }

    #[inline]
    pub(crate) fn external_physics_mut(&mut self) -> &mut bool {
        &mut self.external_physics
    }

    pub(crate) fn before_physics(&mut self, frame_time: Option<f32>) {
        if let Some(frame_time) = frame_time {
            if let Some(runtime_animation) = self.runtime_animation {
                let runtime_animation: &mut MmdRuntimeAnimation = unsafe {
                    &mut *(runtime_animation.get() as *mut MmdRuntimeAnimation)
                };
                runtime_animation.animate(frame_time, self);
            }
        }

        #[cfg(debug_assertions)]
        {
            let animation_bone_arena = &mut self.animation_arena_mut().bone_arena_mut();
            for i in 0..animation_bone_arena.len() as u32 {
                let bone_animation = &mut animation_bone_arena[i];
                bone_animation.rotation = bone_animation.rotation.normalize();
            }
        }

        self.morph_controller.update(&mut self.bone_arena, self.animation_arena.morph_arena());
        
        self.bone_arena.reset_world_matrices();
        for i in 0..self.sorted_runtime_bones.len() {
            let bone_index = self.sorted_runtime_bones[i];
            let bone = &mut self.bone_arena.arena_mut()[bone_index];
            bone.reset_state();
        }
        self.append_transform_solver_arena.reset_state();
        self.update(false);
    }

    pub(crate) fn after_physics(&mut self) {
        self.update(true);
    }

    fn update(&mut self, after_physics_stage: bool) {
        for i in 0..self.sorted_runtime_bones.len() {
            let bone_index = self.sorted_runtime_bones[i];
            let bone = &mut self.bone_arena.arena_mut()[bone_index];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            let compute_ik = if let Some(ik_solver) = bone.ik_solver {
                if self.animation_arena.iksolver_state_arena()[ik_solver] != 0 {
                    true
                } else {
                    false
                }
            } else {
                false
            };

            self.update_world_matrix(bone_index, self.external_physics, compute_ik);
        }
    }
}
