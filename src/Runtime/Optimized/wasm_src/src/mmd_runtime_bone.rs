use std::cell::RefCell;

use nalgebra::{Vector3, UnitQuaternion, Matrix4 };

use crate::{ik_solver::IkSolver, append_transform_solver::AppendTransformSolver, animation_arena::AnimationArena};

pub(crate) struct MmdRuntimeBone {
    pub rest_position: Vector3<f32>,
    index: usize,

    pub parent_bone: Option<usize>,
    pub child_bones: Vec<usize>,
    pub transform_order: i32,
    pub transform_after_physics: bool,

    pub append_transform_solver: Option<RefCell<AppendTransformSolver>>,
    pub ik_solver: Option<RefCell<IkSolver>>,

    pub morph_position_offset: Option<Vector3<f32>>,
    pub morph_rotation_offset: Option<UnitQuaternion<f32>>,

    pub ik_rotation: Option<UnitQuaternion<f32>>,

    pub local_matrix: Matrix4<f32>,
    pub world_matrix: Matrix4<f32>,
}

impl MmdRuntimeBone {
    pub fn new(index: usize) -> Self {
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
            world_matrix: Matrix4::identity(),
        }
    }

    pub fn animated_position(&self, animation_arena: &AnimationArena) -> Vector3<f32> {
        let mut position = animation_arena.nth_bone_position(self.index);
        if let Some(morph_position_offset) = self.morph_position_offset {
            position += morph_position_offset;
        }
        position
    }

    pub fn animated_rotation(&self, animation_arena: &AnimationArena) -> UnitQuaternion<f32> {
        let mut rotation = animation_arena.nth_bone_rotation(self.index);
        if let Some(morph_rotation_offset) = self.morph_rotation_offset {
            rotation *= morph_rotation_offset;
        }
        rotation
    }

    pub fn animation_position_offset(&self) -> Vector3<f32> {
        let mut position = Vector3::zeros();
        if let Some(morph_position_offset) = self.morph_position_offset {
            position += morph_position_offset;
        }
        position - self.rest_position
    }

    pub fn update_local_matrix(&mut self, animation_arena: &AnimationArena) {
        let mut rotation = self.animated_rotation(animation_arena);
        if let Some(ik_rotation) = self.ik_rotation {
            rotation = ik_rotation * rotation;
        }

        let mut position = self.animated_position(animation_arena);
        
        if let Some(append_transform_solver) = &self.append_transform_solver {
            let append_transform_solver = append_transform_solver.borrow();
            
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
            Matrix4::new_nonuniform_scaling(&animation_arena.nth_bone_scale(self.index));
    }
}
