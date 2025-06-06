use glam::Mat4;

use crate::physics::bullet::runtime::{
    collision_shape::CollisionShape, constraint::Constraint, multi_physics_world::PhysicsWorldId, rigidbody_bundle::RigidBodyBundle
};

use super::rigidbody_bundle_proxy::RigidBodyBundleProxy;

// for parallel iteration
unsafe impl Send for CollisionShape {}
unsafe impl Send for RigidBodyBundle {}
unsafe impl Send for Constraint {}

pub(crate) struct PhysicsModelContext {
    constraints: Box<[Constraint]>,
    bundle_proxy: Box<RigidBodyBundleProxy>,
    #[allow(dead_code)]
    shapes: Box<[CollisionShape]>, // shapes must be alive while bundle is alive
    world_id: PhysicsWorldId,
    shared_world_ids: Vec<PhysicsWorldId>,
    
    // for thread safety, we need buffer to apply world matrix
    world_matrix_apply_buffer: Option<Mat4>,
    world_matrix: Mat4,
    world_matrix_inverse: Mat4,

    // for thread safety, we need buffer to apply need_init
    need_init_apply_buffer: bool,
    need_init: bool,
}

impl PhysicsModelContext {
    pub(super) fn new(
        constraints: Box<[Constraint]>,
        bundle_proxy: Box<RigidBodyBundleProxy>,
        shapes: Box<[CollisionShape]>,
        world_id: PhysicsWorldId,
        shared_world_ids: Vec<PhysicsWorldId>,
        world_matrix: Mat4,
    ) -> Self {
        let invertable = world_matrix.determinant() != 0.0;

        let (world_matrix, world_matrix_inverse) = if invertable {
            (world_matrix, world_matrix.inverse())
        } else {
            (Mat4::IDENTITY, Mat4::IDENTITY)
        };
        
        Self {
            shapes,
            bundle_proxy,
            constraints,
            world_id,
            shared_world_ids,

            world_matrix_apply_buffer: None,
            world_matrix,
            world_matrix_inverse,
            
            need_init_apply_buffer: false,
            need_init: false,
        }
    }

    pub(super) fn bundle_proxy(&self) -> &RigidBodyBundleProxy {
        &self.bundle_proxy
    }

    pub(super) fn bundle_proxy_mut(&mut self) -> &mut RigidBodyBundleProxy {
        &mut self.bundle_proxy
    }
    
    pub(super) fn constraints_mut(&mut self) -> &mut [Constraint] {
        &mut self.constraints
    }

    pub(super) fn world_id(&self) -> PhysicsWorldId {
        self.world_id
    }

    pub(super) fn shared_world_ids(&self) -> &[PhysicsWorldId] {
        &self.shared_world_ids
    }

    pub(crate) fn set_world_matrix(&mut self, world_matrix: Mat4) {
        self.world_matrix_apply_buffer = Some(world_matrix);
    }

    pub (crate) fn apply_world_matrix(&mut self) {
        if let Some(world_matrix) = self.world_matrix_apply_buffer {
            let invertable = world_matrix.determinant() != 0.0;
            if invertable {
                self.world_matrix = world_matrix;
                self.world_matrix_inverse = world_matrix.inverse();
            } else {
                self.world_matrix = Mat4::IDENTITY;
                self.world_matrix_inverse = Mat4::IDENTITY;
            }
            self.world_matrix_apply_buffer = None;
        }
    }

    pub(super) fn world_matrix(&self) -> &Mat4 {
        &self.world_matrix
    }
    
    pub(super) fn world_matrix_inverse(&self) -> &Mat4 {
        &self.world_matrix_inverse
    }

    pub(crate) fn mark_as_need_init(&mut self) {
        self.need_init_apply_buffer = true;
    }

    pub(crate) fn apply_need_init(&mut self) {
        if self.need_init_apply_buffer {
            self.need_init = true;
            self.need_init_apply_buffer = false;
        }
    }

    pub(super) fn flush_need_init(&mut self) -> bool {
        let need_init = self.need_init;
        self.need_init = false;
        need_init
    }
}
