use std::collections::BTreeMap;

use glam::Vec3;

use super::constraint::{Constraint, ConstraintConstructionInfo};
use super::rigidbody::{Rigidbody, RigidbodyConstructionInfo};

#[link(name = "bullet")]
extern "C" {
    fn bt_create_world() -> *mut std::ffi::c_void;

    fn bt_destroy_world(world: *mut std::ffi::c_void);

    fn bt_world_set_gravity(world: *mut std::ffi::c_void, x: f32, y: f32, z: f32);

    fn bt_world_step_simulation(world: *mut std::ffi::c_void, time_step: f32, max_sub_steps: i32, fixed_time_step: f32);

    fn bt_world_add_rigidbody(world: *mut std::ffi::c_void, body: *mut std::ffi::c_void);

    fn bt_world_remove_rigidbody(world: *mut std::ffi::c_void, body: *mut std::ffi::c_void);

    fn bt_world_add_constraint(world: *mut std::ffi::c_void, constraint: *mut std::ffi::c_void);

    fn bt_world_remove_constraint(world: *mut std::ffi::c_void, constraint: *mut std::ffi::c_void);
}

pub(crate) type RigidbodyHandle = i32;

pub(crate) struct PhysicsObject {
    world: *mut std::ffi::c_void,
    bodies: Vec<Rigidbody>,
    constraints: Vec<Constraint>,
}

impl PhysicsObject {
    fn new(world: *mut std::ffi::c_void) -> Self {
        Self {
            world,
            bodies: Vec::new(),
            constraints: Vec::new(),
        }
    }

    pub(crate) fn create_rigidbody(&mut self, info: &RigidbodyConstructionInfo) -> RigidbodyHandle {
        let mut body = Rigidbody::new(info);
        unsafe { bt_world_add_rigidbody(self.world, body.get_body_mut()) };
        self.bodies.push(body);
        self.bodies.len() as RigidbodyHandle - 1
    }

    pub(crate) fn create_constraint(&mut self, info: &ConstraintConstructionInfo) -> Result<(), String> {
        let mut constraint = Constraint::new(info, &self.bodies)?;
        unsafe { bt_world_add_constraint(self.world, constraint.get_constraint_mut()) };
        self.constraints.push(constraint);
        Ok(())
    }
    
    pub(crate) fn bodies(&self) -> &Vec<Rigidbody> {
        &self.bodies
    }

    pub(crate) fn bodies_mut(&mut self) -> &mut Vec<Rigidbody> {
        &mut self.bodies
    }

    pub(crate) fn constraints(&self) -> &Vec<Constraint> {
        &self.constraints
    }

    pub(crate) fn constraints_mut(&mut self) -> &mut Vec<Constraint> {
        &mut self.constraints
    }
}

impl Drop for PhysicsObject {
    fn drop(&mut self) {
        for body in &mut self.bodies {
            unsafe { bt_world_remove_rigidbody(self.world, body.get_body_mut()) };
        }
        for constraint in &mut self.constraints {
            unsafe { bt_world_remove_constraint(self.world, constraint.get_constraint_mut()) };
        }
    }
}

type PhysicsObjectHandle = u32;

pub(crate) struct PhysicsWorld {
    world: *mut std::ffi::c_void,
    objects: BTreeMap<PhysicsObjectHandle, PhysicsObject>,
}

impl PhysicsWorld {
    pub(crate) fn new() -> Self {
        let world = unsafe { bt_create_world() };
        Self { 
            world,
            objects: BTreeMap::new(),
        }
    }

    pub(crate) fn set_gravity(&mut self, gravity: Vec3) {
        unsafe { bt_world_set_gravity(self.world, gravity.x, gravity.y, gravity.z) };
    }

    pub(crate) fn step_simulation(&mut self, time_step: f32, max_sub_steps: i32, fixed_time_step: f32) {
        unsafe { bt_world_step_simulation(self.world, time_step, max_sub_steps, fixed_time_step) };
    }

    pub(crate) fn create_physics_object(&mut self, handle: PhysicsObjectHandle) -> &mut PhysicsObject {
        let object = PhysicsObject::new(self.world);
        self.objects.insert(handle, object);
        self.objects.get_mut(&handle).unwrap()
    }

    pub(crate) fn destroy_physics_object(&mut self, handle: PhysicsObjectHandle) {
        self.objects.remove(&handle);
    }

    pub(crate) fn get_physics_object(&self, handle: PhysicsObjectHandle) -> &PhysicsObject {
        self.objects.get(&handle).unwrap()
    }

    pub(crate) fn get_physics_object_mut(&mut self, handle: PhysicsObjectHandle) -> &mut PhysicsObject {
        self.objects.get_mut(&handle).unwrap()
    }

    pub(crate) fn remove_physics_object(&mut self, handle: PhysicsObjectHandle) {
        self.objects.remove(&handle);
    }
}

impl Drop for PhysicsWorld {
    fn drop(&mut self) {
        self.objects.clear();
        unsafe { bt_destroy_world(self.world) };
    }
}

unsafe impl Send for PhysicsWorld {}
