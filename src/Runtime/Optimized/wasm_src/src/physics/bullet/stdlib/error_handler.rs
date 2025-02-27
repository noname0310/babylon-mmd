#[no_mangle]
extern "C" fn __cxa_pure_virtual() {
    panic!("pure virtual function call");
}

#[cfg(debug_assertions)]
#[no_mangle]
extern "C" fn bw_error(message: *const std::ffi::c_char, args: std::ffi::VaList) -> i32 {
    let mut str = String::new();
    let bytes_written  = unsafe {
        printf_compat::format(message as *const u8, args, printf_compat::output::fmt_write(&mut str))
    };
    web_sys::console::error_1(&str.into());
    bytes_written
}
