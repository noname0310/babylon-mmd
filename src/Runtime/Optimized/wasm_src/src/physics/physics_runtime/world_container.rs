use glam::Vec3;
use rustc_hash::FxHashMap;

use crate::physics::bullet::bind::physics_world::PhysicsWorld;

use super::{physics_model_context::PhysicsModelContext, physics_model_handle::PhysicsModelHandle};

#[cfg(feature = "parallel")]
use rayon::prelude::*;

pub(crate) type PhysicsWorldId = u32;

pub(super) struct WorldContainer {
    worlds: FxHashMap<PhysicsWorldId, Box<PhysicsWorld>>,
    gravity: Vec3,
}

impl WorldContainer {
    pub(super) fn new() -> Self {
        Self {
            worlds: FxHashMap::default(),
            gravity: Vec3::new(0.0, -98.0, 0.0),
        }
    }

    pub(super) fn get_gravity(&self) -> &Vec3 {
        &self.gravity
    }

    pub(super) fn set_gravity(&mut self, gravity: Vec3) {
        self.gravity = gravity;
        for world in self.worlds.values_mut() {
            world.set_gravity(gravity);
        }
    }

    pub(super) fn override_world_gravity(&mut self, world_id: PhysicsWorldId, gravity: Option<Vec3>) {
        let default_gravity = self.gravity;

        let world = self.get_world_mut(world_id);
        if let Some(world) = world {
            if let Some(gravity) = gravity {
                world.override_gravity(gravity);
            } else {
                world.restore_gravity(default_gravity);
            }
        }
    }

    pub(super) fn get_world_gravity(&self, world_id: PhysicsWorldId) -> Option<&Vec3> {
        let world = self.get_world(world_id)?;
        world.overridden_gravity().as_ref()
    }
    
    pub(super) fn get_or_create_world(&mut self, world_id: PhysicsWorldId) -> &mut PhysicsWorld {
        self.worlds.entry(world_id).or_insert_with(|| {
            let mut world = Box::new(PhysicsWorld::new());
            world.set_gravity(self.gravity);
            world
        })
    }

    pub(super) fn step_simulation(&mut self, time_step: f32, max_sub_steps: i32, fixed_time_step: f32) {
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

    fn get_world(&self, world_id: PhysicsWorldId) -> Option<&PhysicsWorld> {
        self.worlds.get(&world_id).map(|world| &**world)
    }

    fn get_world_mut(&mut self, world_id: PhysicsWorldId) -> Option<&mut PhysicsWorld> {
        self.worlds.get_mut(&world_id).map(|world| &mut **world)
    }

    pub(super) fn destroy_physics_context(&mut self, context: &PhysicsModelContext) {
        self.destroy_physics_model(context.physics_handle());
        for handle in context.kinematic_shared_physics_handles() {
            self.destroy_physics_model(handle);
        }
    }

    fn destroy_physics_model(&mut self, context: &PhysicsModelHandle) {
        let world = self.worlds.get_mut(&context.world_id()).unwrap();
        world.destroy_physics_object(context.object_handle());

        if world.objects_len() == 0 {
            self.worlds.remove(&context.world_id());
        }
    }
}
