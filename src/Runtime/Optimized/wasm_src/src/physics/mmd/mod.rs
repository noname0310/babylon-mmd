use glam::{EulerRot, Mat4, Quat, Vec3};
use physics_model_context::PhysicsModelContext;
use rigidbody_bundle_proxy::{RigidBodyBundleProxy, RigidBodyProxyData};

use crate::diagnostic::DiagnosticWriter;
use crate::mmd_model::mmd_runtime_bone::MmdRuntimeBone;
use crate::mmd_model::MmdModel;
use crate::mmd_model_metadata::{RigidBodyMetadata, RigidBodyMetadataReader, RigidBodyPhysicsMode, RigidBodyShapeType};

use super::bullet::runtime::collision_shape::{BoxShape, CapsuleShape, CollisionShape, SphereShape, StaticPlaneShape};
use super::bullet::runtime::motion_type::MotionType;
use super::bullet::runtime::multi_physics_world::MultiPhysicsWorld;
use super::bullet::runtime::rigidbody_construction_info::RigidBodyConstructionInfo;

pub(crate) mod rigidbody_bundle_proxy;
pub(crate) mod physics_model_context;

pub(crate) struct MmdPhysicsRuntime {
    multi_physics_world: MultiPhysicsWorld,
    max_sub_steps: i32,
    fixed_time_step: f32,
}

struct CreateRbInfoResult<'a> {
    bone_index: Option<i32>,
    motion_type: MotionType,
    physics_mode: RigidBodyPhysicsMode,
    body_offset_matrix: Mat4,
    construction_info: RigidBodyConstructionInfo<'a>,
}

impl MmdPhysicsRuntime {
    pub(crate) fn new(allow_dynamic_shadow: bool) -> Self {
        let multi_physics_world = MultiPhysicsWorld::new(allow_dynamic_shadow);
        Self {
            multi_physics_world,
            max_sub_steps: 5,
            fixed_time_step: 1.0 / 100.0,
        }
    }
    
    pub(crate) fn world(&self) -> &MultiPhysicsWorld {
        &self.multi_physics_world
    }

    pub(crate) fn max_sub_steps_mut(&mut self) -> &mut i32 {
        &mut self.max_sub_steps
    }

    pub(crate) fn fixed_time_step_mut(&mut self) -> &mut f32 {
        &mut self.fixed_time_step
    }
    
    pub(crate) fn set_gravity(&mut self, gravity: Vec3) {
        self.multi_physics_world.set_gravity(gravity);
    }

    pub(crate) fn step_simulation(&mut self, time_step: f32, mmd_models: &mut [Box<MmdModel>]) {
        // synchronize kinematic rigid bodies with bone matrices
        for model in mmd_models.iter_mut() {
            let context = if let Some(context) = model.physics_model_context_mut() {
                context
            } else {
                continue;
            };

            let world_matrix = *context.world_matrix();
            let need_init = context.flush_need_init();

            for index in 0..context.bundle_proxy().len() {
                let context = model.physics_model_context().as_ref();
                // SAFETY: context validity check is done at first line of outer loop
                let context = unsafe { context.unwrap_unchecked() };

                let linked_bone_index = if let Some(linked_bone_index) = context.bundle_proxy().linked_bone_index(index) {
                    linked_bone_index
                } else {
                    continue;
                };

                let physics_mode = context.bundle_proxy().physics_mode(index);
                if physics_mode == RigidBodyPhysicsMode::FollowBone { // only kinematic object needs to update
                    let bone_world_matrices = model.bone_arena().world_matrices();
                    let bone_world_matrix = bone_world_matrices[linked_bone_index];
                    
                    let context = model.physics_model_context_mut().as_mut();
                    // SAFETY: context validity check is done at first line of outer loop
                    let context = unsafe { context.unwrap_unchecked() };

                    context.bundle_proxy_mut().set_transform(index, world_matrix * bone_world_matrix);
                } else if need_init && (physics_mode == RigidBodyPhysicsMode::Physics || physics_mode == RigidBodyPhysicsMode::PhysicsWithBone) {
                    let bone_world_matrices = model.bone_arena().world_matrices();
                    let bone_world_matrix = bone_world_matrices[linked_bone_index];

                    let context = model.physics_model_context_mut().as_mut();
                    // SAFETY: context validity check is done at first line of outer loop
                    let context = unsafe { context.unwrap_unchecked() };

                    context.bundle_proxy_mut().inner_mut().make_temporal_kinematic(index);
                    context.bundle_proxy_mut().set_transform(index, world_matrix * bone_world_matrix);
                }
            }
        }

        self.multi_physics_world.step_simulation(time_step, self.max_sub_steps, self.fixed_time_step);

        // synchronize bone matrices with dynamic rigid bodies
        for model in mmd_models.iter_mut() {
            let context = if let Some(context) = model.physics_model_context() {
                context
            } else {
                continue;
            };      

            let world_matrix_inverse = *context.world_matrix_inverse();

            for index in 0..context.bundle_proxy().len() {
                let context = model.physics_model_context().as_ref();
                // SAFETY: context validity check is done at first line of outer loop
                let context = unsafe { context.unwrap_unchecked() };

                let physics_mode = context.bundle_proxy().physics_mode(index);

                if physics_mode == RigidBodyPhysicsMode::FollowBone || physics_mode == RigidBodyPhysicsMode::Static {
                    continue; // kinematic and static objects are not updated
                }

                let linked_bone_index = if let Some(linked_bone_index) = context.bundle_proxy().linked_bone_index(index) {
                    linked_bone_index
                } else {
                    continue;
                };

                let mut body_world_matrix = world_matrix_inverse * context.bundle_proxy().get_transform(index);

                let mut bone_world_matrices = model.bone_arena_mut().world_matrices_mut();
                if physics_mode == RigidBodyPhysicsMode::PhysicsWithBone {
                    let bone_position = bone_world_matrices[linked_bone_index].w_axis.truncate();
                    body_world_matrix.w_axis = bone_position.extend(body_world_matrix.w_axis.w);
                }

                bone_world_matrices[linked_bone_index] = body_world_matrix;
            }
        }
    }

    fn create_shape<'a>(
        diagnostic: &mut DiagnosticWriter,
        scaling_factor: f32,
        rigidbody_index: u32,
        metadata: &RigidBodyMetadata,
    ) -> Option<(CollisionShape, bool)> {
        let shape_size = metadata.shape_size * scaling_factor;

        let (shape, is_zero_volume) = if metadata.shape_type == RigidBodyShapeType::Sphere as u8 {
            let shape = SphereShape::new(shape_size.x);
            let is_zero_volume = shape_size.x == 0.0;
            (CollisionShape::Sphere(shape), is_zero_volume)
        } else if metadata.shape_type == RigidBodyShapeType::Box as u8 {
            let shape = BoxShape::new(Vec3::new(shape_size.x, shape_size.y, shape_size.z));
            let is_zero_volume = shape_size.x == 0.0 || shape_size.y == 0.0 || shape_size.z == 0.0;
            (CollisionShape::Box(shape), is_zero_volume)
        } else if metadata.shape_type == RigidBodyShapeType::Capsule as u8 {
            let shape = CapsuleShape::new(shape_size.x, shape_size.y);
            let is_zero_volume = shape_size.x == 0.0 || shape_size.y == 0.0;
            (CollisionShape::Capsule(shape), is_zero_volume)
        } else if metadata.shape_type == RigidBodyShapeType::StaticPlane as u8 {
            let shape = StaticPlaneShape::new(Vec3::new(shape_size.x, shape_size.y, shape_size.z), shape_size.w);
            let is_zero_volume = shape_size.x == 0.0 && shape_size.y == 0.0 && shape_size.z == 0.0;
            (CollisionShape::StaticPlane(shape), is_zero_volume)
        } else {
            diagnostic.warning(format!("Unsupported shape type {} for rigid body {}", metadata.shape_type, rigidbody_index));
            return None;
        };

        Some((shape, is_zero_volume))
    }

    fn create_rb_info<'a>(
        bones: &[MmdRuntimeBone],
        world_matrix: Mat4,
        diagnostic: &mut DiagnosticWriter,
        scaling_factor: f32,
        rigidbody_index: u32,
        metadata: &RigidBodyMetadata,
        shape: &'a mut CollisionShape,
        is_zero_volume: bool,
    ) -> Option<CreateRbInfoResult<'a>> {
        let bone_index = metadata.bone_index;
        let bone_index = if bone_index < 0 || bones.len() <= bone_index as usize {
            diagnostic.warning(format!("Bone index out of range create unmapped rigid body: {}", rigidbody_index));
            None
        } else {
            Some(bone_index)
        };

        let (motion_type, physics_mode) = if metadata.physics_mode == RigidBodyPhysicsMode::FollowBone as u8 {
            (MotionType::Kinematic, RigidBodyPhysicsMode::FollowBone)
        } else if metadata.physics_mode == RigidBodyPhysicsMode::Physics as u8 || metadata.physics_mode == RigidBodyPhysicsMode::PhysicsWithBone as u8 {
            (MotionType::Dynamic, if metadata.physics_mode == RigidBodyPhysicsMode::Physics as u8 { RigidBodyPhysicsMode::Physics } else { RigidBodyPhysicsMode::PhysicsWithBone })
        } else if metadata.physics_mode == RigidBodyPhysicsMode::Static as u8 {
            (MotionType::Static, RigidBodyPhysicsMode::Static)
        } else {
            diagnostic.warning(format!("Unsupported physics mode {} for rigid body {}", metadata.physics_mode, rigidbody_index));
            return None;
        };

        // static plane validation
        let (motion_type, physics_mode) = if let CollisionShape::StaticPlane(_) = shape {
            if physics_mode != RigidBodyPhysicsMode::Static {
                diagnostic.warning(format!("Static plane shape must have static physics mode, forced to static for rigid body {}", rigidbody_index));
            }
            (MotionType::Static, RigidBodyPhysicsMode::Static)
        } else {
            (motion_type, physics_mode)
        };

        // model space position and rotation
        let position = metadata.shape_position;
        let rotation = Quat::from_euler(
            EulerRot::YXZ,
            metadata.shape_rotation.y, metadata.shape_rotation.x, metadata.shape_rotation.z
        );
        let pose_matrix = Mat4::from_rotation_translation(rotation, position.into());

        // compute the offset matrix from the bone to the rigid body
        let body_offset_matrix = if let Some(bone_index) = bone_index {
            let parent_world_matrix_inverse = *bones[bone_index as usize].absolute_inverse_bind_matrix();

            parent_world_matrix_inverse * pose_matrix
        } else {
            Mat4::IDENTITY
        };

        // world space transform
        let initial_transform_matrix = world_matrix * pose_matrix;

        let construction_info: RigidBodyConstructionInfo<'a> = RigidBodyConstructionInfo {
            shape: shape,
            initial_transform: initial_transform_matrix,
            data_mask: 0,
            motion_type: motion_type as u8,
            mass: metadata.mass * scaling_factor,
            local_inertia: Vec3::ZERO,
            linear_damping: metadata.linear_damping,
            angular_damping: metadata.angular_damping,
            friction: metadata.friction,
            restitution: metadata.repulsion,
            linear_sleeping_threshold: 0.0,
            angular_sleeping_threshold: 0.0,
            collision_group: 1 << (metadata.collision_group as u16),
            collision_mask: metadata.collision_mask,
            additional_damping: true as u8,
            no_contact_response: (metadata.collision_mask == 0x0000 || is_zero_volume) as u8,
            disable_deactivation: true as u8,
        };

        Some(CreateRbInfoResult {
            bone_index,
            motion_type,
            physics_mode,
            body_offset_matrix,
            construction_info,
        })
    }

    pub(crate) fn create_physics_context(
        &mut self,
        bones: &[MmdRuntimeBone],
        mut reader: RigidBodyMetadataReader,
        mut diagnostic: DiagnosticWriter
    ) -> PhysicsModelContext {
        let world_matrix = *reader.model_initial_world_matrix();

        let (scaling_factor, world_rotation) = if world_matrix.determinant() == 0.0 {
            (1.0, glam::Quat::IDENTITY)
        } else {
            let (scale, rotation, _) = world_matrix.to_scale_rotation_translation();
            if ((scale.x - scale.y).abs() < 0.0001) && ((scale.y - scale.z).abs() < 0.0001) {
                if (scale.x - 1.0).abs() < 0.0001 {
                    (1.0, rotation)
                } else {
                    diagnostic.warning("Root node scaling is not 1, simulation may differ from the original".to_string());
                    (scale.x, rotation)
                }
            } else {
                diagnostic.warning("Root node scaling is not uniform, physics may not work correctly".to_string());
                (scale.max_element(), rotation)
            }
        };

        let mut rigidbody_map = vec![-1; reader.count() as usize];
        let mut rigidbody_initial_transforms = Vec::with_capacity(reader.count() as usize);

        let mut kinematic_object_count = 0;
        let mut shapes = Vec::with_capacity(reader.count() as usize);
        let mut rb_info_list = Vec::with_capacity(reader.count() as usize);
        let mut rb_data_list = Vec::with_capacity(reader.count() as usize);
        reader.enumerate(|rigidbody_index, metadata| {
            let position = metadata.shape_position;
            let rotation = metadata.shape_rotation;

            let (shape, is_zero_volume) = match Self::create_shape(&mut diagnostic, scaling_factor, rigidbody_index, &metadata) {
                Some(v) => v,
                None => return,
            };
            
            shapes.push(shape);

            let CreateRbInfoResult {
                bone_index,
                motion_type,
                physics_mode,
                body_offset_matrix,
                construction_info
            } = match Self::create_rb_info(
                bones,
                world_matrix,
                &mut diagnostic,
                scaling_factor,
                rigidbody_index,
                &metadata,
                shapes.last_mut().unwrap(),
                is_zero_volume
            ) {
                Some(v) => v,
                None => return,
            };

            rb_info_list.push(construction_info);
            rb_data_list.push(RigidBodyProxyData {
                linked_bone_index: bone_index.map(|v| v as u32),
                body_offset_matrix,
                body_offset_inverse_matrix: body_offset_matrix.inverse(),
                physics_mode,
            });

            rigidbody_map[rigidbody_index as usize] = rigidbody_initial_transforms.len() as i32;
            rigidbody_initial_transforms.push((position, rotation));

            if MotionType::Dynamic != motion_type {
                kinematic_object_count += 1;
            }
        });
        let rigidbody_bundle_proxy = RigidBodyBundleProxy::new(&mut rb_info_list, rb_data_list.into_boxed_slice());

        self.multi_physics_world.add_rigidbody_bundle(
            reader.physics_world_id(),
            rigidbody_bundle_proxy.inner_mut().create_handle()
        );

        let kinematic_shared_physics_world_ids = reader.take_kinematic_shared_physics_world_ids();
        for world_id in kinematic_shared_physics_world_ids {
            self.multi_physics_world.add_rigidbody_bundle_shadow(
                world_id,
                rigidbody_bundle_proxy.inner_mut().create_handle()
            );
        }

        let mut reader = reader.next().unwrap();
        let world = self.worlds.get_or_create_world(world_id);
        let physics_object = world.get_physics_object_mut(physics_object_handle);

        let mut constraint_info = ConstraintConstructionInfo::new();

        physics_object.reserve_constraints(reader.count() as usize);
        reader.enumerate(|constraint_index, metadata| {
            let rigidbody_index_a = metadata.rigidbody_index_a;
            let rigidbody_index_b = metadata.rigidbody_index_b;

            let rigidbody_index_a = if rigidbody_index_a < 0 || rigidbody_map.len() <= rigidbody_index_a as usize {
                diagnostic.warning(format!("Rigid body index out of range failed to create joint {}", constraint_index));
                return;
            } else {
                let rigidbody_index_a = rigidbody_map[rigidbody_index_a as usize];
                if rigidbody_index_a == -1 {
                    diagnostic.warning(format!("Rigid body not found failed to create joint {}", constraint_index));
                    return;
                }
                rigidbody_index_a
            };

            let rigidbody_index_b = if rigidbody_index_b < 0 || rigidbody_map.len() <= rigidbody_index_b as usize {
                diagnostic.warning(format!("Rigid body index out of range failed to create joint {}", constraint_index));
                return;
            } else {
                let rigidbody_index_b = rigidbody_map[rigidbody_index_b as usize];
                if rigidbody_index_b == -1 {
                    diagnostic.warning(format!("Rigid body not found failed to create joint {}", constraint_index));
                    return;
                }
                rigidbody_index_b
            };

            let constraint_type = if metadata.kind == JointKind::Spring6Dof as u8 {
                ConstraintType::Generic6DofSpring
            } else {
                diagnostic.warning(format!("Unsupported joint kind {} for joint {}", metadata.kind, constraint_index));
                return;
            };

            constraint_info.set_type(constraint_type);
            constraint_info.set_bodies(rigidbody_index_a as usize, rigidbody_index_b as usize);

            let joint_transform = Mat4::from_rotation_translation(
                Quat::from_euler(
                    EulerRot::YXZ,
                    metadata.rotation.y, metadata.rotation.x, metadata.rotation.z
                ),
                (metadata.position * scaling_factor).into()
            );

            let rigidbody_a_inverse = {
                let (position, rotation) = rigidbody_initial_transforms[rigidbody_index_a as usize];
                let world_matrix = Mat4::from_rotation_translation(
                    Quat::from_euler(
                        EulerRot::YXZ,
                        rotation.y, rotation.x, rotation.z
                    ),
                    (position * scaling_factor).into()
                );
                world_matrix.inverse()
            };

            let rigidbody_b_inverse = {
                let (position, rotation) = rigidbody_initial_transforms[rigidbody_index_b as usize];
                let world_matrix = Mat4::from_rotation_translation(
                    Quat::from_euler(
                        EulerRot::YXZ,
                        rotation.y, rotation.x, rotation.z
                    ),
                    (position * scaling_factor).into()
                );
                world_matrix.inverse()
            };

            let joint_final_transform_a = rigidbody_a_inverse * joint_transform;
            let joint_final_transform_b = rigidbody_b_inverse * joint_transform;

            constraint_info.set_frames(joint_final_transform_a, joint_final_transform_b);
            constraint_info.set_use_linear_reference_frame_a(true);
            constraint_info.set_disable_collisions_between_linked_bodies(false);
            constraint_info.set_linear_limits(metadata.position_min.into(), metadata.position_max.into());
            constraint_info.set_angular_limits(metadata.rotation_min.into(), metadata.rotation_max.into());
            constraint_info.set_stiffness(metadata.spring_position.into(), metadata.spring_rotation.into());

            if let Err(message) = physics_object.create_constraint(&constraint_info) {
                diagnostic.warning(message);
            }

            let body_a = &physics_object.bodies()[rigidbody_index_a as usize];
            let body_b = &physics_object.bodies()[rigidbody_index_b as usize];

            if body_a.get_physics_mode() != RigidBodyPhysicsMode::FollowBone &&
                body_b.get_physics_mode() == RigidBodyPhysicsMode::PhysicsWithBone { // case: A is parent of B
                if let Some(body_b_bone_index) = body_b.get_linked_bone_index() {
                    if let (Some(parent_bone), Some(body_a_bone_index)) = (bones[body_b_bone_index as usize].parent_bone(), body_a.get_linked_bone_index()) {
                        if parent_bone == body_a_bone_index {
                            let body_b = &mut physics_object.bodies_mut()[rigidbody_index_b as usize];
                            body_b.set_physics_mode(RigidBodyPhysicsMode::Physics);
                        }
                    }
                }
            } else if body_b.get_physics_mode() != RigidBodyPhysicsMode::FollowBone &&
                body_a.get_physics_mode() == RigidBodyPhysicsMode::PhysicsWithBone { // case: B is parent of A
                if let Some(body_a_bone_index) = body_a.get_linked_bone_index() {
                    if let (Some(parent_bone), Some(body_b_bone_index)) = (bones[body_a_bone_index as usize].parent_bone(), body_b.get_linked_bone_index()) {
                        if parent_bone == body_b_bone_index {
                            let body_a = &mut physics_object.bodies_mut()[rigidbody_index_a as usize];
                            body_a.set_physics_mode(RigidBodyPhysicsMode::Physics);
                        }
                    }
                }
            }
        });

        PhysicsModelContext::new(
            physics_handle,
            kinematic_shared_physics_handles,
            world_matrix,
        )
    }

    pub(crate) fn destroy_physics_context(&mut self, mut context: PhysicsModelContext) {
        let world_id = context.world_id();

        for constraint in context.constraints_mut() {
            self.multi_physics_world.remove_constraint(world_id, constraint.create_handle());
        }

        for i in 0..context.shared_world_ids().len() {
            let world_id = context.shared_world_ids()[i];
            self.multi_physics_world.remove_rigidbody_bundle_shadow(
                world_id, 
                context.bundle_proxy_mut().inner_mut().create_handle()
            );
        }
        self.multi_physics_world.remove_rigidbody_bundle(
            context.world_id(), 
            context.bundle_proxy_mut().inner_mut().create_handle()
        );
    }
}
