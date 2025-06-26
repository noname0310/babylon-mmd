use glam::{Quat, Vec3};

use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};

#[repr(C)]
#[derive(Clone)]
pub(super) struct InterpolationScalar {
    pub(super) x1: u8,
    pub(super) x2: u8,
    pub(super) y1: u8,
    pub(super) y2: u8,
}

impl InterpolationScalar {
    pub(super) fn new() -> Self {
        Self {
            x1: 20,
            x2: 107,
            y1: 20,
            y2: 107,
        }
    }
}

#[repr(C)]
#[derive(Clone)]
pub(super) struct InterpolationVector3 {
    pub(super) x: InterpolationScalar,
    pub(super) y: InterpolationScalar,
    pub(super) z: InterpolationScalar,
}

impl InterpolationVector3 {
    pub(super) fn new() -> Self {
        Self {
            x: InterpolationScalar::new(),
            y: InterpolationScalar::new(),
            z: InterpolationScalar::new(),
        }
    }
}

pub(super) struct MmdBoneAnimationTrack {
    pub(super) frame_numbers: Box<[u32]>,
    rotations: Box<[Quat]>,
    rotation_interpolations: Box<[InterpolationScalar]>,
    physics_toggles: Box<[u8]>,
}

impl MmdBoneAnimationTrack {
    pub(super) fn new(frame_count: usize) -> Self {
        Self {
            frame_numbers: vec![0; frame_count].into_boxed_slice(),
            rotations: vec![Quat::IDENTITY; frame_count].into_boxed_slice(),
            rotation_interpolations: vec![InterpolationScalar::new(); frame_count].into_boxed_slice(),
            physics_toggles: vec![0; frame_count].into_boxed_slice(),
        }
    }

    #[inline]
    pub(super) fn rotations(&self) -> UncheckedSlice<Quat> {
        UncheckedSlice::new(&self.rotations)
    }

    #[inline]
    pub(super) fn rotations_mut(&mut self) -> UncheckedSliceMut<Quat> {
        UncheckedSliceMut::new(&mut self.rotations)
    }

    #[inline]
    pub(super) fn rotation_interpolations(&self) -> UncheckedSlice<InterpolationScalar> {
        UncheckedSlice::new(&self.rotation_interpolations)
    }

    #[inline]
    pub(super) fn rotation_interpolations_mut(&mut self) -> UncheckedSliceMut<InterpolationScalar> {
        UncheckedSliceMut::new(&mut self.rotation_interpolations)
    }

    #[inline]
    pub(super) fn physics_toggles(&self) -> UncheckedSlice<u8> {
        UncheckedSlice::new(&self.physics_toggles)
    }

    #[inline]
    pub(super) fn physics_toggles_mut(&mut self) -> UncheckedSliceMut<u8> {
        UncheckedSliceMut::new(&mut self.physics_toggles)
    }

    #[inline]
    pub(super) fn start_frame(&self) -> u32 {
        self.frame_numbers.first().copied().unwrap_or(0)
    }

    #[inline]
    pub(super) fn end_frame(&self) -> u32 {
        self.frame_numbers.last().copied().unwrap_or(0)
    }
}

pub(super) struct MmdMovableBoneAnimationTrack {
    pub(super) frame_numbers: Box<[u32]>,
    positions: Box<[Vec3]>,
    position_interpolations: Box<[InterpolationVector3]>,
    rotations: Box<[Quat]>,
    rotation_interpolations: Box<[InterpolationScalar]>,
    physics_toggles: Box<[u8]>,
}

impl MmdMovableBoneAnimationTrack {
    pub(super) fn new(frame_count: usize) -> Self {
        Self {
            frame_numbers: vec![0; frame_count].into_boxed_slice(),
            positions: vec![Vec3::ZERO; frame_count].into_boxed_slice(),
            position_interpolations: vec![InterpolationVector3::new(); frame_count].into_boxed_slice(),
            rotations: vec![Quat::IDENTITY; frame_count].into_boxed_slice(),
            rotation_interpolations: vec![InterpolationScalar::new(); frame_count].into_boxed_slice(),
            physics_toggles: vec![0; frame_count].into_boxed_slice(),
        }
    }

    #[inline]
    pub(super) fn positions(&self) -> UncheckedSlice<Vec3> {
        UncheckedSlice::new(&self.positions)
    }

    #[inline]
    pub(super) fn positions_mut(&mut self) -> UncheckedSliceMut<Vec3> {
        UncheckedSliceMut::new(&mut self.positions)
    }

    #[inline]
    pub(super) fn position_interpolations(&self) -> UncheckedSlice<InterpolationVector3> {
        UncheckedSlice::new(&self.position_interpolations)
    }

    #[inline]
    pub(super) fn position_interpolations_mut(&mut self) -> UncheckedSliceMut<InterpolationVector3> {
        UncheckedSliceMut::new(&mut self.position_interpolations)
    }

    #[inline]
    pub(super) fn rotations(&self) -> UncheckedSlice<Quat> {
        UncheckedSlice::new(&self.rotations)
    }

    #[inline]
    pub(super) fn rotations_mut(&mut self) -> UncheckedSliceMut<Quat> {
        UncheckedSliceMut::new(&mut self.rotations)
    }

    #[inline]
    pub(super) fn rotation_interpolations(&self) -> UncheckedSlice<InterpolationScalar> {
        UncheckedSlice::new(&self.rotation_interpolations)
    }

    #[inline]
    pub(super) fn rotation_interpolations_mut(&mut self) -> UncheckedSliceMut<InterpolationScalar> {
        UncheckedSliceMut::new(&mut self.rotation_interpolations)
    }

    #[inline]
    pub(super) fn physics_toggles(&self) -> UncheckedSlice<u8> {
        UncheckedSlice::new(&self.physics_toggles)
    }

    #[inline]
    pub(super) fn physics_toggles_mut(&mut self) -> UncheckedSliceMut<u8> {
        UncheckedSliceMut::new(&mut self.physics_toggles)
    }

    #[inline]
    pub(super) fn start_frame(&self) -> u32 {
        self.frame_numbers.first().copied().unwrap_or(0)
    }

    #[inline]
    pub(super) fn end_frame(&self) -> u32 {
        self.frame_numbers.last().copied().unwrap_or(0)
    }
}

pub(super) struct MmdMorphAnimationTrack {
    pub(super) frame_numbers: Box<[u32]>,
    weights: Box<[f32]>,
}

impl MmdMorphAnimationTrack {
    pub(super) fn new(frame_count: usize) -> Self {
        Self {
            frame_numbers: vec![0; frame_count].into_boxed_slice(),
            weights: vec![0.0; frame_count].into_boxed_slice(),
        }
    }

    #[inline]
    pub(super) fn weights(&self) -> UncheckedSlice<f32> {
        UncheckedSlice::new(&self.weights)
    }

    #[inline]
    pub(super) fn weights_mut(&mut self) -> UncheckedSliceMut<f32> {
        UncheckedSliceMut::new(&mut self.weights)
    }

    #[inline]
    pub(super) fn start_frame(&self) -> u32 {
        self.frame_numbers.first().copied().unwrap_or(0)
    }

    #[inline]
    pub(super) fn end_frame(&self) -> u32 {
        self.frame_numbers.last().copied().unwrap_or(0)
    }
}

pub(super) struct MmdPropertyAnimationTrack {
    pub(super) frame_numbers: Box<[u32]>,
    ik_states: Box<[Box<[u8]>]>,
}

impl MmdPropertyAnimationTrack {
    pub(super) fn new(frame_count: usize, ik_count: usize) -> Self {
        Self {
            frame_numbers: vec![0; frame_count].into_boxed_slice(),
            ik_states: vec![vec![1; frame_count].into_boxed_slice(); ik_count].into_boxed_slice(),
        }
    }

    #[inline]
    pub(super) fn ik_count(&self) -> usize {
        self.ik_states.len()
    }

    #[inline]
    pub(super) fn ik_states(&self, ik_index: usize) -> UncheckedSlice<u8> {
        UncheckedSlice::new(&self.ik_states[ik_index])
    }

    #[inline]
    pub(super) fn ik_states_mut(&mut self, ik_index: usize) -> UncheckedSliceMut<u8> {
        UncheckedSliceMut::new(&mut self.ik_states[ik_index])
    }

    #[inline]
    pub(super) fn start_frame(&self) -> u32 {
        self.frame_numbers.first().copied().unwrap_or(0)
    }

    #[inline]
    pub(super) fn end_frame(&self) -> u32 {
        self.frame_numbers.last().copied().unwrap_or(0)
    }
}
