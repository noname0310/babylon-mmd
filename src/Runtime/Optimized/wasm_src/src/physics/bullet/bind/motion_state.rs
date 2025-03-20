use glam::{Mat4, Vec3, Vec3A, Vec4};

#[link(name = "bullet")]
extern "C" {
    fn bw_create_motion_state(transform_buffer: *const f32) -> *mut std::ffi::c_void;

    fn bw_destroy_motion_state(motion_state: *mut std::ffi::c_void);

    fn bw_create_motion_state_bundle(count: usize) -> *mut std::ffi::c_void;

    fn bw_destroy_motion_state_bundle(bundle: *mut std::ffi::c_void);

    fn bw_motion_state_bundle_get_motion_states_ptr(bundle: *const std::ffi::c_void) -> *mut std::ffi::c_void;

    fn bw_motion_state_bundle_get_count(bundle: *const std::ffi::c_void) -> usize;
}

#[repr(C, align(16))]
struct MotionStateRawRead {
    vtable: *const std::ffi::c_void,
    matrix_rowx: Vec3A,
    matrix_rowy: Vec3A,
    matrix_rowz: Vec3A,
    translation: Vec3A,
}

#[repr(C, align(16))]
struct MotionStateRawWrite {
    vtable: *const std::ffi::c_void,
    padding0: [u32; 3],
    matrix_rowx: Vec3,
    padding1: f32,
    matrix_rowy: Vec3,
    padding2: f32,
    matrix_rowz: Vec3,
    padding3: f32,
    translation: Vec3,
    padding4: f32,
}

pub(crate) struct MotionState {
    ptr: *mut std::ffi::c_void,
}

impl MotionState {
    pub(crate) fn new(transform: &Mat4) -> Self {
        let transform_buffer = transform.as_ref();
        Self {
            ptr: unsafe { bw_create_motion_state(transform_buffer.as_ptr()) },
        }
    }

    pub(crate) fn get_transform(&self) -> Mat4 {
        let raw = unsafe { &*(self.ptr as *const MotionStateRawRead) };
        Mat4::from_cols(
            Vec4::new(raw.matrix_rowx.x, raw.matrix_rowy.x, raw.matrix_rowz.x, 0.0),
            Vec4::new(raw.matrix_rowx.y, raw.matrix_rowy.y, raw.matrix_rowz.y, 0.0),
            Vec4::new(raw.matrix_rowx.z, raw.matrix_rowy.z, raw.matrix_rowz.z, 0.0),
            Vec4::new(raw.translation.x, raw.translation.y, raw.translation.z, 1.0),
        )
    }

    pub(crate) fn set_transform(&mut self, transform: &Mat4) {
        let raw = unsafe { &mut *(self.ptr as *mut MotionStateRawWrite) };
        raw.matrix_rowx = Vec3::new(transform.x_axis.x, transform.y_axis.x, transform.z_axis.x);
        raw.matrix_rowy = Vec3::new(transform.x_axis.y, transform.y_axis.y, transform.z_axis.y);
        raw.matrix_rowz = Vec3::new(transform.x_axis.z, transform.y_axis.z, transform.z_axis.z);
        raw.translation = Vec3::new(transform.w_axis.x, transform.w_axis.y, transform.w_axis.z);
    }

    pub(crate) fn copy_from(&self, other: &Self) {
        let raw = unsafe { &*(other.ptr as *const MotionStateRawRead) };
        let raw_write = unsafe { &mut *(self.ptr as *mut MotionStateRawWrite) };
        raw_write.matrix_rowx = raw.matrix_rowx.into();
        raw_write.matrix_rowy = raw.matrix_rowy.into();
        raw_write.matrix_rowz = raw.matrix_rowz.into();
        raw_write.translation = raw.translation.into();
    }

    pub(crate) fn ptr(&self) -> *const std::ffi::c_void {
        self.ptr
    }

    pub(crate) fn ptr_mut(&mut self) -> *mut std::ffi::c_void {
        self.ptr
    }
}

impl Drop for MotionState {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("MotionState already dropped");
        }

        unsafe { bw_destroy_motion_state(self.ptr) };

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}

pub(crate) struct MotionStateBundle {
    ptr: *mut std::ffi::c_void,
}

impl MotionStateBundle {
    pub(crate) fn new(count: usize) -> Self {
        Self {
            ptr: unsafe { bw_create_motion_state_bundle(count) },
        }
    }

    pub(crate) fn get_nth_motion_state_ptr_mut(&mut self, index: usize) -> *mut std::ffi::c_void {
        let motion_states_ptr = unsafe {
            bw_motion_state_bundle_get_motion_states_ptr(self.ptr) as *mut MotionStateRawWrite
        };

        unsafe { motion_states_ptr.add(index) as *mut std::ffi::c_void }
    }

    pub(crate) fn get_transform(&self, index: usize) -> Mat4 {
        let motion_states_ptr = unsafe {
            bw_motion_state_bundle_get_motion_states_ptr(self.ptr) as *mut MotionStateRawRead
        };

        let motion_state_ptr = unsafe { motion_states_ptr.add(index) };
        let raw = unsafe { &*motion_state_ptr };
        
        Mat4::from_cols(
            Vec4::new(raw.matrix_rowx.x, raw.matrix_rowy.x, raw.matrix_rowz.x, 0.0),
            Vec4::new(raw.matrix_rowx.y, raw.matrix_rowy.y, raw.matrix_rowz.y, 0.0),
            Vec4::new(raw.matrix_rowx.z, raw.matrix_rowy.z, raw.matrix_rowz.z, 0.0),
            Vec4::new(raw.translation.x, raw.translation.y, raw.translation.z, 1.0),
        )
    }

    pub(crate) fn set_transform(&mut self, index: usize, transform: &Mat4) {
        let motion_states_ptr = unsafe {
            bw_motion_state_bundle_get_motion_states_ptr(self.ptr) as *mut MotionStateRawWrite
        };

        let motion_state_ptr = unsafe { motion_states_ptr.add(index) };

        let raw = unsafe { &mut *motion_state_ptr };
        raw.matrix_rowx = Vec3::new(transform.x_axis.x, transform.y_axis.x, transform.z_axis.x);
        raw.matrix_rowy = Vec3::new(transform.x_axis.y, transform.y_axis.y, transform.z_axis.y);
        raw.matrix_rowz = Vec3::new(transform.x_axis.z, transform.y_axis.z, transform.z_axis.z);
        raw.translation = Vec3::new(transform.w_axis.x, transform.w_axis.y, transform.w_axis.z);
    }

    pub(crate) fn copy_from(&self, other: &Self) {
        let motion_states_ptr = unsafe {
            bw_motion_state_bundle_get_motion_states_ptr(self.ptr) as *mut MotionStateRawWrite
        };

        let other_motion_states_ptr = unsafe {
            bw_motion_state_bundle_get_motion_states_ptr(other.ptr) as *mut MotionStateRawRead
        };

        for i in 0..self.size() {
            let motion_state_ptr = unsafe { motion_states_ptr.add(i) };
            let other_motion_state_ptr = unsafe { other_motion_states_ptr.add(i) };

            let raw = unsafe { &*other_motion_state_ptr };
            let raw_write = unsafe { &mut *motion_state_ptr };
            raw_write.matrix_rowx = raw.matrix_rowx.into();
            raw_write.matrix_rowy = raw.matrix_rowy.into();
            raw_write.matrix_rowz = raw.matrix_rowz.into();
            raw_write.translation = raw.translation.into();
        }
    }

    pub(crate) fn get_motion_states_ptr(&self) -> *mut std::ffi::c_void {
        unsafe {
            bw_motion_state_bundle_get_motion_states_ptr(self.ptr)
        }
    }

    pub(crate) fn size(&self) -> usize {
        unsafe { bw_motion_state_bundle_get_count(self.ptr) }
    }
}

impl Drop for MotionStateBundle {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("MotionStateBundle already dropped");
        }

        unsafe { bw_destroy_motion_state_bundle(self.ptr) };

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}
