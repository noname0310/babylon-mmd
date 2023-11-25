use nalgebra::{UnitQuaternion, Vector3, distance_squared, UnitVector3, Matrix4, SimdPartialOrd};

use crate::{mmd_runtime_bone::{MmdRuntimeBone, MmdRuntimeBoneArena}, mmd_model_metadata::IkChainAngleLimits, animation_arena::AnimationArena, append_transform_solver::AppendTransformSolverArena};

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
    bone: usize,
    angle_limits: Option<IkChainAngleLimits>,
    prev_angle: Vector3<f32>,
    saved_ik_rotation: UnitQuaternion<f32>,
    plane_mode_angle: f32,
}

impl IkChain {
    fn new(
        bone: usize,
        angle_limits: Option<IkChainAngleLimits>,
    ) -> Self {
        IkChain {
            bone,
            angle_limits,
            prev_angle: Vector3::zeros(),
            saved_ik_rotation: UnitQuaternion::identity(),
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
    pub iteration: i32,
    pub limit_angle: f32,

    ik_bone: usize,
    target_bone: usize,
    ik_chains: Vec<IkChain>,
}

impl IkSolver {
    pub fn new(
        ik_bone: usize,
        target_bone: usize,
        chain_capacity: usize,
    ) -> IkSolver {
        IkSolver {
            iteration: 0,
            limit_angle: 0.0,
            ik_bone,
            target_bone,
            ik_chains: Vec::with_capacity(chain_capacity),
        }
    }

    pub fn add_ik_chain(
        &mut self,
        arena: &mut [MmdRuntimeBone],
        bone: usize,
        angle_limits: Option<IkChainAngleLimits>,
    ) {
        let ik_chain = IkChain::new(bone, angle_limits);
        self.ik_chains.push(ik_chain);

        let bone = &mut arena[bone];
        bone.ik_rotation = Some(UnitQuaternion::identity());
    }

    pub fn solve(&mut self, animation_arena: &AnimationArena, bone_arena: &mut MmdRuntimeBoneArena, append_transform_sovler_arena: &AppendTransformSolverArena) {
        for chain in &mut self.ik_chains {
            chain.prev_angle = Vector3::zeros();
            chain.saved_ik_rotation = UnitQuaternion::identity();
            chain.plane_mode_angle = 0.0;

            let chain_bone = &mut bone_arena[chain.bone];
            chain_bone.update_local_matrix(animation_arena, append_transform_sovler_arena);
            bone_arena.update_world_matrix(chain.bone);
        };


        let mut max_distance = f32::MAX;
        for i in 0..self.iteration {
            self.solve_core(animation_arena, bone_arena, append_transform_sovler_arena, i);

            let target_position = bone_arena.world_matrix(self.target_bone).column(3).xyz();
            let ik_position = bone_arena.world_matrix(self.ik_bone).column(3).xyz();
            let distance = distance_squared(&target_position.into(), &ik_position.into());
            if distance < max_distance {
                max_distance = distance;
                for chain in &mut self.ik_chains {
                    chain.saved_ik_rotation = bone_arena[chain.bone].ik_rotation.unwrap();
                }
            } else {
                for chain in &mut self.ik_chains {
                    let chain_bone = &mut bone_arena[chain.bone];
                    chain_bone.ik_rotation = Some(chain.saved_ik_rotation);
                    chain_bone.update_local_matrix(animation_arena, append_transform_sovler_arena);
                    bone_arena.update_world_matrix(chain.bone);
                }
                break;
            }
        }
    }

    fn solve_core(&mut self, animation_arena: &AnimationArena, bone_arena: &mut MmdRuntimeBoneArena, append_transform_sovler_arena: &AppendTransformSolverArena, iteration: i32) {
        let ik_position = bone_arena.world_matrix(self.ik_bone).column(3).xyz();

        for chain_index in 0..self.ik_chains.len() {
            let chain = &mut self.ik_chains[chain_index];
            if chain.bone == self.ik_bone {
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

            let target_position = bone_arena.world_matrix(self.target_bone).column(3).xyz();
            let inverse_chain = bone_arena.world_matrix(chain.bone).try_inverse().unwrap();

            let chain_ik_position = inverse_chain.transform_point(&ik_position.into());
            let chain_target_position = inverse_chain.transform_point(&target_position.into());
            
            let chain_ik_vector = chain_ik_position.coords.normalize();
            let chain_target_vector = chain_target_position.coords.normalize();

            let dot = chain_target_vector.dot(&chain_ik_vector);
            let dot = dot.clamp(-1.0, 1.0);

            let angle = dot.acos();
            let angle_deg = angle.to_degrees();
            if angle_deg < 1.0e-3 {
                continue;
            }
            let angle = angle.clamp(-self.limit_angle, self.limit_angle);
            let cross = UnitVector3::new_normalize(chain_target_vector.cross(&chain_ik_vector));
            let rotation = UnitQuaternion::from_axis_angle(&cross, angle);

            let animated_rotation = bone_arena[chain.bone].animated_rotation(animation_arena);
            let chain_bone = &mut bone_arena[chain.bone];
            let mut chain_rotation = chain_bone.ik_rotation.unwrap() * animated_rotation * rotation;
            if let Some(IkChainAngleLimits{minimum_angle, maximum_angle}) = &chain.angle_limits {
                let mut chain_rotation_matrix = chain_rotation.to_homogeneous();
                let rotation_xyz = IkSolver::decompose(&chain_rotation_matrix, chain.prev_angle);
                let mut clamp_xyz = rotation_xyz
                    .simd_clamp(*minimum_angle, *maximum_angle);

                clamp_xyz = (clamp_xyz - chain.prev_angle)
                    .simd_clamp(Vector3::from_element(-self.limit_angle), Vector3::from_element(self.limit_angle)) + chain.prev_angle;
                let r = UnitQuaternion::from_axis_angle(&Vector3::x_axis(), clamp_xyz.x)
                    * UnitQuaternion::from_axis_angle(&Vector3::y_axis(), clamp_xyz.y)
                    * UnitQuaternion::from_axis_angle(&Vector3::z_axis(), clamp_xyz.z);
                chain_rotation_matrix = r.to_homogeneous();
                chain.prev_angle = clamp_xyz;

                chain_rotation = UnitQuaternion::from_matrix(&chain_rotation_matrix.fixed_view::<3, 3>(0, 0).into_owned());
            }

            let animated_rotation = bone_arena[chain.bone].animated_rotation(animation_arena);
            let chain_bone = &mut bone_arena[chain.bone];
            chain_bone.ik_rotation = Some(chain_rotation * animated_rotation.inverse());

            chain_bone.update_local_matrix(animation_arena, append_transform_sovler_arena);
            // mmd_model.update_world_matrix(chain.bone);
        }
    }

    fn solve_plane(&mut self, animation_arena: &AnimationArena, bone_arena: &mut MmdRuntimeBoneArena, append_transform_sovler_arena: &AppendTransformSolverArena, iteration: i32, chain_index: usize, solve_axis: SolveAxis) {
        let chain = &mut self.ik_chains[chain_index];
        let (minimum_angle, maximum_angle, rotate_axis) = match solve_axis {
            SolveAxis::X => (
                chain.angle_limits.as_ref().unwrap().minimum_angle.x,
                chain.angle_limits.as_ref().unwrap().maximum_angle.x,
                Vector3::<f32>::x_axis(),
            ),
            SolveAxis::Y => (
                chain.angle_limits.as_ref().unwrap().minimum_angle.y,
                chain.angle_limits.as_ref().unwrap().maximum_angle.y,
                Vector3::<f32>::y_axis(),
            ),
            SolveAxis::Z => (
                chain.angle_limits.as_ref().unwrap().minimum_angle.z,
                chain.angle_limits.as_ref().unwrap().maximum_angle.z,
                Vector3::<f32>::z_axis(),
            ),
        };
        
        let ik_position = bone_arena.world_matrix(self.ik_bone).column(3).xyz();
        let target_position = bone_arena.world_matrix(self.target_bone).column(3).xyz();
        let inverse_chain = bone_arena.world_matrix(chain.bone).try_inverse().unwrap();

        let chain_ik_position = inverse_chain.transform_point(&ik_position.into());
        let chain_target_position = inverse_chain.transform_point(&target_position.into());

        let chain_ik_vector = chain_ik_position.coords.normalize();
        let chain_target_vector = chain_target_position.coords.normalize();

        let dot = chain_target_vector.dot(&chain_ik_vector);
        let dot = dot.clamp(-1.0, 1.0);

        let angle = dot.acos();

        let angle = angle.clamp(-self.limit_angle, self.limit_angle);

        let rot1 = UnitQuaternion::from_axis_angle(&rotate_axis, angle);
        let target_vec1 = rot1 * chain_target_vector;
        let dot1 = target_vec1.dot(&chain_ik_vector);

        let rot2 = UnitQuaternion::from_axis_angle(&rotate_axis, -angle);
        let target_vec2 = rot2 * chain_target_vector;
        let dot2 = target_vec2.dot(&chain_ik_vector);

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

        let animated_rotation = bone_arena[chain.bone].animated_rotation(animation_arena);
        let chain_bone = &mut bone_arena[chain.bone];
        chain_bone.ik_rotation = Some(UnitQuaternion::from_axis_angle(&rotate_axis, new_angle) * animated_rotation.inverse());

        chain_bone.update_local_matrix(animation_arena, append_transform_sovler_arena);
        bone_arena.update_world_matrix(chain.bone);
    }

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

    fn decompose(matrix: &Matrix4<f32>, before: Vector3<f32>) -> Vector3<f32> {
        let mut r = Vector3::zeros();

        let sy = -matrix[(2, 0)];
        let e = 1.0e-6;

        if (1.0 - sy.abs()).abs() < e {
            r.y = sy.asin();
            let sx = before.x.sin();
            let sz = before.z.sin();
            if sx.abs() < sz.abs() {
                let cx = before.x.cos();
                if cx > 0.0 {
                    r.x = 0.0;
                    r.z = (-matrix[(0, 1)]).asin();
                } else {
                    r.x = 0.0;
                    r.z = matrix[(0, 1)].asin();
                }
            } else {
                let cz = before.z.cos();
                if cz > 0.0 {
                    r.z = 0.0;
                    r.x = (-matrix[(1, 2)]).asin();
                } else {
                    r.z = 0.0;
                    r.x = matrix[(1, 2)].asin();
                }
            }
        } else {
            r.x = matrix[(2, 1)].atan2(matrix[(2, 2)]);
            r.y = (-matrix[(2, 0)]).asin();
            r.z = matrix[(1, 0)].atan2(matrix[(0, 0)]);
        }

        let pi = std::f32::consts::PI;
        let tests = [
            Vector3::new(r.x + pi, pi - r.y, r.z + pi),
            Vector3::new(r.x + pi, pi - r.y, r.z - pi),
            Vector3::new(r.x + pi, -pi - r.y, r.z + pi),
            Vector3::new(r.x + pi, -pi - r.y, r.z - pi),
            Vector3::new(r.x - pi, pi - r.y, r.z + pi),
            Vector3::new(r.x - pi, pi - r.y, r.z - pi),
            Vector3::new(r.x - pi, -pi - r.y, r.z + pi),
            Vector3::new(r.x - pi, -pi - r.y, r.z - pi),
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
