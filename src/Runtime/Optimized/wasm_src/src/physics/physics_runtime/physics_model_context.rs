use super::physics_model_handle::PhysicsModelHandle;

pub(crate) struct PhysicsModelContext {
    physics_handle: PhysicsModelHandle,
    kinematic_shared_physics_handles: Vec<PhysicsModelHandle>,
}

impl PhysicsModelContext {
    pub(super) fn new(
        physics_handle: PhysicsModelHandle,
        kinematic_shared_physics_handles: Vec<PhysicsModelHandle>,
    ) -> Self {
        Self {
            physics_handle,
            kinematic_shared_physics_handles,
        }
    }

    pub(super) fn physics_handle(&self) -> &PhysicsModelHandle {
        &self.physics_handle
    }

    pub(super) fn kinematic_shared_physics_handles(&self) -> &[PhysicsModelHandle] {
        &self.kinematic_shared_physics_handles
    }
}
