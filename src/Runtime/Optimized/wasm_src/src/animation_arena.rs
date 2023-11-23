#[repr(packed)]
#[derive(Clone)]
struct AnimatedBoneData {
    position: [f32; 3],
    rotation: [f32; 4],
    scale: [f32; 3],
}

pub(crate) struct AnimationArena {
    bone_arena: Box<[AnimatedBoneData]>,
    morph_arena: Box<[f32]>,
}

impl AnimationArena {
    fn new(bone_count: usize, morph_count: usize) -> Self {
        AnimationArena {
            bone_arena: vec![AnimatedBoneData {
                position: [0.0, 0.0, 0.0],
                rotation: [0.0, 0.0, 0.0, 1.0],
                scale: [1.0, 1.0, 1.0],
            }; bone_count].into_boxed_slice(),
            morph_arena: vec![0.0; morph_count].into_boxed_slice(),
        }
    }
}
