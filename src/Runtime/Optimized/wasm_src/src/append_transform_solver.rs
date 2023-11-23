use nalgebra::{UnitQuaternion, Vector3};

use crate::{mmd_runtime_bone::MmdRuntimeBone, mmd_model_metadata::BoneFlag};

pub(crate) struct AppendTransformSolver {
    is_local: bool,
    affect_rotation: bool,
    affect_position: bool,
    ratio: f32,

    target_bone: usize,

    append_position_offset: Vector3<f32>,
    append_rotation_offset: UnitQuaternion<f32>,
}

impl AppendTransformSolver {
    pub fn new(
        target_bone: usize,
        bone_flag: u16,
        ratio: f32,
    ) -> Self {
        AppendTransformSolver {
            is_local: bone_flag & BoneFlag::LocalAppendTransform as u16 != 0,
            affect_rotation: bone_flag & BoneFlag::HasAppendRotate as u16 != 0,
            affect_position: bone_flag & BoneFlag::HasAppendMove as u16 != 0,
            ratio,
            target_bone,
            append_position_offset: Vector3::zeros(),
            append_rotation_offset: UnitQuaternion::identity(),
        }
    }

    pub fn is_affect_rotation(&self) -> bool {
        self.affect_rotation
    }

    pub fn is_affect_position(&self) -> bool {
        self.affect_position
    }

    pub fn append_position_offset(&self) -> &Vector3<f32> {
        &self.append_position_offset
    }

    pub fn append_rotation_offset(&self) -> &UnitQuaternion<f32> {
        &self.append_rotation_offset
    }

    pub fn update(&mut self, arena: &[MmdRuntimeBone]) {
        let target_bone = &arena[self.target_bone];

        if self.affect_rotation {
            let mut rotation = if self.is_local {
                target_bone.animated_rotation()
            } else if let Some(append_transform_solver) = &target_bone.append_transform_solver {
                append_transform_solver.append_rotation_offset
            } else {
                target_bone.animated_rotation()
            };

            if let Some(ik_rotation) = &target_bone.ik_rotation {
                rotation = ik_rotation * rotation;
            }

            self.append_rotation_offset = UnitQuaternion::identity().slerp(&rotation, self.ratio);
        }

        if self.affect_position {
            let position = if self.is_local {
                target_bone.animated_position()
            } else if let Some(append_transform_solver) = &target_bone.append_transform_solver {
                append_transform_solver.append_position_offset
            } else {
                target_bone.animated_position()
            };

            self.append_position_offset = position * self.ratio;
        }
    }
}
