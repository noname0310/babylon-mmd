use std::sync::atomic;

#[repr(C)]
pub(crate) struct StringPtr {
    ptr: *const u8, // ptr must be 4 bytes
    len: usize,
}

unsafe impl Send for StringPtr {}

#[repr(C)]
pub(crate) struct DiagnosticResult {
    ptr: *const StringPtr, // ptr must be 4 bytes
    len: usize,
}

unsafe impl Send for DiagnosticResult {}

struct StringPtrBuffer {
    buffer: Vec<StringPtr>,
}

impl StringPtrBuffer {
    pub(crate) fn new() -> Self {
        StringPtrBuffer { buffer: Vec::new() }
    }

    pub(crate) fn set(&mut self, strings: &[String]) {
        self.buffer.clear();
        for string in strings {
            self.buffer.push(StringPtr {
                ptr: string.as_ptr(),
                len: string.len(),
            });
        }
    }
}

enum LogLevel {
    Error,
    Warning,
    Info,
    None,
}

pub(crate) struct Diagnostic {
    pub(crate) errors: Vec<String>,
    pub(crate) warnings: Vec<String>,
    pub(crate) infos: Vec<String>,
    ptr_buffer: StringPtrBuffer,
    result: DiagnosticResult,
    locked: atomic::AtomicU8,
    last_acquired: LogLevel,
}

impl Diagnostic {
    pub(crate) fn new() -> Self {
        let ptr_buffer = StringPtrBuffer::new();
        Diagnostic {
            errors: Vec::new(),
            warnings: Vec::new(),
            infos: Vec::new(),
            ptr_buffer,
            result: DiagnosticResult {
                ptr: std::ptr::null(),
                len: 0,
            },
            locked: atomic::AtomicU8::new(0),
            last_acquired: LogLevel::None,
        }
    }

    fn acquire_lock(&self) {
        while self.locked.compare_exchange(0, 1, atomic::Ordering::Acquire, atomic::Ordering::Relaxed).is_err() {
            std::thread::yield_now();
        }
    }

    fn release_lock(&self) {
        self.locked.store(0, atomic::Ordering::Release);
    }
    
    pub(crate) fn writer(&mut self) -> DiagnosticWriter {
        DiagnosticWriter::new(self)
    }
    
    fn update_result(&mut self) {
        self.result.ptr = self.ptr_buffer.buffer.as_ptr();
        self.result.len = self.ptr_buffer.buffer.len();
    }

    pub(crate) unsafe fn acquire_error_result(&mut self) -> &DiagnosticResult {
        self.acquire_lock();
        self.last_acquired = LogLevel::Error;

        self.ptr_buffer.set(&self.errors);
        self.update_result();
        &self.result
    }

    pub(crate) unsafe fn acquire_warning_result(&mut self) -> &DiagnosticResult {
        self.acquire_lock();
        self.last_acquired = LogLevel::Warning;

        self.ptr_buffer.set(&self.warnings);
        self.update_result();
        &self.result
    }

    pub(crate) unsafe fn acquire_info_result(&mut self) -> &DiagnosticResult {
        self.acquire_lock();
        self.last_acquired = LogLevel::Info;

        self.ptr_buffer.set(&self.infos);
        self.update_result();
        &self.result
    }

    pub(crate) unsafe fn release_result(&mut self) {
        match self.last_acquired {
            LogLevel::Error => {
                self.errors.clear();
            }
            LogLevel::Warning => {
                self.warnings.clear();
            }
            LogLevel::Info => {
                self.infos.clear();
            }
            LogLevel::None => {
                panic!("Diagnostic result was not acquired");
            }
        }
        self.release_lock();
        self.last_acquired = LogLevel::None;
    }
}

pub(crate) struct DiagnosticWriter<'a> {
    diagnostic: &'a mut Diagnostic,
}

impl<'a> DiagnosticWriter<'a> {
    pub(crate) fn new(diagnostic: &'a mut Diagnostic) -> Self {
        diagnostic.acquire_lock();
        DiagnosticWriter { diagnostic }
    }

    pub(crate) fn error(&mut self, message: String) {
        self.diagnostic.errors.push(message);
    }

    // pub(crate) fn warning(&mut self, message: String) {
    //     self.diagnostic.warnings.push(message);
    // }

    // pub(crate) fn info(&mut self, message: String) {
    //     self.diagnostic.infos.push(message);
    // }
}

impl<'a> Drop for DiagnosticWriter<'a> {
    fn drop(&mut self) {
        self.diagnostic.release_lock();
    }
}
