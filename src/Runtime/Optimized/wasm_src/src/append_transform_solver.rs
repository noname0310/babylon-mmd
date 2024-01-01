use nalgebra::{UnitQuaternion, Vector3};

use crate::{mmd_runtime_bone::MmdRuntimeBoneArena, mmd_model_metadata::BoneFlag, animation_arena::AnimationArena};

pub(crate) struct AppendTransformSolverArena {
    arena: Box<[AppendTransformSolver]>,
}

impl AppendTransformSolverArena {
    pub fn new(arena: Box<[AppendTransformSolver]>) -> Self {
        AppendTransformSolverArena {
            arena,
        }
    }

    pub fn update(&mut self, index: usize, animation_arena: &AnimationArena, bone_arena: &MmdRuntimeBoneArena) {
        let solver = &self.arena[index];
        let target_bone = &bone_arena[solver.target_bone];

        if solver.affect_rotation {
            let mut rotation = if solver.is_local {
                target_bone.animated_rotation(animation_arena)
            } else if let Some(append_transform_solver) = target_bone.append_transform_solver {
                self.arena[append_transform_solver].append_rotation_offset
            } else {
                target_bone.animated_rotation(animation_arena)
            };

            if let Some(ik_rotation) = &target_bone.ik_rotation {
                rotation = ik_rotation * rotation;
            }

            let solver = &mut self.arena[index];
            solver.append_rotation_offset = UnitQuaternion::identity().slerp(&rotation, solver.ratio);
        }

        let solver = &self.arena[index];
        if solver.affect_position {
            let position = if solver.is_local {
                target_bone.animation_position_offset(animation_arena)
            } else if let Some(append_transform_solver) = target_bone.append_transform_solver {
                self.arena[append_transform_solver].append_position_offset
            } else {
                target_bone.animation_position_offset(animation_arena)
            };

            let solver = &mut self.arena[index];
            solver.append_position_offset = position * solver.ratio;
        }
    }
}

impl std::ops::Deref for AppendTransformSolverArena {
    type Target = [AppendTransformSolver];

    fn deref(&self) -> &Self::Target {
        &self.arena
    }
}

impl std::ops::DerefMut for AppendTransformSolverArena {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.arena
    }
}

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
}
