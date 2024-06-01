use glam::{Vec3A, Mat4, Quat};

use crate::animation_arena::AnimationArena;
use crate::append_transform_solver::AppendTransformSolverArena;
use crate::ik_chain_info::IkChainInfo;
use crate::ik_solver::IkSolverArena;
use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};

pub(crate) struct MmdRuntimeBoneArena {
    arena: Box<[MmdRuntimeBone]>,
    world_matrix_arena: Box<[Mat4]>,
    world_matrix_back_buffer: Option<Box<[Mat4]>>,
}

impl MmdRuntimeBoneArena {
    pub(crate) fn new(arena: Box<[MmdRuntimeBone]>) -> Self {
        let bone_count = arena.len();
        MmdRuntimeBoneArena {
            arena,
            world_matrix_arena: vec![Mat4::IDENTITY; bone_count].into_boxed_slice(),
            world_matrix_back_buffer: None,
        }
    }
    
    #[inline]
    pub(crate) fn arena(&self) -> UncheckedSlice<MmdRuntimeBone> {
        UncheckedSlice::new(&self.arena)
    }

    #[inline]
    pub(crate) fn arena_mut(&mut self) -> UncheckedSliceMut<MmdRuntimeBone> {
        UncheckedSliceMut::new(&mut self.arena)
    }

    #[inline]
    pub(crate) fn world_matrix_arena_mut_ptr(&mut self) -> *mut f32 {
        self.world_matrix_arena.as_mut_ptr() as *mut f32
    }

    pub(crate) fn create_world_matrix_back_buffer(&mut self) -> *mut f32 {
        self.world_matrix_back_buffer = Some(vec![Mat4::IDENTITY; self.world_matrix_arena.len()].into_boxed_slice());
        self.world_matrix_back_buffer.as_mut().unwrap().as_mut_ptr() as *mut f32
    }

    pub(crate) fn swap_buffer(&mut self) {
        let mut back_buffer = self.world_matrix_back_buffer.take().unwrap();
        std::mem::swap(&mut self.world_matrix_arena, &mut back_buffer);
        self.world_matrix_back_buffer = Some(back_buffer);
    }

    #[inline]
    pub(crate) fn world_matrices(&self) -> UncheckedSlice<Mat4> {
        UncheckedSlice::new(&self.world_matrix_arena)
    }

    #[inline]
    pub(crate) fn world_matrices_mut(&mut self) -> UncheckedSliceMut<Mat4> {
        UncheckedSliceMut::new(&mut self.world_matrix_arena)
    }

    pub(crate) fn reset_world_matrices(&mut self) {
        for world_matrix in self.world_matrices_mut().iter_mut() {
            *world_matrix = Mat4::IDENTITY;
        }
    }

    pub(crate) fn update_world_matrix(
        bone_arena: &mut MmdRuntimeBoneArena,
        bone_index: u32,
        animation_arena: &AnimationArena,
        append_transform_solver_arena: &mut AppendTransformSolverArena,
        iksolver_arena: &IkSolverArena,
        use_physics: bool,
        compute_ik: bool,
    ) {
        let bone = &bone_arena.arena()[bone_index];

        let mut rotation = bone.animated_rotation(animation_arena);
        let mut position = bone.animation_position_offset(animation_arena);

        if let Some(append_transform_solver) = bone.append_transform_solver {
            append_transform_solver_arena.update(
                append_transform_solver,
                animation_arena,
                bone_arena,
                rotation,
                position
            );
            let append_transform_solver = &append_transform_solver_arena.arena()[append_transform_solver];

            if append_transform_solver.is_affect_rotation() {
                rotation = append_transform_solver.append_rotation();
            }
            if append_transform_solver.is_affect_position() {
                position = append_transform_solver.append_position();
            }
        }

        let bone = &mut bone_arena.arena_mut()[bone_index];
        
        if let Some(ik_chain_info) = &mut bone.ik_chain_info {
            *ik_chain_info.local_rotation_mut() = rotation;
            *ik_chain_info.local_position_mut() = position;
            
            rotation = ik_chain_info.ik_rotation() * rotation;
        }

        let local_scale = animation_arena.bone_arena()[bone_index].scale;
        let local_position = position + bone.rest_position;

        let local_matrix = if local_scale.x != 1.0 || local_scale.y != 1.0 || local_scale.z != 1.0 {
            Mat4::from_scale_rotation_translation(local_scale.into(), rotation, local_position.into())
        } else {
            Mat4::from_rotation_translation(rotation, local_position.into())
        };

        let world_matrix = if let Some(parent_bone) = bone.parent_bone {
            let parent_world_matrix = bone_arena.world_matrices()[parent_bone];
            parent_world_matrix * local_matrix
        } else {
            local_matrix
        };
        
        bone_arena.world_matrices_mut()[bone_index] = world_matrix;

        let bone = &mut bone_arena.arena_mut()[bone_index];

        if compute_ik {
            if let Some(ik_solver) = bone.ik_solver {
                let ik_solver = &iksolver_arena.arena()[ik_solver];
                if !(use_physics && ik_solver.can_skip_when_physics_enabled()) {
                    ik_solver.solve(animation_arena, bone_arena, append_transform_solver_arena, use_physics);
                }
            }
        }
    }
}

pub(crate) struct MmdRuntimeBone {
    pub(crate) rest_position: Vec3A,
    pub(crate) absolute_inverse_bind_matrix: Mat4,
    index: u32,

    pub(crate) parent_bone: Option<u32>,
    pub(crate) transform_order: i32,
    pub(crate) transform_after_physics: bool,

    pub(crate) append_transform_solver: Option<u32>,
    pub(crate) ik_solver: Option<u32>,

    pub(crate) morph_position_offset: Option<Vec3A>,
    pub(crate) morph_rotation_offset: Option<Quat>,

    pub(crate) ik_chain_info: Option<IkChainInfo>,
}

impl MmdRuntimeBone {
    pub(crate) fn new(index: u32) -> Self {
        MmdRuntimeBone {
            rest_position: Vec3A::ZERO,
            absolute_inverse_bind_matrix: Mat4::IDENTITY,
            index,
            
            parent_bone: None,
            transform_order: 0,
            transform_after_physics: false,

            append_transform_solver: None,
            ik_solver: None,

            morph_position_offset: None,
            morph_rotation_offset: None,

            ik_chain_info: None,
        }
    }

    pub(crate) fn animated_position(&self, animation_arena: &AnimationArena) -> Vec3A {
        let mut position = animation_arena.bone_arena()[self.index].position;
        if let Some(morph_position_offset) = self.morph_position_offset {
            position += morph_position_offset;
        }
        position
    }

    pub(crate) fn animated_rotation(&self, animation_arena: &AnimationArena) -> Quat {
        let mut rotation = animation_arena.bone_arena()[self.index].rotation;
        if let Some(morph_rotation_offset) = self.morph_rotation_offset {
            rotation = morph_rotation_offset * rotation;
        }
        rotation
    }

    #[inline]
    pub(crate) fn animation_position_offset(&self, animation_arena: &AnimationArena) -> Vec3A {
        self.animated_position(animation_arena) - self.rest_position
    }

    pub(crate) fn reset_state(&mut self) {
        if let Some(ik_chain_info) = &mut self.ik_chain_info {
            ik_chain_info.reset_state();
        }
    }
}
