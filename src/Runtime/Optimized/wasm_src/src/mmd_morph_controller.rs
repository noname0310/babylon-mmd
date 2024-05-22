use std::cell::RefCell;

use glam::Quat;

use crate::mmd_model_metadata::MorphMetadata;
use crate::mmd_runtime_bone::MmdRuntimeBoneArena;
use crate::unchecked_slice::{UncheckedSlice, UncheckedSliceMut};

pub(crate) struct MmdMorphController {
    morphs: Box<[MorphMetadata]>,
    active_morphs: Box<[bool]>
}

impl MmdMorphController {
    pub(crate) fn new(morphs: Box<[MorphMetadata]>) -> Self {
        let active_morphs = vec![false; morphs.len()].into_boxed_slice();
        MmdMorphController {
            morphs,
            active_morphs
        }
    }

    fn morphs(&self) -> UncheckedSlice<MorphMetadata> {
        UncheckedSlice::new(&self.morphs)
    }

    fn active_morphs(&self) -> UncheckedSlice<bool> {
        UncheckedSlice::new(&self.active_morphs)
    }

    fn active_morphs_mut(&mut self) -> UncheckedSliceMut<bool> {
        UncheckedSliceMut::new(&mut self.active_morphs)
    }

    pub(crate) fn update(&mut self, bone_arena: &mut MmdRuntimeBoneArena, morph_weights: UncheckedSlice<f32>) {
        for i in 0..self.active_morphs().len() as u32 {
            if self.active_morphs()[i] {
                self.reset_morph(i, bone_arena);
            }
        }

        for (i, weight) in morph_weights.iter().enumerate() {
            if *weight == 0.0 {
                self.active_morphs_mut()[i as u32] = false;
                continue;
            }

            self.active_morphs_mut()[i as u32] = true;
            self.apply_morph(i as u32, bone_arena, *weight);
        }
    }

    fn reset_morph(&self, i: u32, arena: &mut MmdRuntimeBoneArena) {
        match &self.morphs()[i] {
            MorphMetadata::Bone(bone_morph) => {
                for index in bone_morph.indices.iter() {
                    if let Some(bone) = arena.arena_mut().get_mut(*index as u32) {
                        bone.morph_position_offset = None;
                        bone.morph_rotation_offset = None;
                    }
                }
            }
            MorphMetadata::Group(_) => {
                self.group_morph_foreach(i as i32, |index, _| {
                    self.reset_morph(index as u32, arena);
                });
            }
        }
    }

    fn apply_morph(&self, i: u32, arena: &mut MmdRuntimeBoneArena, weight: f32) {
        match &self.morphs()[i] {
            MorphMetadata::Bone(bone_morph) => {
                for i in 0..bone_morph.indices.len() {
                    let index = bone_morph.indices[i];

                    let mut bone_arena = arena.arena_mut();
                    let bone = if let Some(bone) = bone_arena.get_mut(index as u32) {
                        bone
                    } else {
                        continue;
                    };
                    
                    let position = bone_morph.positions[i];
                    let rotation = bone_morph.rotations[i];

                    bone.morph_position_offset = if let Some(morph_position_offset) = bone.morph_position_offset {
                        Some(morph_position_offset + position * weight)
                    } else {
                        Some(position * weight)
                    };

                    bone.morph_rotation_offset = if let Some(morph_rotation_offset) = bone.morph_rotation_offset {
                        Some(morph_rotation_offset.slerp(rotation, weight))
                    } else {
                        Some(Quat::IDENTITY.slerp(rotation, weight))
                    };
                }
            }
            MorphMetadata::Group(_) => {
                self.group_morph_foreach(i as i32, |index, ratio| {
                    self.apply_morph(index as u32, arena, weight * ratio);
                });
            }
        }
    }

    fn group_morph_foreach(
        &self,
        group_morph_index: i32,
        mut f: impl FnMut(i32, f32),
    ) {
        let morphs = self.morphs();
        let morph = &morphs[group_morph_index as u32];
        if let MorphMetadata::Group(group_morph) = morph {
            for (index, ratio) in group_morph.indices.iter().zip(group_morph.ratios.iter()) {
                let child_morph = morphs.get(*index as u32);
                let child_morph = if let Some(child_morph) = child_morph {
                    child_morph
                } else {
                    continue;
                };

                if let MorphMetadata::Group(_) = child_morph {
                    continue;
                }

                f(*index, *ratio);
            }
        }
    }
}
