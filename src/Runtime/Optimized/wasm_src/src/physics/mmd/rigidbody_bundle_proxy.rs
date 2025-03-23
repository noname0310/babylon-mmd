use glam::Mat4;

use crate::{mmd_model_metadata::RigidBodyPhysicsMode, physics::bullet::runtime::{rigidbody_bundle::RigidBodyBundle, rigidbody_construction_info::RigidBodyConstructionInfo}};

pub(super) struct RigidBodyProxyData {
    linked_bone_index: Option<u32>,
    body_offset_matrix: Mat4,
    body_offset_matrix_inverse: Mat4,
    physics_mode: RigidBodyPhysicsMode,
}

pub(super) struct RigidBodyBundleProxy {
    inner: RigidBodyBundle,
    data_list: Box<[RigidBodyProxyData]>,
}

impl RigidBodyBundleProxy {
    pub(super) fn new(
        info_list: &mut [RigidBodyConstructionInfo],
        data_list: Box<[RigidBodyProxyData]>,
    ) -> Self {
        let inner = RigidBodyBundle::new(info_list);
        Self { inner, data_list }
    }

    pub(super) fn inner(&self) -> &RigidBodyBundle {
        &self.inner
    }

    pub(super) fn inner_mut(&mut self) -> &mut RigidBodyBundle {
        &mut self.inner
    }
}
