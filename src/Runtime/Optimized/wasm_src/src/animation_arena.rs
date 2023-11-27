use nalgebra::{Vector3, UnitQuaternion};
use web_sys::js_sys::{Float32Array, Uint8Array};

#[repr(C)]
#[derive(Clone)]
pub struct AnimatedBoneData {
    position: Vector3<f32>,
    rotation: UnitQuaternion<f32>,
    scale: Vector3<f32>,
}

pub(crate) struct AnimationArena {
    bone_arena: Box<[AnimatedBoneData]>,
    iksolver_state_arena: Box<[u8]>,
    morph_arena: Box<[f32]>,
}

impl AnimationArena {
    pub fn new(bone_count: usize, ik_count: usize, morph_count: usize) -> Self {
        AnimationArena {
            bone_arena: vec![AnimatedBoneData {
                position: Vector3::new(0.0, 0.0, 0.0),
                rotation: UnitQuaternion::identity(),
                scale: Vector3::new(1.0, 1.0, 1.0),
            }; bone_count].into_boxed_slice(),
            iksolver_state_arena: vec![0; ik_count].into_boxed_slice(),
            morph_arena: vec![0.0; morph_count].into_boxed_slice(),
        }
    }
    
    pub unsafe fn bone_arena_typed_array(&mut self) -> Float32Array {
        Float32Array::view_mut_raw(
            self.bone_arena.as_mut_ptr() as *mut f32,
            self.bone_arena.len() * 10,
        )
    }

    pub unsafe fn iksolver_state_arena_typed_array(&mut self) -> Uint8Array {
        Uint8Array::view(&self.iksolver_state_arena)
    }

    pub unsafe fn morph_arena_typed_array(&mut self) -> Float32Array {
        Float32Array::view(&self.morph_arena)
    }

    pub fn bone_position(&self, index: usize) -> &Vector3<f32> {
        &self.bone_arena[index].position
    }

    pub fn bone_rotation(&self, index: usize) -> &UnitQuaternion<f32> {
        &self.bone_arena[index].rotation
    }

    pub fn bone_scale(&self, index: usize) -> &Vector3<f32> {
        &self.bone_arena[index].scale
    }

    pub fn iksolver_state_arena(&self) -> &[u8] {
        &self.iksolver_state_arena
    }

    pub fn morph_arena(&self) -> &[f32] {
        &self.morph_arena
    }
}
