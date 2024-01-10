use nalgebra::{Vector3, UnitQuaternion, Matrix4 };

use crate::animation_arena::AnimationArena;
use crate::append_transform_solver::AppendTransformSolverArena;

pub(crate) struct MmdRuntimeBoneArena {
    arena: Box<[MmdRuntimeBone]>,
    world_matrix_arena: Box<[Matrix4<f32>]>,
    world_matrix_back_buffer: Option<Box<[Matrix4<f32>]>>,
    bone_stack: Vec<u32>,
}

impl MmdRuntimeBoneArena {
    pub fn new(arena: Box<[MmdRuntimeBone]>, bone_stack: Vec<u32>) -> Self {
        let bone_count = arena.len();
        MmdRuntimeBoneArena {
            arena,
            world_matrix_arena: vec![Matrix4::identity(); bone_count].into_boxed_slice(),
            world_matrix_back_buffer: None,
            bone_stack,
        }
    }

    pub fn world_matrix_arena_ptr(&mut self) -> *mut f32 {
        self.world_matrix_arena.as_mut_ptr() as *mut f32
    }

    pub(crate) fn create_world_matrix_back_buffer(&mut self) -> &mut [Matrix4<f32>] {
        self.world_matrix_back_buffer = Some(vec![Matrix4::identity(); self.world_matrix_arena.len()].into_boxed_slice());
        self.world_matrix_back_buffer.as_mut().unwrap()
    }

    pub(crate) fn swap_buffer(&mut self) {
        let mut back_buffer = self.world_matrix_back_buffer.take().unwrap();
        std::mem::swap(&mut self.world_matrix_arena, &mut back_buffer);
        self.world_matrix_back_buffer = Some(back_buffer);
    }

    pub fn world_matrix(&self, index: u32) -> &Matrix4<f32> {
        &self.world_matrix_arena[index as usize]
    }

    pub fn update_world_matrix(&mut self, root: u32) {
        let stack = &mut self.bone_stack;
        stack.push(root);

        while let Some(bone) = stack.pop() {
            if let Some(parent_bone) = self.arena[bone as usize].parent_bone {
                let parent_world_matrix = self.world_matrix_arena[parent_bone as usize];
                self.world_matrix_arena[bone as usize] = parent_world_matrix * self.arena[bone as usize].local_matrix;
            } else {
                self.world_matrix_arena[bone as usize] = self.arena[bone as usize].local_matrix;
            }

            let bone = &self.arena[bone as usize];
            for child_bone in &bone.child_bones {
                stack.push(*child_bone);
            }
        }
    }
}

impl std::ops::Deref for MmdRuntimeBoneArena {
    type Target = [MmdRuntimeBone];

    fn deref(&self) -> &Self::Target {
        &self.arena
    }
}

impl std::ops::DerefMut for MmdRuntimeBoneArena {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.arena
    }
}

pub(crate) struct MmdRuntimeBone {
    pub rest_position: Vector3<f32>,
    index: u32,

    pub parent_bone: Option<u32>,
    pub child_bones: Vec<u32>,
    pub transform_order: i32,
    pub transform_after_physics: bool,

    pub append_transform_solver: Option<u32>,
    pub ik_solver: Option<u32>,

    pub morph_position_offset: Option<Vector3<f32>>,
    pub morph_rotation_offset: Option<UnitQuaternion<f32>>,

    pub ik_rotation: Option<UnitQuaternion<f32>>,

    pub local_matrix: Matrix4<f32>,
}

impl MmdRuntimeBone {
    pub fn new(index: u32) -> Self {
        MmdRuntimeBone {
            rest_position: Vector3::zeros(),
            index,
            
            parent_bone: None,
            child_bones: Vec::new(),
            transform_order: 0,
            transform_after_physics: false,

            append_transform_solver: None,
            ik_solver: None,

            morph_position_offset: None,
            morph_rotation_offset: None,

            ik_rotation: None,

            local_matrix: Matrix4::identity(),
        }
    }

    pub fn animated_position(&self, animation_arena: &AnimationArena) -> Vector3<f32> {
        let mut position = *animation_arena.bone_position(self.index);
        if let Some(morph_position_offset) = self.morph_position_offset {
            position += morph_position_offset;
        }
        position
    }

    pub fn animated_rotation(&self, animation_arena: &AnimationArena) -> UnitQuaternion<f32> {
        let mut rotation = *animation_arena.bone_rotation(self.index);
        if let Some(morph_rotation_offset) = self.morph_rotation_offset {
            rotation *= morph_rotation_offset;
        }
        rotation
    }

    pub fn animation_position_offset(&self, animation_arena: &AnimationArena) -> Vector3<f32> {
        self.animated_position(animation_arena) - self.rest_position
    }

    pub fn update_local_matrix(&mut self, animation_arena: &AnimationArena, append_transform_solver_arena: &AppendTransformSolverArena) {
        let mut rotation = self.animated_rotation(animation_arena);
        if let Some(ik_rotation) = self.ik_rotation {
            rotation = ik_rotation * rotation;
        }

        let mut position = self.animated_position(animation_arena);
        
        if let Some(append_transform_solver) = self.append_transform_solver {
            let append_transform_solver = &append_transform_solver_arena[append_transform_solver as usize];

            if append_transform_solver.is_affect_rotation() {
                rotation *= append_transform_solver.append_rotation_offset();
            }
            if append_transform_solver.is_affect_position() {
                position += append_transform_solver.append_position_offset();
            }
        }

        self.local_matrix = 
            Matrix4::new_translation(&position) *
            rotation.to_homogeneous() *
            Matrix4::new_nonuniform_scaling(animation_arena.bone_scale(self.index));
    }
}
