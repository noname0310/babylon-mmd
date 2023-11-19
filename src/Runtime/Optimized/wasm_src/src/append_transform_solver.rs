use nalgebra::{UnitQuaternion, Vector3};

use crate::mmd_runtime_bone::MmdRuntimeBone;

pub(crate) struct AppendTransformSolver<'a> {
    is_local: bool,
    affect_rotation: bool,
    affect_position: bool,
    ratio: f32,

    bone: &'a mut MmdRuntimeBone<'a>,
    target_bone: &'a mut MmdRuntimeBone<'a>,

    append_position_offset: Vector3<f32>,
    append_rotation_offset: UnitQuaternion<f32>,
}

impl<'a> AppendTransformSolver<'a> {
    pub fn new(
        bone: &'a mut MmdRuntimeBone<'a>,
        target_bone: &'a mut MmdRuntimeBone<'a>,
        is_local: bool,
        affect_rotation: bool,
        affect_position: bool,
        ratio: f32,
    ) -> AppendTransformSolver<'a> {
        AppendTransformSolver {
            is_local,
            affect_rotation,
            affect_position,
            ratio,
            bone,
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

    pub fn update(&mut self) {
        if self.affect_rotation {
            let mut rotation = if self.is_local {
                self.target_bone.animated_rotation()
            } else {
                if let Some(append_transform_solver) = &self.target_bone.append_transform_solver {
                    append_transform_solver.append_rotation_offset
                } else {
                    self.target_bone.animated_rotation()
                }
            };

            if let Some(ik_rotation) = &self.target_bone.ik_rotation {
                rotation = ik_rotation * rotation;
            }

            self.append_rotation_offset = UnitQuaternion::identity().slerp(&rotation, self.ratio);
        }

        if self.affect_position {
            let position = if self.is_local {
                self.target_bone.animated_position()
            } else {
                if let Some(append_transform_solver) = &self.target_bone.append_transform_solver {
                    append_transform_solver.append_position_offset
                } else {
                    self.target_bone.animated_position()
                }
            };

            self.append_position_offset = position * self.ratio;
        }
    }
}
