use glam::{Vec3A, Quat};

use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};

use super::mmd_runtime_bone::MmdRuntimeBone;

#[repr(C)]
#[derive(Clone)]
pub(crate) struct AnimatedBoneData {
    pub(crate) position: Vec3A,
    pub(crate) rotation: Quat,
    pub(crate) scale: Vec3A,
}

pub(crate) struct AnimationArena {
    bone_arena: Box<[AnimatedBoneData]>,
    iksolver_state_arena: Box<[u8]>,
    rigidbody_state_arena: Box<[u8]>,
    morph_arena: Box<[f32]>,
}

impl AnimationArena {
    pub(super) fn new(
        runtime_bones: &[MmdRuntimeBone],
        ik_count: u32,
        rigidbody_count: u32,
        morph_count: u32,
    ) -> Self {
        let mut bone_arena = Vec::with_capacity(runtime_bones.len());
        for runtime_bone in runtime_bones {
            bone_arena.push(AnimatedBoneData {
                position: runtime_bone.rest_position,
                rotation: Quat::IDENTITY,
                scale: Vec3A::ONE,
            });
        }

        AnimationArena {
            bone_arena: bone_arena.into_boxed_slice(),
            iksolver_state_arena: vec![1; ik_count as usize].into_boxed_slice(),
            rigidbody_state_arena: vec![1; rigidbody_count as usize].into_boxed_slice(),
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
    pub(crate) fn rigidbody_state_arena(&self) -> UncheckedSlice<u8> {
        UncheckedSlice::new(&self.rigidbody_state_arena)
    }

    #[inline]
    pub(crate) fn rigidbody_state_arena_mut(&mut self) -> UncheckedSliceMut<u8> {
        UncheckedSliceMut::new(&mut self.rigidbody_state_arena)
    }

    #[inline]
    pub(crate) fn morph_arena(&self) -> UncheckedSlice<f32> {
        UncheckedSlice::new(&self.morph_arena)
    }

    #[inline]
    pub(crate) fn morph_arena_mut(&mut self) -> UncheckedSliceMut<f32> {
        UncheckedSliceMut::new(&mut self.morph_arena)
    }

    pub(crate) fn reallocate_rigidbody_state_arena(&mut self, new_size: u32) {
        if new_size != self.rigidbody_state_arena.len() as u32 {
            self.rigidbody_state_arena = vec![1; new_size as usize].into_boxed_slice();
        }
    }
}
