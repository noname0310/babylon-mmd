use nalgebra::Quaternion;

#[repr(C)]
pub(crate) struct InterpolationScalar {
    x1: u8,
    x2: u8,
    y1: u8,
    y2: u8,
}

#[repr(C)]
pub(crate) struct InterpolationVector3 {
    x: InterpolationScalar,
    y: InterpolationScalar,
    z: InterpolationScalar,
}

pub(crate) struct MmdBoneAnimationTrack {
    frame_numbers: Box<[u32]>,
    rotations: Box<[Quaternion<f32>]>,
    rotation_interpolations: Box<[InterpolationScalar]>,
}

pub(crate) struct MmdMovableBoneAnimationTrack {
    frame_numbers: Box<[u32]>,
    positions: Box<[(f32, f32, f32)]>,
    position_interpolations: Box<[InterpolationVector3]>,
    rotations: Box<[Quaternion<f32>]>,
    rotation_interpolations: Box<[InterpolationScalar]>,
}

pub(crate) struct MmdMorphAnimationTrack {
    frame_numbers: Box<[u32]>,
    weights: Box<[f32]>,
}

pub(crate) struct MmdPropertyAnimationTrack {
    frame_numbers: Box<[u32]>,
    ik_states: Box<[Box<[bool]>]>,
}
