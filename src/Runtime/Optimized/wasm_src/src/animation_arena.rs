use nalgebra::{Vector3, UnitQuaternion, Quaternion, Vector4};
use web_sys::js_sys::Float32Array;

#[repr(C, packed)]
#[derive(Clone)]
pub struct AnimatedBoneData {
    position: [f32; 3],
    rotation: [f32; 4],
    scale: [f32; 3],
}

pub(crate) struct AnimationArena {
    bone_arena: Box<[AnimatedBoneData]>,
    iksolver_state_arena: Box<[bool]>,
    morph_arena: Box<[f32]>,
}

impl AnimationArena {
    pub fn new(bone_count: usize, morph_count: usize) -> Self {
        AnimationArena {
            bone_arena: vec![AnimatedBoneData {
                position: [0.0, 0.0, 0.0],
                rotation: [0.0, 0.0, 0.0, 1.0],
                scale: [1.0, 1.0, 1.0],
            }; bone_count].into_boxed_slice(),
            iksolver_state_arena: vec![false; bone_count].into_boxed_slice(),
            morph_arena: vec![0.0; morph_count].into_boxed_slice(),
        }
    }
    
    pub unsafe fn bone_arena_typed_array(&mut self) -> Float32Array {
        Float32Array::view_mut_raw(
            self.bone_arena.as_mut_ptr() as *mut f32,
            self.bone_arena.len() * 10,
        )
    }

    pub fn nth_bone_position(&self, index: usize) -> Vector3<f32> {
        let position = self.bone_arena[index].position;
        Vector3::from_column_slice(&position)
    }

    pub fn nth_bone_rotation(&self, index: usize) -> UnitQuaternion<f32> {
        let rotation = self.bone_arena[index].rotation;
        UnitQuaternion::new_unchecked(Quaternion::from_vector(
            Vector4::from_column_slice(&rotation)
        ))
    }

    pub fn nth_bone_scale(&self, index: usize) -> Vector3<f32> {
        let scale = self.bone_arena[index].scale;
        Vector3::from_column_slice(&scale)
    }

    pub fn iksolver_state_arena(&self) -> &[bool] {
        &self.iksolver_state_arena
    }

    pub fn morph_arena(&self) -> &[f32] {
        &self.morph_arena
    }
}
