use glam::Vec3;

#[link(name = "bullet")]
extern "C" {
    fn bw_create_boxshape(x: f32, y: f32, z: f32) -> *mut std::ffi::c_void;

    fn bw_destroy_boxshape(shape: *mut std::ffi::c_void);

    fn bw_create_sphereshape(radius: f32) -> *mut std::ffi::c_void;

    fn bw_destroy_sphereshape(shape: *mut std::ffi::c_void);

    fn bw_create_capsuleshape(radius: f32, height: f32) -> *mut std::ffi::c_void;

    fn bw_destroy_capsuleshape(shape: *mut std::ffi::c_void);

    fn bw_create_staticplaneshape(normal_x: f32, normal_y: f32, normal_z: f32, plane_constant: f32) -> *mut std::ffi::c_void;

    fn bw_destroy_staticplaneshape(shape: *mut std::ffi::c_void);
}

pub(crate) struct BoxShape {
    ptr: *mut std::ffi::c_void,
}

impl BoxShape {
    pub(crate) fn new(size: Vec3) -> Self {
        Self {
            ptr: unsafe { bw_create_boxshape(size.x, size.y, size.z) },
        }
    }

    pub(crate) fn ptr(&self) -> *const std::ffi::c_void {
        self.ptr
    }
}

impl Drop for BoxShape {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("BoxShape already dropped");
        }

        unsafe { bw_destroy_boxshape(self.ptr); }

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}

pub(crate) struct SphereShape {
    ptr: *mut std::ffi::c_void,
}

impl SphereShape {
    pub(crate) fn new(radius: f32) -> Self {
        Self {
            ptr: unsafe { bw_create_sphereshape(radius) },
        }
    }

    pub(crate) fn ptr(&self) -> *const std::ffi::c_void {
        self.ptr
    }
}

impl Drop for SphereShape {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("SphereShape already dropped");
        }

        unsafe { bw_destroy_sphereshape(self.ptr); }

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}

pub(crate) struct CapsuleShape {
    ptr: *mut std::ffi::c_void,
}

impl CapsuleShape {
    pub(crate) fn new(radius: f32, height: f32) -> Self {
        Self {
            ptr: unsafe { bw_create_capsuleshape(radius, height) },
        }
    }

    pub(crate) fn ptr(&self) -> *const std::ffi::c_void {
        self.ptr
    }
}

impl Drop for CapsuleShape {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("CapsuleShape already dropped");
        }

        unsafe { bw_destroy_capsuleshape(self.ptr); }

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}

pub(crate) struct StaticPlaneShape {
    ptr: *mut std::ffi::c_void,
}

impl StaticPlaneShape {
    pub(crate) fn new(normal: Vec3, plane_constant: f32) -> Self {
        Self {
            ptr: unsafe { bw_create_staticplaneshape(normal.x, normal.y, normal.z, plane_constant) },
        }
    }

    pub(crate) fn ptr(&self) -> *const std::ffi::c_void {
        self.ptr
    }
}

impl Drop for StaticPlaneShape {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("StaticPlaneShape already dropped");
        }

        unsafe { bw_destroy_staticplaneshape(self.ptr) };

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}
