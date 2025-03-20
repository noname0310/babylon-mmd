use glam::{Mat4, Vec3};

use super::collision_shape::CollisionShape;

#[repr(C)]
pub(crate) struct RigidBodyConstructionInfo<'a> {
    // for shape
    pub(crate) shape: &'a mut CollisionShape,
    
    // for motion state
    pub(crate) initial_transform: Mat4,

    // for rigid body
    pub(crate) data_mask: u16,
    pub(crate) motion_type: u8,
    pub(crate) mass: f32,
    pub(crate) local_inertia: Vec3,
    pub(crate) linear_damping: f32,
    pub(crate) angular_damping: f32,
    pub(crate) friction: f32,
    // rolling_friction: f32,
    // spinning_friction: f32,
    pub(crate) restitution: f32,
    pub(crate) linear_sleeping_threshold: f32,
    pub(crate) angular_sleeping_threshold: f32,
    pub(crate) collision_group: u16,
    pub(crate) collision_mask: u16,
    pub(crate) additional_damping: u8,
    // additional_damping_factor: f32,
    // additional_linear_damping_threshold_sqr: f32,
    // additional_angular_damping_threshold_sqr: f32,
    // additional_angular_damping_factor: f32,
    pub(crate) no_contact_response: u8,
    pub(crate) disable_deactivation: u8,
}
