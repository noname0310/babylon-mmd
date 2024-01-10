use glam::{Vec3A, Quat};

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
    pub(crate) fn new(bone_count: u32, ik_count: u32, morph_count: u32) -> Self {
        AnimationArena {
            bone_arena: vec![AnimatedBoneData {
                position: Vec3A::new(0.0, 0.0, 0.0),
                rotation: Quat::IDENTITY,
                scale: Vec3A::new(1.0, 1.0, 1.0),
            }; bone_count as usize].into_boxed_slice(),
            iksolver_state_arena: vec![1; ik_count as usize].into_boxed_slice(),
            morph_arena: vec![0.0; morph_count as usize].into_boxed_slice(),
        }
    }
    
    #[inline]
    pub(crate) fn bone_arena_mut(&mut self) -> &mut [AnimatedBoneData] {
        &mut self.bone_arena
    }

    #[inline]
    pub(crate) fn bone_position(&self, index: u32) -> Vec3A {
        self.bone_arena[index as usize].position
    }

    #[inline]
    pub(crate) fn bone_rotation(&self, index: u32) -> Quat {
        self.bone_arena[index as usize].rotation
    }

    #[inline]
    pub(crate) fn bone_scale(&self, index: u32) -> Vec3A {
        self.bone_arena[index as usize].scale
    }

    #[inline]
    pub(crate) fn iksolver_state_arena(&self) -> &[u8] {
        &self.iksolver_state_arena
    }

    #[inline]
    pub(crate) fn iksolver_state_arena_mut(&mut self) -> &mut [u8] {
        &mut self.iksolver_state_arena
    }

    #[inline]
    pub(crate) fn morph_arena(&self) -> &[f32] {
        &self.morph_arena
    }

    #[inline]
    pub(crate) fn morph_arena_mut(&mut self) -> &mut [f32] {
        &mut self.morph_arena
    }
}
