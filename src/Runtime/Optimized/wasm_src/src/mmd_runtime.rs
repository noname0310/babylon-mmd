use std::ptr::NonNull;
use std::sync::atomic;

use wasm_bindgen::prelude::*;

use crate::animation::mmd_runtime_animation::MmdRuntimeAnimation;
use crate::diagnostic::{Diagnostic, DiagnosticResult};
use crate::mmd_model::MmdModel;
use crate::mmd_model_metadata::MetadataBuffer;

#[cfg(feature = "physics")]
use crate::physics::physics_runtime::PhysicsRuntime;

#[cfg(feature = "parallel")]
use rayon::prelude::*;

#[wasm_bindgen]
pub struct MmdRuntime {
    #[cfg(feature = "physics")]
    physics_runtime: PhysicsRuntime,
    
    #[allow(clippy::vec_box)]
    mmd_models: Vec<Box<MmdModel>>,
    locked: atomic::AtomicU8,
    diagnostic: Diagnostic,
}

#[wasm_bindgen]
impl MmdRuntime {
    pub(crate) fn new() -> Self {
        MmdRuntime {
            #[cfg(feature = "physics")]
            physics_runtime: PhysicsRuntime::new(),

            mmd_models: Vec::new(),
            locked: atomic::AtomicU8::new(0),
            diagnostic: Diagnostic::new(),
        }
    }

    #[wasm_bindgen(js_name = "allocateBuffer")]
    pub fn allocate_buffer(&self, size: usize) -> *mut u8 {
        let mut vec = vec![0; size].into_boxed_slice();
        let ptr = vec.as_mut_ptr();
        std::mem::forget(vec);
        ptr
    }

    #[wasm_bindgen(js_name = "deallocateBuffer")]
    pub fn deallocate_buffer(&self, ptr: *mut u8, size: usize) {
        unsafe {
            let _ = Box::from_raw(std::slice::from_raw_parts_mut(ptr, size));
        }
    }

    #[wasm_bindgen(js_name = "createMmdModel")]
    pub fn create_mmd_model(&mut self, serialized_metadata_ptr: *const u8, serialized_metadata_size: usize) -> *mut usize {
        let serialized_metadata = unsafe {
            std::slice::from_raw_parts(serialized_metadata_ptr, serialized_metadata_size)
        };
        let metadata_buffer = MetadataBuffer::new(serialized_metadata);

        let mmd_model = Box::new(
            MmdModel::new(
                metadata_buffer,

                #[cfg(feature = "physics")]
                &mut self.physics_runtime,

                &mut self.diagnostic
            )
        );
        let ptr = &*mmd_model as *const MmdModel as *mut usize;
        self.mmd_models.push(mmd_model);
        ptr
    }

    #[wasm_bindgen(js_name = "destroyMmdModel")]
    pub fn destroy_mmd_model(&mut self, ptr: *mut usize) {
        let ptr = ptr as *mut MmdModel;
        let index = match self.mmd_models.iter().position(|mmd_model| &**mmd_model as *const MmdModel == ptr) {
            Some(index) => index,
            None => return,
        };

        #[cfg(not(feature = "physics"))]
        {
            self.mmd_models.remove(index);
        }
        #[cfg(feature = "physics")]
        {
            let model = self.mmd_models.remove(index);
            let context = model.physics_model_context();
            if let Some(context) = context {
                self.physics_runtime.destroy_physics_context(context);
            }
        }
    }

    #[wasm_bindgen(js_name = "getAnimationArena")]
    pub fn get_animation_bone_arena(&mut self, ptr: *mut usize) -> *mut f32 {
        let ptr = ptr as *mut MmdModel;
        let animation_arena = unsafe {
            &mut *ptr
        }.animation_arena_mut();
        animation_arena.bone_arena_mut().as_mut_ptr() as *mut f32
    }

    #[wasm_bindgen(js_name = "getAnimationIkSolverStateArena")]
    pub fn get_animation_iksolver_state_arena(&mut self, ptr: *mut usize) -> *mut u8 {
        let ptr = ptr as *mut MmdModel;
        let animation_arena = unsafe {
            &mut *ptr
        }.animation_arena_mut();
        animation_arena.iksolver_state_arena_mut().as_mut_ptr()
    }

    #[wasm_bindgen(js_name = "getAnimationMorphArena")]
    pub fn get_animation_morph_arena(&mut self, ptr: *mut usize) -> *mut f32 {
        let ptr = ptr as *mut MmdModel;
        let animation_arena = unsafe {
            &mut *ptr
        }.animation_arena_mut();
        animation_arena.morph_arena_mut().as_mut_ptr()
    }
    
    #[wasm_bindgen(js_name = "getBoneWorldMatrixArena")]
    pub fn get_bone_world_matrix_arena(&mut self, ptr: *mut usize) -> *mut f32 {
        let ptr = ptr as *mut MmdModel;
        let bone_arena = unsafe {
            &mut *ptr
        }.bone_arena_mut();
        bone_arena.world_matrix_arena_mut_ptr()
    }

    #[wasm_bindgen(js_name = "createBoneWorldMatrixBackBuffer")]
    pub fn create_bone_world_matrix_back_buffer(&mut self, ptr: *mut usize) -> *mut f32 {
        let ptr = ptr as *mut MmdModel;
        let bone_arena = unsafe {
            &mut *ptr
        }.bone_arena_mut();
        bone_arena.create_world_matrix_back_buffer()
    }

    #[wasm_bindgen(js_name = "setRuntimeAnimation")]
    pub fn set_runtime_animation(&mut self, ptr: *mut usize, runtime_animation: *mut usize) {
        let ptr = ptr as *mut MmdModel;

        let runtime_animation = NonNull::new(runtime_animation as *mut MmdRuntimeAnimation);

        let animation = unsafe {
            &mut *ptr
        }.runtime_animation_mut();
        *animation = runtime_animation;
    }

    #[wasm_bindgen(js_name = "setExternalPhysics")]
    pub fn set_external_physics(&mut self, ptr: *mut usize, external_physics: bool) {
        let ptr = ptr as *mut MmdModel;

        let physics = unsafe {
            &mut *ptr
        }.external_physics_mut();
        *physics = external_physics;
    }

    #[inline]
    fn before_physics_internal(
        &mut self,
        frame_time: Option<f32>,

        #[cfg(feature = "physics")]
        time_step: Option<f32>,
    ) {
        #[cfg(feature = "parallel")]
        {
            if 1 < self.mmd_models.len() {
                self.mmd_models.par_iter_mut().for_each(|mmd_model| {
                    mmd_model.before_physics(frame_time);
                });
            } else if !self.mmd_models.is_empty() {
                self.mmd_models[0].before_physics(frame_time);
            }
        }

        #[cfg(not(feature = "parallel"))]
        for mmd_model in &mut self.mmd_models {
            mmd_model.before_physics(frame_time);
        }

        #[cfg(feature = "physics")]
        self.physics_runtime.step_simulation(time_step.unwrap_or(1.0 / 60.0), &mut self.mmd_models);
    }

    #[cfg(feature = "physics")]
    #[wasm_bindgen(js_name = "beforePhysics")]
    pub fn before_physics(&mut self, frame_time: Option<f32>, time_step: Option<f32>) {
        self.apply_mmd_models_world_matrix();
        self.before_physics_internal(frame_time, time_step);
    }

    #[cfg(not(feature = "physics"))]
    #[wasm_bindgen(js_name = "beforePhysics")]
    pub fn before_physics(&mut self, frame_time: Option<f32>) {
        self.before_physics_internal(frame_time);
    }

    #[wasm_bindgen(js_name = "afterPhysics")]
    pub fn after_physics(&mut self) {
        #[cfg(feature = "parallel")]
        {
            if 1 < self.mmd_models.len() {
                self.mmd_models.par_iter_mut().for_each(|mmd_model| {
                    mmd_model.after_physics();
                });
            } else if !self.mmd_models.is_empty() {
                self.mmd_models[0].after_physics();
            }
        }

        #[cfg(not(feature = "parallel"))]
        for mmd_model in &mut self.mmd_models {
            mmd_model.after_physics();
        }
    }

    #[wasm_bindgen(js_name = "getLockStatePtr")]
    pub fn get_lock_state_ptr(&self) -> *const u8 {
        &self.locked as *const atomic::AtomicU8 as *const u8
    }

    #[wasm_bindgen(js_name = "swapWorldMatrixBuffer")]
    pub fn swap_world_matrix_buffer(&mut self) {
        for mmd_model in &mut self.mmd_models {
            mmd_model.bone_arena_mut().swap_buffer();
        }
    }

    #[inline]
    #[cfg(feature = "parallel")]
    fn buffered_before_physics_internal(
        mmd_runtime: &mut MmdRuntime,
        frame_time: Option<f32>,

        #[cfg(feature = "physics")]
        time_step: Option<f32>,
    ) {
        let mmd_runtime = unsafe {
            &mut *(mmd_runtime as *mut MmdRuntime)
        };

        #[cfg(feature = "physics")]
        mmd_runtime.apply_mmd_models_world_matrix();

        mmd_runtime.locked.store(1, atomic::Ordering::Release);
        rayon::spawn(move || {
            mmd_runtime.before_physics_internal(
                frame_time,
                
                #[cfg(feature = "physics")]
                time_step,
            );

            mmd_runtime.locked.store(0, atomic::Ordering::Release);
        });
    }

    #[cfg(feature = "physics")]
    #[cfg(feature = "parallel")]
    #[wasm_bindgen(js_name = "bufferedBeforePhysics")]
    pub fn buffered_before_physics(mmd_runtime: &mut MmdRuntime, frame_time: Option<f32>, time_step: Option<f32>) {
        MmdRuntime::buffered_before_physics_internal(mmd_runtime, frame_time, time_step);
    }

    #[cfg(not(feature = "physics"))]
    #[cfg(feature = "parallel")]
    #[wasm_bindgen(js_name = "bufferedBeforePhysics")]
    pub fn buffered_before_physics(mmd_runtime: &mut MmdRuntime, frame_time: Option<f32>) {
        MmdRuntime::buffered_before_physics_internal(mmd_runtime, frame_time);
    }

    #[inline]
    #[cfg(feature = "parallel")]
    fn buffered_update_internal(
        mmd_runtime: &mut MmdRuntime,
        frame_time: Option<f32>,

        #[cfg(feature = "physics")]
        time_step: Option<f32>,
    ) {
        let mmd_runtime = unsafe {
            &mut *(mmd_runtime as *mut MmdRuntime)
        };
        
        #[cfg(feature = "physics")]
        mmd_runtime.apply_mmd_models_world_matrix();

        mmd_runtime.locked.store(1, atomic::Ordering::Release);
        rayon::spawn(move || {
            mmd_runtime.before_physics_internal(
                frame_time,

                #[cfg(feature = "physics")]
                time_step,
            );
            mmd_runtime.after_physics();
            mmd_runtime.locked.store(0, atomic::Ordering::Release);
        });
    }

    #[cfg(not(feature = "physics"))]
    #[cfg(feature = "parallel")]
    #[wasm_bindgen(js_name = "bufferedUpdate")]
    pub fn buffered_update(mmd_runtime: &mut MmdRuntime, frame_time: Option<f32>) {
        MmdRuntime::buffered_update_internal(mmd_runtime, frame_time);
    }

    #[cfg(feature = "physics")]
    #[cfg(feature = "parallel")]
    #[wasm_bindgen(js_name = "bufferedUpdate")]
    pub fn buffered_update(mmd_runtime: &mut MmdRuntime, frame_time: Option<f32>, time_step: Option<f32>) {
        MmdRuntime::buffered_update_internal(mmd_runtime, frame_time, time_step);
    }

    #[wasm_bindgen(js_name = "acquireDiagnosticErrorResult")]
    pub fn acquire_diagnostic_error_result(&mut self) -> *const usize {
        let result = unsafe{ self.diagnostic.acquire_error_result() };
        result as *const DiagnosticResult as *const usize
    }

    #[wasm_bindgen(js_name = "acquireDiagnosticWarningResult")]
    pub fn acquire_diagnostic_warning_result(&mut self) -> *const usize {
        let result = unsafe{ self.diagnostic.acquire_warning_result() };
        result as *const DiagnosticResult as *const usize
    }

    #[wasm_bindgen(js_name = "acquireDiagnosticInfoResult")]
    pub fn acquire_diagnostic_info_result(&mut self) -> *const usize {
        let result = unsafe{ self.diagnostic.acquire_info_result() };
        result as *const DiagnosticResult as *const usize
    }

    #[wasm_bindgen(js_name = "releaseDiagnosticResult")]
    pub fn release_diagnostic_result(&mut self) {
        unsafe{ self.diagnostic.release_result(); }
    }
}

#[cfg(feature = "physics")]
use glam::{Vec3, Mat4};

#[cfg(feature = "physics")]
#[wasm_bindgen]
impl MmdRuntime {
    #[wasm_bindgen(js_name = "setPhysicsMaxSubSteps")]
    pub fn set_physics_max_sub_steps(&mut self, max_sub_steps: i32) {
        *self.physics_runtime.max_sub_steps_mut() = max_sub_steps;
    }

    #[wasm_bindgen(js_name = "setPhysicsFixedTimeStep")]
    pub fn set_physics_fixed_time_step(&mut self, fixed_time_step: f32) {
        *self.physics_runtime.fixed_time_step_mut() = fixed_time_step;
    }

    #[wasm_bindgen(js_name = "setPhysicsGravity")]
    pub fn set_physics_gravity(&mut self, gravity_x: f32, gravity_y: f32, gravity_z: f32) {
        self.physics_runtime.set_gravity(Vec3::new(gravity_x, gravity_y, gravity_z));
    }

    #[wasm_bindgen(js_name = "getPhysicsGravity")]
    pub fn get_physics_gravity(&self) -> *const f32 {
        self.physics_runtime.get_gravity().as_ref().as_ptr()
    }

    #[wasm_bindgen(js_name = "overridePhysicsGravity")]
    pub fn override_physics_gravity(&mut self, world_id: u32, gravity_x: f32, gravity_y: f32, gravity_z: f32) {
        self.physics_runtime.override_world_gravity(world_id, Some(Vec3::new(gravity_x, gravity_y, gravity_z)));
    }

    #[wasm_bindgen(js_name = "restorePhysicsGravity")]
    pub fn restore_physics_gravity(&mut self, world_id: u32) {
        self.physics_runtime.override_world_gravity(world_id, None);
    }

    #[wasm_bindgen(js_name = "getPhysicsWorldGravity")]
    pub fn get_physics_world_gravity(&self, world_id: u32) -> *const f32 {
        let gravity = self.physics_runtime.get_world_gravity(world_id);
        match gravity {
            Some(gravity) => gravity.as_ref().as_ptr(),
            None => std::ptr::null(),
        }
    }

    #[wasm_bindgen(js_name = "setMmdModelWorldMatrix")]
    pub fn set_mmd_model_world_matrix(&mut self, ptr: *mut usize, world_matrix: *const f32) {
        let ptr = ptr as *mut MmdModel;
        if let Some(context) = unsafe { &mut *ptr }.physics_model_context_mut() {
            let world_matrix = unsafe {
                Mat4::from_cols_slice(std::slice::from_raw_parts(world_matrix, 16))
            };
            context.set_world_matrix(world_matrix);
        }
    }

    fn apply_mmd_models_world_matrix(&mut self) {
        for mmd_model in &mut self.mmd_models {
            if let Some(context) = mmd_model.physics_model_context_mut() {
                context.apply_world_matrix();
            }
        }
    }

    #[wasm_bindgen(js_name = "markMmdModelPhysicsNeedInit")]
    pub fn mark_mmd_model_physics_need_init(&mut self, ptr: *mut usize) {
        let ptr = ptr as *mut MmdModel;
        if let Some(context) = unsafe { &mut *ptr }.physics_model_context_mut() {
            context.mark_need_init();
        }
    }
}

impl Default for MmdRuntime {
    fn default() -> Self {
        Self::new()
    }
}
