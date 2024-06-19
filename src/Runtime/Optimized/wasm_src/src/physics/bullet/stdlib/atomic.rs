#[no_mangle]
extern "C" fn bw_get_thread_id() -> usize {
    thread_id::get()
}

pub struct UnsafeManualMutex {
    mutex: wasm_sync::Mutex<()>,
    guard: Option<&'static mut std::sync::MutexGuard<'static, ()>>,
}

impl UnsafeManualMutex {
    fn new() -> Self {
        let mutex = wasm_sync::Mutex::new(());
        let guard = None;

        Self { mutex, guard }
    }

    fn lock(&mut self) -> u8 {
        match self.mutex.lock() {
            Ok(guard) => {
                let guard = unsafe {
                    std::mem::transmute::<
                        std::sync::MutexGuard<'_, ()>,
                        std::sync::MutexGuard<'static, ()>
                    >(guard)
                };
                self.guard = Some(Box::leak(Box::new(guard)));
                0
            }
            Err(_) => 1,
        }
    }

    fn unlock(&mut self) -> u8 {
        match self.guard.take() {
            Some(guard) => {
                unsafe {
                    let _ = Box::from_raw(guard as *mut std::sync::MutexGuard<()>);
                }
                0
            }
            None => 1,
        }
    }
}

#[no_mangle]
unsafe extern "C" fn bw_mutex_init() -> *mut UnsafeManualMutex {
    let mutex = Box::new(UnsafeManualMutex::new());
    let ptr = Box::leak(mutex) as *mut UnsafeManualMutex;
    ptr
}

// there's no destroy bw_mutex has memory leak, but it's fine because it's used only for global mutex
// #[no_mangle]
// unsafe extern "C" fn bw_mutex_destroy(mutex: *mut ManualMutex) {
//     unsafe {
//         Box::from_raw(mutex);
//     }
// }

#[no_mangle]
unsafe extern "C" fn bw_mutex_lock(mutex: *mut UnsafeManualMutex) -> u8 {
    unsafe { &mut *mutex }.lock()
}

#[no_mangle]
unsafe extern "C" fn bw_mutex_unlock(mutex: *mut UnsafeManualMutex) -> u8 {
    unsafe { &mut *mutex }.unlock()
}

#[no_mangle]
unsafe extern "C" fn bw_cond_init() -> *mut wasm_sync::Condvar {
    let cond = Box::new(wasm_sync::Condvar::new());
    let ptr = Box::leak(cond) as *mut wasm_sync::Condvar;
    ptr
}

// there's no destroy bw_cond has memory leak, but it's fine because it's used only for global mutex
// #[no_mangle]
// unsafe extern "C" fn bw_cond_destroy(cond: *mut wasm_sync::Condvar) {
//     unsafe {
//         Box::from_raw(cond);
//     }
// }

#[no_mangle]
unsafe extern "C" fn bw_cond_wait(cond: *mut wasm_sync::Condvar, manual_mutex: *mut UnsafeManualMutex) -> u8 {
    let manual_mutex = unsafe { &mut *manual_mutex };

    let guard = match manual_mutex.guard.take() {
        Some(guard) => unsafe { Box::from_raw(guard as *mut std::sync::MutexGuard<()>) },
        None => return 1,
    };

    match unsafe { &*cond }.wait(*guard) {
        Ok(guard) => {
            manual_mutex.guard = Some(Box::leak(Box::new(guard)));
            0
        }
        Err(_) => 1,
    }
}

#[no_mangle]
unsafe extern "C" fn bw_cond_broadcast(cond: *mut wasm_sync::Condvar) -> u8 {
    unsafe { &*cond }.notify_all();
    0
}
