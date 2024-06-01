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

    pub(crate) fn reset_state(&mut self) {
        for solver in self.arena_mut().iter_mut() {
            solver.append_position = Vec3A::ZERO;
            solver.append_rotation = Quat::IDENTITY;
        }
    }

    pub(crate) fn update(
        &mut self,
        index: u32,
        animation_arena: &AnimationArena,
        bone_arena: &mut MmdRuntimeBoneArena,
        animated_rotation: Quat,
        animated_position: Vec3A,
    ) {
        let solver = &self.arena()[index];

        if solver.affect_rotation {
            let mut append_rotation = if solver.is_local {
                Quat::from_mat4(&bone_arena.world_matrices()[solver.target_bone])
            } else {
                let target_bone = &mut bone_arena.arena_mut()[solver.target_bone];

                if let Some(append_transform_solver) = target_bone.append_transform_solver {
                    let target_solver = &self.arena()[append_transform_solver];
                    if target_solver.affect_rotation {
                        target_solver.append_rotation
                    } else {
                        target_bone.animated_rotation(animation_arena)
                    }
                } else {
                    target_bone.animated_rotation(animation_arena)
                }
            };

            let target_bone = &mut bone_arena.arena_mut()[solver.target_bone];
            if let Some(ik_chain_info) = &target_bone.ik_chain_info {
                append_rotation = ik_chain_info.ik_rotation() * append_rotation
            };

            if solver.ratio != 1.0 {
                append_rotation = Quat::IDENTITY.slerp(append_rotation, solver.ratio);
            }

            append_rotation = animated_rotation * append_rotation;

            let solver = &mut self.arena_mut()[index];
            solver.append_rotation = append_rotation;
        }

        let solver = &self.arena()[index];

        if solver.affect_position {
            let mut append_position = if solver.is_local {
                let target_bone_world_matrix = bone_arena.world_matrices()[solver.target_bone];
                let absolute_inverse_bind_matrix = bone_arena.arena()[solver.target_bone].absolute_inverse_bind_matrix;
                Vec3A::from((absolute_inverse_bind_matrix * target_bone_world_matrix).w_axis)
            } else {
                let target_bone = &mut bone_arena.arena_mut()[solver.target_bone];

                if let Some(append_transform_solver) = target_bone.append_transform_solver {
                    let target_solver = &self.arena()[append_transform_solver];
                    if target_solver.affect_position {
                        target_solver.append_position
                    } else {
                        target_bone.animation_position_offset(animation_arena)
                    }
                } else {
                    target_bone.animation_position_offset(animation_arena)
                }
            };

            if solver.ratio != 1.0 {
                append_position *= solver.ratio;
            }

            append_position += animated_position;

            let solver = &mut self.arena_mut()[index];
            solver.append_position = append_position;
        }
    }
}

pub(crate) struct AppendTransformSolver {
    is_local: bool,
    affect_rotation: bool,
    affect_position: bool,
    ratio: f32,

    target_bone: u32,

    append_position: Vec3A,
    append_rotation: Quat,
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
            append_position: Vec3A::ZERO,
            append_rotation: Quat::IDENTITY,
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
    pub(crate) fn append_position(&self) -> Vec3A {
        self.append_position
    }

    #[inline]
    pub(crate) fn append_rotation(&self) -> Quat {
        self.append_rotation
    }
}
