use glam::Vec3;

use super::motion_state::MotionState;
use super::super::runtime;

#[link(name = "bullet")]
extern "C" {
    fn bw_create_rigidbody(info: *const std::ffi::c_void) -> *mut std::ffi::c_void;

    fn bw_destroy_rigidbody(body: *mut std::ffi::c_void);

    fn bw_rigidbody_set_damping(body: *mut std::ffi::c_void, linear_damping: f32, angular_damping: f32);

    fn bw_rigidbody_get_linear_damping(body: *const std::ffi::c_void) -> f32;

    fn bw_rigidbody_get_angular_damping(body: *const std::ffi::c_void) -> f32;

    fn bw_rigidbody_set_mass_props(body: *mut std::ffi::c_void, mass: f32, local_inertia: *const f32);

    fn bw_rigidbody_get_mass(body: *const std::ffi::c_void) -> f32;

    fn bw_rigidbody_get_local_inertia(body: *const std::ffi::c_void, local_inertia: *mut f32);

    fn bw_rigidbody_get_total_force(body: *const std::ffi::c_void, force: *mut f32);

    fn bw_rigidbody_get_total_torque(body: *const std::ffi::c_void, torque: *mut f32);

    fn bw_rigidbody_apply_central_force(body: *mut std::ffi::c_void, force: *const f32);

    fn bw_rigidbody_apply_torque(body: *mut std::ffi::c_void, torque: *const f32);

    fn bw_rigidbody_apply_force(body: *mut std::ffi::c_void, force: *const f32, relative_position: *const f32);

    fn bw_rigidbody_apply_central_impulse(body: *mut std::ffi::c_void, impulse: *const f32);

    fn bw_rigidbody_apply_torque_impulse(body: *mut std::ffi::c_void, torque: *const f32);

    fn bw_rigidbody_apply_impulse(body: *mut std::ffi::c_void, impulse: *const f32, relative_position: *const f32);

    fn bw_rigidbody_apply_push_impulse(body: *mut std::ffi::c_void, impulse: *const f32, relative_position: *const f32);

    fn bw_rigidbody_get_push_velocity(body: *const std::ffi::c_void, velocity: *mut f32);

    fn bw_rigidbody_get_turn_velocity(body: *const std::ffi::c_void, velocity: *mut f32);

    fn bw_rigidbody_set_push_velocity(body: *mut std::ffi::c_void, velocity: *const f32);

    fn bw_rigidbody_set_turn_velocity(body: *mut std::ffi::c_void, velocity: *const f32);

    fn bw_rigidbody_apply_central_push_impulse(body: *mut std::ffi::c_void, impulse: *const f32);

    fn bw_rigidbody_apply_torque_turn_impulse(body: *mut std::ffi::c_void, torque: *const f32);

    fn bw_rigidbody_clear_forces(body: *mut std::ffi::c_void);

    fn bw_rigidbody_get_linear_velocity(body: *const std::ffi::c_void, velocity: *mut f32);

    fn bw_rigidbody_get_angular_velocity(body: *const std::ffi::c_void, velocity: *mut f32);

    fn bw_rigidbody_set_linear_velocity(body: *mut std::ffi::c_void, velocity: *const f32);

    fn bw_rigidbody_set_angular_velocity(body: *mut std::ffi::c_void, velocity: *const f32);

    fn bw_rigidbody_get_velocity_in_local_point(body: *const std::ffi::c_void, relative_position: *const f32, velocity: *mut f32);

    fn bw_rigidbody_get_push_velocity_in_local_point(body: *const std::ffi::c_void, relative_position: *const f32, velocity: *mut f32);

    fn bw_rigidbody_translate(body: *mut std::ffi::c_void, translation: *const f32);

    fn bw_rigidbody_set_shape(body: *mut std::ffi::c_void, shape: *const std::ffi::c_void);

    fn bw_rigidbody_get_world_transform_ptr(body: *mut std::ffi::c_void) -> *mut std::ffi::c_void;

    fn bw_rigidbody_get_motion_type(body: *mut std::ffi::c_void) -> u8;

    fn bw_create_rigidbody_shadow(body: *mut std::ffi::c_void, motion_state: *mut std::ffi::c_void) -> *mut std::ffi::c_void;

    fn bw_destroy_rigidbody_shadow(shadow: *mut std::ffi::c_void);

    fn bw_rigidbody_shadow_set_motion_state(shadow: *mut std::ffi::c_void, motion_state: *mut std::ffi::c_void);
}

pub(crate) enum ConstructionInfoDataMask {
    LocalInertia = 1 << 0,
}

#[derive(PartialEq, Eq, Clone, Copy)]
pub(crate) enum MotionType {
    Dynamic = 0,
    Static = 1,
    Kinematic = 2,
}

#[repr(C)]
pub(crate) struct RigidBodyConstructionInfo {
    // for shape
    shape: *const std::ffi::c_void,
    
    // for motion state
    motion_state: *const std::ffi::c_void,

    // for rigid body
    data_mask: u16,
    motion_type: u8,
    mass: f32,
    local_inertia: Vec3,
    padding0: f32,
    linear_damping: f32,
    angular_damping: f32,
    friction: f32,
    // rolling_friction: f32,
    // spinning_friction: f32,
    restitution: f32,
    linear_sleeping_threshold: f32,
    angular_sleeping_threshold: f32,
    collision_group: u16,
    collision_mask: u16,
    additional_damping: u8,
    // additional_damping_factor: f32,
    // additional_linear_damping_threshold_sqr: f32,
    // additional_angular_damping_threshold_sqr: f32,
    // additional_angular_damping_factor: f32,
    no_contact_response: u8,
    disable_deactivation: u8,
}

impl RigidBodyConstructionInfo {
    pub(crate) fn from_runtime_info_raw(
        info: &runtime::rigidbody_construction_info::RigidBodyConstructionInfo,
        motion_state: *const std::ffi::c_void,
    ) -> Self {
        Self {
            shape: info.shape.ptr(),
            motion_state,
            data_mask: info.data_mask,
            motion_type: info.motion_type,
            mass: info.mass,
            local_inertia: info.local_inertia,
            padding0: 0.0,
            linear_damping: info.linear_damping,
            angular_damping: info.angular_damping,
            friction: info.friction,
            // rolling_friction: 0.0,
            // spinning_friction: 0.0,
            restitution: info.restitution,
            linear_sleeping_threshold: info.linear_sleeping_threshold,
            angular_sleeping_threshold: info.angular_sleeping_threshold,
            collision_group: info.collision_group,
            collision_mask: info.collision_mask,
            additional_damping: info.additional_damping,
            // additional_damping_factor: 0.0,
            // additional_linear_damping_threshold_sqr: 0.0,
            // additional_angular_damping_threshold_sqr: 0.0,
            // additional_angular_damping_factor: 0.0,
            no_contact_response: info.no_contact_response,
            disable_deactivation: info.disable_deactivation,
        }
    }
    
    pub(crate) fn from_runtime_info(
        info: &runtime::rigidbody_construction_info::RigidBodyConstructionInfo,
        motion_state: &MotionState,
    ) -> Self {
        Self::from_runtime_info_raw(info, motion_state.ptr())
    }

    pub(crate) fn get_motion_type(&self) -> MotionType {
        match self.motion_type {
            0 => MotionType::Dynamic,
            1 => MotionType::Static,
            2 => MotionType::Kinematic,
            _ => panic!("Invalid motion type"),
        }
    }
}

pub(crate) struct RigidBody {
    ptr: *mut std::ffi::c_void,
}

impl RigidBody {
    pub(crate) fn new(info: &RigidBodyConstructionInfo) -> Self {
        Self {
            ptr: unsafe { bw_create_rigidbody(info as *const RigidBodyConstructionInfo as *const std::ffi::c_void) },
        }
    }

    pub(super) fn ptr(&self) -> *const std::ffi::c_void {
        self.ptr
    }

    pub(super) fn ptr_mut(&mut self) -> *mut std::ffi::c_void {
        self.ptr
    }

    pub(crate) fn set_damping(&mut self, linear_damping: f32, angular_damping: f32) {
        unsafe { bw_rigidbody_set_damping(self.ptr, linear_damping, angular_damping) };
    }

    pub(crate) fn get_linear_damping(&self) -> f32 {
        unsafe { bw_rigidbody_get_linear_damping(self.ptr) }
    }

    pub(crate) fn get_angular_damping(&self) -> f32 {
        unsafe { bw_rigidbody_get_angular_damping(self.ptr) }
    }

    pub(crate) fn set_mass_props(&mut self, mass: f32, local_inertia: Vec3) {
        unsafe { bw_rigidbody_set_mass_props(self.ptr, mass, local_inertia.as_ref().as_ptr()) };
    }

    pub(crate) fn get_mass(&self) -> f32 {
        unsafe { bw_rigidbody_get_mass(self.ptr) }
    }

    pub(crate) fn get_local_inertia(&self) -> Vec3 {
        let mut local_inertia = Vec3::ZERO;
        unsafe { bw_rigidbody_get_local_inertia(self.ptr, local_inertia.as_mut().as_mut_ptr()) };
        local_inertia
    }

    pub(crate) fn get_total_force(&self) -> Vec3 {
        let mut force = Vec3::ZERO;
        unsafe { bw_rigidbody_get_total_force(self.ptr, force.as_mut().as_mut_ptr()) };
        force
    }

    pub(crate) fn get_total_torque(&self) -> Vec3 {
        let mut torque = Vec3::ZERO;
        unsafe { bw_rigidbody_get_total_torque(self.ptr, torque.as_mut().as_mut_ptr()) };
        torque
    }

    pub(crate) fn apply_central_force(&mut self, force: Vec3) {
        unsafe { bw_rigidbody_apply_central_force(self.ptr, force.as_ref().as_ptr()) };
    }

    pub(crate) fn apply_torque(&mut self, torque: Vec3) {
        unsafe { bw_rigidbody_apply_torque(self.ptr, torque.as_ref().as_ptr()) };
    }

    pub(crate) fn apply_force(&mut self, force: Vec3, relative_position: Vec3) {
        unsafe { bw_rigidbody_apply_force(self.ptr, force.as_ref().as_ptr(), relative_position.as_ref().as_ptr()) };
    }

    pub(crate) fn apply_central_impulse(&mut self, impulse: Vec3) {
        unsafe { bw_rigidbody_apply_central_impulse(self.ptr, impulse.as_ref().as_ptr()) };
    }

    pub(crate) fn apply_torque_impulse(&mut self, torque: Vec3) {
        unsafe { bw_rigidbody_apply_torque_impulse(self.ptr, torque.as_ref().as_ptr()) };
    }

    pub(crate) fn apply_impulse(&mut self, impulse: Vec3, relative_position: Vec3) {
        unsafe { bw_rigidbody_apply_impulse(self.ptr, impulse.as_ref().as_ptr(), relative_position.as_ref().as_ptr()) };
    }

    pub(crate) fn apply_push_impulse(&mut self, impulse: Vec3, relative_position: Vec3) {
        unsafe { bw_rigidbody_apply_push_impulse(self.ptr, impulse.as_ref().as_ptr(), relative_position.as_ref().as_ptr()) };
    }

    pub(crate) fn get_push_velocity(&self) -> Vec3 {
        let mut velocity = Vec3::ZERO;
        unsafe { bw_rigidbody_get_push_velocity(self.ptr, velocity.as_mut().as_mut_ptr()) };
        velocity
    }

    pub(crate) fn get_turn_velocity(&self) -> Vec3 {
        let mut velocity = Vec3::ZERO;
        unsafe { bw_rigidbody_get_turn_velocity(self.ptr, velocity.as_mut().as_mut_ptr()) };
        velocity
    }

    pub(crate) fn set_push_velocity(&mut self, velocity: Vec3) {
        unsafe { bw_rigidbody_set_push_velocity(self.ptr, velocity.as_ref().as_ptr()) };
    }

    pub(crate) fn set_turn_velocity(&mut self, velocity: Vec3) {
        unsafe { bw_rigidbody_set_turn_velocity(self.ptr, velocity.as_ref().as_ptr()) };
    }

    pub(crate) fn apply_central_push_impulse(&mut self, impulse: Vec3) {
        unsafe { bw_rigidbody_apply_central_push_impulse(self.ptr, impulse.as_ref().as_ptr()) };
    }

    pub(crate) fn apply_torque_turn_impulse(&mut self, torque: Vec3) {
        unsafe { bw_rigidbody_apply_torque_turn_impulse(self.ptr, torque.as_ref().as_ptr()) };
    }

    pub(crate) fn clear_forces(&mut self) {
        unsafe { bw_rigidbody_clear_forces(self.ptr) };
    }

    pub(crate) fn get_linear_velocity(&self) -> Vec3 {
        let mut velocity = Vec3::ZERO;
        unsafe { bw_rigidbody_get_linear_velocity(self.ptr, velocity.as_mut().as_mut_ptr()) };
        velocity
    }

    pub(crate) fn get_angular_velocity(&self) -> Vec3 {
        let mut velocity = Vec3::ZERO;
        unsafe { bw_rigidbody_get_angular_velocity(self.ptr, velocity.as_mut().as_mut_ptr()) };
        velocity
    }

    pub(crate) fn set_linear_velocity(&mut self, velocity: Vec3) {
        unsafe { bw_rigidbody_set_linear_velocity(self.ptr, velocity.as_ref().as_ptr()) };
    }

    pub(crate) fn set_angular_velocity(&mut self, velocity: Vec3) {
        unsafe { bw_rigidbody_set_angular_velocity(self.ptr, velocity.as_ref().as_ptr()) };
    }

    pub(crate) fn get_velocity_in_local_point(&self, relative_position: Vec3) -> Vec3 {
        let mut velocity = Vec3::ZERO;
        unsafe { bw_rigidbody_get_velocity_in_local_point(self.ptr, relative_position.as_ref().as_ptr(), velocity.as_mut().as_mut_ptr()) };
        velocity
    }

    pub(crate) fn get_push_velocity_in_local_point(&self, relative_position: Vec3) -> Vec3 {
        let mut velocity = Vec3::ZERO;
        unsafe { bw_rigidbody_get_push_velocity_in_local_point(self.ptr, relative_position.as_ref().as_ptr(), velocity.as_mut().as_mut_ptr()) };
        velocity
    }

    pub(crate) fn translate(&mut self, translation: Vec3) {
        unsafe { bw_rigidbody_translate(self.ptr, translation.as_ref().as_ptr()) };
    }

    pub(crate) fn set_shape(&mut self, shape: *const std::ffi::c_void) {
        unsafe { bw_rigidbody_set_shape(self.ptr, shape) };
    }

    pub(crate) fn get_world_transform_ptr_mut(&mut self) -> *mut std::ffi::c_void {
        unsafe { bw_rigidbody_get_world_transform_ptr(self.ptr) }
    }

    pub(crate) fn get_motion_type(&self) -> MotionType {
        match unsafe { bw_rigidbody_get_motion_type(self.ptr) } {
            0 => MotionType::Dynamic,
            1 => MotionType::Static,
            2 => MotionType::Kinematic,
            _ => panic!("Invalid motion type"),
        }
    }

    pub(crate) fn is_static_or_kinematic(&self) -> bool {
        self.get_motion_type() != MotionType::Dynamic
    }
}

impl Drop for RigidBody {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("RigidBody already dropped");
        }

        unsafe { bw_destroy_rigidbody(self.ptr) };

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}

pub(crate) struct RigidBodyShadow {
    ptr: *mut std::ffi::c_void,
}

impl RigidBodyShadow {
    pub(crate) fn new(body: &mut RigidBody, motion_state: *mut std::ffi::c_void) -> Self {
        Self {
            ptr: unsafe { bw_create_rigidbody_shadow(body.ptr_mut(), motion_state) },
        }
    }

    pub(super) fn ptr(&self) -> *const std::ffi::c_void {
        self.ptr
    }

    pub(super) fn ptr_mut(&mut self) -> *mut std::ffi::c_void {
        self.ptr
    }
    pub(crate) fn set_motion_state(&mut self, motion_state: *mut std::ffi::c_void) {
        unsafe { bw_rigidbody_shadow_set_motion_state(self.ptr_mut(), motion_state) };
    }
}

impl Drop for RigidBodyShadow {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        if self.ptr.is_null() {
            panic!("RigidBodyShadow already dropped");
        }

        unsafe { bw_destroy_rigidbody_shadow(self.ptr) };

        #[cfg(debug_assertions)]
        {
            self.ptr = std::ptr::null_mut();
        }
    }
}
