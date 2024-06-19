use glam::{Vec3A, Mat3, Quat, DVec3, DMat3, DQuat};

use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};
use crate::mmd_model_metadata::IkChainAngleLimits;

use super::ik_chain_info::IkChainInfo;
use super::mmd_runtime_bone::MmdRuntimeBone;
use super::MmdModel;

pub(super) struct IkSolverArena {
    arena: Box<[IkSolver]>,    
}

impl IkSolverArena {
    pub(super) fn new(arena: Box<[IkSolver]>) -> Self {
        IkSolverArena {
            arena,
        }
    }

    #[inline]
    pub(super) fn arena(&self) -> UncheckedSlice<IkSolver> {
        UncheckedSlice::new(&self.arena)
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
    pub(super) fn new(
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

    pub(super) fn add_ik_chain(
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

    pub(super) fn initialize_ik_skip_flag(&mut self, is_physics_bone: UncheckedSlice<bool>) {
        self.can_skip_when_physics_enabled = true;
        for chain in &mut self.ik_chains {
            if !is_physics_bone[chain.bone] {
                self.can_skip_when_physics_enabled = false;
                break;
            }
        }
    }

    #[inline]
    pub(super) fn can_skip_when_physics_enabled(&self) -> bool {
        self.can_skip_when_physics_enabled
    }
}

impl MmdModel {
    pub(super) fn solve_ik(
        &mut self,
        ik_solver_index: u32,
        use_physics: bool,
    ) {
        let solver = &self.ik_solver_arena.arena()[ik_solver_index];
        if solver.ik_chains.is_empty() {
            return;
        }

        for chain in &solver.ik_chains {
            let chain_bone = &mut self.bone_arena.arena_mut()[chain.bone];
            *chain_bone.ik_chain_info.as_mut().unwrap().ik_rotation_mut() = Quat::IDENTITY;
        };

        let ik_position = self.bone_arena.world_matrices()[solver.ik_bone].w_axis.truncate().as_dvec3();

        self.update_world_matrix(solver.target_bone, use_physics, true);
        
        let solver = &self.ik_solver_arena.arena()[ik_solver_index];
        let mut target_position = self.bone_arena.world_matrices()[solver.target_bone].w_axis.truncate().as_dvec3();

        if ik_position.distance_squared(target_position) < 1.0e-8 {
            return;
        }

        // update ik chain, target bone world matrix
        for chain_index in (0..solver.ik_chains.len()).rev() {
            let solver = &self.ik_solver_arena.arena()[ik_solver_index];
            let chain = &solver.ik_chains[chain_index];
            self.update_world_matrix(chain.bone, use_physics, false);
        }
        let solver = &self.ik_solver_arena.arena()[ik_solver_index];
        self.update_world_matrix(solver.target_bone, false, false);
        let solver = &self.ik_solver_arena.arena()[ik_solver_index];
        target_position = self.bone_arena.world_matrices()[solver.target_bone].w_axis.truncate().as_dvec3();

        if ik_position.distance_squared(target_position) < 1.0e-8 {
            return;
        }

        let iteration = solver.iteration;
        let half_iteration = iteration >> 1;
        for i in 0..iteration {
            let solver = &self.ik_solver_arena.arena()[ik_solver_index];
            for chain_index in 0..solver.ik_chains.len() {
                let solver = &self.ik_solver_arena.arena()[ik_solver_index];
                let chain = &solver.ik_chains[chain_index];
                if chain.solve_axis != SolveAxis::Fixed {
                    target_position = self.solve_ik_chain(
                        ik_solver_index,
                        chain_index as u32,
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

    fn solve_ik_chain(
        &mut self,
        ik_solver_index: u32,
        ik_chain_index: u32,
        ik_position: DVec3,
        target_position: DVec3,
        use_axis: bool,
    ) -> DVec3 {
        let solver = &self.ik_solver_arena.arena()[ik_solver_index];
        let chain = &solver.ik_chains[ik_chain_index as usize];

        let chain_position = self.bone_arena.world_matrices()[chain.bone].w_axis.truncate().as_dvec3();
        let chain_target_vector = (chain_position - target_position).normalize_or_zero();
        let chain_ik_vector = (chain_position - ik_position).normalize_or_zero();

        let chain_rotation_axis = chain_target_vector.cross(chain_ik_vector);
        if chain_rotation_axis.length_squared() < 1.0e-8 {
            return target_position;
        }
        
        let chain_parent_rotation_matrix = if let Some(parent_bone) = self.bone_arena.arena()[chain.bone].parent_bone() {
            Mat3::from_mat4(self.bone_arena.world_matrices()[parent_bone]).as_dmat3()
        } else {
            DMat3::IDENTITY
        };
        let chain_rotation_axis = if let (Some(_), true) = (&chain.angle_limits, use_axis) {
            match chain.solve_axis {
                // SolveAxis::None => (chain_parent_rotation_matrix.transpose() * chain_rotation_axis).normalize_or_zero(),
                SolveAxis::X => {
                    let dot = chain_rotation_axis.dot(chain_parent_rotation_matrix.x_axis);
                    DVec3::new(
                        if 0.0 <= dot { 1.0 } else { -1.0 },
                        0.0,
                        0.0,
                    )
                },
                SolveAxis::Y => {
                    let dot = chain_rotation_axis.dot(chain_parent_rotation_matrix.y_axis);
                    DVec3::new(
                        0.0,
                        if 0.0 <= dot { 1.0 } else { -1.0 },
                        0.0,
                    )
                },
                SolveAxis::Z => {
                    let dot = chain_rotation_axis.dot(chain_parent_rotation_matrix.z_axis);
                    DVec3::new(
                        0.0,
                        0.0,
                        if 0.0 <= dot { 1.0 } else { -1.0 },
                    )
                }
                _ => {
                    (chain_parent_rotation_matrix.transpose() * chain_rotation_axis).normalize_or_zero()
                },
            }
        } else {
            (chain_parent_rotation_matrix.transpose() * chain_rotation_axis).normalize_or_zero()
        };

        let dot = chain_target_vector.dot(chain_ik_vector).clamp(-1.0, 1.0);

        let solver = &self.ik_solver_arena.arena()[ik_solver_index];

        let angle = (solver.limit_angle as f64 * ((ik_chain_index + 1) as f64)).min(dot.acos());
        let ik_rotation = DQuat::from_axis_angle(chain_rotation_axis, angle);
        *self.bone_arena.arena_mut()[chain.bone].ik_chain_info.as_mut().unwrap().ik_rotation_mut() =
            (ik_rotation * self.bone_arena.arena()[chain.bone].ik_chain_info.as_ref().unwrap().ik_rotation().as_dquat()).as_quat();

        if let Some(angle_limits) = &chain.angle_limits {
            if let Some(ik_chain_info) = &mut self.bone_arena.arena_mut()[chain.bone].ik_chain_info {
                let chain_rotation = DMat3::from_quat(ik_chain_info.local_rotation().as_dquat() * ik_chain_info.ik_rotation().as_dquat());
                let threshold = 88.0 * std::f64::consts::PI / 180.0;
                
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
                                MmdModel::ik_limit_angle(r_x, min.x as f64, max.x as f64, use_axis),
                                MmdModel::ik_limit_angle(r_y, min.y as f64, max.y as f64, use_axis),
                                MmdModel::ik_limit_angle(r_z, min.z as f64, max.z as f64, use_axis),
                            )
                        };

                        DQuat::from_axis_angle(DVec3::Y, r_y) *
                            DQuat::from_axis_angle(DVec3::X, r_x) *
                            DQuat::from_axis_angle(DVec3::Z, r_z)
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
                                MmdModel::ik_limit_angle(r_x, min.x as f64, max.x as f64, use_axis),
                                MmdModel::ik_limit_angle(r_y, min.y as f64, max.y as f64, use_axis),
                                MmdModel::ik_limit_angle(r_z, min.z as f64, max.z as f64, use_axis),
                            )
                        };

                        DQuat::from_axis_angle(DVec3::Z, r_z) *
                            DQuat::from_axis_angle(DVec3::Y, r_y) *
                            DQuat::from_axis_angle(DVec3::X, r_x)
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
                                MmdModel::ik_limit_angle(r_x, min.x as f64, max.x as f64, use_axis),
                                MmdModel::ik_limit_angle(r_y, min.y as f64, max.y as f64, use_axis),
                                MmdModel::ik_limit_angle(r_z, min.z as f64, max.z as f64, use_axis),
                            )
                        };

                        DQuat::from_axis_angle(DVec3::X, r_x) *
                            DQuat::from_axis_angle(DVec3::Z, r_z) *
                            DQuat::from_axis_angle(DVec3::Y, r_y)
                    }
                };

                let inverted_local_rotation = ik_chain_info.local_rotation().as_dquat().inverse();
                *ik_chain_info.ik_rotation_mut() = (new_ik_rotation * inverted_local_rotation).as_quat();
            } else {
                unreachable!("ik_chain_info is None");
            }
        }

        for i in (0..=ik_chain_index).rev() {
            let solver = &self.ik_solver_arena.arena()[ik_solver_index];
            self.update_ik_chain_world_matrix(solver.ik_chains[i as usize].bone);
        }
        let solver = &self.ik_solver_arena.arena()[ik_solver_index];
        self.update_world_matrix(solver.target_bone, false, false);
        
        let solver = &self.ik_solver_arena.arena()[ik_solver_index];
        self.bone_arena.world_matrices()[solver.target_bone].w_axis.truncate().as_dvec3()
    }

    fn ik_limit_angle(
        angle: f64,
        min: f64,
        max: f64,
        use_axis: bool,
    ) -> f64 {
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
