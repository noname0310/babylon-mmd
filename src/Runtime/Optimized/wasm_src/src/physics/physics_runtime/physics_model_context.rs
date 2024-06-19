use glam::Mat4;

use super::physics_model_handle::PhysicsModelHandle;

pub(crate) struct PhysicsModelContext {
    physics_handle: PhysicsModelHandle,
    kinematic_shared_physics_handles: Vec<PhysicsModelHandle>,
    world_matrix: Mat4,
    world_matrix_inverse: Mat4,
}

impl PhysicsModelContext {
    pub(super) fn new(
        physics_handle: PhysicsModelHandle,
        kinematic_shared_physics_handles: Vec<PhysicsModelHandle>,
        world_matrix: Mat4,
    ) -> Self {
        Self {
            physics_handle,
            kinematic_shared_physics_handles,
            world_matrix,
            world_matrix_inverse: world_matrix.inverse(),
        }
    }

    pub(super) fn physics_handle(&self) -> &PhysicsModelHandle {
        &self.physics_handle
    }

    pub(super) fn kinematic_shared_physics_handles(&self) -> &[PhysicsModelHandle] {
        &self.kinematic_shared_physics_handles
    }

    pub(super) fn world_matrix(&self) -> &Mat4 {
        &self.world_matrix
    }
    
    pub(super) fn world_matrix_inverse(&self) -> &Mat4 {
        &self.world_matrix_inverse
    }

    pub(super) fn set_world_matrix(&mut self, world_matrix: Mat4) {
        self.world_matrix = world_matrix;
        self.world_matrix_inverse = world_matrix.inverse();
    }
}
