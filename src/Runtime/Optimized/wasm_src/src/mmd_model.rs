use std::cell::RefCell;

use nalgebra::{Vector3, UnitQuaternion};

use crate::{mmd_runtime_bone::MmdRuntimeBone, mmd_model_metadata::{MetadataBuffer, BoneMetadataReader, BoneFlag}, append_transform_solver::AppendTransformSolver, ik_solver::IkSolver, animation_arena::AnimationArena, mmd_morph_controller::MmdMorphController};

pub(crate) struct MmdModel {
    animation_arena: AnimationArena,
    bone_arena: Box<[MmdRuntimeBone]>,
    morph_controller: MmdMorphController,
    sorted_runtime_bones: Box<[usize]>,
    sorted_runtime_root_bones: Box<[usize]>,
    bone_stack: Vec<usize>,
}

impl MmdModel {
    pub fn new(buffer: MetadataBuffer) -> Self {
        let reader = BoneMetadataReader::new(buffer);

        let mut bone_arena: Vec<MmdRuntimeBone> = Vec::with_capacity(reader.count() as usize);
        for i in 0..reader.count() {
            bone_arena.push(MmdRuntimeBone::new(i as usize));
        }
        let mut bone_arena = bone_arena.into_boxed_slice();
        
        let reader = reader.enumerate(|i, metadata| {
            let i = i as usize;

            {
                let bone = &mut bone_arena[i];
                bone.rest_position = metadata.rest_position;
                bone.transform_order = metadata.transform_order;
                bone.transform_after_physics = metadata.flag & BoneFlag::TransformAfterPhysics as u16 != 0;
            }

            if 0 <= metadata.parent_bone_index && metadata.parent_bone_index < bone_arena.len() as i32 {
                let parent_bone = &mut bone_arena[metadata.parent_bone_index as usize];
                parent_bone.child_bones.push(i);
                let bone: &mut MmdRuntimeBone = &mut bone_arena[i];
                bone.parent_bone = Some(metadata.parent_bone_index as usize);
            }
            
            if let Some(append_transform) = metadata.append_transform {
                let target_bone_index = append_transform.parent_index;
                if 0 <= target_bone_index && target_bone_index < bone_arena.len() as i32 {
                    let append_transform_solver = AppendTransformSolver::new(
                        target_bone_index as usize,
                        metadata.flag,
                        append_transform.ratio,
                    );
                    let bone = &mut bone_arena[i];
                    bone.append_transform_solver = Some(RefCell::new(append_transform_solver));
                } else {
                    // todo diagnostic
                    panic!();
                }
            }

            if let Some(ik) = metadata.ik {
                if 0 <= ik.target && ik.target < bone_arena.len() as i32 {
                    let mut ik_solver = IkSolver::new(
                        i,
                        ik.target as usize,
                        ik.links.len(),
                    );
                    ik_solver.iteration = ik.iteration;
                    ik_solver.limit_angle = ik.rotation_constraint;

                    for link in ik.links {
                        if 0 <= link.target && link.target < bone_arena.len() as i32 {
                            ik_solver.add_ik_chain(
                                &mut bone_arena,
                                link.target as usize,
                                link.limits,
                            );
                        } else {
                            // todo diagnostic
                            panic!();
                        }
                    }
                    bone_arena[i].ik_solver = Some(RefCell::new(ik_solver));
                } else {
                    // todo diagnostic
                    panic!();
                }
            }
        });
    
        let (morphs, reader) = reader.read();
        let animation_arena = AnimationArena::new(bone_arena.len(), morphs.len());
        let morph_controller = MmdMorphController::new(morphs.into_boxed_slice());

        let reader = reader.for_each(|metadata| {
            // todo add physics
        });

        reader.for_each(|metadata| {
            // todo add physics
        });

        let mut sorted_runtime_bones = Vec::with_capacity(bone_arena.len());
        for i in 0..sorted_runtime_bones.len() {
            sorted_runtime_bones.push(i);
        }
        sorted_runtime_bones.sort_by(|a, b| {
            let a = &bone_arena[*a];
            let b = &bone_arena[*b];
            a.transform_order.cmp(&b.transform_order)
        });

        let mut sorted_runtime_root_bones = Vec::with_capacity(bone_arena.len());
        for i in 0..sorted_runtime_bones.len() {
            let bone = &bone_arena[sorted_runtime_bones[i]];
            if bone.parent_bone.is_none() {
                sorted_runtime_root_bones.push(i);
            }
        }

        let mut bone_max_depth = 0;
        for root in sorted_runtime_root_bones.iter() {
            fn calc_depth(bone_arena: &[MmdRuntimeBone], bone: usize, depth: usize) -> usize {
                let bone = &bone_arena[bone];
                let mut max_depth = depth;
                for child_bone in &bone.child_bones {
                    max_depth = max_depth.max(calc_depth(bone_arena, *child_bone, depth + 1));
                }
                max_depth
            }
            bone_max_depth = bone_max_depth.max(calc_depth(&bone_arena, sorted_runtime_bones[*root], 1));
        }

        MmdModel {
            animation_arena,
            bone_arena,
            morph_controller,
            sorted_runtime_bones: sorted_runtime_bones.into_boxed_slice(),
            sorted_runtime_root_bones: sorted_runtime_root_bones.into_boxed_slice(),
            bone_stack: Vec::with_capacity(bone_max_depth),
        }
    }

    pub fn animation_arena(&self) -> &AnimationArena {
        &self.animation_arena
    }

    pub fn bone_arena(&mut self) -> &mut [MmdRuntimeBone] {
        &mut self.bone_arena
    }

    pub fn animated_position(&self, bone_index: usize) -> Vector3<f32> {
        self.bone_arena[bone_index].animated_position(&self.animation_arena)
    }

    pub fn animated_rotation(&self, bone_index: usize) -> UnitQuaternion<f32> {
        self.bone_arena[bone_index].animated_rotation(&self.animation_arena)
    }

    pub fn update_local_matrix(&mut self, bone_index: usize) {
        let bone = &mut self.bone_arena[bone_index];
        bone.update_local_matrix(&self.animation_arena);
    }

    pub fn update_world_matrix(&mut self, root: usize) {
        let stack = &mut self.bone_stack;
        stack.push(root);

        while let Some(bone) = stack.pop() {
            if let Some(parent_bone) = self.bone_arena[bone].parent_bone {
                let parent_world_matrix = self.bone_arena[parent_bone].world_matrix;

                let bone = &mut self.bone_arena[bone];
                bone.world_matrix = parent_world_matrix * bone.local_matrix;
            } else {
                let bone = &mut self.bone_arena[bone];
                bone.world_matrix = bone.local_matrix;
            }

            let bone = &self.bone_arena[bone];
            for child_bone in &bone.child_bones {
                stack.push(*child_bone);
            }
        }
    }

    pub fn before_physics(&mut self) {
        self.morph_controller.update(&mut self.bone_arena, self.animation_arena.morph_arena());
        self.update(false);
    }

    pub fn after_physics(&mut self) {
        self.update(true);
    }

    fn update(&mut self, after_physics_stage: bool) {
        for bone in self.sorted_runtime_bones.iter() {
            let bone = &mut self.bone_arena[*bone];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            bone.update_local_matrix(&self.animation_arena);
        }

        for i in 0..self.sorted_runtime_root_bones.len() {
            let bone_index = self.sorted_runtime_root_bones[i];
            let bone = &mut self.bone_arena[bone_index];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            self.update_world_matrix(bone_index);
        }

        for i in 0..self.sorted_runtime_bones.len() {
            let bone_index = self.sorted_runtime_bones[i];
            let bone = &self.bone_arena[bone_index];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            if let Some(append_transform_solver) = &bone.append_transform_solver {
                append_transform_solver.borrow_mut().update(&self.bone_arena, &self.animation_arena);
                let bone = &mut self.bone_arena[bone_index];
                bone.update_local_matrix(&self.animation_arena);
                self.update_world_matrix(bone_index);
            }

            let bone = &mut self.bone_arena[bone_index];
            if let Some(ik_solver) = &mut bone.ik_solver {
                if self.animation_arena.iksolver_state_arena()[bone_index] {
                    // ik_solver.solve(self);
                }
                self.update_world_matrix(bone_index);
            }
        }

        for i in 0..self.sorted_runtime_root_bones.len() {
            let bone_index = self.sorted_runtime_root_bones[i];
            let bone = &mut self.bone_arena[bone_index];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            self.update_world_matrix(bone_index);
        }
    }
}
