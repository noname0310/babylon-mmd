mod animation_buffer;
mod ik_solver;
mod mmd_model;
mod mmd_runtime_bone;
mod mmd_runtime;
mod append_transform_solver;

use wasm_bindgen::prelude::*;
use web_sys::{console, js_sys::Float32Array};
use nalgebra::Vector3;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen(js_name = mainJs)]
pub fn main_js() -> Result<(), JsValue> {
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();

    // Your code goes here!
    console::log_1(&JsValue::from_str("Hello world!"));

    let vec = Vector3::new(1.0, 2.0, 3.0);

    console::log_1(&JsValue::from_str(&format!("Vector: {:?}", vec)));

    console::log_1(&JsValue::from_str(&format!("Size of Vector3: {}", std::mem::size_of::<Vector3<f32>>())));

    Ok(())
}

#[wasm_bindgen(js_name = sum)]
pub fn sum(ptr: *mut f32, count: usize) -> f32 {
    let data = unsafe { std::slice::from_raw_parts(ptr, count) };
    data.iter().sum()
}

#[wasm_bindgen(js_name = getVecPointer)]
pub fn get_vec_pointer(count: usize) -> *mut f32 {
    let mut v = Vec::with_capacity(count);
    let ptr = v.as_mut_ptr();
    std::mem::forget(v);
    ptr
}

#[wasm_bindgen(js_name = getArray)]
pub fn get_array(ptr: *mut f32, count: usize) -> Float32Array {
    unsafe { Float32Array::view(std::slice::from_raw_parts(ptr, count)) }
}

#[wasm_bindgen(js_name = f32BufferReadBenchmark)]
pub fn f32_buffer_read_benchmark(buffer: Float32Array) -> f32 {
    let mut sum = 0.0;
    for i in 0..buffer.length() {
        sum += buffer.get_index(i as u32);
    }
    sum
}

pub fn f32_buffer_to_vec_array_read_test(f32_arr: &Float32Array) -> Vec<f32> {
    let mut vec = Vec::with_capacity(f32_arr.length() as usize);
    for i in 0..f32_arr.length() {
        vec.push(f32_arr.get_index(i));
    }
    vec
}

use std::mem::ManuallyDrop;

pub fn to_arrays<const N: usize, T>(mut v: Vec<T>) -> Vec<[T; N]> {
    assert_eq!(v.len() % N, 0, "length not divisible by {N}");
    if v.capacity() % N != 0 {
        v.shrink_to_fit();
        assert_eq!(v.capacity() % N, 0, "capacity not divisible by {N} and we could not shrink to make it so");
    }
    let mut v = ManuallyDrop::new(v);
    let (ptr, len, cap) = (v.as_mut_ptr(), v.len(), v.capacity());
    // SAFETY:
    // * Global allocator is given `Vec<T> == Vec<T, Global>`
    // * an array has the same alingment as it's items
    // * len / N arrays of [T; N] have been initialized because len items have been initialized before
    // * capacity is divisible by N so the allocation is the same sisze
    unsafe { Vec::from_raw_parts(ptr.cast(), len / N, cap / N) }
}
