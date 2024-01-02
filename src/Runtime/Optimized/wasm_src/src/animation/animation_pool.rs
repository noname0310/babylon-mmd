use super::{mmd_animation::MmdAnimation, mmd_runtime_animation::MmdRuntimeAnimation};

pub(crate) struct AnimationPool {
    animations: Vec<MmdAnimation>,
    runtime_animations: Vec<MmdRuntimeAnimation>,
    next_animation_id: u32,
    next_runtime_animation_id: u32,
}

impl AnimationPool {
    pub(crate) fn new() -> Self {
        Self {
            animations: Vec::new(),
            runtime_animations: Vec::new(),
            next_animation_id: 0,
            next_runtime_animation_id: 0,
        }
    }
}
