use super::mmd_animation_track::{MmdBoneAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack};

pub(crate) struct MmdAnimation {
    pub(crate) id: u32,
    pub(crate) bone_tracks: Box<[MmdBoneAnimationTrack]>,
    pub(crate) movable_bone_tracks: Box<[MmdMovableBoneAnimationTrack]>,
    pub(crate) morph_tracks: Box<[MmdMorphAnimationTrack]>,
    pub(crate) property_tracks: Box<[MmdPropertyAnimationTrack]>,
}
