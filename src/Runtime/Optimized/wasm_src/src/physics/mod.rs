use std::sync::Once;

mod bt_bind;
mod bt_stdlib;

#[link(name = "bullet")]
extern "C" {
    fn __wasm_call_ctors();
}

static BULLET_GLOBAL_CTORS: Once = Once::new();

pub(crate) fn init() {
    BULLET_GLOBAL_CTORS.call_once(|| {
        unsafe { __wasm_call_ctors() };
    });
}
