use wasm_bindgen::prelude::*;
use std::sync::atomic;

use super::multi_physics_world::{MultiPhysicsWorld, MultiPhysicsWorldHandle};

pub(crate) struct MultiPhysicsRuntime {
    multi_physics_world_handle: MultiPhysicsWorldHandle,
    lock: atomic::AtomicU8,
    #[cfg(debug_assertions)]
    ref_count: atomic::AtomicU32,
}

impl MultiPhysicsRuntime {
    pub(crate) fn new(handle: MultiPhysicsWorldHandle) -> Self {
        Self {
            multi_physics_world_handle: handle,
            lock: atomic::AtomicU8::new(0),
            #[cfg(debug_assertions)]
            ref_count: atomic::AtomicU32::new(0),
        }
    }
    
    pub(crate) fn get_lock_state_ptr(&self) -> *const u8 {
        &self.lock as *const atomic::AtomicU8 as *const u8
    }

    #[cfg(feature = "parallel")]
    pub(crate) fn buffered_step_simulation(mut runtime_handle: MultiPhysicsRuntimeHandle, time_step: f32, max_sub_steps: i32, fixed_time_step: f32) {
        let runtime = runtime_handle.get_mut();
        
        let multi_physics_world = runtime.multi_physics_world_handle.get_mut();
        multi_physics_world.sync_buffered_motion_state();
        
        runtime.lock.store(1, atomic::Ordering::Release);
    
        rayon::spawn(move || {
            let runtime = runtime_handle.get_mut();

            let multi_physics_world = runtime.multi_physics_world_handle.get_mut();
            multi_physics_world.step_simulation(time_step, max_sub_steps, fixed_time_step);

            runtime.lock.store(0, atomic::Ordering::Release);
        });
    }

    pub(crate) fn create_handle(&mut self) -> MultiPhysicsRuntimeHandle {
        MultiPhysicsRuntimeHandle::new(self)
    }
}

#[cfg(debug_assertions)]
impl Drop for MultiPhysicsRuntime {
    fn drop(&mut self) {
        if 0 < self.ref_count.load(atomic::Ordering::Acquire) {
            panic!("MultiPhysicsRuntime still has references");
        }
    }
}

pub(crate) struct MultiPhysicsRuntimeHandle {
    runtime: &'static mut MultiPhysicsRuntime,
}

impl MultiPhysicsRuntimeHandle {
    pub(crate) fn new(runtime: &mut MultiPhysicsRuntime) -> Self {
        let runtime = unsafe {
            std::mem::transmute::<&mut MultiPhysicsRuntime, &'static mut MultiPhysicsRuntime>(runtime)
        };

        #[cfg(debug_assertions)]
        {
            runtime.ref_count.fetch_add(1, atomic::Ordering::Release);
        }

        Self {
            runtime,
        }
    }
    
    pub(crate) fn get(&self) -> &MultiPhysicsRuntime {
        self.runtime
    }

    pub(crate) fn get_mut(&mut self) -> &mut MultiPhysicsRuntime {
        self.runtime
    }

    pub(crate) fn clone(&mut self) -> Self {
        Self::new(self.runtime)
    }
}

#[cfg(debug_assertions)]
impl Drop for MultiPhysicsRuntimeHandle {
    fn drop(&mut self) {
        self.runtime.ref_count.fetch_sub(1, atomic::Ordering::Release);
    }
}

impl PartialEq for MultiPhysicsRuntimeHandle {
    fn eq(&self, other: &Self) -> bool {
        std::ptr::eq(self.runtime as *const MultiPhysicsRuntime, other.runtime as *const MultiPhysicsRuntime)
    }
}

impl Eq for MultiPhysicsRuntimeHandle {}

#[wasm_bindgen(js_name = "createMultiPhysicsRuntime")]
pub fn create_multi_physics_runtime(physics_world: *mut usize) -> *mut usize {
    let physics_world = unsafe { &mut *(physics_world as *mut MultiPhysicsWorld) };
    let physics_runtime = MultiPhysicsRuntime::new(physics_world.create_handle());
    Box::into_raw(Box::new(physics_runtime)) as *mut usize
}

#[wasm_bindgen(js_name = "destroyMultiPhysicsRuntime")]
pub fn destroy_multi_physics_runtime(physics_runtime: *mut usize) {
    unsafe {
        let _ = Box::from_raw(physics_runtime as *mut MultiPhysicsRuntime);
    }
}

#[wasm_bindgen(js_name = "multiPhysicsRuntimeGetLockStatePtr")]
pub fn multi_physics_runtime_get_lock_state_ptr(runtime: *mut usize) -> *const u8 {
    let physics_runtime = unsafe { &mut *(runtime as *mut MultiPhysicsRuntime) };
    physics_runtime.get_lock_state_ptr()
}

#[cfg(feature = "parallel")]
#[wasm_bindgen(js_name = "multiPhysicsRuntimeBufferedStepSimulation")]
pub fn multi_physics_runtime_buffered_step_simulation(physics_runtime: *mut usize, time_step: f32, max_sub_steps: i32, fixed_time_step: f32) {
    let physics_runtime = unsafe { &mut *(physics_runtime as *mut MultiPhysicsRuntime) };
    MultiPhysicsRuntime::buffered_step_simulation(physics_runtime.create_handle(), time_step, max_sub_steps, fixed_time_step);
}
