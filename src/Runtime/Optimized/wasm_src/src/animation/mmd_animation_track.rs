use nalgebra::{Quaternion, Vector3};

#[repr(C)]
#[derive(Clone)]
pub(crate) struct InterpolationScalar {
    x1: u8,
    x2: u8,
    y1: u8,
    y2: u8,
}

impl InterpolationScalar {
    pub(crate) fn new() -> Self {
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
pub(crate) struct InterpolationVector3 {
    x: InterpolationScalar,
    y: InterpolationScalar,
    z: InterpolationScalar,
}

impl InterpolationVector3 {
    pub(crate) fn new() -> Self {
        Self {
            x: InterpolationScalar::new(),
            y: InterpolationScalar::new(),
            z: InterpolationScalar::new(),
        }
    }
}

pub(crate) struct MmdBoneAnimationTrack {
    pub(crate) frame_numbers: Box<[u32]>,
    pub(crate) rotations: Box<[Quaternion<f32>]>,
    pub(crate) rotation_interpolations: Box<[InterpolationScalar]>,
}

impl MmdBoneAnimationTrack {
    pub(crate) fn new(frame_count: usize) -> Self {
        Self {
            frame_numbers: vec![0; frame_count].into_boxed_slice(),
            rotations: vec![Quaternion::identity(); frame_count].into_boxed_slice(),
            rotation_interpolations: vec![InterpolationScalar::new(); frame_count].into_boxed_slice(),
        }
    }
}

pub(crate) struct MmdMovableBoneAnimationTrack {
    pub(crate) frame_numbers: Box<[u32]>,
    pub(crate) positions: Box<[Vector3<f32>]>,
    pub(crate) position_interpolations: Box<[InterpolationVector3]>,
    pub(crate) rotations: Box<[Quaternion<f32>]>,
    pub(crate) rotation_interpolations: Box<[InterpolationScalar]>,
}

impl MmdMovableBoneAnimationTrack {
    pub(crate) fn new(frame_count: usize) -> Self {
        Self {
            frame_numbers: vec![0; frame_count].into_boxed_slice(),
            positions: vec![Vector3::zeros(); frame_count].into_boxed_slice(),
            position_interpolations: vec![InterpolationVector3::new(); frame_count].into_boxed_slice(),
            rotations: vec![Quaternion::identity(); frame_count].into_boxed_slice(),
            rotation_interpolations: vec![InterpolationScalar::new(); frame_count].into_boxed_slice(),
        }
    }
}

pub(crate) struct MmdMorphAnimationTrack {
    pub(crate) frame_numbers: Box<[u32]>,
    pub(crate) weights: Box<[f32]>,
}

impl MmdMorphAnimationTrack {
    pub(crate) fn new(frame_count: usize) -> Self {
        Self {
            frame_numbers: vec![0; frame_count].into_boxed_slice(),
            weights: vec![0.0; frame_count].into_boxed_slice(),
        }
    }
}

pub(crate) struct MmdPropertyAnimationTrack {
    pub(crate) frame_numbers: Box<[u32]>,
    pub(crate) ik_states: Box<[Box<[u8]>]>,
}

impl MmdPropertyAnimationTrack {
    pub(crate) fn new(frame_count: usize, ik_count: usize) -> Self {
        Self {
            frame_numbers: vec![0; frame_count].into_boxed_slice(),
            ik_states: vec![vec![1; frame_count].into_boxed_slice(); ik_count].into_boxed_slice(),
        }
    }
}
