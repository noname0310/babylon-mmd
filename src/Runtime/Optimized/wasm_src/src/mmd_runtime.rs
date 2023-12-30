use wasm_bindgen::prelude::*;
use web_sys::js_sys::Uint8Array;

use crate::{mmd_model::MmdModel, mmd_model_metadata::MetadataBuffer};

#[wasm_bindgen]
pub struct MmdRuntime {
    mmd_models: Vec<MmdModel>,
}

#[wasm_bindgen]
impl MmdRuntime {
    pub fn new() -> Self {
        MmdRuntime {
            mmd_models: Vec::new(),
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

    #[wasm_bindgen(js_name = "bufferToUint8Array")]
    pub fn buffer_to_uint8_array(&self, ptr: *mut u8, size: usize) -> Uint8Array {
        let slice = unsafe {
            std::slice::from_raw_parts_mut(ptr, size)
        };
        unsafe {
            Uint8Array::view(slice)
        }
    }

    #[wasm_bindgen(js_name = "createMmdModel")]
    pub fn create_mmd_model(&mut self, serialized_metadata_ptr: *const u8, serialized_metadata_size: usize) -> usize {
        let serialized_metadata = unsafe {
            std::slice::from_raw_parts(serialized_metadata_ptr, serialized_metadata_size)
        };
        let metadata_buffer = MetadataBuffer::new(serialized_metadata);

        let mmd_model = MmdModel::new(metadata_buffer);
        self.mmd_models.push(mmd_model);
        self.mmd_models.len() - 1
    }
}
