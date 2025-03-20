use glam::Vec3;
use wasm_bindgen::prelude::*;

use super::super::bind;

pub(crate) struct BoxShape {
    inner: bind::collision_shape::BoxShape,
    #[cfg(debug_assertions)]
    ref_count: u32,
}

impl BoxShape {
    pub(crate) fn new(size: Vec3) -> Self {
        let inner = bind::collision_shape::BoxShape::new(size);
        Self {
            inner,
            #[cfg(debug_assertions)]
            ref_count: 0,
        }
    }
}

#[cfg(debug_assertions)]
impl Drop for BoxShape {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("BoxShape still has references");
        }
    }
}

pub(crate) struct SphereShape {
    inner: bind::collision_shape::SphereShape,
    #[cfg(debug_assertions)]
    ref_count: u32,
}

impl SphereShape {
    pub(crate) fn new(radius: f32) -> Self {
        let inner = bind::collision_shape::SphereShape::new(radius);
        Self {
            inner,
            #[cfg(debug_assertions)]
            ref_count: 0,
        }
    }
}

#[cfg(debug_assertions)]
impl Drop for SphereShape {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("SphereShape still has references");
        }
    }
}

pub(crate) struct CapsuleShape {
    inner: bind::collision_shape::CapsuleShape,
    #[cfg(debug_assertions)]
    ref_count: u32,
}

impl CapsuleShape {
    pub(crate) fn new(radius: f32, height: f32) -> Self {
        let inner = bind::collision_shape::CapsuleShape::new(radius, height);
        Self {
            inner,
            #[cfg(debug_assertions)]
            ref_count: 0,
        }
    }
}

#[cfg(debug_assertions)]
impl Drop for CapsuleShape {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("CapsuleShape still has references");
        }
    }
}

pub(crate) struct StaticPlaneShape {
    inner: bind::collision_shape::StaticPlaneShape,
    #[cfg(debug_assertions)]
    ref_count: u32,
}

impl StaticPlaneShape {
    pub(crate) fn new(normal: Vec3, plane_constant: f32) -> Self {
        let inner = bind::collision_shape::StaticPlaneShape::new(normal, plane_constant);
        Self {
            inner,
            #[cfg(debug_assertions)]
            ref_count: 0,
        }
    }
}

#[cfg(debug_assertions)]
impl Drop for StaticPlaneShape {
    fn drop(&mut self) {
        if 0 < self.ref_count {
            panic!("StaticPlaneShape still has references");
        }
    }
}

pub(crate) enum CollisionShape {
    Box(BoxShape),
    Sphere(SphereShape),
    Capsule(CapsuleShape),
    StaticPlane(StaticPlaneShape),
}

impl CollisionShape {
    pub(crate) fn ptr(&self) -> *const std::ffi::c_void {
        match self {
            CollisionShape::Box(shape) => shape.inner.ptr(),
            CollisionShape::Sphere(shape) => shape.inner.ptr(),
            CollisionShape::Capsule(shape) => shape.inner.ptr(),
            CollisionShape::StaticPlane(shape) => shape.inner.ptr(),
        }
    }

    #[cfg(debug_assertions)]
    fn ref_count_mut(&mut self) -> &mut u32 {
        match self {
            CollisionShape::Box(shape) => &mut shape.ref_count,
            CollisionShape::Sphere(shape) => &mut shape.ref_count,
            CollisionShape::Capsule(shape) => &mut shape.ref_count,
            CollisionShape::StaticPlane(shape) => &mut shape.ref_count,
        }
    }

    pub(crate) fn create_handle(&mut self) -> CollisionShapeHandle {
        CollisionShapeHandle::new(self)
    }
}

pub(crate) struct CollisionShapeHandle {
    shape: &'static mut CollisionShape,
}

impl CollisionShapeHandle {
    pub(crate) fn new(shape: &mut CollisionShape) -> Self {
        let shape = unsafe { 
            std::mem::transmute::<&mut CollisionShape, &'static mut CollisionShape>(shape)
        };

        #[cfg(debug_assertions)]
        {
            *shape.ref_count_mut() += 1;
        }

        Self {
            shape,
        }
    }

    pub(crate) fn get(&self) -> &CollisionShape {
        self.shape
    }

    pub(crate) fn get_mut(&mut self) -> &mut CollisionShape {
        self.shape
    }

    pub(crate) fn clone(&mut self) -> Self {
        Self::new(self.shape)
    }
}

#[cfg(debug_assertions)]
impl Drop for CollisionShapeHandle {
    fn drop(&mut self) {
        *self.shape.ref_count_mut() -= 1;
    }
}

impl PartialEq for CollisionShapeHandle {
    fn eq(&self, other: &Self) -> bool {
        std::ptr::eq(self.shape as *const CollisionShape, other.shape as *const CollisionShape)
    }
}

impl Eq for CollisionShapeHandle {}

#[wasm_bindgen(js_name = "createBoxShape")]
pub fn create_boxshape(x: f32, y: f32, z: f32) -> *mut usize {
    let box_shape = BoxShape::new(Vec3::new(x, y, z));
    let box_shape = CollisionShape::Box(box_shape);
    Box::into_raw(Box::new(box_shape)) as *mut usize
}

#[wasm_bindgen(js_name = "createSphereShape")]
pub fn create_sphereshape(radius: f32) -> *mut usize {
    let sphere_shape = SphereShape::new(radius);
    let sphere_shape = CollisionShape::Sphere(sphere_shape);
    Box::into_raw(Box::new(sphere_shape)) as *mut usize
}

#[wasm_bindgen(js_name = "createCapsuleShape")]
pub fn create_capsuleshape(radius: f32, height: f32) -> *mut usize {
    let capsule_shape = CapsuleShape::new(radius, height);
    let capsule_shape = CollisionShape::Capsule(capsule_shape);
    Box::into_raw(Box::new(capsule_shape)) as *mut usize
}

#[wasm_bindgen(js_name = "createStaticPlaneShape")]
pub fn create_staticplaneshape(normal_x: f32, normal_y: f32, normal_z: f32, plane_constant: f32) -> *mut usize {
    let plane_shape = StaticPlaneShape::new(Vec3::new(normal_x, normal_y, normal_z), plane_constant);
    let plane_shape = CollisionShape::StaticPlane(plane_shape);
    Box::into_raw(Box::new(plane_shape)) as *mut usize
}

#[wasm_bindgen(js_name = "destroyShape")]
pub fn destroy_shape(ptr: *mut usize) {
    unsafe {
        let _ = Box::from_raw(ptr as *mut CollisionShape);
    }
}
