use super::mmd_animation_track::{MmdBoneAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack};

pub(crate) struct MmdAnimation {
    pub(crate) id: u32,
    pub(crate) bone_tracks: Box<[MmdBoneAnimationTrack]>,
    pub(crate) movable_bone_tracks: Box<[MmdMovableBoneAnimationTrack]>,
    pub(crate) morph_tracks: Box<[MmdMorphAnimationTrack]>,
    pub(crate) property_track: MmdPropertyAnimationTrack,
}

impl MmdAnimation {
    pub(crate) fn new(
        id: u32,
        bone_tracks: Box<[MmdBoneAnimationTrack]>,
        movable_bone_tracks: Box<[MmdMovableBoneAnimationTrack]>,
        morph_tracks: Box<[MmdMorphAnimationTrack]>,
        property_track: MmdPropertyAnimationTrack,
    ) -> Self {
        Self {
            id,
            bone_tracks,
            movable_bone_tracks,
            morph_tracks,
            property_track,
        }
    }
}
