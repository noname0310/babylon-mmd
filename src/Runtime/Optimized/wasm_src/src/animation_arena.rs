use nalgebra::{Vector3, UnitQuaternion};

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
    pub fn new(bone_count: u32, ik_count: u32, morph_count: u32) -> Self {
        AnimationArena {
            bone_arena: vec![AnimatedBoneData {
                position: Vector3::new(0.0, 0.0, 0.0),
                rotation: UnitQuaternion::identity(),
                scale: Vector3::new(1.0, 1.0, 1.0),
            }; bone_count as usize].into_boxed_slice(),
            iksolver_state_arena: vec![1; ik_count as usize].into_boxed_slice(),
            morph_arena: vec![0.0; morph_count as usize].into_boxed_slice(),
        }
    }
    
    pub fn bone_arena_mut(&mut self) -> &mut [AnimatedBoneData] {
        &mut self.bone_arena
    }

    pub fn bone_position(&self, index: u32) -> &Vector3<f32> {
        &self.bone_arena[index as usize].position
    }

    pub fn bone_rotation(&self, index: u32) -> &UnitQuaternion<f32> {
        &self.bone_arena[index as usize].rotation
    }

    pub fn bone_scale(&self, index: u32) -> &Vector3<f32> {
        &self.bone_arena[index as usize].scale
    }

    pub fn iksolver_state_arena(&self) -> &[u8] {
        &self.iksolver_state_arena
    }

    pub fn iksolver_state_arena_mut(&mut self) -> &mut [u8] {
        &mut self.iksolver_state_arena
    }

    pub fn morph_arena(&self) -> &[f32] {
        &self.morph_arena
    }

    pub fn morph_arena_mut(&mut self) -> &mut [f32] {
        &mut self.morph_arena
    }
}
