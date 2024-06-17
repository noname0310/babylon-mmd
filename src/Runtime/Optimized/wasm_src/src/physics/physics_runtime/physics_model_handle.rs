use crate::physics::bullet::bind::physics_world::PhysicsObjectHandle;

use super::PhysicsWorldId;

pub(super) struct PhysicsModelHandle {
    world_id: PhysicsWorldId,
    object_handle: PhysicsObjectHandle,
}

impl PhysicsModelHandle {
    pub(super) fn new(world_id: PhysicsWorldId, object_handle: PhysicsObjectHandle) -> Self {
        Self {
            world_id,
            object_handle,
        }
    }

    pub(super) fn world_id(&self) -> PhysicsWorldId {
        self.world_id
    }

    pub(super) fn object_handle(&self) -> PhysicsObjectHandle {
        self.object_handle
    }
}
