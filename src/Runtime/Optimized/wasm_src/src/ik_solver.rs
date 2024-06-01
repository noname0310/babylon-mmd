use glam::{Vec3, Vec3A, Mat3, Quat};

use crate::ik_chain_info::IkChainInfo;
use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};
use crate::mmd_runtime_bone::{MmdRuntimeBone, MmdRuntimeBoneArena};
use crate::mmd_model_metadata::IkChainAngleLimits;
use crate::animation_arena::AnimationArena;
use crate::append_transform_solver::AppendTransformSolverArena;

pub(crate) struct IkSolverArena {
    arena: Box<[IkSolver]>,    
}

impl IkSolverArena {
    pub(crate) fn new(arena: Box<[IkSolver]>) -> Self {
        IkSolverArena {
            arena,
        }
    }

    #[inline]
    pub(crate) fn arena(&self) -> UncheckedSlice<IkSolver> {
        UncheckedSlice::new(&self.arena)
    }
    
    pub(crate) fn solve(
        ik_solver_arena: &IkSolverArena,
        ik_solver_index: u32,
        animation_arena: &AnimationArena,
        bone_arena: &mut MmdRuntimeBoneArena,
        append_transform_solver_arena: &mut AppendTransformSolverArena,
        use_physics: bool,
    ) {
        let solver = &ik_solver_arena.arena()[ik_solver_index];
        if solver.ik_chains.is_empty() {
            return;
        }

        for chain in &solver.ik_chains {
            let chain_bone = &mut bone_arena.arena_mut()[chain.bone];
            *chain_bone.ik_chain_info.as_mut().unwrap().ik_rotation_mut() = Quat::IDENTITY;
        };

        let ik_position = Vec3A::from(bone_arena.world_matrices()[solver.ik_bone].w_axis);

        MmdRuntimeBoneArena::update_world_matrix(
            bone_arena,
            solver.target_bone,
            animation_arena,
            append_transform_solver_arena,
            ik_solver_arena,
            use_physics,
            true,
        );
        let mut target_position = Vec3A::from(bone_arena.world_matrices()[solver.target_bone].w_axis);

        if ik_position.distance_squared(target_position) < 1.0e-8 {
            return;
        }

        // update ik chain, target bone world matrix
        for chain in solver.ik_chains.iter().rev() {
            MmdRuntimeBoneArena::update_world_matrix(
                bone_arena,
                chain.bone,
                animation_arena,
                append_transform_solver_arena,
                ik_solver_arena,
                use_physics,
                false,
            );
        }
        MmdRuntimeBoneArena::update_world_matrix(
            bone_arena,
            solver.target_bone,
            animation_arena,
            append_transform_solver_arena,
            ik_solver_arena,
            false,
            false,
        );
        target_position = Vec3A::from(bone_arena.world_matrices()[solver.target_bone].w_axis);

        if ik_position.distance_squared(target_position) < 1.0e-8 {
            return;
        }

        let iteration = solver.iteration;
        let half_iteration = iteration >> 1;
        for i in 0..iteration {
            for chain_index in 0..solver.ik_chains.len() {
                let chain = &solver.ik_chains[chain_index];
                if chain.solve_axis != SolveAxis::Fixed {
                    target_position = IkSolverArena::solve_chain(
                        ik_solver_arena,
                        ik_solver_index,
                        chain_index as u32,
                        animation_arena,
                        bone_arena,
                        append_transform_solver_arena,
                        ik_position,
                        target_position,
                        i < half_iteration,
                    );
                }
            }
            if ik_position.distance_squared(target_position) < 1.0e-8 {
                break;
            }
        }
    }

    #[allow(clippy::too_many_arguments)] // can be improved in the future
    fn solve_chain(
        ik_solver_arena: &IkSolverArena,
        ik_solver_index: u32,
        ik_chain_index: u32,
        animation_arena: &AnimationArena,
        bone_arena: &mut MmdRuntimeBoneArena,
        append_transform_solver_arena: &mut AppendTransformSolverArena,
        ik_position: Vec3A,
        target_position: Vec3A,
        use_axis: bool,
    ) -> Vec3A {
        let chain = &ik_solver_arena.arena()[ik_solver_index].ik_chains[ik_chain_index as usize];

        let chain_position = Vec3A::from(bone_arena.world_matrices()[chain.bone].w_axis);
        let chain_target_vector = (chain_position - target_position).normalize();
        let chain_ik_vector = (chain_position - ik_position).normalize();

        let chain_rotation_axis = chain_target_vector.cross(chain_ik_vector);
        if chain_rotation_axis.length_squared() < 1.0e-8 {
            return target_position;
        }
        
        let chain_parent_rotation_matrix = if let Some(parent_bone) = bone_arena.arena()[chain.bone].parent_bone {
            Mat3::from_mat4(bone_arena.world_matrices()[parent_bone])
        } else {
            Mat3::IDENTITY
        };
        let chain_rotation_axis = if let (Some(_), true) = (&chain.angle_limits, use_axis) {
            match chain.solve_axis {
                // SolveAxis::None => (chain_parent_rotation_matrix.transpose() * chain_rotation_axis).normalize(),
                SolveAxis::X => {
                    let dot = chain_rotation_axis.dot(chain_parent_rotation_matrix.x_axis.into());
                    Vec3A::new(
                        if 0.0 <= dot { 1.0 } else { -1.0 },
                        0.0,
                        0.0,
                    )
                },
                SolveAxis::Y => {
                    let dot = chain_rotation_axis.dot(chain_parent_rotation_matrix.y_axis.into());
                    Vec3A::new(
                        0.0,
                        if 0.0 <= dot { 1.0 } else { -1.0 },
                        0.0,
                    )
                },
                SolveAxis::Z => {
                    let dot = chain_rotation_axis.dot(chain_parent_rotation_matrix.z_axis.into());
                    Vec3A::new(
                        0.0,
                        0.0,
                        if 0.0 <= dot { 1.0 } else { -1.0 },
                    )
                }
                _ => {
                    (chain_parent_rotation_matrix.transpose() * chain_rotation_axis).normalize()
                },
            }
        } else {
            (chain_parent_rotation_matrix.transpose() * chain_rotation_axis).normalize()
        };

        let dot = chain_target_vector.dot(chain_ik_vector).clamp(-1.0, 1.0);

        let solver = &ik_solver_arena.arena()[ik_solver_index];

        let angle = (solver.limit_angle * ((ik_chain_index + 1) as f32)).min(dot.acos());
        let ik_rotation = Quat::from_axis_angle(chain_rotation_axis.into(), angle);
        *bone_arena.arena_mut()[chain.bone].ik_chain_info.as_mut().unwrap().ik_rotation_mut() =
            ik_rotation * bone_arena.arena()[chain.bone].ik_chain_info.as_ref().unwrap().ik_rotation();

        if let Some(angle_limits) = &chain.angle_limits {
            if let Some(ik_chain_info) = &mut bone_arena.arena_mut()[chain.bone].ik_chain_info {
                let chain_rotation = Mat3::from_quat(ik_chain_info.local_rotation() * ik_chain_info.ik_rotation());
                let threshold = 88.0 * std::f32::consts::PI / 180.0;
                
                let new_ik_rotation = match chain.rotation_order {
                    EulerRotationOrder::Yxz => {
                        let r_x = (-chain_rotation.z_axis.y).asin();
                        let r_x = if r_x.abs() > threshold {
                            if r_x < 0.0 { -threshold } else { threshold }
                        } else {
                            r_x
                        };
                        let cos_x = r_x.cos();
                        let cos_x = if cos_x != 0.0 { 1.0 / cos_x } else { cos_x };
                        let r_y = (chain_rotation.z_axis.x * cos_x).atan2(chain_rotation.z_axis.z * cos_x);
                        let r_z = (chain_rotation.x_axis.y * cos_x).atan2(chain_rotation.y_axis.y * cos_x);
                        let (r_x, r_y, r_z) = {
                            let min = angle_limits.minimum_angle;
                            let max = angle_limits.maximum_angle;
                            (
                                IkSolverArena::limit_angle(r_x, min.x, max.x, use_axis),
                                IkSolverArena::limit_angle(r_y, min.y, max.y, use_axis),
                                IkSolverArena::limit_angle(r_z, min.z, max.z, use_axis),
                            )
                        };

                        Quat::from_axis_angle(Vec3::Y, r_y) *
                            Quat::from_axis_angle(Vec3::X, r_x) *
                            Quat::from_axis_angle(Vec3::Z, r_z)
                    }
                    EulerRotationOrder::Zyx => {
                        let r_y = (-chain_rotation.x_axis.z).asin();
                        let r_y = if r_y.abs() > threshold {
                            if r_y < 0.0 { -threshold } else { threshold }
                        } else {
                            r_y
                        };
                        let cos_y = r_y.cos();
                        let cos_y = if cos_y != 0.0 { 1.0 / cos_y } else { cos_y };
                        let r_x = (chain_rotation.y_axis.z * cos_y).atan2(chain_rotation.z_axis.z * cos_y);
                        let r_z = (chain_rotation.x_axis.y * cos_y).atan2(chain_rotation.x_axis.x * cos_y);
                        let (r_x, r_y, r_z) = {
                            let min = angle_limits.minimum_angle;
                            let max = angle_limits.maximum_angle;
                            (
                                IkSolverArena::limit_angle(r_x, min.x, max.x, use_axis),
                                IkSolverArena::limit_angle(r_y, min.y, max.y, use_axis),
                                IkSolverArena::limit_angle(r_z, min.z, max.z, use_axis),
                            )
                        };

                        Quat::from_axis_angle(Vec3::Z, r_z) *
                            Quat::from_axis_angle(Vec3::Y, r_y) *
                            Quat::from_axis_angle(Vec3::X, r_x)
                    }
                    EulerRotationOrder::Xzy => {
                        let r_z = (-chain_rotation.y_axis.x).asin();
                        let r_z = if r_z.abs() > threshold {
                            if r_z < 0.0 { -threshold } else { threshold }
                        } else {
                            r_z
                        };
                        let cos_z = r_z.cos();
                        let cos_z = if cos_z != 0.0 { 1.0 / cos_z } else { cos_z };
                        let r_x = (chain_rotation.y_axis.z * cos_z).atan2(chain_rotation.y_axis.y * cos_z);
                        let r_y = (chain_rotation.z_axis.x * cos_z).atan2(chain_rotation.x_axis.x * cos_z);
                        let (r_x, r_y, r_z) = {
                            let min = angle_limits.minimum_angle;
                            let max = angle_limits.maximum_angle;
                            (
                                IkSolverArena::limit_angle(r_x, min.x, max.x, use_axis),
                                IkSolverArena::limit_angle(r_y, min.y, max.y, use_axis),
                                IkSolverArena::limit_angle(r_z, min.z, max.z, use_axis),
                            )
                        };

                        Quat::from_axis_angle(Vec3::X, r_x) *
                            Quat::from_axis_angle(Vec3::Z, r_z) *
                            Quat::from_axis_angle(Vec3::Y, r_y)
                    }
                };

                let inverted_local_rotation = ik_chain_info.local_rotation().inverse();
                *ik_chain_info.ik_rotation_mut() = new_ik_rotation * inverted_local_rotation;
            } else {
                unreachable!("ik_chain_info is None");
            }
        }

        for i in (0..=ik_chain_index).rev() {
            MmdRuntimeBoneArena::update_world_matrix_for_ik_chain(
                bone_arena,
                solver.ik_chains[i as usize].bone,
                animation_arena,
            );
        }
        MmdRuntimeBoneArena::update_world_matrix(
            bone_arena,
            solver.target_bone,
            animation_arena,
            append_transform_solver_arena,
            ik_solver_arena,
            false,
            false,
        );
        Vec3A::from(bone_arena.world_matrices()[solver.target_bone].w_axis)
    }

    fn limit_angle(
        angle: f32,
        min: f32,
        max: f32,
        use_axis: bool,
    ) -> f32 {
        if angle < min {
            let diff = 2.0 * min - angle;
            if diff <= max && use_axis { diff } else { min }
        } else if angle > max {
            let diff = 2.0 * max - angle;
            if diff >= min && use_axis { diff } else { max }
        } else {
            angle
        }
    }
}

enum EulerRotationOrder {
    Yxz,
    Zyx,
    Xzy,
}

#[derive(PartialEq)]
enum SolveAxis {
    None,
    Fixed,
    X,
    Y,
    Z,
}

struct IkChain {
    bone: u32,
    angle_limits: Option<IkChainAngleLimits>,
    rotation_order: EulerRotationOrder,
    solve_axis: SolveAxis,
}

impl IkChain {
    fn new(
        bone: u32,
        angle_limits: Option<IkChainAngleLimits>,
    ) -> Self {
        if let Some(angle_limits) = angle_limits {
            let min = Vec3A::min(angle_limits.minimum_angle, angle_limits.maximum_angle);
            let max = Vec3A::max(angle_limits.minimum_angle, angle_limits.maximum_angle);

            let half_pi = std::f32::consts::PI * 0.5;
            let rotation_order = if -half_pi < min.x && max.x < half_pi {
                EulerRotationOrder::Yxz
            } else if -half_pi < min.y && max.y < half_pi {
                EulerRotationOrder::Zyx
            } else /* if -half_pi < minimum_angle.z && maximum_angle.z < half_pi */ {
                EulerRotationOrder::Xzy
            };

            let solve_axis = if min.x == 0.0 && max.x == 0.0 && min.y == 0.0 && max.y == 0.0 && min.z == 0.0 && max.z == 0.0 {
                SolveAxis::Fixed
            } else if min.y == 0.0 && max.y == 0.0 && min.z == 0.0 && max.z == 0.0 {
                SolveAxis::X
            } else if min.x == 0.0 && max.x == 0.0 && min.z == 0.0 && max.z == 0.0 {
                SolveAxis::Y
            } else if min.x == 0.0 && max.x == 0.0 && min.y == 0.0 && max.y == 0.0 {
                SolveAxis::Z
            } else {
                SolveAxis::None
            };

            IkChain {
                bone,
                angle_limits: Some(IkChainAngleLimits {
                    minimum_angle: min,
                    maximum_angle: max,
                }),
                rotation_order,
                solve_axis,
            }
        } else {
            IkChain {
                bone,
                angle_limits,
                rotation_order: EulerRotationOrder::Xzy, // not used
                solve_axis: SolveAxis::None,
            }
        }
    }
}

pub(crate) struct IkSolver {
    iteration: i32,
    limit_angle: f32,

    ik_bone: u32,
    target_bone: u32,
    ik_chains: Vec<IkChain>,

    can_skip_when_physics_enabled: bool,
}

impl IkSolver {
    pub(crate) fn new(
        iteration: i32,
        limit_angle: f32,
        ik_bone: u32,
        target_bone: u32,
        chain_capacity: u32,
    ) -> IkSolver {
        IkSolver {
            iteration: iteration.min(256),
            limit_angle,
            ik_bone,
            target_bone,
            ik_chains: Vec::with_capacity(chain_capacity as usize),
            can_skip_when_physics_enabled: false,
        }
    }

    pub(crate) fn add_ik_chain(
        &mut self,
        mut arena: UncheckedSliceMut<MmdRuntimeBone>,
        bone: u32,
        angle_limits: Option<IkChainAngleLimits>,
    ) {
        let ik_chain = IkChain::new(bone, angle_limits);
        self.ik_chains.push(ik_chain);

        let bone = &mut arena[bone];
        bone.ik_chain_info = Some(IkChainInfo::new());
    }

    pub(crate) fn initialize_ik_skip_flag(&mut self, is_physics_bone: UncheckedSlice<bool>) {
        self.can_skip_when_physics_enabled = true;
        for chain in &mut self.ik_chains {
            if !is_physics_bone[chain.bone] {
                self.can_skip_when_physics_enabled = false;
                break;
            }
        }
    }

    pub(crate) fn can_skip_when_physics_enabled(&self) -> bool {
        self.can_skip_when_physics_enabled
    }
}
