use glam::Mat4;

use crate::{mmd_model_metadata::RigidBodyPhysicsMode, physics::bullet::runtime::{rigidbody_bundle::RigidBodyBundle, rigidbody_construction_info::RigidBodyConstructionInfo}};

pub(super) struct RigidBodyProxyData {
    pub(super) linked_bone_index: Option<u32>,
    pub(super) body_offset_matrix: Mat4,
    pub(super) body_offset_inverse_matrix: Mat4,
    pub(super) physics_mode: RigidBodyPhysicsMode,
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
        assert!(info_list.len() == data_list.len());
        let inner = RigidBodyBundle::new(info_list);
        Self { inner, data_list }
    }

    pub(super) fn inner_mut(&mut self) -> &mut RigidBodyBundle {
        &mut self.inner
    }

    pub(super) fn linked_bone_index(&self, index: usize) -> Option<u32> {
        self.data_list[index].linked_bone_index
    }

    pub(super) fn get_transform(&self, index: usize) -> Mat4 {
        self.inner.get_buffered_motion_states().get_transform(index) * self.data_list[index].body_offset_inverse_matrix
    }

    pub(super) fn set_transform(&mut self, index: usize, transform: Mat4) {
        let transform = transform * self.data_list[index].body_offset_matrix;
        self.inner.get_motion_states_mut().set_transform(index, &transform);
    }

    pub(super) fn get_physics_mode(&self, index: usize) -> RigidBodyPhysicsMode {
        self.data_list[index].physics_mode
    }

    pub(super) fn set_physics_mode(&mut self, index: usize, mode: RigidBodyPhysicsMode) {
        self.data_list[index].physics_mode = mode;
    }

    pub(super) fn len(&self) -> usize {
        self.inner.len()
    }
}
