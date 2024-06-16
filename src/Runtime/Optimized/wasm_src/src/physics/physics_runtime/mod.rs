use rustc_hash::FxHashMap;

use super::bt_bind::physics_world::PhysicsWorld;

#[cfg(feature = "parallel")]
use rayon::prelude::*;

pub(crate) struct PhysicsRuntime {
    max_sub_steps: i32,
    fixed_time_step: f32,
    worlds: FxHashMap<u32, Box<PhysicsWorld>>,
}

impl PhysicsRuntime {
    pub(crate) fn new() -> Self {
        Self {
            max_sub_steps: 120,
            fixed_time_step: 1.0 / 120.0,
            worlds: FxHashMap::default(),
        }
    }

    pub(crate) fn max_sub_steps_mut(&mut self) -> &mut i32 {
        &mut self.max_sub_steps
    }

    pub(crate) fn fixed_time_step_mut(&mut self) -> &mut f32 {
        &mut self.fixed_time_step
    }

    pub(crate) fn step_simulation(self: &mut Self, time_step: f32) {
        let max_sub_steps = self.max_sub_steps;
        let fixed_time_step = self.fixed_time_step;

        #[cfg(feature = "parallel")]
        {
            if 1 < self.worlds.len() {
                self.worlds.par_iter_mut().for_each(|(_, world)| {
                    world.step_simulation(time_step, max_sub_steps, fixed_time_step);
                });
            } else if !self.worlds.is_empty() {
                self.worlds.values_mut().next().unwrap().step_simulation(time_step, max_sub_steps, fixed_time_step);
            }
        }

        #[cfg(not(feature = "parallel"))]
        for world in self.worlds.values_mut() {
            world.step_simulation(time_step, max_sub_steps, fixed_time_step);
        }
    }
}
