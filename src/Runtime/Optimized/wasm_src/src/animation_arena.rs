use glam::{Vec3A, Quat};

use crate::{mmd_runtime_bone::MmdRuntimeBone, unchecked_slice::{UncheckedSliceMut, UncheckedSlice}};

#[repr(C)]
#[derive(Clone)]
pub struct AnimatedBoneData {
    pub(crate) position: Vec3A,
    pub(crate) rotation: Quat,
    pub(crate) scale: Vec3A,
}

pub(crate) struct AnimationArena {
    bone_arena: Box<[AnimatedBoneData]>,
    iksolver_state_arena: Box<[u8]>,
    morph_arena: Box<[f32]>,
}

impl AnimationArena {
    pub(crate) fn new(runtime_bones: &[MmdRuntimeBone], ik_count: u32, morph_count: u32) -> Self {
        let mut bone_arena = Vec::with_capacity(runtime_bones.len() as usize);
        for i in 0..runtime_bones.len() {
            let rest_position = runtime_bones[i].rest_position;
            bone_arena.push(AnimatedBoneData {
                position: rest_position,
                rotation: Quat::IDENTITY,
                scale: Vec3A::ONE,
            });
        }

        AnimationArena {
            bone_arena: bone_arena.into_boxed_slice(),
            iksolver_state_arena: vec![1; ik_count as usize].into_boxed_slice(),
            morph_arena: vec![0.0; morph_count as usize].into_boxed_slice(),
        }
    }

    #[inline]
    pub(crate) fn bone_arena(&self) -> UncheckedSlice<AnimatedBoneData> {
        UncheckedSlice::new(&self.bone_arena)
    }
    
    #[inline]
    pub(crate) fn bone_arena_mut(&mut self) -> UncheckedSliceMut<AnimatedBoneData> {
        UncheckedSliceMut::new(&mut self.bone_arena)
    }

    #[inline]
    pub(crate) fn iksolver_state_arena(&self) -> UncheckedSlice<u8> {
        UncheckedSlice::new(&self.iksolver_state_arena)
    }

    #[inline]
    pub(crate) fn iksolver_state_arena_mut(&mut self) -> UncheckedSliceMut<u8> {
        UncheckedSliceMut::new(&mut self.iksolver_state_arena)
    }

    #[inline]
    pub(crate) fn morph_arena(&self) -> UncheckedSlice<f32> {
        UncheckedSlice::new(&self.morph_arena)
    }

    #[inline]
    pub(crate) fn morph_arena_mut(&mut self) -> UncheckedSliceMut<f32> {
        UncheckedSliceMut::new(&mut self.morph_arena)
    }
}
