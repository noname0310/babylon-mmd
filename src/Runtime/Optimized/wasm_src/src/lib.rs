use wasm_bindgen::prelude::*;
use web_sys::console;
use nalgebra::Vector3;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn main_js() -> Result<(), JsValue> {
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();

    // Your code goes here!
    console::log_1(&JsValue::from_str("Hello world!"));

    let vec = Vector3::new(1.0, 2.0, 3.0);
    console::log_1(&JsValue::from_str(&format!("Vector: {:?}", vec)));

    Ok(())
}
