use wasm_bindgen::prelude::*;

use crate::mmd_model::MmdModel;

#[wasm_bindgen]
pub(crate) struct MmdRuntime {
    mmd_models: Vec<MmdModel>,
}

#[wasm_bindgen]
impl MmdRuntime {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        MmdRuntime {
            mmd_models: Vec::new(),
        }
    }

    #[wasm_bindgen(js_name = "addMmdModel")]
    pub fn add_mmd_model(&mut self) {
        
    }
}
