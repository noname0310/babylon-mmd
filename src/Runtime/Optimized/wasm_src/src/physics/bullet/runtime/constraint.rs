use glam::{Vec3, Mat4};

use super::super::bind;

use super::rigidbody::{RigidBody, RigidBodyHandle};
use super::rigidbody_bundle::{RigidBodyBundle, RigidBodyBundleHandle};

use wasm_bindgen::prelude::*;

#[allow(dead_code)]
enum ConstraintRigidBodyHandleInfo {
    RigidBody((RigidBodyHandle, RigidBodyHandle)),
    RigidBodyBundle(RigidBodyBundleHandle),
}

pub(crate) struct Generic6DofConstraint {
    inner: bind::constraint::Generic6DofConstraint,
    #[cfg(debug_assertions)]
    ref_count: u32,
    #[allow(dead_code)]
    #[cfg(debug_assertions)]
    body_handle: ConstraintRigidBodyHandleInfo,
}

impl Generic6DofConstraint {
    fn new_raw(
        body_a: &bind::rigidbody::RigidBody,
        body_b: &bind::rigidbody::RigidBody,
        #[cfg(debug_assertions)]
        body_handle: ConstraintRigidBodyHandleInfo,
        frame_a: &Mat4,
        frame_b: &Mat4,
        use_linear_reference_frame_a: bool,
    ) -> Self {
        let inner = bind::constraint::Generic6DofConstraint::new(
            body_a,
            body_b,
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        );
        Self {
            inner,
            #[cfg(debug_assertions)]
            ref_count: 0,
            #[cfg(debug_assertions)]
            body_handle,
        }
    }

    pub(crate) fn new(mut body_a: RigidBodyHandle, mut body_b: RigidBodyHandle, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let body_a_binding: RigidBodyHandle = body_a.clone();
        let body_inner_a = body_a_binding.get().get_inner();

        let body_b_binding: RigidBodyHandle = body_b.clone();
        let body_inner_b = body_b_binding.get().get_inner();

        Self::new_raw(
            body_inner_a,
            body_inner_b,
            #[cfg(debug_assertions)]
            ConstraintRigidBodyHandleInfo::RigidBody((body_a, body_b)),
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        )
    }

    pub(crate) fn from_bundle(mut body_bundle: RigidBodyBundleHandle, body_a_index: u32, body_b_index: u32, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let cloned_handle = body_bundle.clone();
        let body_inner_a = &cloned_handle.get().bodies()[body_a_index as usize];
        let body_inner_b = &cloned_handle.get().bodies()[body_b_index as usize];
        Self::new_raw(
            body_inner_a,
            body_inner_b,
            #[cfg(debug_assertions)]
            ConstraintRigidBodyHandleInfo::RigidBodyBundle(body_bundle),
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        )
    }

    pub(super) fn ptr_mut(&self) -> *mut std::ffi::c_void {
        self.inner.ptr_mut()
    }

    pub(crate) fn set_linear_lower_limit(&mut self, limit: Vec3) {
        self.inner.set_linear_lower_limit(limit);
    }

    pub(crate) fn set_linear_upper_limit(&mut self, limit: Vec3) {
        self.inner.set_linear_upper_limit(limit);
    }

    pub(crate) fn set_angular_lower_limit(&mut self, limit: Vec3) {
        self.inner.set_angular_lower_limit(limit);
    }

    pub(crate) fn set_angular_upper_limit(&mut self, limit: Vec3) {
        self.inner.set_angular_upper_limit(limit);
    }
}

#[cfg(debug_assertions)]
impl Drop for Generic6DofConstraint {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("Generic6DofConstraint still has references");
        }
    }
}

pub(crate) struct Generic6DofSpringConstraint {
    inner: bind::constraint::Generic6DofSpringConstraint,
    #[cfg(debug_assertions)]
    ref_count: u32,
    #[allow(dead_code)]
    #[cfg(debug_assertions)]
    body_handle: ConstraintRigidBodyHandleInfo,
}

impl Generic6DofSpringConstraint {
    fn new_raw(
        body_a: &bind::rigidbody::RigidBody,
        body_b: &bind::rigidbody::RigidBody,
        #[cfg(debug_assertions)]
        body_handle: ConstraintRigidBodyHandleInfo,
        frame_a: &Mat4,
        frame_b: &Mat4,
        use_linear_reference_frame_a: bool,
    ) -> Self {
        let inner = bind::constraint::Generic6DofSpringConstraint::new(
            body_a,
            body_b,
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        );
        Self {
            inner,
            #[cfg(debug_assertions)]
            ref_count: 0,
            #[cfg(debug_assertions)]
            body_handle,
        }
    }

    pub(crate) fn new(mut body_a: RigidBodyHandle, mut body_b: RigidBodyHandle, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let body_a_binding: RigidBodyHandle = body_a.clone();
        let body_inner_a = body_a_binding.get().get_inner();

        let body_b_binding: RigidBodyHandle = body_b.clone();
        let body_inner_b = body_b_binding.get().get_inner();

        Self::new_raw(
            body_inner_a,
            body_inner_b,
            #[cfg(debug_assertions)]
            ConstraintRigidBodyHandleInfo::RigidBody((body_a, body_b)),
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        )
    }

    pub(crate) fn from_bundle(mut body_bundle: RigidBodyBundleHandle, body_a_index: u32, body_b_index: u32, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let cloned_handle = body_bundle.clone();
        let body_inner_a = &cloned_handle.get().bodies()[body_a_index as usize];
        let body_inner_b = &cloned_handle.get().bodies()[body_b_index as usize];
        Self::new_raw(
            body_inner_a,
            body_inner_b,
            #[cfg(debug_assertions)]
            ConstraintRigidBodyHandleInfo::RigidBodyBundle(body_bundle),
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        )
    }

    pub(super) fn ptr_mut(&self) -> *mut std::ffi::c_void {
        self.inner.ptr_mut()
    }

    pub(crate) fn set_linear_lower_limit(&mut self, limit: Vec3) {
        self.inner.set_linear_lower_limit(limit);
    }

    pub(crate) fn set_linear_upper_limit(&mut self, limit: Vec3) {
        self.inner.set_linear_upper_limit(limit);
    }

    pub(crate) fn set_angular_lower_limit(&mut self, limit: Vec3) {
        self.inner.set_angular_lower_limit(limit);
    }

    pub(crate) fn set_angular_upper_limit(&mut self, limit: Vec3) {
        self.inner.set_angular_upper_limit(limit);
    }

    pub(crate) fn enable_spring(&mut self, index: u8, on_off: bool) {
        self.inner.enable_spring(index, on_off);
    }

    pub(crate) fn set_stiffness(&mut self, index: u8, stiffness: f32) {
        self.inner.set_stiffness(index, stiffness);
    }

    pub(crate) fn set_damping(&mut self, index: u8, damping: f32) {
        self.inner.set_damping(index, damping);
    }
}

#[cfg(debug_assertions)]
impl Drop for Generic6DofSpringConstraint {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("Generic6DofSpringConstraint still has references");
        }
    }
}

pub(crate) struct MmdGeneric6DofSpringConstraint {
    inner: bind::constraint::MmdGeneric6DofSpringConstraint,
    #[cfg(debug_assertions)]
    ref_count: u32,
    #[allow(dead_code)]
    #[cfg(debug_assertions)]
    body_handle: ConstraintRigidBodyHandleInfo,
}

impl MmdGeneric6DofSpringConstraint {
    fn new_raw(
        body_a: &bind::rigidbody::RigidBody,
        body_b: &bind::rigidbody::RigidBody,
        #[cfg(debug_assertions)]
        body_handle: ConstraintRigidBodyHandleInfo,
        frame_a: &Mat4,
        frame_b: &Mat4,
        use_linear_reference_frame_a: bool,
    ) -> Self {
        let inner = bind::constraint::MmdGeneric6DofSpringConstraint::new(
            body_a,
            body_b,
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        );
        Self {
            inner,
            #[cfg(debug_assertions)]
            ref_count: 0,
            #[cfg(debug_assertions)]
            body_handle,
        }
    }

    pub(crate) fn new(mut body_a: RigidBodyHandle, mut body_b: RigidBodyHandle, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let body_a_binding: RigidBodyHandle = body_a.clone();
        let body_inner_a = body_a_binding.get().get_inner();

        let body_b_binding: RigidBodyHandle = body_b.clone();
        let body_inner_b = body_b_binding.get().get_inner();

        Self::new_raw(
            body_inner_a,
            body_inner_b,
            #[cfg(debug_assertions)]
            ConstraintRigidBodyHandleInfo::RigidBody((body_a, body_b)),
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        )
    }

    pub(crate) fn from_bundle(mut body_bundle: RigidBodyBundleHandle, body_a_index: u32, body_b_index: u32, frame_a: &Mat4, frame_b: &Mat4, use_linear_reference_frame_a: bool) -> Self {
        let cloned_handle = body_bundle.clone();
        let body_inner_a = &cloned_handle.get().bodies()[body_a_index as usize];
        let body_inner_b = &cloned_handle.get().bodies()[body_b_index as usize];
        Self::new_raw(
            body_inner_a,
            body_inner_b,
            #[cfg(debug_assertions)]
            ConstraintRigidBodyHandleInfo::RigidBodyBundle(body_bundle),
            frame_a,
            frame_b,
            use_linear_reference_frame_a
        )
    }

    pub(super) fn ptr_mut(&self) -> *mut std::ffi::c_void {
        self.inner.ptr_mut()
    }

    pub(crate) fn set_linear_lower_limit(&mut self, limit: Vec3) {
        self.inner.set_linear_lower_limit(limit);
    }

    pub(crate) fn set_linear_upper_limit(&mut self, limit: Vec3) {
        self.inner.set_linear_upper_limit(limit);
    }

    pub(crate) fn set_angular_lower_limit(&mut self, limit: Vec3) {
        self.inner.set_angular_lower_limit(limit);
    }

    pub(crate) fn set_angular_upper_limit(&mut self, limit: Vec3) {
        self.inner.set_angular_upper_limit(limit);
    }

    pub(crate) fn enable_spring(&mut self, index: u8, on_off: bool) {
        self.inner.enable_spring(index, on_off);
    }

    pub(crate) fn set_stiffness(&mut self, index: u8, stiffness: f32) {
        self.inner.set_stiffness(index, stiffness);
    }

    pub(crate) fn set_damping(&mut self, index: u8, damping: f32) {
        self.inner.set_damping(index, damping);
    }
}

#[cfg(debug_assertions)]
impl Drop for MmdGeneric6DofSpringConstraint {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("MmdGeneric6DofSpringConstraint still has references");
        }
    }
}

pub(crate) enum Constraint {
    Generic6Dof(Generic6DofConstraint),
    Generic6DofSpring(Generic6DofSpringConstraint),
    MmdGeneric6DofSpring(MmdGeneric6DofSpringConstraint),
    #[allow(dead_code)]
    Unknown,
}

impl Constraint {
    pub(super) fn ptr_mut(&self) -> *mut std::ffi::c_void {
        match self {
            Constraint::Generic6Dof(constraint) => constraint.ptr_mut(),
            Constraint::Generic6DofSpring(constraint) => constraint.ptr_mut(),
            Constraint::MmdGeneric6DofSpring(constraint) => constraint.ptr_mut(),
            Constraint::Unknown => panic!("Unknown constraint"),
        }
    }

    #[cfg(debug_assertions)]
    fn ref_count_mut(&mut self) -> &mut u32 {
        match self {
            Constraint::Generic6Dof(constraint) => &mut constraint.ref_count,
            Constraint::Generic6DofSpring(constraint) => &mut constraint.ref_count,
            Constraint::MmdGeneric6DofSpring(constraint) => &mut constraint.ref_count,
            Constraint::Unknown => panic!("Unknown constraint"),
        }
    }

    pub(crate) fn create_handle(&mut self) -> ConstraintHandle {
        ConstraintHandle::new(self)
    }
}

pub(crate) struct ConstraintHandle {
    constraint: &'static mut Constraint,
}

impl ConstraintHandle {
    pub(crate) fn new(constraint: &mut Constraint) -> Self {
        let constraint = unsafe { 
            std::mem::transmute::<&mut Constraint, &'static mut Constraint>(constraint)
        };

        #[cfg(debug_assertions)]
        {
            *constraint.ref_count_mut() += 1;
        }

        Self {
            constraint,
        }
    }

    pub(crate) fn get(&self) -> &Constraint {
        self.constraint
    }

    pub(crate) fn get_mut(&mut self) -> &mut Constraint {
        self.constraint
    }

    pub(crate) fn clone(&mut self) -> Self {
        Self::new(self.constraint)
    }
}

#[cfg(debug_assertions)]
impl Drop for ConstraintHandle {
    fn drop(&mut self) {
        *self.constraint.ref_count_mut() -= 1;
    }
}

impl PartialEq for ConstraintHandle {
    fn eq(&self, other: &Self) -> bool {
        std::ptr::eq(self.constraint as *const Constraint, other.constraint as *const Constraint)
    }
}

impl Eq for ConstraintHandle {}

#[wasm_bindgen(js_name = "createGeneric6DofConstraint")]
pub fn create_generic6dof_constraint(
    body_a: *mut usize,
    body_b: *mut usize,
    frame_a: *const f32,
    frame_b: *const f32,
    use_linear_reference_frame_a: bool,
) -> *mut usize {
    let body_a = unsafe { &mut *(body_a as *mut RigidBody) };
    let body_b = unsafe { &mut *(body_b as *mut RigidBody) };

    let frame_a = unsafe { std::slice::from_raw_parts(frame_a, 16) };
    let frame_b = unsafe { std::slice::from_raw_parts(frame_b, 16) };
    let frame_a = Mat4::from_cols_slice(frame_a);
    let frame_b = Mat4::from_cols_slice(frame_b);

    let constraint = Generic6DofConstraint::new(body_a.create_handle(), body_b.create_handle(), &frame_a, &frame_b, use_linear_reference_frame_a);
    let constraint = Box::new(Constraint::Generic6Dof(constraint));
    Box::into_raw(constraint) as *mut usize
}

#[wasm_bindgen(js_name = "createGeneric6DofConstraintFromBundle")]
pub fn create_generic6dof_constraint_from_bundle(
    body_bundle: *mut usize,
    body_a_index: u32,
    body_b_index: u32,
    frame_a: *const f32,
    frame_b: *const f32,
    use_linear_reference_frame_a: bool,
) -> *mut usize {
    let body_bundle = unsafe { &mut *(body_bundle as *mut RigidBodyBundle) };

    let frame_a = unsafe { std::slice::from_raw_parts(frame_a, 16) };
    let frame_b = unsafe { std::slice::from_raw_parts(frame_b, 16) };
    let frame_a = Mat4::from_cols_slice(frame_a);
    let frame_b = Mat4::from_cols_slice(frame_b);

    let constraint = Generic6DofConstraint::from_bundle(body_bundle.create_handle(), body_a_index, body_b_index, &frame_a, &frame_b, use_linear_reference_frame_a);
    let constraint = Box::new(Constraint::Generic6Dof(constraint));
    Box::into_raw(constraint) as *mut usize
}

#[wasm_bindgen(js_name = "createGeneric6DofSpringConstraint")]
pub fn create_generic6dof_spring_constraint(
    body_a: *mut usize,
    body_b: *mut usize,
    frame_a: *const f32,
    frame_b: *const f32,
    use_linear_reference_frame_a: bool,
) -> *mut usize {
    let body_a = unsafe { &mut *(body_a as *mut RigidBody) };
    let body_b = unsafe { &mut *(body_b as *mut RigidBody) };

    let frame_a = unsafe { std::slice::from_raw_parts(frame_a, 16) };
    let frame_b = unsafe { std::slice::from_raw_parts(frame_b, 16) };
    let frame_a = Mat4::from_cols_slice(frame_a);
    let frame_b = Mat4::from_cols_slice(frame_b);

    let constraint = Generic6DofSpringConstraint::new(body_a.create_handle(), body_b.create_handle(), &frame_a, &frame_b, use_linear_reference_frame_a);
    let constraint = Box::new(Constraint::Generic6DofSpring(constraint));
    Box::into_raw(constraint) as *mut usize
}

#[wasm_bindgen(js_name = "createGeneric6DofSpringConstraintFromBundle")]
pub fn create_generic6dof_spring_constraint_from_bundle(
    body_bundle: *mut usize,
    body_a_index: u32,
    body_b_index: u32,
    frame_a: *const f32,
    frame_b: *const f32,
    use_linear_reference_frame_a: bool,
) -> *mut usize {
    let body_bundle = unsafe { &mut *(body_bundle as *mut RigidBodyBundle) };

    let frame_a = unsafe { std::slice::from_raw_parts(frame_a, 16) };
    let frame_b = unsafe { std::slice::from_raw_parts(frame_b, 16) };
    let frame_a = Mat4::from_cols_slice(frame_a);
    let frame_b = Mat4::from_cols_slice(frame_b);

    let constraint = Generic6DofSpringConstraint::from_bundle(body_bundle.create_handle(), body_a_index, body_b_index, &frame_a, &frame_b, use_linear_reference_frame_a);
    let constraint = Box::new(Constraint::Generic6DofSpring(constraint));
    Box::into_raw(constraint) as *mut usize
}

#[wasm_bindgen(js_name = "createMmdGeneric6DofSpringConstraint")]
pub fn create_mmd_generic6dof_spring_constraint(
    body_a: *mut usize,
    body_b: *mut usize,
    frame_a: *const f32,
    frame_b: *const f32,
    use_linear_reference_frame_a: bool,
) -> *mut usize {
    let body_a = unsafe { &mut *(body_a as *mut RigidBody) };
    let body_b = unsafe { &mut *(body_b as *mut RigidBody) };

    let frame_a = unsafe { std::slice::from_raw_parts(frame_a, 16) };
    let frame_b = unsafe { std::slice::from_raw_parts(frame_b, 16) };
    let frame_a = Mat4::from_cols_slice(frame_a);
    let frame_b = Mat4::from_cols_slice(frame_b);

    let constraint = MmdGeneric6DofSpringConstraint::new(body_a.create_handle(), body_b.create_handle(), &frame_a, &frame_b, use_linear_reference_frame_a);
    let constraint = Box::new(Constraint::MmdGeneric6DofSpring(constraint));
    Box::into_raw(constraint) as *mut usize
}

#[wasm_bindgen(js_name = "createMmdGeneric6DofSpringConstraintFromBundle")]
pub fn create_mmd_generic6dof_spring_constraint_from_bundle(
    body_bundle: *mut usize,
    body_a_index: u32,
    body_b_index: u32,
    frame_a: *const f32,
    frame_b: *const f32,
    use_linear_reference_frame_a: bool,
) -> *mut usize {
    let body_bundle = unsafe { &mut *(body_bundle as *mut RigidBodyBundle) };

    let frame_a = unsafe { std::slice::from_raw_parts(frame_a, 16) };
    let frame_b = unsafe { std::slice::from_raw_parts(frame_b, 16) };
    let frame_a = Mat4::from_cols_slice(frame_a);
    let frame_b = Mat4::from_cols_slice(frame_b);

    let constraint = MmdGeneric6DofSpringConstraint::from_bundle(body_bundle.create_handle(), body_a_index, body_b_index, &frame_a, &frame_b, use_linear_reference_frame_a);
    let constraint = Box::new(Constraint::MmdGeneric6DofSpring(constraint));
    Box::into_raw(constraint) as *mut usize
}

#[wasm_bindgen(js_name = "destroyConstraint")]
pub fn destroy_constraint(ptr: *mut usize) {
    unsafe {
        let _ = Box::from_raw(ptr as *mut Constraint);
    }
}

#[wasm_bindgen(js_name = "constraintSetLinearLowerLimit")]
pub fn constraint_set_linear_lower_limit(ptr: *mut usize, x: f32, y: f32, z: f32) {
    let constraint = unsafe { &mut *(ptr as *mut Constraint) };
    
    match constraint {
        Constraint::Generic6Dof(constraint) => {
            constraint.set_linear_lower_limit(Vec3::new(x, y, z));
        },
        Constraint::Generic6DofSpring(constraint) => {
            constraint.set_linear_lower_limit(Vec3::new(x, y, z));
        },
        _ => {
            panic!("constraintSetLinearLowerLimit: set_linear_lower_limit is not supported for this constraint type");
        }
    }
}

#[wasm_bindgen(js_name = "constraintSetLinearUpperLimit")]
pub fn constraint_set_linear_upper_limit(ptr: *mut usize, x: f32, y: f32, z: f32) {
    let constraint = unsafe { &mut *(ptr as *mut Constraint) };
    
    match constraint {
        Constraint::Generic6Dof(constraint) => {
            constraint.set_linear_upper_limit(Vec3::new(x, y, z));
        },
        Constraint::Generic6DofSpring(constraint) => {
            constraint.set_linear_upper_limit(Vec3::new(x, y, z));
        },
        Constraint::MmdGeneric6DofSpring(constraint) => {
            constraint.set_linear_upper_limit(Vec3::new(x, y, z));
        },
        _ => {
            panic!("constraintSetLinearUpperLimit: set_linear_upper_limit is not supported for this constraint type");
        }
    }
}

#[wasm_bindgen(js_name = "constraintSetAngularLowerLimit")]
pub fn constraint_set_angular_lower_limit(ptr: *mut usize, x: f32, y: f32, z: f32) {
    let constraint = unsafe { &mut *(ptr as *mut Constraint) };
    
    match constraint {
        Constraint::Generic6Dof(constraint) => {
            constraint.set_angular_lower_limit(Vec3::new(x, y, z));
        },
        Constraint::Generic6DofSpring(constraint) => {
            constraint.set_angular_lower_limit(Vec3::new(x, y, z));
        },
        Constraint::MmdGeneric6DofSpring(constraint) => {
            constraint.set_angular_lower_limit(Vec3::new(x, y, z));
        },
        _ => {
            panic!("constraintSetAngularLowerLimit: set_angular_lower_limit is not supported for this constraint type");
        }
    }
}

#[wasm_bindgen(js_name = "constraintSetAngularUpperLimit")]
pub fn constraint_set_angular_upper_limit(ptr: *mut usize, x: f32, y: f32, z: f32) {
    let constraint: &mut Constraint = unsafe { &mut *(ptr as *mut Constraint) };
    
    match constraint {
        Constraint::Generic6Dof(constraint) => {
            constraint.set_angular_upper_limit(Vec3::new(x, y, z));
        },
        Constraint::Generic6DofSpring(constraint) => {
            constraint.set_angular_upper_limit(Vec3::new(x, y, z));
        },
        Constraint::MmdGeneric6DofSpring(constraint) => {
            constraint.set_angular_upper_limit(Vec3::new(x, y, z));
        },
        _ => {
            panic!("constraintSetAngularUpperLimit: set_angular_upper_limit is not supported for this constraint type");
        }
    }
}

#[wasm_bindgen(js_name = "constraintEnableSpring")]
pub fn constraint_enable_spring(ptr: *mut usize, index: u8, on_off: bool) {
    let constraint = unsafe { &mut *(ptr as *mut Constraint) };
    
    match constraint {
        Constraint::Generic6DofSpring(constraint) => {
            constraint.enable_spring(index, on_off);
        },
        Constraint::MmdGeneric6DofSpring(constraint) => {
            constraint.enable_spring(index, on_off);
        },
        _ => {
            panic!("constraintEnableSpring: enable_spring is not supported for this constraint type");
        }
    }
}

#[wasm_bindgen(js_name = "constraintSetStiffness")]
pub fn constraint_set_stiffness(ptr: *mut usize, index: u8, stiffness: f32) {
    let constraint = unsafe { &mut *(ptr as *mut Constraint) };
    
    match constraint {
        Constraint::Generic6DofSpring(constraint) => {
            constraint.set_stiffness(index, stiffness);
        },
        Constraint::MmdGeneric6DofSpring(constraint) => {
            constraint.set_stiffness(index, stiffness);
        },
        _ => {
            panic!("constraintSetStiffness: set_stiffness is not supported for this constraint type");
        }
    }
}

#[wasm_bindgen(js_name = "constraintSetDamping")]
pub fn constraint_set_damping(ptr: *mut usize, index: u8, damping: f32) {
    let constraint = unsafe { &mut *(ptr as *mut Constraint) };
    
    match constraint {
        Constraint::Generic6DofSpring(constraint) => {
            constraint.set_damping(index, damping);
        },
        Constraint::MmdGeneric6DofSpring(constraint) => {
            constraint.set_damping(index, damping);
        },
        _ => {
            panic!("constraintSetDamping: set_damping is not supported for this constraint type");
        }
    }
}
