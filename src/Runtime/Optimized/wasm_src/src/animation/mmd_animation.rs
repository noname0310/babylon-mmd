use super::mmd_animation_track::{MmdBoneAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack};

pub(super) struct MmdAnimation {
    bone_tracks: Box<[MmdBoneAnimationTrack]>,
    movable_bone_tracks: Box<[MmdMovableBoneAnimationTrack]>,
    morph_tracks: Box<[MmdMorphAnimationTrack]>,
    property_track: MmdPropertyAnimationTrack,
}

impl MmdAnimation {
    pub(super) fn new(
        bone_tracks: Box<[MmdBoneAnimationTrack]>,
        movable_bone_tracks: Box<[MmdMovableBoneAnimationTrack]>,
        morph_tracks: Box<[MmdMorphAnimationTrack]>,
        property_track: MmdPropertyAnimationTrack,
    ) -> Self {
        Self {
            bone_tracks,
            movable_bone_tracks,
            morph_tracks,
            property_track,
        }
    }

    #[inline]
    pub(super) fn bone_tracks(&self) -> &[MmdBoneAnimationTrack] {
        &self.bone_tracks
    }

    #[inline]
    pub(super) fn movable_bone_tracks(&self) -> &[MmdMovableBoneAnimationTrack] {
        &self.movable_bone_tracks
    }

    #[inline]
    pub(super) fn morph_tracks(&self) -> &[MmdMorphAnimationTrack] {
        &self.morph_tracks
    }

    #[inline]
    pub(super) fn property_track(&self) -> &MmdPropertyAnimationTrack {
        &self.property_track
    }

    #[inline]
    pub(super) fn property_track_mut(&mut self) -> &mut MmdPropertyAnimationTrack {
        &mut self.property_track
    }
}
