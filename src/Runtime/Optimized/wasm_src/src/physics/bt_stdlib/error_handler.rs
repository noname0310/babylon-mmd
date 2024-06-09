#[no_mangle]
extern "C" fn __cxa_pure_virtual() {
    panic!("pure virtual function call");
}
