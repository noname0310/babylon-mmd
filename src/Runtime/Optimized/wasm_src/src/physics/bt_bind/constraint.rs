use super::rigidbody::Rigidbody;
use glam::{Mat4, Vec3};

use super::physics_world::RigidbodyHandle;

#[link(name = "bullet")]
extern "C" {
    fn bt_create_constraint_construction_info() -> *mut std::ffi::c_void;

    fn bt_destroy_constraint_construction_info(info: *mut std::ffi::c_void);

    fn bt_constraint_construction_info_set_type(info: *mut std::ffi::c_void, type_: u8);

    fn bt_constraint_construction_info_set_frames(info: *mut std::ffi::c_void, frame_a_buffer: *const f32, frame_b_buffer: *const f32);

    fn bt_constraint_construction_info_set_use_linear_reference_frame_a(info: *mut std::ffi::c_void, use_linear_reference_frame_a: u8);

    fn bt_constraint_construction_info_set_disable_collisions_between_linked_bodies(info: *mut std::ffi::c_void, disable_collisions_between_linked_bodies: u8);

    fn bt_constraint_construction_info_set_linear_limits(info: *mut std::ffi::c_void, lower_limit_buffer: *const f32, upper_limit_buffer: *const f32);

    fn bt_constraint_construction_info_set_angular_limits(info: *mut std::ffi::c_void, lower_limit_buffer: *const f32, upper_limit_buffer: *const f32);

    fn bt_constraint_construction_info_set_stiffness(info: *mut std::ffi::c_void, linear_stiffness_buffer: *const f32, angular_stiffness_buffer: *const f32);

    fn bt_create_constraint(info: *mut std::ffi::c_void, body_a: *const std::ffi::c_void, body_b: *const std::ffi::c_void) -> *mut std::ffi::c_void;

    fn bt_destroy_constraint(constraint: *mut std::ffi::c_void);
}

pub(crate) enum ConstraintType {
    // Point2Point = 0,
    // Hinge = 1,
    // ConeTwist = 2,
    Generic6Dof = 3,
    // Slider = 4,
    Generic6DofSpring = 5,
    // Universal = 6,
    // Hinge2 = 7,
    // Gear = 8,
    // Fixed = 9,
}

pub(crate) struct ConstraintConstructionInfo {
    info: *mut std::ffi::c_void,
    body_a: RigidbodyHandle,
    body_b: RigidbodyHandle,
}

impl ConstraintConstructionInfo {
    pub(crate) fn new() -> Self {
        let info = unsafe { bt_create_constraint_construction_info() };
        Self { 
            info,
            body_a: -1,
            body_b: -1,
        }
    }

    pub(crate) fn set_type(&mut self, type_: ConstraintType) {
        unsafe { bt_constraint_construction_info_set_type(self.info, type_ as u8) };
    }

    pub(crate) fn set_bodies(&mut self, body_a: RigidbodyHandle, body_b: RigidbodyHandle) {
        self.body_a = body_a;
        self.body_b = body_b;
    }

    pub(crate) fn set_frames(&mut self, frame_a: &Mat4, frame_b: &Mat4) {
        let frame_a_buffer = frame_a.as_ref().as_ptr();
        let frame_b_buffer = frame_b.as_ref().as_ptr();
        unsafe { bt_constraint_construction_info_set_frames(self.info, frame_a_buffer, frame_b_buffer) };
    }

    pub(crate) fn set_use_linear_reference_frame_a(&mut self, use_linear_reference_frame_a: bool) {
        unsafe { bt_constraint_construction_info_set_use_linear_reference_frame_a(self.info, use_linear_reference_frame_a as u8) };
    }

    pub(crate) fn set_disable_collisions_between_linked_bodies(&mut self, disable_collisions_between_linked_bodies: bool) {
        unsafe { bt_constraint_construction_info_set_disable_collisions_between_linked_bodies(self.info, disable_collisions_between_linked_bodies as u8) };
    }

    pub(crate) fn set_linear_limits(&mut self, lower_limit: Vec3, upper_limit: Vec3) {
        let lower_limit_buffer = lower_limit.as_ref().as_ptr();
        let upper_limit_buffer = upper_limit.as_ref().as_ptr();
        unsafe { bt_constraint_construction_info_set_linear_limits(self.info, lower_limit_buffer, upper_limit_buffer) };
    }

    pub(crate) fn set_angular_limits(&mut self, lower_limit: Vec3, upper_limit: Vec3) {
        let lower_limit_buffer = lower_limit.as_ref().as_ptr();
        let upper_limit_buffer = upper_limit.as_ref().as_ptr();
        unsafe { bt_constraint_construction_info_set_angular_limits(self.info, lower_limit_buffer, upper_limit_buffer) };
    }

    pub(crate) fn set_stiffness(&mut self, linear_stiffness: Vec3, angular_stiffness: Vec3) {
        let linear_stiffness_buffer = linear_stiffness.as_ref().as_ptr();
        let angular_stiffness_buffer = angular_stiffness.as_ref().as_ptr();
        unsafe { bt_constraint_construction_info_set_stiffness(self.info, linear_stiffness_buffer, angular_stiffness_buffer) };
    }
}

impl Drop for ConstraintConstructionInfo {
    fn drop(&mut self) {
        unsafe { bt_destroy_constraint_construction_info(self.info) };
    }
}

pub(super) struct Constraint {
    constraint: *mut std::ffi::c_void,
}

impl Constraint {
    pub(super) fn new(info: &ConstraintConstructionInfo, body_vector: &Vec<Rigidbody>) -> Result<Self, String> {
        let body_a = body_vector.get(info.body_a as usize).ok_or("Body A not found")?.get_body();
        let body_b = body_vector.get(info.body_b as usize).ok_or("Body B not found")?.get_body();
        let constraint = unsafe { bt_create_constraint(info.info, body_a, body_b) };
        Ok(Self { constraint })
    }

    pub(super) fn get_constraint_mut(&mut self) -> *mut std::ffi::c_void {
        self.constraint
    }
}

impl Drop for Constraint {
    fn drop(&mut self) {
        unsafe { bt_destroy_constraint(self.constraint) };
    }
}
