use glam::{Vec3, Vec3A, Vec4, Mat3, Quat};

use crate::mmd_runtime_bone::{MmdRuntimeBone, MmdRuntimeBoneArena};
use crate::mmd_model_metadata::IkChainAngleLimits;
use crate::animation_arena::AnimationArena;
use crate::append_transform_solver::AppendTransformSolverArena;

pub(crate) struct IkSolverArena {
    arena: Box<[IkSolver]>,    
}

impl IkSolverArena {
    pub fn new(arena: Box<[IkSolver]>) -> Self {
        IkSolverArena {
            arena,
        }
    }
}

impl std::ops::Deref for IkSolverArena {
    type Target = [IkSolver];

    fn deref(&self) -> &Self::Target {
        &self.arena
    }
}

impl std::ops::DerefMut for IkSolverArena {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.arena
    }
}

struct IkChain {
    bone: u32,
    angle_limits: Option<IkChainAngleLimits>,
    prev_angle: Vec3A,
    saved_ik_rotation: Quat,
    plane_mode_angle: f32,
}

impl IkChain {
    fn new(
        bone: u32,
        angle_limits: Option<IkChainAngleLimits>,
    ) -> Self {
        IkChain {
            bone,
            angle_limits,
            prev_angle: Vec3A::ZERO,
            saved_ik_rotation: Quat::IDENTITY,
            plane_mode_angle: 0.0,
        }
    }
}

enum SolveAxis {
    X,
    Y,
    Z,
}

pub(crate) struct IkSolver {
    iteration: i32,
    limit_angle: f32,

    ik_bone: u32,
    target_bone: u32,
    ik_chains: Vec<IkChain>,
}

impl IkSolver {
    pub fn new(
        iteration: i32,
        limit_angle: f32,
        ik_bone: u32,
        target_bone: u32,
        chain_capacity: u32,
    ) -> IkSolver {
        IkSolver {
            iteration,
            limit_angle,
            ik_bone,
            target_bone,
            ik_chains: Vec::with_capacity(chain_capacity as usize),
        }
    }

    pub fn add_ik_chain(
        &mut self,
        arena: &mut [MmdRuntimeBone],
        bone: u32,
        angle_limits: Option<IkChainAngleLimits>,
    ) {
        let ik_chain = IkChain::new(bone, angle_limits);
        self.ik_chains.push(ik_chain);

        let bone = &mut arena[bone as usize];
        bone.ik_rotation = Some(Quat::IDENTITY);
    }

    pub fn solve(&mut self, animation_arena: &AnimationArena, bone_arena: &mut MmdRuntimeBoneArena, append_transform_sovler_arena: &AppendTransformSolverArena) {
        for chain in &mut self.ik_chains {
            chain.prev_angle = Vec3A::ZERO;
            chain.plane_mode_angle = 0.0;

            let chain_bone = &mut bone_arena[chain.bone as usize];
            chain_bone.ik_rotation = Some(Quat::IDENTITY);
            chain_bone.update_local_matrix(animation_arena, append_transform_sovler_arena);
            bone_arena.update_world_matrix(chain.bone);
        };


        let mut max_distance = f32::MAX;
        for i in 0..self.iteration {
            self.solve_core(animation_arena, bone_arena, append_transform_sovler_arena, i);

            let target_position = Vec3A::from(bone_arena.world_matrix(self.target_bone).w_axis);
            let ik_position = Vec3A::from(bone_arena.world_matrix(self.ik_bone).w_axis);
            let distance = target_position.distance_squared(ik_position);
            if distance < max_distance {
                max_distance = distance;
                for chain in &mut self.ik_chains {
                    chain.saved_ik_rotation = bone_arena[chain.bone as usize].ik_rotation.unwrap();
                }
            } else {
                for chain in &mut self.ik_chains {
                    let chain_bone = &mut bone_arena[chain.bone as usize];
                    chain_bone.ik_rotation = Some(chain.saved_ik_rotation);
                    chain_bone.update_local_matrix(animation_arena, append_transform_sovler_arena);
                    bone_arena.update_world_matrix(chain.bone);
                }
                break;
            }
        }
    }

    fn solve_core(&mut self, animation_arena: &AnimationArena, bone_arena: &mut MmdRuntimeBoneArena, append_transform_sovler_arena: &AppendTransformSolverArena, iteration: i32) {
        let ik_position = Vec3A::from(bone_arena.world_matrix(self.ik_bone).w_axis);

        for chain_index in 0..self.ik_chains.len() {
            let chain = &mut self.ik_chains[chain_index];
            if chain.bone == self.target_bone {
                continue;
            }

            if let Some(IkChainAngleLimits{minimum_angle, maximum_angle}) = &chain.angle_limits {
                if (minimum_angle.x != 0.0 || maximum_angle.x != 0.0) &&
                    (minimum_angle.y == 0.0 || maximum_angle.y == 0.0) &&
                    (minimum_angle.z == 0.0 || maximum_angle.z == 0.0) {
                    self.solve_plane(animation_arena, bone_arena, append_transform_sovler_arena, iteration, chain_index, SolveAxis::X);
                    continue;
                } else if (minimum_angle.x == 0.0 || maximum_angle.x == 0.0) &&
                    (minimum_angle.y != 0.0 || maximum_angle.y != 0.0) &&
                    (minimum_angle.z == 0.0 || maximum_angle.z == 0.0) {
                    self.solve_plane(animation_arena, bone_arena, append_transform_sovler_arena, iteration, chain_index, SolveAxis::Y);
                    continue;
                } else if (minimum_angle.x == 0.0 || maximum_angle.x == 0.0) &&
                    (minimum_angle.y == 0.0 || maximum_angle.y == 0.0) &&
                    (minimum_angle.z != 0.0 || maximum_angle.z != 0.0) {
                    self.solve_plane(animation_arena, bone_arena, append_transform_sovler_arena, iteration, chain_index, SolveAxis::Z);
                    continue;
                }
            }

            let target_position = Vec3A::from(bone_arena.world_matrix(self.target_bone).w_axis);
            let inverse_chain = bone_arena.world_matrix(chain.bone).inverse();

            let chain_ik_position = Vec3A::from(inverse_chain * Vec4::from((ik_position, 1.0)));
            let chain_target_position = Vec3A::from(inverse_chain * Vec4::from((target_position, 1.0)));
            
            let chain_ik_vector = chain_ik_position.normalize();
            let chain_target_vector = chain_target_position.normalize();

            let dot = chain_target_vector.dot(chain_ik_vector);
            let dot = dot.clamp(-1.0, 1.0);

            let angle = dot.acos();
            let angle_deg = angle.to_degrees();
            if angle_deg < 1.0e-3 {
                continue;
            }
            let angle = angle.clamp(-self.limit_angle, self.limit_angle);
            let rotation = {
                let cross = chain_target_vector.cross(chain_ik_vector);
                if cross == Vec3A::ZERO {
                    Quat::IDENTITY
                } else {
                    let cross = cross.normalize();
                    Quat::from_axis_angle(cross.into(), angle)
                }
            };

            let animated_rotation = bone_arena[chain.bone as usize].animated_rotation(animation_arena);
            let chain_bone = &mut bone_arena[chain.bone as usize];
            let mut chain_rotation = chain_bone.ik_rotation.unwrap() * animated_rotation * rotation;
            if let Some(IkChainAngleLimits{minimum_angle, maximum_angle}) = &chain.angle_limits {
                let mut chain_rotation_matrix = Mat3::from_quat(chain_rotation);
                let rotation_xyz = IkSolver::decompose(&chain_rotation_matrix, chain.prev_angle);
                let mut clamp_xyz = Vec3A::new(
                    rotation_xyz.x.clamp(minimum_angle.x, maximum_angle.x),
                    rotation_xyz.y.clamp(minimum_angle.y, maximum_angle.y),
                    rotation_xyz.z.clamp(minimum_angle.z, maximum_angle.z),
                );

                clamp_xyz -= chain.prev_angle;
                clamp_xyz.x = clamp_xyz.x.clamp(-self.limit_angle, self.limit_angle);
                clamp_xyz.y = clamp_xyz.y.clamp(-self.limit_angle, self.limit_angle);
                clamp_xyz.z = clamp_xyz.z.clamp(-self.limit_angle, self.limit_angle);
                clamp_xyz += chain.prev_angle;

                let r = Quat::from_axis_angle(Vec3::X, clamp_xyz.x)
                    * Quat::from_axis_angle(Vec3::Y, clamp_xyz.y)
                    * Quat::from_axis_angle(Vec3::Z, clamp_xyz.z);
                chain_rotation_matrix = Mat3::from_quat(r);
                chain.prev_angle = clamp_xyz;

                chain_rotation = Quat::from_mat3(&chain_rotation_matrix);
            }

            let chain_bone = &mut bone_arena[chain.bone as usize];
            chain_bone.ik_rotation = Some(chain_rotation * animated_rotation.inverse());

            chain_bone.update_local_matrix(animation_arena, append_transform_sovler_arena);
            bone_arena.update_world_matrix(chain.bone);
        }
    }

    fn solve_plane(&mut self, animation_arena: &AnimationArena, bone_arena: &mut MmdRuntimeBoneArena, append_transform_sovler_arena: &AppendTransformSolverArena, iteration: i32, chain_index: usize, solve_axis: SolveAxis) {
        let chain = &mut self.ik_chains[chain_index];
        let (minimum_angle, maximum_angle, rotate_axis) = match solve_axis {
            SolveAxis::X => (
                chain.angle_limits.as_ref().unwrap().minimum_angle.x,
                chain.angle_limits.as_ref().unwrap().maximum_angle.x,
                Vec3::X,
            ),
            SolveAxis::Y => (
                chain.angle_limits.as_ref().unwrap().minimum_angle.y,
                chain.angle_limits.as_ref().unwrap().maximum_angle.y,
                Vec3::Y,
            ),
            SolveAxis::Z => (
                chain.angle_limits.as_ref().unwrap().minimum_angle.z,
                chain.angle_limits.as_ref().unwrap().maximum_angle.z,
                Vec3::Z,
            ),
        };
        
        let ik_position = Vec3A::from(bone_arena.world_matrix(self.ik_bone).w_axis);
        let target_position = Vec3A::from(bone_arena.world_matrix(self.target_bone).w_axis);
        let inverse_chain = bone_arena.world_matrix(chain.bone).inverse();

        let chain_ik_position = Vec3A::from(inverse_chain * Vec4::from((ik_position, 1.0)));
        let chain_target_position = Vec3A::from(inverse_chain * Vec4::from((target_position, 1.0)));

        let chain_ik_vector = chain_ik_position.normalize();
        let chain_target_vector = chain_target_position.normalize();

        let dot = chain_target_vector.dot(chain_ik_vector);
        let dot = dot.clamp(-1.0, 1.0);

        let angle = dot.acos();

        let angle = angle.clamp(-self.limit_angle, self.limit_angle);

        let rot1 = Quat::from_axis_angle(rotate_axis, angle);
        let target_vec1 = rot1 * chain_target_vector;
        let dot1 = target_vec1.dot(chain_ik_vector);

        let rot2 = Quat::from_axis_angle(rotate_axis, -angle);
        let target_vec2 = rot2 * chain_target_vector;
        let dot2 = target_vec2.dot(chain_ik_vector);

        let mut new_angle = chain.plane_mode_angle + if dot1 > dot2 { angle } else { -angle };
        if iteration == 0 && (new_angle < minimum_angle || new_angle > maximum_angle) {
            if -new_angle > minimum_angle && -new_angle < maximum_angle {
                new_angle = -new_angle;
            } else {
                let half_rad = (minimum_angle + maximum_angle) * 0.5;
                if (half_rad - new_angle).abs() > (half_rad + new_angle).abs() {
                    new_angle = -new_angle;
                }
            }
        }

        let new_angle = new_angle.clamp(minimum_angle, maximum_angle);
        chain.plane_mode_angle = new_angle;

        let animated_rotation = bone_arena[chain.bone as usize].animated_rotation(animation_arena);
        let chain_bone = &mut bone_arena[chain.bone as usize];
        chain_bone.ik_rotation = Some(Quat::from_axis_angle(rotate_axis, new_angle) * animated_rotation.inverse());

        chain_bone.update_local_matrix(animation_arena, append_transform_sovler_arena);
        bone_arena.update_world_matrix(chain.bone);
    }

    #[inline]
    fn normalize_angle(mut angle: f32) -> f32 {
        while angle >= std::f32::consts::PI * 2.0 {
            angle -= std::f32::consts::PI * 2.0;
        }
        while angle < 0.0 {
            angle += std::f32::consts::PI * 2.0;
        }
        angle
    }

    fn diff_angle(a: f32, b: f32) -> f32 {
        let diff = IkSolver::normalize_angle(a) - IkSolver::normalize_angle(b);
        if diff > std::f32::consts::PI {
            diff - std::f32::consts::PI * 2.0
        } else if diff < -std::f32::consts::PI {
            diff + std::f32::consts::PI * 2.0
        } else {
            diff
        }
    }

    #[inline]
    fn decompose(matrix: &Mat3, before: Vec3A) -> Vec3A {
        let mut r = Vec3A::ZERO;

        let sy = -matrix.x_axis.z;
        let e = 1.0e-6;

        if (1.0 - sy.abs()).abs() < e {
            r.y = sy.asin();
            let sx = before.x.sin();
            let sz = before.z.sin();
            if sx.abs() < sz.abs() {
                let cx = before.x.cos();
                if cx > 0.0 {
                    r.x = 0.0;
                    r.z = (-matrix.y_axis.x).asin();
                } else {
                    r.x = std::f32::consts::PI;
                    r.z = matrix.y_axis.x.asin();
                }
            } else {
                let cz = before.z.cos();
                if cz > 0.0 {
                    r.z = 0.0;
                    r.x = (-matrix.z_axis.y).asin();
                } else {
                    r.z = std::f32::consts::PI;
                    r.x = matrix.z_axis.y.asin();
                }
            }
        } else {
            r.x = matrix.y_axis.z.atan2(matrix.z_axis.z);
            r.y = (-matrix.x_axis.x).asin();
            r.z = matrix.x_axis.y.atan2(matrix.x_axis.x);
        }

        let pi = std::f32::consts::PI;
        let tests = [
            Vec3A::new(r.x + pi, pi - r.y, r.z + pi),
            Vec3A::new(r.x + pi, pi - r.y, r.z - pi),
            Vec3A::new(r.x + pi, -pi - r.y, r.z + pi),
            Vec3A::new(r.x + pi, -pi - r.y, r.z - pi),
            Vec3A::new(r.x - pi, pi - r.y, r.z + pi),
            Vec3A::new(r.x - pi, pi - r.y, r.z - pi),
            Vec3A::new(r.x - pi, -pi - r.y, r.z + pi),
            Vec3A::new(r.x - pi, -pi - r.y, r.z - pi),
        ];

        let err_x = IkSolver::diff_angle(r.x, before.x).abs();
        let err_y = IkSolver::diff_angle(r.y, before.y).abs();
        let err_z = IkSolver::diff_angle(r.z, before.z).abs();
        let mut min_err = err_x + err_y + err_z;
        for test in tests {
            let err = IkSolver::diff_angle(test.x, before.x).abs() +
                IkSolver::diff_angle(test.y, before.y).abs() +
                IkSolver::diff_angle(test.z, before.z).abs();
            if err < min_err {
                min_err = err;
                r = test;
            }
        }
        r
    }
}
