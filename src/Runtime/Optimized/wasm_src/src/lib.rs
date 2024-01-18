mod animation_arena;
mod ik_solver;
mod mmd_model;
mod mmd_runtime_bone;
mod mmd_runtime;
mod append_transform_solver;
mod mmd_model_metadata;
mod mmd_morph_controller;
mod animation;
mod unchecked_slice;
mod threading;

use crossbeam_channel::Receiver;
use rayon::ThreadBuilder;
use wasm_bindgen::prelude::*;
use web_sys::js_sys::WebAssembly;

#[wasm_bindgen(js_name = init)]
pub fn init() -> WebAssembly::Module {
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();

    return wasm_bindgen::module().unchecked_into()
}

#[wasm_bindgen(js_name = createMmdRuntime)]
pub fn create_mmd_runtime() -> mmd_runtime::MmdRuntime {
    mmd_runtime::MmdRuntime::new()
}

#[wasm_bindgen(js_name = createAnimationPool)]
pub fn create_animation_pool() -> animation::animation_pool::AnimationPool {
    animation::animation_pool::AnimationPool::new()
}

#[wasm_bindgen(js_name = createWorkerPoolBuilder)]
pub fn create_worker_pool_builder(thread_count: usize) -> threading::worker_pool_builder::WorkerPoolBuilder {
    threading::worker_pool_builder::WorkerPoolBuilder::new(thread_count)
}

#[wasm_bindgen(js_name = workerEntry)]
pub fn worker_entry(receiver: *const Receiver<ThreadBuilder>) {
    threading::worker_pool_builder::worker_entry(receiver);
}
