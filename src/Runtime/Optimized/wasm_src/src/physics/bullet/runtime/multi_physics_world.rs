use glam::Vec3;
use rustc_hash::FxHashMap;
use wasm_bindgen::prelude::*;

use super::constraint::{Constraint, ConstraintHandle};
use super::physics_world::PhysicsWorld;
use super::rigidbody::{RigidBody, RigidBodyHandle};
use super::rigidbody_bundle::{RigidBodyBundle, RigidBodyBundleHandle};

#[cfg(feature = "parallel")]
use rayon::prelude::*;

pub(crate) type PhysicsWorldId = u32;

#[cfg(debug_assertions)]
struct MultiPhysicsWorldHandleInfo {
    bodies: Vec<RigidBodyHandle>,
    body_bundles: Vec<RigidBodyBundleHandle>,
}

pub(crate) struct MultiPhysicsWorld {
    worlds: FxHashMap<PhysicsWorldId, PhysicsWorld>,
    gravity: Vec3,

    #[cfg(debug_assertions)]
    ref_count: u32,
    #[cfg(debug_assertions)]
    handle_info: MultiPhysicsWorldHandleInfo,
    
    // global bodies and bundles are added to all worlds
    global_bodies: Vec<RigidBodyHandle>,
    global_body_bundles: Vec<RigidBodyBundleHandle>,

    // orphan bodies and bundles are added to the world as only shadows
    orphan_bodies: Vec<RigidBodyHandle>,
    orphan_body_bundles: Vec<RigidBodyBundleHandle>,

    allow_dynamic_shadow: bool,
    use_motion_state_buffer: bool,
}

impl MultiPhysicsWorld {
    pub(crate) fn new(allow_dynamic_shadow: bool) -> Self {
        Self {
            worlds: FxHashMap::default(),
            gravity: Vec3::new(0.0, -10.0, 0.0),
            
            #[cfg(debug_assertions)]
            ref_count: 0,
            
            #[cfg(debug_assertions)]
            handle_info: MultiPhysicsWorldHandleInfo {
                bodies: Vec::new(),
                body_bundles: Vec::new(),
            },
            
            global_bodies: Vec::new(),
            global_body_bundles: Vec::new(),

            orphan_bodies: Vec::new(),
            orphan_body_bundles: Vec::new(),

            allow_dynamic_shadow,
            use_motion_state_buffer: false,
        }
    }

    fn get_or_create_world(&mut self, id: PhysicsWorldId) -> &mut PhysicsWorld {
        self.worlds.entry(id).or_insert_with(|| {
            let mut world = PhysicsWorld::new(self.use_motion_state_buffer);
            world.set_gravity(self.gravity);

            for body in self.global_bodies.iter_mut() {
                world.add_rigidbody_shadow(body.clone(), true);
            }
            for bundle in self.global_body_bundles.iter_mut() {
                world.add_rigidbody_bundle_shadow(bundle.clone(), self.allow_dynamic_shadow, true);
            }
            world
        })
    }

    fn get_world(&mut self, id: PhysicsWorldId) -> Option<&mut PhysicsWorld> {
        self.worlds.get_mut(&id)
    }

    fn remove_world_if_empty(&mut self, id: PhysicsWorldId) {
        if let Some(world) = self.worlds.get(&id) {
            if world.is_empty() {
                self.worlds.remove(&id);
            }
        }
    }

    pub(crate) fn set_gravity(&mut self, force: Vec3) {
        self.gravity = force;
        for (_, world) in self.worlds.iter_mut() {
            world.set_gravity(force);
        }
    }

    pub(crate) fn sync_buffered_motion_state(&mut self) {
        if !self.use_motion_state_buffer {
            return;
        }
        
        for body in self.global_bodies.iter_mut() {
            body.get_mut().sync_buffered_motion_state();
        }
        for bundle in self.global_body_bundles.iter_mut() {
            bundle.get_mut().sync_buffered_motion_states();
        }

        for body in self.orphan_bodies.iter_mut() {
            body.get_mut().sync_buffered_motion_state();
        }
        for bundle in self.orphan_body_bundles.iter_mut() {
            bundle.get_mut().sync_buffered_motion_states();
        }

        for (_, world) in self.worlds.iter_mut() {
            world.sync_buffered_motion_state();
        }
    }

    pub(crate) fn step_simulation(&mut self, time_step: f32, max_sub_steps: i32, fixed_time_step: f32) {
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
        {
            for (_, world) in self.worlds.iter_mut() {
                world.step_simulation(time_step, max_sub_steps, fixed_time_step);
            }
        }
    }

    pub(crate) fn add_rigidbody(&mut self, world_id: PhysicsWorldId, mut rigidbody: RigidBodyHandle) {
        #[cfg(debug_assertions)]
        {
            if self.handle_info.bodies.iter().any(|b| *b == rigidbody) {
                panic!("RigidBody already added to the world");
            }
            self.handle_info.bodies.push(rigidbody.clone());

            if self.global_bodies.iter().any(|b| *b == rigidbody) {
                panic!("RigidBody already added as global");
            }
        }

        self.get_or_create_world(world_id).add_rigidbody(rigidbody.clone());
        
        if rigidbody.get().has_orphan_ref() {
            // rigidbody is no longer an orphan, remove it from the orphan list
            if let Some(index) = self.orphan_bodies.iter().position(|b| *b == rigidbody) {
                self.orphan_bodies.remove(index);
            }
        }
    }

    pub(crate) fn remove_rigidbody(&mut self, world_id: PhysicsWorldId, mut rigidbody: RigidBodyHandle) {
        #[cfg(debug_assertions)]
        {
            if !self.handle_info.bodies.iter().any(|b| *b == rigidbody) {
                panic!("RigidBody not found in the world");
            }
            let index: usize = self.handle_info.bodies.iter().position(|r| *r == rigidbody).unwrap();
            self.handle_info.bodies.remove(index);
        }

        if rigidbody.get().has_orphan_ref() {
            // rigidbody is an orphan, add it to the orphan list
            self.orphan_bodies.push(rigidbody.clone());
        }

        if let Some(world) = self.get_world(world_id) { 
            world.remove_rigidbody(rigidbody)
        }
        self.remove_world_if_empty(world_id);
    }

    pub(crate) fn add_rigidbody_bundle(&mut self, world_id: PhysicsWorldId, mut bundle: RigidBodyBundleHandle) {
        #[cfg(debug_assertions)]
        {
            if self.handle_info.body_bundles.iter().any(|b| *b == bundle) {
                panic!("RigidBodyBundle already added to the world");
            }
            self.handle_info.body_bundles.push(bundle.clone());

            if self.global_body_bundles.iter().any(|b| *b == bundle) {
                panic!("RigidBodyBundle already added as global");
            }
        }

        self.get_or_create_world(world_id).add_rigidbody_bundle(bundle.clone());

        if bundle.get().has_orphan_ref() {
            // bundle is no longer an orphan, remove it from the orphan list
            if let Some(index) = self.orphan_body_bundles.iter().position(|b| *b == bundle) {
                self.orphan_body_bundles.remove(index);
            }
        }
    }

    pub(crate) fn remove_rigidbody_bundle(&mut self, world_id: PhysicsWorldId, mut bundle: RigidBodyBundleHandle) {
        #[cfg(debug_assertions)]
        {
            if !self.handle_info.body_bundles.iter().any(|b| *b == bundle) {
                panic!("RigidBodyBundle not found in the world");
            }
            let index: usize = self.handle_info.body_bundles.iter().position(|r| *r == bundle).unwrap();
            self.handle_info.body_bundles.remove(index);
        }

        if bundle.get().has_orphan_ref() {
            // bundle is an orphan, add it to the orphan list
            self.orphan_body_bundles.push(bundle.clone());
        }

        if let Some(world) = self.get_world(world_id) {
            world.remove_rigidbody_bundle(bundle);
        }
        self.remove_world_if_empty(world_id);
    }

    pub(crate) fn add_rigidbody_to_global(&mut self, mut rigidbody: RigidBodyHandle) {
        #[cfg(debug_assertions)]
        {
            if self.global_bodies.iter().any(|b| *b == rigidbody) {
                panic!("RigidBody already added to the global world");
            }

            if self.handle_info.bodies.iter().any(|b| *b == rigidbody) {
                panic!("RigidBody already added to the world");
            }
        }

        for (_, world) in self.worlds.iter_mut() {
            world.add_rigidbody_shadow(rigidbody.clone(), true);
        }
        self.global_bodies.push(rigidbody.clone());

        if self.use_motion_state_buffer {
            rigidbody.get_mut().acquire_buffered_motion_state(true);
        }
    }

    pub(crate) fn remove_rigidbody_from_global(&mut self, mut rigidbody: RigidBodyHandle) {
        #[cfg(debug_assertions)]
        {
            if !self.global_bodies.iter().any(|b| *b == rigidbody) {
                panic!("RigidBody not found in the global world");
            }
        }

        for i in 0..self.worlds.len() {
            let (id, world) = self.worlds.iter_mut().nth(i).unwrap();
            let id = *id;
            world.remove_rigidbody_shadow(rigidbody.clone(), true);
            self.remove_world_if_empty(id);
        }
        let index: usize = self.global_bodies.iter().position(|r| *r == rigidbody).unwrap();
        self.global_bodies.remove(index);

        if self.use_motion_state_buffer {
            rigidbody.get_mut().release_buffered_motion_state(true);
        }
    }

    pub(crate) fn add_rigidbody_bundle_to_global(&mut self, mut bundle: RigidBodyBundleHandle) {
        #[cfg(debug_assertions)]
        {
            if self.global_body_bundles.iter().any(|b| *b == bundle) {
                panic!("RigidBodyBundle already added to the global world");
            }

            if self.handle_info.body_bundles.iter().any(|b| *b == bundle) {
                panic!("RigidBodyBundle already added to the world");
            }
        }

        for (_, world) in self.worlds.iter_mut() {
            world.add_rigidbody_bundle_shadow(bundle.clone(), self.allow_dynamic_shadow, true);
        }
        self.global_body_bundles.push(bundle.clone());

        if self.use_motion_state_buffer {
            bundle.get_mut().acquire_buffered_motion_states(true);
        }
    }

    pub(crate) fn remove_rigidbody_bundle_from_global(&mut self, mut bundle: RigidBodyBundleHandle) {
        #[cfg(debug_assertions)]
        {
            if !self.global_body_bundles.iter().any(|b| *b == bundle) {
                panic!("RigidBodyBundle not found in the global world");
            }
        }

        for i in 0..self.worlds.len() {
            let (id, world) = self.worlds.iter_mut().nth(i).unwrap();
            let id = *id;
            world.remove_rigidbody_bundle_shadow(bundle.clone(), true);
            self.remove_world_if_empty(id);
        }
        let index: usize = self.global_body_bundles.iter().position(|r| *r == bundle).unwrap();
        self.global_body_bundles.remove(index);

        if self.use_motion_state_buffer {
            bundle.get_mut().release_buffered_motion_states(true);
        }
    }

    pub(crate) fn add_rigidbody_shadow(&mut self, world_id: PhysicsWorldId, mut rigidbody: RigidBodyHandle) {
        if !rigidbody.get().get_inner().is_static_or_kinematic() && !self.allow_dynamic_shadow {
            panic!("Dynamic shadow is not allowed");
        }
        // if self.allow_dynamic_shadow && !self.use_motion_state_buffer {
        //     panic!("Dynamic shadow requires motion state buffer");
        // }
        // if is dynamic and rigidbody is not in any world, throw error on js side
        self.get_or_create_world(world_id).add_rigidbody_shadow(rigidbody.clone(), false);

        // if rigidbody is not in any world, add it to the orphan list
        if !rigidbody.get().has_managed_ref() && !rigidbody.get().has_orphan_ref() {
            self.orphan_bodies.push(rigidbody.clone());
        }

        if self.use_motion_state_buffer {
            rigidbody.get_mut().acquire_buffered_motion_state(false);
        }
    }

    pub(crate) fn remove_rigidbody_shadow(&mut self, world_id: PhysicsWorldId, mut rigidbody: RigidBodyHandle) {
        if let Some(world) = self.get_world(world_id) {
            world.remove_rigidbody_shadow(rigidbody.clone(), false);
        }
        self.remove_world_if_empty(world_id);

        if self.use_motion_state_buffer {
            rigidbody.get_mut().release_buffered_motion_state(false);
        }

        // if rigidbody is not in any world, remove it from the orphan list
        if !rigidbody.get().has_managed_ref() && !rigidbody.get().has_orphan_ref() {
            if let Some(index) = self.orphan_bodies.iter().position(|b| *b == rigidbody) {
                self.orphan_bodies.remove(index);
            }
        }
    }

    pub(crate) fn add_rigidbody_bundle_shadow(&mut self, world_id: PhysicsWorldId, mut bundle: RigidBodyBundleHandle) {
        let allow_dynamic_shadow = self.allow_dynamic_shadow;
        // if allow_dynamic_shadow && !self.use_motion_state_buffer {
        //     panic!("Dynamic shadow requires motion state buffer");
        // }
        self.get_or_create_world(world_id).add_rigidbody_bundle_shadow(bundle.clone(), allow_dynamic_shadow, false);

        // if bundle is not in any world, add it to the orphan list
        if !bundle.get().has_managed_ref() && !bundle.get().has_orphan_ref() {
            self.orphan_body_bundles.push(bundle.clone());
        }

        if self.use_motion_state_buffer {
            bundle.get_mut().acquire_buffered_motion_states(false);
        }
    }

    pub(crate) fn remove_rigidbody_bundle_shadow(&mut self, world_id: PhysicsWorldId, mut bundle: RigidBodyBundleHandle) {
        if let Some(world) = self.get_world(world_id) {
            world.remove_rigidbody_bundle_shadow(bundle.clone(), false);
        }
        self.remove_world_if_empty(world_id);

        if self.use_motion_state_buffer {
            bundle.get_mut().release_buffered_motion_states(false);
        }

        // if bundle is not in any world, remove it from the orphan list
        if !bundle.get().has_managed_ref() && !bundle.get().has_orphan_ref() {
            if let Some(index) = self.orphan_body_bundles.iter().position(|b| *b == bundle) {
                self.orphan_body_bundles.remove(index);
            }
        }
    }

    pub(crate) fn add_constraint(&mut self, world_id: PhysicsWorldId, constraint: ConstraintHandle, disable_collisions_between_linked_bodies: bool) {
        self.get_or_create_world(world_id).add_constraint(constraint, disable_collisions_between_linked_bodies);
    }

    pub(crate) fn remove_constraint(&mut self, world_id: PhysicsWorldId, constraint: ConstraintHandle) {
        if let Some(world) = self.get_world(world_id) {
            world.remove_constraint(constraint);
        }
        self.remove_world_if_empty(world_id);
    }

    pub(crate) fn use_motion_state_buffer(&mut self, use_buffer: bool) {
        if self.use_motion_state_buffer == use_buffer {
            return;
        }

        if use_buffer {
            for body in self.global_bodies.iter_mut() {
                body.get_mut().acquire_buffered_motion_state(true);
            }
            for bundle in self.global_body_bundles.iter_mut() {
                bundle.get_mut().acquire_buffered_motion_states(true);
            }

            for (_, world) in self.worlds.iter_mut() {
                world.acquire_buffered_motion_state();
            }
        } else {
            for body in self.global_bodies.iter_mut() {
                body.get_mut().release_buffered_motion_state(true);
            }
            for bundle in self.global_body_bundles.iter_mut() {
                bundle.get_mut().release_buffered_motion_states(true);
            }

            for (_, world) in self.worlds.iter_mut() {
                world.release_buffered_motion_state();
            }
        }

        for (_, world) in self.worlds.iter_mut() {
            world.update_shadow_motion_state();
            world.set_use_motion_state_buffer(use_buffer);
        }

        self.use_motion_state_buffer = use_buffer;
    }

    pub(crate) fn create_handle(&mut self) -> MultiPhysicsWorldHandle {
        MultiPhysicsWorldHandle::new(self)
    }
}

unsafe impl Send for MultiPhysicsWorld {}

#[cfg(debug_assertions)]
impl Drop for MultiPhysicsWorld {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("MultiPhysicsWorld still has references");
        }
    }
}

pub(crate) struct MultiPhysicsWorldHandle {
    world: &'static mut MultiPhysicsWorld,
}

impl MultiPhysicsWorldHandle {
    pub(crate) fn new(world: &mut MultiPhysicsWorld) -> Self {
        let world = unsafe {
            std::mem::transmute::<&mut MultiPhysicsWorld, &'static mut MultiPhysicsWorld>(world)
        };

        #[cfg(debug_assertions)]
        {
            world.ref_count += 1;
        }

        Self {
            world,
        }
    }

    // pub(crate) fn get(&self) -> &MultiPhysicsWorld {
    //     self.world
    // }

    #[allow(dead_code)] // for suppressing warning on non-multithreaded builds
    pub(crate) fn get_mut(&mut self) -> &mut MultiPhysicsWorld {
        self.world
    }

    // pub(crate) fn clone(&mut self) -> Self {
    //     Self::new(self.world)
    // }
}

#[cfg(debug_assertions)]
impl Drop for MultiPhysicsWorldHandle {
    fn drop(&mut self) {
        self.world.ref_count -= 1;
    }
}

impl PartialEq for MultiPhysicsWorldHandle {
    fn eq(&self, other: &Self) -> bool {
        std::ptr::eq(self.world as *const MultiPhysicsWorld, other.world as *const MultiPhysicsWorld)
    }
}

impl Eq for MultiPhysicsWorldHandle {}

#[wasm_bindgen(js_name = "createMultiPhysicsWorld")]
pub fn create_multi_physics_world(allow_dynamic_shadow: bool) -> *mut usize {
    let world = MultiPhysicsWorld::new(allow_dynamic_shadow);
    let world = Box::new(world);
    Box::into_raw(world) as *mut usize
}

#[wasm_bindgen(js_name = "destroyMultiPhysicsWorld")]
pub fn destroy_multi_physics_world(world: *mut usize) {
    unsafe {
        let _ = Box::from_raw(world as *mut MultiPhysicsWorld);
    }
}

#[wasm_bindgen(js_name = "multiPhysicsWorldSetGravity")]
pub fn multi_physics_world_set_gravity(world: *mut usize, x: f32, y: f32, z: f32) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    world.set_gravity(Vec3::new(x, y, z));
}

#[wasm_bindgen(js_name = "multiPhysicsWorldStepSimulation")]
pub fn multi_physics_world_step_simulation(world: *mut usize, time_step: f32, max_sub_steps: i32, fixed_time_step: f32) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    world.sync_buffered_motion_state();
    world.step_simulation(time_step, max_sub_steps, fixed_time_step);
}

#[wasm_bindgen(js_name = "multiPhysicsWorldAddRigidBody")]
pub fn multi_physics_world_add_rigidbody(world: *mut usize, world_id: PhysicsWorldId, rigidbody: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let rigidbody = unsafe { &mut *(rigidbody as *mut RigidBody) };
    world.add_rigidbody(world_id, rigidbody.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldRemoveRigidBody")]
pub fn multi_physics_world_remove_rigidbody(world: *mut usize, world_id: PhysicsWorldId, rigidbody: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let rigidbody = unsafe { &mut *(rigidbody as *mut RigidBody) };
    world.remove_rigidbody(world_id, rigidbody.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldAddRigidBodyBundle")]
pub fn multi_physics_world_add_rigidbody_bundle(world: *mut usize, world_id: PhysicsWorldId, bundle: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let bundle = unsafe { &mut *(bundle as *mut RigidBodyBundle) };
    world.add_rigidbody_bundle(world_id, bundle.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldRemoveRigidBodyBundle")]
pub fn multi_physics_world_remove_rigidbody_bundle(world: *mut usize, world_id: PhysicsWorldId, bundle: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let bundle = unsafe { &mut *(bundle as *mut RigidBodyBundle) };
    world.remove_rigidbody_bundle(world_id, bundle.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldAddRigidBodyToGlobal")]
pub fn multi_physics_world_add_rigidbody_to_global(world: *mut usize, rigidbody: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let rigidbody = unsafe { &mut *(rigidbody as *mut RigidBody) };
    world.add_rigidbody_to_global(rigidbody.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldRemoveRigidBodyFromGlobal")]
pub fn multi_physics_world_remove_rigidbody_from_global(world: *mut usize, rigidbody: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let rigidbody = unsafe { &mut *(rigidbody as *mut RigidBody) };
    world.remove_rigidbody_from_global(rigidbody.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldAddRigidBodyBundleToGlobal")]
pub fn multi_physics_world_add_rigidbody_bundle_to_global(world: *mut usize, bundle: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let bundle = unsafe { &mut *(bundle as *mut RigidBodyBundle) };
    world.add_rigidbody_bundle_to_global(bundle.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldRemoveRigidBodyBundleFromGlobal")]
pub fn multi_physics_world_remove_rigidbody_bundle_from_global(world: *mut usize, bundle: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let bundle = unsafe { &mut *(bundle as *mut RigidBodyBundle) };
    world.remove_rigidbody_bundle_from_global(bundle.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldAddRigidBodyShadow")]
pub fn multi_physics_world_add_rigidbody_shadow(world: *mut usize, world_id: PhysicsWorldId, rigidbody: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let rigidbody = unsafe { &mut *(rigidbody as *mut RigidBody) };
    world.add_rigidbody_shadow(world_id, rigidbody.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldRemoveRigidBodyShadow")]
pub fn multi_physics_world_remove_rigidbody_shadow(world: *mut usize, world_id: PhysicsWorldId, rigidbody: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let rigidbody = unsafe { &mut *(rigidbody as *mut RigidBody) };
    world.remove_rigidbody_shadow(world_id, rigidbody.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldAddRigidBodyBundleShadow")]
pub fn multi_physics_world_add_rigidbody_bundle_shadow(world: *mut usize, world_id: PhysicsWorldId, bundle: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let bundle = unsafe { &mut *(bundle as *mut RigidBodyBundle) };
    world.add_rigidbody_bundle_shadow(world_id, bundle.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldRemoveRigidBodyBundleShadow")]
pub fn multi_physics_world_remove_rigidbody_bundle_shadow(world: *mut usize, world_id: PhysicsWorldId, bundle: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let bundle = unsafe { &mut *(bundle as *mut RigidBodyBundle) };
    world.remove_rigidbody_bundle_shadow(world_id, bundle.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldAddConstraint")]
pub fn multi_physics_world_add_constraint(world: *mut usize, world_id: PhysicsWorldId, constraint: *mut usize, disable_collisions_between_linked_bodies: bool) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let constraint = unsafe { &mut *(constraint as *mut Constraint) };
    world.add_constraint(world_id, constraint.create_handle(), disable_collisions_between_linked_bodies);
}

#[wasm_bindgen(js_name = "multiPhysicsWorldRemoveConstraint")]
pub fn multi_physics_world_remove_constraint(world: *mut usize, world_id: PhysicsWorldId, constraint: *mut usize) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    let constraint = unsafe { &mut *(constraint as *mut Constraint) };
    world.remove_constraint(world_id, constraint.create_handle());
}

#[wasm_bindgen(js_name = "multiPhysicsWorldUseMotionStateBuffer")]
pub fn multi_physics_world_use_motion_state_buffer(world: *mut usize, use_buffer: bool) {
    let world = unsafe { &mut *(world as *mut MultiPhysicsWorld) };
    world.use_motion_state_buffer(use_buffer);
}
