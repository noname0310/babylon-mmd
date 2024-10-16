use glam::{Mat4, Quat, Vec3, Vec4};

use crate::mmd_model_metadata::RigidbodyPhysicsMode;

#[link(name = "bullet")]
extern "C" {
    fn bt_create_rigidbody_construction_info() -> *mut std::ffi::c_void;

    fn bt_destroy_rigidbody_construction_info(info: *mut std::ffi::c_void);

    fn bt_rigidbody_construction_info_set_shape_type(info: *mut std::ffi::c_void, shape_type: u8);

    fn bt_rigidbody_construction_info_set_shape_size(info: *mut std::ffi::c_void, size_buffer: *const f32);

    fn bt_rigidbody_construction_info_set_motion_type(info: *mut std::ffi::c_void, motion_type: u8);

    fn bt_rigidbody_construction_info_set_start_transform(info: *mut std::ffi::c_void, position_buffer: *const f32, rotation_buffer: *const f32);

    fn bt_rigidbody_construction_info_set_mass(info: *mut std::ffi::c_void, mass: f32);

    fn bt_rigidbody_construction_info_set_damping(info: *mut std::ffi::c_void, linear_damping: f32, angular_damping: f32);

    fn bt_rigidbody_construction_info_set_friction(info: *mut std::ffi::c_void, friction: f32);

    fn bt_rigidbody_construction_info_set_restitution(info: *mut std::ffi::c_void, restitution: f32);

    fn bt_rigidbody_construction_info_set_additional_damping(info: *mut std::ffi::c_void, additional_damping: u8);

    fn bt_rigidbody_construction_info_set_no_contact_response(info: *mut std::ffi::c_void, no_contact_response: u8);

    fn bt_rigidbody_construction_info_set_collision_group_mask(info: *mut std::ffi::c_void, collision_group: u16, collision_mask: u16);

    fn bt_rigidbody_construction_info_set_sleeping_threshold(info: *mut std::ffi::c_void, linear_sleeping_threshold: f32, angular_sleeping_threshold: f32);

    fn bt_rigidbody_construction_info_set_disable_deactivation(info: *mut std::ffi::c_void, disable_deactivation: u8);

    fn bt_create_rigidbody(info: *mut std::ffi::c_void) -> *mut std::ffi::c_void;

    fn bt_destroy_rigidbody(body: *mut std::ffi::c_void);

    fn bt_rigidbody_get_transform(body: *mut std::ffi::c_void, transform_buffer: *mut f32);

    fn bt_rigidbody_set_transform(body: *mut std::ffi::c_void, transform_buffer: *const f32);

    fn bt_rigidbody_make_kinematic(body: *mut std::ffi::c_void);

    fn bt_rigidbody_restore_dynamic(body: *mut std::ffi::c_void);
}

#[derive(Clone, Copy)]
pub(crate) enum ShapeType {
    Box = 0,
    Sphere = 1,
    Capsule = 2,
    // Cylinder = 3,
    // Cone = 4,
    StaticPlane = 5,
    // Mesh = 6,
    // ConvexHull = 7,
    // Compound = 8,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum MotionType {
    Dynamic = 0,
    Kinematic = 1,
    Static = 2,
}

pub(crate) struct RigidbodyConstructionInfo {
    info: *mut std::ffi::c_void,
}

impl RigidbodyConstructionInfo {
    pub(crate) fn new() -> Self {
        let info = unsafe { bt_create_rigidbody_construction_info() };
        Self { info }
    }

    pub(crate) fn set_shape_type(&mut self, shape_type: ShapeType) {
        unsafe { bt_rigidbody_construction_info_set_shape_type(self.info, shape_type as u8) };
    }

    pub(crate) fn set_shape_size(&mut self, size: Vec4) {
        unsafe { bt_rigidbody_construction_info_set_shape_size(self.info, size.as_ref().as_ptr()) };
    }

    pub(crate) fn set_motion_type(&mut self, motion_type: MotionType) {
        unsafe { bt_rigidbody_construction_info_set_motion_type(self.info, motion_type as u8) };
    }

    pub(crate) fn set_start_transform(&mut self, position: Vec3, rotation: Quat) {
        unsafe { bt_rigidbody_construction_info_set_start_transform(self.info, position.as_ref().as_ptr(), rotation.as_ref().as_ptr()) };
    }

    pub(crate) fn set_mass(&mut self, mass: f32) {
        unsafe { bt_rigidbody_construction_info_set_mass(self.info, mass) };
    }

    pub(crate) fn set_damping(&mut self, linear_damping: f32, angular_damping: f32) {
        unsafe { bt_rigidbody_construction_info_set_damping(self.info, linear_damping, angular_damping) };
    }

    pub(crate) fn set_friction(&mut self, friction: f32) {
        unsafe { bt_rigidbody_construction_info_set_friction(self.info, friction) };
    }

    pub(crate) fn set_restitution(&mut self, restitution: f32) {
        unsafe { bt_rigidbody_construction_info_set_restitution(self.info, restitution) };
    }

    pub(crate) fn set_additional_damping(&mut self, additional_damping: bool) {
        unsafe { bt_rigidbody_construction_info_set_additional_damping(self.info, additional_damping as u8) };
    }

    pub (crate) fn set_no_contact_response(&mut self, no_contact_response: bool) {
        unsafe { bt_rigidbody_construction_info_set_no_contact_response(self.info, no_contact_response as u8) };
    }

    pub(crate) fn set_collision_group_mask(&mut self, collision_group: u16, collision_mask: u16) {
        unsafe { bt_rigidbody_construction_info_set_collision_group_mask(self.info, collision_group, collision_mask) };
    }

    pub(crate) fn set_sleeping_threshold(&mut self, linear_sleeping_threshold: f32, angular_sleeping_threshold: f32) {
        unsafe { bt_rigidbody_construction_info_set_sleeping_threshold(self.info, linear_sleeping_threshold, angular_sleeping_threshold) };
    }

    pub(crate) fn set_disable_deactivation(&mut self, disable_deactivation: bool) {
        unsafe { bt_rigidbody_construction_info_set_disable_deactivation(self.info, disable_deactivation as u8) };
    }
}

impl Drop for RigidbodyConstructionInfo {
    fn drop(&mut self) {
        unsafe { bt_destroy_rigidbody_construction_info(self.info) };
    }
}

pub(crate) struct Rigidbody {
    body: *mut std::ffi::c_void,
    linked_bone_index: Option<u32>,
    body_offset_matrix: Mat4,
    body_offset_inverse_matrix: Mat4,
    physics_mode: RigidbodyPhysicsMode,
    temporary_kinematic: bool,
}

impl Rigidbody {
    pub(super) fn new(
        info: &RigidbodyConstructionInfo,
        linked_bone_index: Option<u32>,
        body_offset_matrix: &Mat4,
        physics_mode: RigidbodyPhysicsMode,
    ) -> Self {
        let body = unsafe { bt_create_rigidbody(info.info) };
        Self { 
            body,
            linked_bone_index,
            body_offset_matrix: *body_offset_matrix,
            body_offset_inverse_matrix: body_offset_matrix.inverse(),
            physics_mode,
            temporary_kinematic: false,
        }
    }

    pub(super) fn get_body(&self) -> *const std::ffi::c_void {
        self.body
    }

    pub(super) fn get_body_mut(&mut self) -> *mut std::ffi::c_void {
        self.body
    }

    pub(crate) fn get_linked_bone_index(&self) -> Option<u32> {
        self.linked_bone_index
    }

    pub(crate) fn get_transform(&self) -> Mat4 {
        let mut transform = Mat4::IDENTITY;
        unsafe { bt_rigidbody_get_transform(self.body, transform.as_mut().as_mut_ptr()) };
        transform * self.body_offset_inverse_matrix
    }

    pub(crate) fn set_transform(&mut self, transform: Mat4) {
        let transform = transform * self.body_offset_matrix;
        unsafe { bt_rigidbody_set_transform(self.body, transform.as_ref().as_ptr()) };
    }

    pub(crate) fn make_kinematic(&mut self) {
        unsafe { bt_rigidbody_make_kinematic(self.body) };
        self.temporary_kinematic = true;
    }

    pub(crate) fn restore_dynamic(&mut self) {
        if !self.temporary_kinematic {
            return;
        }
        self.temporary_kinematic = false;
        unsafe { bt_rigidbody_restore_dynamic(self.body) };
    }

    pub(crate) fn get_physics_mode(&self) -> RigidbodyPhysicsMode {
        self.physics_mode
    }

    pub(crate) fn set_physics_mode(&mut self, physics_mode: RigidbodyPhysicsMode) {
        self.physics_mode = physics_mode;
    }
}

impl Drop for Rigidbody {
    fn drop(&mut self) {
        unsafe { bt_destroy_rigidbody(self.body) };
    }
}
