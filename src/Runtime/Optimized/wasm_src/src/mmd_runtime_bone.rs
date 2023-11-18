use nalgebra::{Vector3, UnitQuaternion, Matrix4 };

use crate::{ik_solver::IkSolver, append_transform_solver::AppendTransformSolver};

pub(crate) struct MmdRuntimeBone<'a> {
    rest_position: Vector3<f32>,
    position: Vector3<f32>,
    rotation: UnitQuaternion<f32>,
    scale: Vector3<f32>,

    name: String,
    parent_bone: Option<&'a mut MmdRuntimeBone<'a>>,
    child_bones: Vec<&'a mut MmdRuntimeBone<'a>>,
    transform_order: i32,
    flag: u16,
    transform_after_physics: bool,

    pub append_transform_solver: Option<AppendTransformSolver<'a>>,
    ik_solver: Option<IkSolver<'a>>,

    morph_position_offset: Option<Vector3<f32>>,
    morph_rotation_offset: Option<UnitQuaternion<f32>>,

    pub ik_rotation: Option<UnitQuaternion<f32>>,

    local_matrix: Matrix4<f32>,
    world_matrix: Matrix4<f32>,
}

impl MmdRuntimeBone<'_> {
    fn new<'a>(name: String, rest_position: Vector3<f32>) -> MmdRuntimeBone<'a> {
        MmdRuntimeBone {
            rest_position,
            position: Vector3::zeros(),
            rotation: UnitQuaternion::identity(),
            scale: Vector3::new(1.0, 1.0, 1.0),
            
            name,
            parent_bone: None,
            child_bones: Vec::new(),
            transform_order: 0,
            flag: 0,
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

    pub fn get_animated_position(&self) -> Vector3<f32> {
        let mut position = self.position;
        if let Some(morph_position_offset) = self.morph_position_offset {
            position += morph_position_offset;
        }
        position
    }

    pub fn get_animated_rotation(&self) -> UnitQuaternion<f32> {
        let mut rotation = self.rotation;
        if let Some(morph_rotation_offset) = self.morph_rotation_offset {
            rotation = rotation * morph_rotation_offset;
        }
        rotation
    }

    pub fn get_animation_position_offset(&self) -> Vector3<f32> {
        let mut position = Vector3::zeros();
        if let Some(morph_position_offset) = self.morph_position_offset {
            position += morph_position_offset;
        }
        position - self.rest_position
    }

    pub fn update_local_matrix(&mut self) {
        let mut rotation = self.get_animated_rotation();
        if let Some(ik_rotation) = self.ik_rotation {
            rotation = ik_rotation * rotation;
        }

        let mut position = self.get_animated_position();
        
        if let Some(append_transform_solver) = &self.append_transform_solver {
            if append_transform_solver.is_affect_rotation() {
                rotation *= append_transform_solver.get_append_rotation_offset();
            }
            if append_transform_solver.is_affect_position() {
                position += append_transform_solver.get_append_position_offset();
            }
        }

        self.local_matrix = 
            Matrix4::new_translation(&position) *
            rotation.to_homogeneous() *
            Matrix4::new_nonuniform_scaling(&self.scale);
    }

    pub fn update_world_matrix(&mut self) {
        let mut stack = Vec::new();
        stack.push(self);

        while let Some(bone) = stack.pop() {
            if let Some(parent_bone) = &bone.parent_bone {
                bone.world_matrix = parent_bone.world_matrix * bone.local_matrix;
            } else {
                bone.world_matrix = bone.local_matrix;
            }

            for child_bone in &mut bone.child_bones {
                stack.push(child_bone);
            }
        }
    }
}
