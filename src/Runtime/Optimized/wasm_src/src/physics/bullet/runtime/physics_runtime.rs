use wasm_bindgen::prelude::*;
use std::sync::atomic;

use super::physics_world::{PhysicsWorld, PhysicsWorldHandle};

pub(crate) struct PhysicsRuntime {
    physics_world_handle: PhysicsWorldHandle,
    lock: atomic::AtomicU8,
    #[cfg(debug_assertions)]
    ref_count: atomic::AtomicU32,
}

impl PhysicsRuntime {
    pub(crate) fn new(handle: PhysicsWorldHandle) -> Self {
        Self {
            physics_world_handle: handle,
            lock: atomic::AtomicU8::new(0),
            #[cfg(debug_assertions)]
            ref_count: atomic::AtomicU32::new(0),
        }
    }
    
    pub(crate) fn get_lock_state_ptr(&self) -> *const u8 {
        &self.lock as *const atomic::AtomicU8 as *const u8
    }

    #[cfg(feature = "parallel")]
    pub(crate) fn buffered_step_simulation(mut runtime_handle: PhysicsRuntimeHandle, time_step: f32, max_sub_steps: i32, fixed_time_step: f32) {
        let runtime = runtime_handle.get_mut();
        
        let physics_world = runtime.physics_world_handle.get_mut();
        physics_world.sync_buffered_motion_state();
        
        runtime.lock.store(1, atomic::Ordering::Release);
        
        rayon::spawn(move || {
            let runtime = runtime_handle.get_mut();

            let physics_world = runtime.physics_world_handle.get_mut();
            physics_world.step_simulation(time_step, max_sub_steps, fixed_time_step);

            runtime.lock.store(0, atomic::Ordering::Release);
        });
    }

    pub(crate) fn create_handle(&mut self) -> PhysicsRuntimeHandle {
        PhysicsRuntimeHandle::new(self)
    }
}

#[cfg(debug_assertions)]
impl Drop for PhysicsRuntime {
    fn drop(&mut self) {
        if 0 < self.ref_count.load(atomic::Ordering::Acquire) {
            panic!("PhysicsRuntime still has references");
        }
    }
}

pub(crate) struct PhysicsRuntimeHandle {
    runtime: &'static mut PhysicsRuntime,
}

impl PhysicsRuntimeHandle {
    pub(crate) fn new(runtime: & mut PhysicsRuntime) -> Self {
        let runtime = unsafe {
            std::mem::transmute::<&mut PhysicsRuntime, &'static mut PhysicsRuntime>(runtime)
        };

        #[cfg(debug_assertions)]
        {
            runtime.ref_count.fetch_add(1, atomic::Ordering::Release);
        }

        Self {
            runtime,
        }
    }

    pub(crate) fn get(&self) -> &PhysicsRuntime {
        self.runtime
    }

    pub(crate) fn get_mut(&mut self) -> &mut PhysicsRuntime {
        self.runtime
    }

    pub(crate) fn clone(&mut self) -> Self {
        Self::new(self.runtime)
    }
}

#[cfg(debug_assertions)]
impl Drop for PhysicsRuntimeHandle {
    fn drop(&mut self) {
        self.runtime.ref_count.fetch_sub(1, atomic::Ordering::Release);
    }
}

impl PartialEq for PhysicsRuntimeHandle {
    fn eq(&self, other: &Self) -> bool {
        std::ptr::eq(self.runtime as *const PhysicsRuntime, other.runtime as *const PhysicsRuntime)
    }
}

impl Eq for PhysicsRuntimeHandle {}

#[wasm_bindgen(js_name = "createPhysicsRuntime")]
pub fn create_physics_runtime(physics_world: *mut usize) -> *mut usize {
    let physics_world = unsafe { &mut *(physics_world as *mut PhysicsWorld) };
    let physics_runtime = PhysicsRuntime::new(physics_world.create_handle());
    Box::into_raw(Box::new(physics_runtime)) as *mut usize
}

#[wasm_bindgen(js_name = "destroyPhysicsRuntime")]
pub fn destroy_physics_runtime(physics_runtime: *mut usize) {
    unsafe {
        let _ = Box::from_raw(physics_runtime as *mut PhysicsRuntime);
    }
}

#[wasm_bindgen(js_name = "physicsRuntimeGetLockStatePtr")]
pub fn physics_runtime_get_lock_state_ptr(physics_runtime: *const usize) -> *const u8 {
    let physics_runtime = unsafe { &*(physics_runtime as *const PhysicsRuntime) };
    physics_runtime.get_lock_state_ptr()
}

#[cfg(feature = "parallel")]
#[wasm_bindgen(js_name = "physicsRuntimeBufferedStepSimulation")]
pub fn physics_runtime_buffered_step_simulation(physics_runtime: *mut usize, time_step: f32, max_sub_steps: i32, fixed_time_step: f32) {
    let physics_runtime = unsafe { &mut *(physics_runtime as *mut PhysicsRuntime) };
    PhysicsRuntime::buffered_step_simulation(physics_runtime.create_handle(), time_step, max_sub_steps, fixed_time_step);
}
