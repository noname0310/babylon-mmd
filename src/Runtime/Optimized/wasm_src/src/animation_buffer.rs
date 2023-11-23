#[repr(packed)]
struct AnimatedBoneData {
    position: [f32; 3],
    rotation: [f32; 4],
    scaling: [f32; 3],
}

pub(crate) struct AnimationBuffer {
    buffer: Box<[AnimatedBoneData]>,
}

impl AnimationBuffer {
    fn new(size: usize) -> AnimationBuffer {
        AnimationBuffer {
            buffer: Vec::with_capacity(size).into_boxed_slice(),
        }
    }
}
