use glam::Vec3;
use wasm_bindgen::prelude::*;

use super::super::bind;

use super::collision_shape::{CollisionShape, CollisionShapeHandle};
use super::physics_world::PhysicsWorldHandle;
use super::rigidbody_construction_info::RigidBodyConstructionInfo;
use super::temporal_kinematic_state::TemporalKinematicState;

pub(crate) struct RigidBody {
    inner: bind::rigidbody::RigidBody,
    motion_state: bind::motion_state::MotionState,
    buffered_motion_state: Option<bind::motion_state::MotionState>,
    temporal_kinematic_state: TemporalKinematicState,
    managed_ref: bool,
    world_ref: u16,
    #[cfg(debug_assertions)]
    ref_count: u32,
    #[cfg(debug_assertions)]
    #[allow(dead_code)]
    shape_handle: CollisionShapeHandle,
}

impl RigidBody {
    pub(crate) fn new(
        info: &mut RigidBodyConstructionInfo
    ) -> Self {
        let motion_state = bind::motion_state::MotionState::new(&info.initial_transform);

        #[cfg(debug_assertions)]
        let shape_handle = info.shape.create_handle();

        let info = bind::rigidbody::RigidBodyConstructionInfo::from_runtime_info(
            info,
            &motion_state
        );
        let inner = bind::rigidbody::RigidBody::new(&info);
        Self {
            inner,
            motion_state,
            buffered_motion_state: None,
            temporal_kinematic_state: if info.get_motion_type() == bind::rigidbody::MotionType::Dynamic {
                TemporalKinematicState::Idle
            } else {
                TemporalKinematicState::Disabled
            },
            managed_ref: false,
            world_ref: 0,
            #[cfg(debug_assertions)]
            ref_count: 0,
            #[cfg(debug_assertions)]
            shape_handle,
        }
    }

    pub(super) fn get_inner(&self) -> &bind::rigidbody::RigidBody {
        &self.inner
    }

    pub(super) fn get_inner_mut(&mut self) -> &mut bind::rigidbody::RigidBody {
        &mut self.inner
    }

    pub(crate) fn get_motion_state_ptr(&mut self) -> *mut std::ffi::c_void {
        self.motion_state.ptr_mut()
    }

    pub(crate) fn get_buffered_motion_state_ptr(&mut self) -> *mut std::ffi::c_void {
        if let Some(motion_state) = self.buffered_motion_state.as_mut() {
            motion_state.ptr_mut()
        } else {
            self.motion_state.ptr_mut()
        }
    }

    fn get_motion_state_mut(&mut self) -> &mut bind::motion_state::MotionState {
        &mut self.motion_state
    }

    fn get_buffered_motion_state_mut(&mut self) -> &mut bind::motion_state::MotionState {
        if let Some(motion_state) = self.buffered_motion_state.as_mut() {
            motion_state
        } else {
            &mut self.motion_state
        }
    }

    pub(super) fn acquire_buffered_motion_state(&mut self, managed_ref: bool) {
        if managed_ref {
            if self.managed_ref {
                panic!("RigidBody already has a managed reference");
            }
            self.managed_ref = true;
        }
        if self.world_ref == 0 {
            self.init_buffered_motion_state();
        }
        self.world_ref += 1;
    }

    pub(super) fn release_buffered_motion_state(&mut self, managed_ref: bool) {
        if managed_ref {
            if !self.managed_ref {
                panic!("RigidBody does not have a managed reference");
            }
            self.managed_ref = false;
        }
        self.world_ref -= 1;
        if self.world_ref == 0 {
            self.clear_buffered_motion_state();
        }
    }

    pub(super) fn has_managed_ref(&self) -> bool {
        self.managed_ref
    }

    pub(super) fn has_orphan_ref(&self) -> bool {
        0 < self.world_ref - (self.managed_ref as u16)
    }

    fn init_buffered_motion_state(&mut self) {
        if !self.get_inner().is_static_or_kinematic() && self.buffered_motion_state.is_none() {
            self.buffered_motion_state = Some(bind::motion_state::MotionState::new(&self.motion_state.get_transform()));
        }
    }

    fn clear_buffered_motion_state(&mut self) {
        self.buffered_motion_state = None;
    }

    pub(super) fn sync_buffered_motion_state(&mut self) {
        if let Some(buffered_motion_state) = self.buffered_motion_state.as_mut() {
            buffered_motion_state.copy_from(&self.motion_state);
        }
    }

    pub(super) fn update_temporal_kinematic_state(&mut self, mut world: PhysicsWorldHandle) {
        match self.temporal_kinematic_state {
            TemporalKinematicState::Disabled | TemporalKinematicState::Idle => { }
            TemporalKinematicState::WaitForRestore => {
                let body = self.create_handle();
                world.get_mut().make_body_kinematic(body);
                self.temporal_kinematic_state = TemporalKinematicState::Restoring;
            }
            TemporalKinematicState::Restoring => {
                let body = self.create_handle();
                world.get_mut().restore_body_dynamic(body);
                self.temporal_kinematic_state = TemporalKinematicState::Idle;
            }
        }
    }

    pub(super) fn clear_temporal_kinematic_state(&mut self) {
        match self.temporal_kinematic_state {
            TemporalKinematicState::Disabled | TemporalKinematicState::Idle => { }
            TemporalKinematicState::WaitForRestore | TemporalKinematicState::Restoring => {
                self.temporal_kinematic_state = TemporalKinematicState::Idle;
            }
        }
    }

    pub(crate) fn set_damping(&mut self, linear_damping: f32, angular_damping: f32) {
        self.inner.set_damping(linear_damping, angular_damping);
    }

    pub(crate) fn get_linear_damping(&self) -> f32 {
        self.inner.get_linear_damping()
    }

    pub(crate) fn get_angular_damping(&self) -> f32 {
        self.inner.get_angular_damping()
    }

    pub(crate) fn set_mass_props(&mut self, mass: f32, local_inertia: Vec3) {
        self.inner.set_mass_props(mass, local_inertia);
    }

    pub(crate) fn get_mass(&self) -> f32 {
        self.inner.get_mass()
    }

    pub(crate) fn get_local_inertia(&self) -> Vec3 {
        self.inner.get_local_inertia()
    }

    pub(crate) fn get_total_force(&self) -> Vec3 {
        self.inner.get_total_force()
    }

    pub(crate) fn get_total_torque(&self) -> Vec3 {
        self.inner.get_total_torque()
    }

    pub(crate) fn apply_central_force(&mut self, force: Vec3) {
        self.inner.apply_central_force(force);
    }

    pub(crate) fn apply_torque(&mut self, torque: Vec3) {
        self.inner.apply_torque(torque);
    }

    pub(crate) fn apply_force(&mut self, force: Vec3, relative_position: Vec3) {
        self.inner.apply_force(force, relative_position);
    }

    pub(crate) fn apply_central_impulse(&mut self, impulse: Vec3) {
        self.inner.apply_central_impulse(impulse);
    }

    pub(crate) fn apply_torque_impulse(&mut self, torque: Vec3) {
        self.inner.apply_torque_impulse(torque);
    }

    pub(crate) fn apply_impulse(&mut self, impulse: Vec3, relative_position: Vec3) {
        self.inner.apply_impulse(impulse, relative_position);
    }

    pub(crate) fn apply_push_impulse(&mut self, impulse: Vec3, relative_position: Vec3) {
        self.inner.apply_push_impulse(impulse, relative_position);
    }

    pub(crate) fn get_push_velocity(&self) -> Vec3 {
        self.inner.get_push_velocity()
    }

    pub(crate) fn get_turn_velocity(&self) -> Vec3 {
        self.inner.get_turn_velocity()
    }

    pub(crate) fn set_push_velocity(&mut self, velocity: Vec3) {
        self.inner.set_push_velocity(velocity);
    }

    pub(crate) fn set_turn_velocity(&mut self, velocity: Vec3) {
        self.inner.set_turn_velocity(velocity);
    }

    pub(crate) fn apply_central_push_impulse(&mut self, impulse: Vec3) {
        self.inner.apply_central_push_impulse(impulse);
    }

    pub(crate) fn apply_torque_turn_impulse(&mut self, torque: Vec3) {
        self.inner.apply_torque_turn_impulse(torque);
    }

    pub(crate) fn clear_forces(&mut self) {
        self.inner.clear_forces();
    }

    pub(crate) fn get_linear_velocity(&self) -> Vec3 {
        self.inner.get_linear_velocity()
    }

    pub(crate) fn get_angular_velocity(&self) -> Vec3 {
        self.inner.get_angular_velocity()
    }

    pub(crate) fn set_linear_velocity(&mut self, velocity: Vec3) {
        self.inner.set_linear_velocity(velocity);
    }

    pub(crate) fn set_angular_velocity(&mut self, velocity: Vec3) {
        self.inner.set_angular_velocity(velocity);
    }

    pub(crate) fn get_velocity_in_local_point(&self, relative_position: Vec3) -> Vec3 {
        self.inner.get_velocity_in_local_point(relative_position)
    }

    pub(crate) fn get_push_velocity_in_local_point(&self, relative_position: Vec3) -> Vec3 {
        self.inner.get_push_velocity_in_local_point(relative_position)
    }

    pub(crate) fn translate(&mut self, translation: Vec3) {
        self.inner.translate(translation);
    }

    pub(crate) fn set_shape(&mut self, shape: CollisionShapeHandle) {
        self.inner.set_shape(shape.get().ptr());
        #[cfg(debug_assertions)]
        {
            self.shape_handle = shape;
        }
    }

    pub(crate) fn get_world_transform_ptr_mut(&mut self) -> *mut std::ffi::c_void {
        self.inner.get_world_transform_ptr_mut()
    }

    pub(crate) fn get_temporal_kinematic_state_ptr_mut(&mut self) -> *mut TemporalKinematicState {
        &mut self.temporal_kinematic_state
    }

    pub(crate) fn create_handle(&mut self) -> RigidBodyHandle {
        RigidBodyHandle::new(self)
    }
}

#[cfg(debug_assertions)]
impl Drop for RigidBody {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("RigidBody still has references");
        }
    }
}

pub(crate) struct RigidBodyHandle {
    rigidbody: &'static mut RigidBody,
}

impl RigidBodyHandle {
    pub(crate) fn new(rigidbody: &mut RigidBody) -> Self {
        let rigidbody = unsafe {
            std::mem::transmute::<&mut RigidBody, &'static mut RigidBody>(rigidbody)
        };

        #[cfg(debug_assertions)]
        {
            rigidbody.ref_count += 1;
        }

        Self {
            rigidbody,
        }
    }

    pub(crate) fn get(&self) -> &RigidBody {
        self.rigidbody
    }

    pub(crate) fn get_mut(&mut self) -> &mut RigidBody {
        self.rigidbody
    }

    pub(crate) fn clone(&mut self) -> Self {
        Self::new(self.rigidbody)
    }

    pub(crate) fn create_shadow(&mut self) -> RigidBodyShadow {
        RigidBodyShadow::new(self.rigidbody)
    }
}

#[cfg(debug_assertions)]
impl Drop for RigidBodyHandle {
    fn drop(&mut self) {
        self.rigidbody.ref_count -= 1;
    }
}

impl PartialEq for RigidBodyHandle {
    fn eq(&self, other: &Self) -> bool {
        std::ptr::eq(self.rigidbody as *const RigidBody, other.rigidbody as *const RigidBody)
    }
}

impl Eq for RigidBodyHandle {}

pub(crate) struct RigidBodyShadow {
    inner: bind::rigidbody::RigidBodyShadow,
    handle: RigidBodyHandle,
}

impl RigidBodyShadow {
    pub(super) fn new(rigidbody: &mut RigidBody) -> Self {
        let motion_state_ptr =  if rigidbody.get_inner().is_static_or_kinematic() {
            rigidbody.get_motion_state_mut().ptr_mut()
        } else {
            rigidbody.get_buffered_motion_state_mut().ptr_mut()
        };
        let inner = bind::rigidbody::RigidBodyShadow::new(rigidbody.get_inner_mut(), motion_state_ptr);

        Self {
            inner,
            handle: rigidbody.create_handle(),
        }
    }

    // pub(super) fn get_inner(&self) -> &bind::rigidbody::RigidBodyShadow {
    //     &self.inner
    // }

    pub(super) fn get_inner_mut(&mut self) -> &mut bind::rigidbody::RigidBodyShadow {
        &mut self.inner
    }

    pub(super) fn update_motion_state(&mut self) {
        if !self.handle.get_mut().get_inner().is_static_or_kinematic() {
            let motion_state = self.handle.get_mut().get_buffered_motion_state_mut();
            self.inner.set_motion_state(motion_state.ptr_mut());
        }
    }

    pub(super) fn handle(&self) -> &RigidBodyHandle {
        &self.handle
    }

    // pub(super) fn handle_mut(&mut self) -> &mut RigidBodyHandle {
    //     &mut self.handle
    // }
}

#[wasm_bindgen(js_name = "createRigidBody")]
pub fn create_rigidbody(info: *mut usize) -> *mut usize {
    let info = unsafe { &mut *(info as *mut RigidBodyConstructionInfo) };
    let rigidbody = RigidBody::new(info);
    let rigidbody = Box::new(rigidbody);
    Box::into_raw(rigidbody) as *mut usize
}

#[wasm_bindgen(js_name = "destroyRigidBody")]
pub fn destroy_rigidbody(ptr: *mut usize) {
    unsafe {
        let _ = Box::from_raw(ptr as *mut RigidBody);
    }
}

#[wasm_bindgen(js_name = "rigidBodyGetMotionStatePtr")]
pub fn rigidbody_get_motion_state_ptr(ptr: *mut usize) -> *mut usize {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    rigidbody.get_motion_state_ptr() as *mut usize
}

#[wasm_bindgen(js_name = "rigidBodyGetBufferedMotionStatePtr")]
pub fn rigidbody_get_buffered_motion_state_ptr(ptr: *mut usize) -> *mut usize {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    rigidbody.get_buffered_motion_state_ptr() as *mut usize
}

#[wasm_bindgen(js_name = "rigidBodySetDamping")]
pub fn rigidbody_set_damping(ptr: *mut usize, linear_damping: f32, angular_damping: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    rigidbody.set_damping(linear_damping, angular_damping);
}

#[wasm_bindgen(js_name = "rigidBodyGetLinearDamping")]
pub fn rigidbody_get_linear_damping(ptr: *const usize) -> f32 {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    rigidbody.get_linear_damping()
}

#[wasm_bindgen(js_name = "rigidBodyGetAngularDamping")]
pub fn rigidbody_get_angular_damping(ptr: *const usize) -> f32 {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    rigidbody.get_angular_damping()
}

#[wasm_bindgen(js_name = "rigidBodySetMassProps")]
pub fn rigidbody_set_mass_props(ptr: *mut usize, mass: f32, local_inertia_x: f32, local_inertia_y: f32, local_inertia_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let local_inertia = Vec3::new(local_inertia_x, local_inertia_y, local_inertia_z);
    rigidbody.set_mass_props(mass, local_inertia);
}

#[wasm_bindgen(js_name = "rigidBodyGetMass")]
pub fn rigidbody_get_mass(ptr: *const usize) -> f32 {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    rigidbody.get_mass()
}

#[wasm_bindgen(js_name = "rigidBodyGetLocalInertia")]
pub fn rigidbody_get_local_inertia(ptr: *const usize, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let local_inertia = rigidbody.get_local_inertia();
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = local_inertia.x;
    out[1] = local_inertia.y;
    out[2] = local_inertia.z;
}

#[wasm_bindgen(js_name = "rigidBodyGetTotalForce")]
pub fn rigidbody_get_total_force(ptr: *const usize, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let force = rigidbody.get_total_force();
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = force.x;
    out[1] = force.y;
    out[2] = force.z;
}

#[wasm_bindgen(js_name = "rigidBodyGetTotalTorque")]
pub fn rigidbody_get_total_torque(ptr: *const usize, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let torque = rigidbody.get_total_torque();
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = torque.x;
    out[1] = torque.y;
    out[2] = torque.z;
}

#[wasm_bindgen(js_name = "rigidBodyApplyCentralForce")]
pub fn rigidbody_apply_central_force(ptr: *mut usize, force_x: f32, force_y: f32, force_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let force = Vec3::new(force_x, force_y, force_z);
    rigidbody.apply_central_force(force);
}

#[wasm_bindgen(js_name = "rigidBodyApplyTorque")]
pub fn rigidbody_apply_torque(ptr: *mut usize, torque_x: f32, torque_y: f32, torque_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let torque = Vec3::new(torque_x, torque_y, torque_z);
    rigidbody.apply_torque(torque);
}

#[wasm_bindgen(js_name = "rigidBodyApplyForce")]
pub fn rigidbody_apply_force(ptr: *mut usize, force_ptr: *const f32, relative_position_ptr: *mut f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let force = unsafe { *(force_ptr as *const Vec3) };
    let relative_position = unsafe { *(relative_position_ptr as *const Vec3) };
    rigidbody.apply_force(force, relative_position);
}

#[wasm_bindgen(js_name = "rigidBodyApplyCentralImpulse")]
pub fn rigidbody_apply_central_impulse(ptr: *mut usize, impulse_x: f32, impulse_y: f32, impulse_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let impulse = Vec3::new(impulse_x, impulse_y, impulse_z);
    rigidbody.apply_central_impulse(impulse);
}

#[wasm_bindgen(js_name = "rigidBodyApplyTorqueImpulse")]
pub fn rigidbody_apply_torque_impulse(ptr: *mut usize, torque_x: f32, torque_y: f32, torque_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let torque = Vec3::new(torque_x, torque_y, torque_z);
    rigidbody.apply_torque_impulse(torque);
}

#[wasm_bindgen(js_name = "rigidBodyApplyImpulse")]
pub fn rigidbody_apply_impulse(ptr: *mut usize, impulse_ptr: *const f32, relative_position_ptr: *const f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let impulse = unsafe { *(impulse_ptr as *const Vec3) };
    let relative_position = unsafe { *(relative_position_ptr as *const Vec3) };
    rigidbody.apply_impulse(impulse, relative_position);
}

#[wasm_bindgen(js_name = "rigidBodyApplyPushImpulse")]
pub fn rigidbody_apply_push_impulse(ptr: *mut usize, impulse_ptr: *const f32, relative_position_ptr: *const f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let impulse = unsafe { *(impulse_ptr as *const Vec3) };
    let relative_position = unsafe { *(relative_position_ptr as *const Vec3) };
    rigidbody.apply_push_impulse(impulse, relative_position);
}

#[wasm_bindgen(js_name = "rigidBodyGetPushVelocity")]
pub fn rigidbody_get_push_velocity(ptr: *const usize, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let velocity = rigidbody.get_push_velocity();
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = velocity.x;
    out[1] = velocity.y;
    out[2] = velocity.z;
}

#[wasm_bindgen(js_name = "rigidBodyGetTurnVelocity")]
pub fn rigidbody_get_turn_velocity(ptr: *const usize, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let velocity = rigidbody.get_turn_velocity();
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = velocity.x;
    out[1] = velocity.y;
    out[2] = velocity.z;
}

#[wasm_bindgen(js_name = "rigidBodySetPushVelocity")]
pub fn rigidbody_set_push_velocity(ptr: *mut usize, velocity_x: f32, velocity_y: f32, velocity_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let velocity = Vec3::new(velocity_x, velocity_y, velocity_z);
    rigidbody.set_push_velocity(velocity);
}

#[wasm_bindgen(js_name = "rigidBodySetTurnVelocity")]
pub fn rigidbody_set_turn_velocity(ptr: *mut usize, velocity_x: f32, velocity_y: f32, velocity_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let velocity = Vec3::new(velocity_x, velocity_y, velocity_z);
    rigidbody.set_turn_velocity(velocity);
}

#[wasm_bindgen(js_name = "rigidBodyApplyCentralPushImpulse")]
pub fn rigidbody_apply_central_push_impulse(ptr: *mut usize, impulse_x: f32, impulse_y: f32, impulse_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let impulse = Vec3::new(impulse_x, impulse_y, impulse_z);
    rigidbody.apply_central_push_impulse(impulse);
}

#[wasm_bindgen(js_name = "rigidBodyApplyTorqueTurnImpulse")]
pub fn rigidbody_apply_torque_turn_impulse(ptr: *mut usize, torque_x: f32, torque_y: f32, torque_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let torque = Vec3::new(torque_x, torque_y, torque_z);
    rigidbody.apply_torque_turn_impulse(torque);
}

#[wasm_bindgen(js_name = "rigidBodyClearForces")]
pub fn rigidbody_clear_forces(ptr: *mut usize) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    rigidbody.clear_forces();
}

#[wasm_bindgen(js_name = "rigidBodyGetLinearVelocity")]
pub fn rigidbody_get_linear_velocity(ptr: *const usize, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let velocity = rigidbody.get_linear_velocity();
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = velocity.x;
    out[1] = velocity.y;
    out[2] = velocity.z;
}

#[wasm_bindgen(js_name = "rigidBodyGetAngularVelocity")]
pub fn rigidbody_get_angular_velocity(ptr: *const usize, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let velocity = rigidbody.get_angular_velocity();
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = velocity.x;
    out[1] = velocity.y;
    out[2] = velocity.z;
}

#[wasm_bindgen(js_name = "rigidBodySetLinearVelocity")]
pub fn rigidbody_set_linear_velocity(ptr: *mut usize, velocity_x: f32, velocity_y: f32, velocity_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let velocity = Vec3::new(velocity_x, velocity_y, velocity_z);
    rigidbody.set_linear_velocity(velocity);
}

#[wasm_bindgen(js_name = "rigidBodySetAngularVelocity")]
pub fn rigidbody_set_angular_velocity(ptr: *mut usize, velocity_x: f32, velocity_y: f32, velocity_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let velocity = Vec3::new(velocity_x, velocity_y, velocity_z);
    rigidbody.set_angular_velocity(velocity);
}

#[wasm_bindgen(js_name = "rigidBodyGetVelocityInLocalPoint")]
pub fn rigidbody_get_velocity_in_local_point(ptr: *const usize, relative_position_ptr: *const f32, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let relative_position = unsafe { *(relative_position_ptr as *const Vec3) };
    let velocity = rigidbody.get_velocity_in_local_point(relative_position);
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = velocity.x;
    out[1] = velocity.y;
    out[2] = velocity.z;
}

#[wasm_bindgen(js_name = "rigidBodyGetPushVelocityInLocalPoint")]
pub fn rigidbody_get_push_velocity_in_local_point(ptr: *const usize, relative_position_ptr: *const f32, out: *mut f32) {
    let rigidbody = unsafe { &*(ptr as *const RigidBody) };
    let relative_position = unsafe { *(relative_position_ptr as *const Vec3) };
    let velocity = rigidbody.get_push_velocity_in_local_point(relative_position);
    let out = unsafe { &mut *(out as *mut [f32; 3]) };
    out[0] = velocity.x;
    out[1] = velocity.y;
    out[2] = velocity.z;
}

#[wasm_bindgen(js_name = "rigidBodyTranslate")]
pub fn rigidbody_translate(ptr: *mut usize, translation_x: f32, translation_y: f32, translation_z: f32) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let translation = Vec3::new(translation_x, translation_y, translation_z);
    rigidbody.translate(translation);
}

#[wasm_bindgen(js_name = "rigidBodySetShape")]
pub fn rigidbody_set_shape(ptr: *mut usize, shape: *mut usize) {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    let shape = unsafe { &mut *(shape as *mut CollisionShape) };
    rigidbody.set_shape(shape.create_handle());
}

#[wasm_bindgen(js_name = "rigidBodyGetWorldTransformPtr")]
pub fn rigidbody_set_world_transform(ptr: *mut usize) -> *mut usize {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    rigidbody.get_world_transform_ptr_mut() as *mut usize
}

#[wasm_bindgen(js_name = "rigidBodyGetTemporalKinematicStatePtr")]
pub fn rigidbody_get_temporal_kinematic_state_ptr(ptr: *mut usize) -> *mut u8 {
    let rigidbody = unsafe { &mut *(ptr as *mut RigidBody) };
    rigidbody.get_temporal_kinematic_state_ptr_mut() as *mut u8
}
