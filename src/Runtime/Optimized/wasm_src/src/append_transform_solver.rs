use glam::{Quat, Vec3A};

use crate::mmd_runtime_bone::MmdRuntimeBoneArena;
use crate::mmd_model_metadata::BoneFlag;
use crate::animation_arena::AnimationArena;
use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};

pub(crate) struct AppendTransformSolverArena {
    arena: Box<[AppendTransformSolver]>,
}

impl AppendTransformSolverArena {
    pub(crate) fn new(arena: Box<[AppendTransformSolver]>) -> Self {
        AppendTransformSolverArena {
            arena,
        }
    }

    #[inline]
    pub(crate) fn arena(&self) -> UncheckedSlice<AppendTransformSolver> {
        UncheckedSlice::new(&self.arena)
    }

    #[inline]
    pub(crate) fn arena_mut(&mut self) -> UncheckedSliceMut<AppendTransformSolver> {
        UncheckedSliceMut::new(&mut self.arena)
    }

    pub(crate) fn update(&mut self, index: u32, animation_arena: &AnimationArena, bone_arena: &MmdRuntimeBoneArena) {
        let solver = &self.arena()[index];
        let target_bone = &bone_arena.arena()[solver.target_bone];

        if solver.affect_rotation {
            let mut rotation = if solver.is_local {
                target_bone.animated_rotation(animation_arena)
            } else if let Some(append_transform_solver) = target_bone.append_transform_solver {
                self.arena()[append_transform_solver].append_rotation_offset
            } else {
                target_bone.animated_rotation(animation_arena)
            };

            if let Some(ik_rotation) = target_bone.ik_rotation {
                rotation = ik_rotation * rotation;
            }

            let solver = &mut self.arena_mut()[index];
            solver.append_rotation_offset = Quat::IDENTITY.slerp(rotation, solver.ratio);
        }

        let solver = &mut self.arena_mut()[index];
        if solver.affect_position {
            let position = if solver.is_local {
                target_bone.animation_position_offset(animation_arena)
            } else if let Some(append_transform_solver) = target_bone.append_transform_solver {
                self.arena()[append_transform_solver].append_position_offset
            } else {
                target_bone.animation_position_offset(animation_arena)
            };

            let solver = &mut self.arena_mut()[index];
            solver.append_position_offset = position * solver.ratio;
        }
    }
}

pub(crate) struct AppendTransformSolver {
    is_local: bool,
    affect_rotation: bool,
    affect_position: bool,
    ratio: f32,

    target_bone: u32,

    append_position_offset: Vec3A,
    append_rotation_offset: Quat,
}

impl AppendTransformSolver {
    pub(crate) fn new(
        target_bone: u32,
        bone_flag: u16,
        ratio: f32,
    ) -> Self {
        AppendTransformSolver {
            is_local: bone_flag & BoneFlag::LocalAppendTransform as u16 != 0,
            affect_rotation: bone_flag & BoneFlag::HasAppendRotate as u16 != 0,
            affect_position: bone_flag & BoneFlag::HasAppendMove as u16 != 0,
            ratio,
            target_bone,
            append_position_offset: Vec3A::ZERO,
            append_rotation_offset: Quat::IDENTITY,
        }
    }

    #[inline]
    pub(crate) fn is_affect_rotation(&self) -> bool {
        self.affect_rotation
    }

    #[inline]
    pub(crate) fn is_affect_position(&self) -> bool {
        self.affect_position
    }

    #[inline]
    pub(crate) fn append_position_offset(&self) -> Vec3A {
        self.append_position_offset
    }

    #[inline]
    pub(crate) fn append_rotation_offset(&self) -> Quat {
        self.append_rotation_offset
    }
}
