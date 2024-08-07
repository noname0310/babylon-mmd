extern crate alloc;

// malloc and free reference:
// https://github.com/rust-embedded-community/tinyrlibc/blob/master/src/malloc.rs

/// `size_t`
type CSizeT = usize;

// The maximum alignment of any fundamental type. Equivalent to max_align_t
const MAX_ALIGN: usize = 16;

/// Rust implementation of C library function `malloc`
///
/// See [malloc](https://linux.die.net/man/3/malloc) for alignment details.
#[no_mangle]
unsafe extern "C" fn bw_malloc(size: CSizeT) -> *mut u8 {
    // size + MAX_ALIGN for to store the size of the allocated memory.
    let layout = alloc::alloc::Layout::from_size_align(size + MAX_ALIGN, MAX_ALIGN).unwrap();
    let ptr = unsafe { alloc::alloc::alloc(layout) };
    if ptr.is_null() {
        return ptr;
    }
    unsafe {
        *(ptr as *mut CSizeT) = size;
    }
    ptr.add(MAX_ALIGN)
}

/// Rust implementation of C library function `free`
#[no_mangle]
unsafe extern "C" fn bw_free(ptr: *mut u8) {
    if ptr.is_null() {
        return;
    }
    let old_size = unsafe { *(ptr.sub(MAX_ALIGN) as *mut CSizeT) };
    let layout = alloc::alloc::Layout::from_size_align(old_size + MAX_ALIGN, MAX_ALIGN).unwrap();
    unsafe { alloc::alloc::dealloc(ptr.sub(MAX_ALIGN), layout) };
}
