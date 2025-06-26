use glam::{Vec3, Vec3A, Mat4, Quat};

use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};

use super::{animation_arena::AnimationArena, ik_chain_info::IkChainInfo, MmdModel};

pub(crate) struct MmdRuntimeBoneArena {
    arena: Box<[MmdRuntimeBone]>,
    world_matrix_arena: Box<[Mat4]>,
    world_matrix_back_buffer: Option<Box<[Mat4]>>,
}

impl MmdRuntimeBoneArena {
    pub(super) fn new(arena: Box<[MmdRuntimeBone]>) -> Self {
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

    pub(super) fn reset_world_matrices(&mut self) {
        for world_matrix in self.world_matrices_mut().iter_mut() {
            *world_matrix = Mat4::IDENTITY;
        }
    }
}

pub(crate) struct MmdRuntimeBone {
    pub(super) rest_position: Vec3A,
    pub(super) absolute_inverse_bind_matrix: Mat4,
    index: u32,

    pub(super) parent_bone: Option<u32>,
    pub(super) child_bones: Vec<u32>,
    pub(super) transform_order: i32,
    pub(super) transform_after_physics: bool,

    pub(super) append_transform_solver: Option<u32>,
    pub(super) axis_limit: Option<Vec3>,
    pub(super) ik_solver: Option<u32>,

    pub(super) morph_position_offset: Option<Vec3A>,
    pub(super) morph_rotation_offset: Option<Quat>,

    pub(super) ik_chain_info: Option<IkChainInfo>,

    pub(super) rigidbody_indices: Box<[u32]>,
}

impl MmdRuntimeBone {
    pub(super) fn new(index: u32) -> Self {
        MmdRuntimeBone {
            rest_position: Vec3A::ZERO,
            absolute_inverse_bind_matrix: Mat4::IDENTITY,
            index,
            
            parent_bone: None,
            child_bones: Vec::new(),
            transform_order: 0,
            transform_after_physics: false,

            append_transform_solver: None,
            axis_limit: None,
            ik_solver: None,

            morph_position_offset: None,
            morph_rotation_offset: None,

            ik_chain_info: None,

            rigidbody_indices: Box::new([]),
        }
    }

    #[inline]
    pub(crate) fn rest_position(&self) -> Vec3A {
        self.rest_position
    }

    #[inline]
    pub(crate) fn absolute_inverse_bind_matrix(&self) -> &Mat4 {
        &self.absolute_inverse_bind_matrix
    }

    #[inline]
    pub(crate) fn parent_bone(&self) -> Option<u32> {
        self.parent_bone
    }

    #[inline]
    #[allow(dead_code)]
    pub(crate) fn rigidbody_indices(&self) -> &[u32] {
        &self.rigidbody_indices
    }

    pub(super) fn animated_position(&self, animation_arena: &AnimationArena) -> Vec3A {
        let mut position = animation_arena.bone_arena()[self.index].position;
        if let Some(morph_position_offset) = self.morph_position_offset {
            position += morph_position_offset;
        }
        position
    }

    pub(super) fn animated_rotation(&self, animation_arena: &AnimationArena) -> Quat {
        let mut rotation = animation_arena.bone_arena()[self.index].rotation;
        
        // MMD's implementation transforms the rotation axis to fit the axis limit of the target skeleton at animation load time.
        // However, that method makes it impossible to apply one animation data to multiple models,
        // so we use an implementation that performs the axis transformation at runtime.
        if let Some(axis_limit) = self.axis_limit {
            if axis_limit == Vec3::ZERO {
                return Quat::IDENTITY;
            }

            let (animation_axis, mut angle) = rotation.to_axis_angle();
            if animation_axis.dot(axis_limit) < 0.0 {
                angle = -angle;
            }
            rotation = Quat::from_axis_angle(axis_limit, angle);
        }

        if let Some(morph_rotation_offset) = self.morph_rotation_offset {
            rotation = morph_rotation_offset * rotation;
        }
        rotation
    }

    #[inline]
    pub(super) fn animation_position_offset(&self, animation_arena: &AnimationArena) -> Vec3A {
        self.animated_position(animation_arena) - self.rest_position
    }

    pub(super) fn reset_state(&mut self) {
        if let Some(ik_chain_info) = &mut self.ik_chain_info {
            ik_chain_info.reset_state();
        }
    }
}

impl MmdModel {
    pub(super) fn update_world_matrix(&mut self, bone_index: u32, use_physics: bool, compute_ik: bool) {
        let bone = &self.bone_arena.arena()[bone_index];

        let mut rotation = bone.animated_rotation(&self.animation_arena);
        let mut position = bone.animation_position_offset(&self.animation_arena);

        if let Some(append_transform_solver) = bone.append_transform_solver {
            self.append_transform_solver_arena.update(
                append_transform_solver,
                &self.animation_arena,
                &mut self.bone_arena,
                rotation,
                position
            );
            let append_transform_solver = &self.append_transform_solver_arena.arena()[append_transform_solver];

            if append_transform_solver.is_affect_rotation() {
                rotation = append_transform_solver.append_rotation();
            }
            if append_transform_solver.is_affect_position() {
                position = append_transform_solver.append_position();
            }
        }

        let bone = &mut self.bone_arena.arena_mut()[bone_index];
        
        if let Some(ik_chain_info) = &mut bone.ik_chain_info {
            *ik_chain_info.local_rotation_mut() = rotation;
            *ik_chain_info.local_position_mut() = position;
            
            rotation = ik_chain_info.ik_rotation() * rotation;
        }

        let local_scale = self.animation_arena.bone_arena()[bone_index].scale;
        let local_position = position + bone.rest_position;

        let local_matrix = if local_scale.x != 1.0 || local_scale.y != 1.0 || local_scale.z != 1.0 {
            Mat4::from_scale_rotation_translation(local_scale.into(), rotation, local_position.into())
        } else {
            Mat4::from_rotation_translation(rotation, local_position.into())
        };

        let world_matrix = if let Some(parent_bone) = bone.parent_bone {
            let parent_world_matrix = self.bone_arena.world_matrices()[parent_bone];
            parent_world_matrix * local_matrix
        } else {
            local_matrix
        };
        
        self.bone_arena.world_matrices_mut()[bone_index] = world_matrix;

        let bone = &mut self.bone_arena.arena_mut()[bone_index];

        if compute_ik {
            if let Some(ik_solver_index) = bone.ik_solver {
                let ik_solver = &self.ik_solver_arena.arena()[ik_solver_index];
                if !(use_physics && ik_solver.can_skip_when_physics_enabled()) {
                    self.solve_ik(ik_solver_index, use_physics);
                }
            }
        }
    }

    pub(super) fn update_ik_chain_world_matrix(&mut self, bone_index: u32) {
        let bone = &self.bone_arena.arena()[bone_index];
        let ik_chain_info = bone.ik_chain_info.as_ref().unwrap();

        let rotation = ik_chain_info.ik_rotation() * ik_chain_info.local_rotation();

        let local_scale = self.animation_arena.bone_arena()[bone_index].scale;
        let local_position = ik_chain_info.local_position() + bone.rest_position;

        let local_matrix = if local_scale.x != 1.0 || local_scale.y != 1.0 || local_scale.z != 1.0 {
            Mat4::from_scale_rotation_translation(local_scale.into(), rotation, local_position.into())
        } else {
            Mat4::from_rotation_translation(rotation, local_position.into())
        };

        let world_matrix = if let Some(parent_bone) = bone.parent_bone {
            let parent_world_matrix = self.bone_arena.world_matrices()[parent_bone];
            parent_world_matrix * local_matrix
        } else {
            local_matrix
        };
        
        self.bone_arena.world_matrices_mut()[bone_index] = world_matrix;

        let bone = &self.bone_arena.arena()[bone_index];
        for i in 0..bone.child_bones.len() {
            let child_bone = self.bone_arena.arena()[bone_index].child_bones[i];
            self.update_world_matrix_recursive(child_bone);
        }
    }

    fn update_world_matrix_recursive(&mut self, bone_index: u32) {
        let mut bone_stack = self.bone_stack.take().unwrap();
        bone_stack.clear();

        bone_stack.push(bone_index);
        while let Some(bone_index) = bone_stack.pop() {
            self.update_world_matrix(bone_index, false, false);

            let bone = &self.bone_arena().arena()[bone_index];
            for &child_bone in bone.child_bones.iter() {
                bone_stack.push(child_bone);
            }
        }

        self.bone_stack = Some(bone_stack);
    }
}
