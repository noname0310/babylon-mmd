use glam::Mat4;

use crate::mmd_model_metadata::RigidBodyPhysicsMode;
use crate::physics::bullet::runtime::collision_shape::CollisionShape;
use crate::physics::bullet::runtime::constraint::Constraint;
use crate::physics::bullet::runtime::kinematic_state::KinematicToggleState;
use crate::physics::bullet::runtime::multi_physics_world::PhysicsWorldId;
use crate::physics::bullet::runtime::rigidbody_bundle::RigidBodyBundle;

use super::rigidbody_bundle_proxy::RigidBodyBundleProxy;

// for parallel iteration
unsafe impl Send for CollisionShape {}
unsafe impl Send for RigidBodyBundle {}
unsafe impl Send for Constraint {}

pub(crate) struct PhysicsModelContext {
    rigidbody_index_map: Box<[i32]>,
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

    synced_rigidbody_states: Box<[u8]>,
    disabled_rigidbody_count: usize,

    // 0: unknown, 1: kinematic, 2: target transform
    body_kinematic_toggle_map: Option<Box<[u8]>>,
}

impl PhysicsModelContext {
    pub(super) fn new(
        rigidbody_index_map: Box<[i32]>,
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

        let unmapped_rigidbody_count = rigidbody_index_map.len();
        
        Self {
            rigidbody_index_map,
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

            synced_rigidbody_states: vec![1; unmapped_rigidbody_count].into_boxed_slice(),
            disabled_rigidbody_count: 0,

            body_kinematic_toggle_map: None,
        }
    }

    pub(super) fn rigidbody_index_map(&self) -> &[i32] {
        &self.rigidbody_index_map
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

    pub(super) fn synced_rigidbody_states(&self) -> &[u8] {
        &self.synced_rigidbody_states
    }

    pub(crate) fn need_deoptimize(&self) -> bool {
        0 < self.disabled_rigidbody_count
    }

    pub(crate) fn commit_body_states(&mut self, rigidbody_states: &[u8]) {
        assert!(self.rigidbody_index_map.len() == rigidbody_states.len() 
            && self.rigidbody_index_map.len() == self.synced_rigidbody_states.len());

        for i in 0..self.rigidbody_index_map.len() {
            let index = self.rigidbody_index_map[i];
            if index == -1 {
                continue;
            }

            let physics_mode = self.bundle_proxy.get_physics_mode(index as usize);
            if physics_mode == RigidBodyPhysicsMode::FollowBone {
                continue;
            }

            let state = rigidbody_states[i];
            if state != self.synced_rigidbody_states[i] {
                self.synced_rigidbody_states[i] = state;
                if state != 0 {
                    self.disabled_rigidbody_count -= 1;
                    self.bundle_proxy.inner_mut().set_kinematic_toggle(
                        index as usize,
                        KinematicToggleState::Disabled
                    );
                } else {
                    self.disabled_rigidbody_count += 1;
                }
            }
        }
    }

    pub(super) fn create_or_initialize_body_kinematic_toggle_map(&mut self) -> &Box<[u8]> {
        if self.body_kinematic_toggle_map.is_none() {
            self.body_kinematic_toggle_map = Some(vec![0; self.rigidbody_index_map.len()].into_boxed_slice());
            return self.body_kinematic_toggle_map.as_ref().unwrap();
        } else {
            let map = self.body_kinematic_toggle_map.as_mut().unwrap();
            map.fill(0);
            return map;
        }
    }

    pub(super) fn body_kinematic_toggle_map(&self) -> Option<&Box<[u8]>> {
        self.body_kinematic_toggle_map.as_ref()
    }

    pub(super) fn body_kinematic_toggle_map_mut(&mut self) -> Option<&mut Box<[u8]>> {
        self.body_kinematic_toggle_map.as_mut()
    }
}
