use glam::Mat4;

use super::physics_model_handle::PhysicsModelHandle;

pub(crate) struct PhysicsModelContext {
    physics_handle: PhysicsModelHandle,
    kinematic_shared_physics_handles: Vec<PhysicsModelHandle>,
    
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
        physics_handle: PhysicsModelHandle,
        kinematic_shared_physics_handles: Vec<PhysicsModelHandle>,
        world_matrix: Mat4,
    ) -> Self {
        Self {
            physics_handle,
            kinematic_shared_physics_handles,

            world_matrix_apply_buffer: None,
            world_matrix,
            world_matrix_inverse: world_matrix.inverse(),
            
            need_init_apply_buffer: false,
            need_init: false,
        }
    }

    pub(super) fn physics_handle(&self) -> &PhysicsModelHandle {
        &self.physics_handle
    }

    pub(super) fn kinematic_shared_physics_handles(&self) -> &[PhysicsModelHandle] {
        &self.kinematic_shared_physics_handles
    }

    pub(crate) fn set_world_matrix(&mut self, world_matrix: Mat4) {
        self.world_matrix_apply_buffer = Some(world_matrix);
    }

    pub (crate) fn apply_world_matrix(&mut self) {
        if let Some(world_matrix) = self.world_matrix_apply_buffer {
            self.world_matrix = world_matrix;
            self.world_matrix_inverse = world_matrix.inverse();
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
