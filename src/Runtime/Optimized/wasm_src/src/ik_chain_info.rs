use glam::{Quat, Vec3A};

pub(crate) struct IkChainInfo {
    local_rotation: Quat,
    local_position: Vec3A,
    ik_rotation: Quat,
}

impl IkChainInfo {
    pub(crate) fn new() -> Self {
        IkChainInfo {
            local_rotation: Quat::IDENTITY,
            local_position: Vec3A::ZERO,
            ik_rotation: Quat::IDENTITY,
        }
    }

    pub(crate) fn reset_state(&mut self) {
        self.local_rotation = Quat::IDENTITY;
        self.local_position = Vec3A::ZERO;
        self.ik_rotation = Quat::IDENTITY;
    }

    #[inline]
    pub(crate) fn local_rotation(&self) -> Quat {
        self.local_rotation
    }

    #[inline]
    pub(crate) fn local_rotation_mut(&mut self) -> &mut Quat {
        &mut self.local_rotation
    }

    #[inline]
    pub(crate) fn local_position(&self) -> Vec3A {
        self.local_position
    }

    #[inline]
    pub(crate) fn local_position_mut(&mut self) -> &mut Vec3A {
        &mut self.local_position
    }

    #[inline]
    pub(crate) fn ik_rotation(&self) -> Quat {
        self.ik_rotation
    }

    #[inline]
    pub(crate) fn ik_rotation_mut(&mut self) -> &mut Quat {
        &mut self.ik_rotation
    }
}
