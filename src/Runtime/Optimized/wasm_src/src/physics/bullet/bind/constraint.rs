use glam::{Vec3, Mat4};

use super::rigidbody::RigidBody;

#[link(name = "bullet")]
extern "C" {
    fn bw_create_generic6dofconstraint(body_a: *const std::ffi::c_void, body_b: *const std::ffi::c_void, frame_a: *const f32, frame_b: *const f32, use_linear_reference_frame_a: u8) -> *mut std::ffi::c_void;

    fn bw_destroy_generic6dofconstraint(constraint: *mut std::ffi::c_void);

    fn bw_generic6dofconstraint_set_linear_lower_limit(constraint: *mut std::ffi::c_void, x: f32, y: f32, z: f32);

    fn bw_generic6dofconstraint_set_linear_upper_limit(constraint: *mut std::ffi::c_void, x: f32, y: f32, z: f32);

    fn bw_generic6dofconstraint_set_angular_lower_limit(constraint: *mut std::ffi::c_void, x: f32, y: f32, z: f32);

    fn bw_generic6dofconstraint_set_angular_upper_limit(constraint: *mut std::ffi::c_void, x: f32, y: f32, z: f32);

    fn bw_generic6dofconstraint_set_param(constraint: *mut std::ffi::c_void, num: i32, value: f32, axis: i32);

    fn bw_create_generic6dofspringconstraint(body_a: *const std::ffi::c_void, body_b: *const std::ffi::c_void, frame_a: *const f32, frame_b: *const f32, use_linear_reference_frame_a: u8) -> *mut std::ffi::c_void;

    fn bw_destroy_generic6dofspringconstraint(constraint: *mut std::ffi::c_void);

    fn bw_generic6dofspringconstraint_enable_spring(constraint: *mut std::ffi::c_void, index: u8, on_off: u8);

    fn bw_generic6dofspringconstraint_set_stiffness(constraint: *mut std::ffi::c_void, index: u8, stiffness: f32);

    fn bw_generic6dofspringconstraint_set_damping(constraint: *mut std::ffi::c_void, index: u8, damping: f32);

    fn bw_create_mmdgeneric6dofspringconstraint(body_a: *const std::ffi::c_void, body_b: *const std::ffi::c_void, frame_a: *const f32, frame_b: *const f32, use_linear_reference_frame_a: u8) -> *mut std::ffi::c_void;

    fn bw_destroy_mmdgeneric6dofspringconstraint(constraint: *mut std::ffi::c_void);
}

pub(crate) struct Generic6DofConstraint {
    ptr: *mut std::ffi::c_void,
}

impl Generic6DofConstraint {
    pub(crate) fn new(body_a: &RigidBody, body_b: &RigidBody, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let frame_a = frame_a.as_ref();
        let frame_b = frame_b.as_ref();
        
        Self {
            ptr: unsafe { bw_create_generic6dofconstraint(body_a.ptr(), body_b.ptr(), frame_a.as_ptr(), frame_b.as_ptr(), use_linear_reference_frame_a as u8) },
        }
    }

    pub(crate) fn ptr_mut(&self) -> *mut std::ffi::c_void {
        self.ptr
    }

    pub(crate) fn set_linear_lower_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_linear_lower_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_linear_upper_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_linear_upper_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_angular_lower_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_angular_lower_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_angular_upper_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_angular_upper_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_param(&mut self, num: i32, value: f32, axis: i32) {
        unsafe { bw_generic6dofconstraint_set_param(self.ptr, num, value, axis) };
    }
}

impl Drop for Generic6DofConstraint {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("Generic6DofConstraint already dropped");
        }

        unsafe { bw_destroy_generic6dofconstraint(self.ptr) };

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}

pub(crate) struct Generic6DofSpringConstraint {
    ptr: *mut std::ffi::c_void,
}

impl Generic6DofSpringConstraint {
    pub(crate) fn new(body_a: &RigidBody, body_b: &RigidBody, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let frame_a = frame_a.as_ref();
        let frame_b = frame_b.as_ref();
        
        Self {
            ptr: unsafe { bw_create_generic6dofspringconstraint(body_a.ptr(), body_b.ptr(), frame_a.as_ptr(), frame_b.as_ptr(), use_linear_reference_frame_a as u8) },
        }
    }

    pub(crate) fn ptr_mut(&self) -> *mut std::ffi::c_void {
        self.ptr
    }

    pub(crate) fn set_linear_lower_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_linear_lower_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_linear_upper_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_linear_upper_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_angular_lower_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_angular_lower_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_angular_upper_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_angular_upper_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_param(&mut self, num: i32, value: f32, axis: i32) {
        unsafe { bw_generic6dofconstraint_set_param(self.ptr, num, value, axis) };
    }

    pub(crate) fn enable_spring(&mut self, index: u8, on_off: bool) {
        unsafe { bw_generic6dofspringconstraint_enable_spring(self.ptr, index, on_off as u8) };
    }

    pub(crate) fn set_stiffness(&mut self, index: u8, stiffness: f32) {
        unsafe { bw_generic6dofspringconstraint_set_stiffness(self.ptr, index, stiffness) };
    }

    pub(crate) fn set_damping(&mut self, index: u8, damping: f32) {
        unsafe { bw_generic6dofspringconstraint_set_damping(self.ptr, index, damping) };
    }
}

impl Drop for Generic6DofSpringConstraint {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("Generic6DofSpringConstraint already dropped");
        }

        unsafe { bw_destroy_generic6dofspringconstraint(self.ptr) };

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}

pub(crate) struct MmdGeneric6DofSpringConstraint {
    ptr: *mut std::ffi::c_void,
}

impl MmdGeneric6DofSpringConstraint {
    pub(crate) fn new(body_a: &RigidBody, body_b: &RigidBody, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let frame_a = frame_a.as_ref();
        let frame_b = frame_b.as_ref();
        
        Self {
            ptr: unsafe { bw_create_mmdgeneric6dofspringconstraint(body_a.ptr(), body_b.ptr(), frame_a.as_ptr(), frame_b.as_ptr(), use_linear_reference_frame_a as u8) },
        }
    }

    pub(crate) fn ptr_mut(&self) -> *mut std::ffi::c_void {
        self.ptr
    }

    pub(crate) fn set_linear_lower_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_linear_lower_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_linear_upper_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_linear_upper_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_angular_lower_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_angular_lower_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_angular_upper_limit(&mut self, limit: Vec3) {
        unsafe { bw_generic6dofconstraint_set_angular_upper_limit(self.ptr, limit.x, limit.y, limit.z) };
    }

    pub(crate) fn set_param(&mut self, num: i32, value: f32, axis: i32) {
        unsafe { bw_generic6dofconstraint_set_param(self.ptr, num, value, axis) };
    }

    pub(crate) fn enable_spring(&mut self, index: u8, on_off: bool) {
        unsafe { bw_generic6dofspringconstraint_enable_spring(self.ptr, index, on_off as u8) };
    }

    pub(crate) fn set_stiffness(&mut self, index: u8, stiffness: f32) {
        unsafe { bw_generic6dofspringconstraint_set_stiffness(self.ptr, index, stiffness) };
    }

    pub(crate) fn set_damping(&mut self, index: u8, damping: f32) {
        unsafe { bw_generic6dofspringconstraint_set_damping(self.ptr, index, damping) };
    }
}

impl Drop for MmdGeneric6DofSpringConstraint {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("MmdGeneric6DofSpringConstraint already dropped");
        }

        unsafe { bw_destroy_mmdgeneric6dofspringconstraint(self.ptr) };

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}
