use glam::{FloatExt, Vec3A};

use crate::mmd_model::MmdModel;
use crate::unchecked_slice::UncheckedSlice;

use super::mmd_animation::MmdAnimation;
use super::bezier_interpolation::bezier_interpolation;
use super::mmd_animation_track::{InterpolationVector3, InterpolationScalar};

#[derive(Clone)]
struct AnimationTrackState {
    frame_time: f32,
    frame_index: u32,
}

struct AnimationState {
    bone_track_states: Box<[AnimationTrackState]>,
    movable_bone_track_states: Box<[AnimationTrackState]>,
    morph_track_states: Box<[AnimationTrackState]>,
    property_track_state: AnimationTrackState,
}

pub(crate) struct MmdRuntimeAnimation {
    animation: &'static MmdAnimation,
    state: AnimationState,
    bone_bind_index_map: Box<[i32]>,
    movable_bone_bind_index_map: Box<[i32]>,
    morph_bind_index_map: Box<[Box<[i32]>]>,
    ik_solver_bind_index_map: Box<[i32]>,
}

impl MmdRuntimeAnimation {
    pub(super) fn new(
        animation: &'static MmdAnimation,
        bone_bind_index_map: Box<[i32]>,
        movable_bone_bind_index_map: Box<[i32]>,
        morph_bind_index_map: Box<[Box<[i32]>]>,
        ik_solver_bind_index_map: Box<[i32]>,
    ) -> Self {
        let bone_track_states = vec![
            AnimationTrackState {
                frame_time: f32::NEG_INFINITY,
                frame_index: 0,
            };
            animation.bone_tracks().len()
        ].into_boxed_slice();

        let movable_bone_track_states = vec![
            AnimationTrackState {
                frame_time: f32::NEG_INFINITY,
                frame_index: 0,
            };
            animation.movable_bone_tracks().len()
        ].into_boxed_slice();

        let morph_track_states = vec![
            AnimationTrackState {
                frame_time: f32::NEG_INFINITY,
                frame_index: 0,
            };
            animation.morph_tracks().len()
        ].into_boxed_slice();

        let property_track_state = AnimationTrackState {
            frame_time: f32::NEG_INFINITY,
            frame_index: 0,
        };

        let state = AnimationState {
            bone_track_states,
            movable_bone_track_states,
            morph_track_states,
            property_track_state,
        };

        Self {
            animation,
            state,
            bone_bind_index_map,
            movable_bone_bind_index_map,
            morph_bind_index_map,
            ik_solver_bind_index_map,
        }
    }

    #[inline]
    pub(super) fn animation(&self) -> &'static MmdAnimation {
        self.animation
    }

    fn upper_bound_frame_index(frame_time: f32, frame_numbers: &[u32], track_state: &mut AnimationTrackState) -> u32 {
        let frame_numbers = UncheckedSlice::new(frame_numbers);

        let AnimationTrackState {frame_time: last_frame_time, frame_index: last_frame_index} = track_state;

        if (frame_time - *last_frame_time).abs() < 6.0 { // if frame time is close to last frame time, use iterative search
            let mut frame_index = *last_frame_index;
            while 0 < frame_index && frame_time < frame_numbers[frame_index - 1] as f32 {
                frame_index -= 1;
            }
            while frame_index < frame_numbers.len() as u32 && frame_numbers[frame_index] as f32 <= frame_time {
                frame_index += 1;
            }

            *last_frame_time = frame_time;
            *last_frame_index = frame_index;

            frame_index
        } else { // if frame time is far from last frame time, use binary search
            let mut low = 0;
            let mut high = frame_numbers.len() as u32;

            while low < high {
                let mid = low + ((high - low) >> 1);
                if frame_time < frame_numbers[mid] as f32 {
                    high = mid;
                } else {
                    low = mid + 1;
                }
            }
        
            *last_frame_time = frame_time;
            *last_frame_index = low;

            low
        }
    }

    pub(crate) fn animate(&mut self, frame_time: f32, mmd_model: &mut MmdModel) {
        if !self.animation.bone_tracks().is_empty() {
            let animation_arena = mmd_model.animation_arena_mut();

            assert!(self.animation.bone_tracks().len() == self.bone_bind_index_map.len()
                && self.animation.bone_tracks().len() == self.state.bone_track_states.len());
            for i in 0..self.animation.bone_tracks().len() {
                let bone = self.bone_bind_index_map[i];
                let mut animation_bone_arena = animation_arena.bone_arena_mut();
                let bone = match animation_bone_arena.get_mut(bone as u32) {
                    Some(bone) => bone,
                    None => continue,
                };

                let track = &self.animation.bone_tracks()[i];

                let clamped_frame_time = frame_time.clamp(track.start_frame() as f32, track.end_frame() as f32);
                let frame_index_b = Self::upper_bound_frame_index(
                    clamped_frame_time,
                    &track.frame_numbers,
                    &mut self.state.bone_track_states[i],
                );
                let frame_index_a = frame_index_b - 1;

                if let Some(frame_number_b) = track.frame_numbers.get(frame_index_b as usize) {
                    let frame_number_a = track.frame_numbers[frame_index_a as usize] as f32;
                    let frame_number_b = *frame_number_b as f32;
                    let gradient = (clamped_frame_time - frame_number_a) / (frame_number_b - frame_number_a);

                    let weight = {
                        let InterpolationScalar {x1, x2, y1, y2} = &track.rotation_interpolations()[frame_index_b];
                        bezier_interpolation(
                            *x1 as f32 / 127.0,
                            *x2 as f32 / 127.0,
                            *y1 as f32 / 127.0,
                            *y2 as f32 / 127.0,
                            gradient,
                        )
                    };
                    bone.rotation = track.rotations()[frame_index_a].slerp(track.rotations()[frame_index_b], weight);
                } else {
                    bone.rotation = track.rotations()[frame_index_a];
                }
            }
        }

        if !self.animation.movable_bone_tracks().is_empty() {
            assert!(self.animation.movable_bone_tracks().len() == self.movable_bone_bind_index_map.len()
                && self.animation.movable_bone_tracks().len() == self.state.movable_bone_track_states.len());
            for i in 0..self.animation.movable_bone_tracks().len() {
                let bone_index = self.movable_bone_bind_index_map[i];
                let bone_rest_position = match mmd_model.bone_arena_mut().arena_mut().get(bone_index as u32) {
                    Some(bone) => bone.rest_position,
                    None => continue,
                };
                let bone = &mut mmd_model.animation_arena_mut().bone_arena_mut()[bone_index as u32];

                let track = &self.animation.movable_bone_tracks()[i];

                let clamped_frame_time = frame_time.clamp(track.start_frame() as f32, track.end_frame() as f32);
                let frame_index_b = Self::upper_bound_frame_index(
                    clamped_frame_time,
                    &track.frame_numbers,
                    &mut self.state.movable_bone_track_states[i],
                );
                let frame_index_a = frame_index_b - 1;

                if let Some(frame_number_b) = track.frame_numbers.get(frame_index_b as usize) {
                    let frame_number_a = track.frame_numbers[frame_index_a as usize] as f32;
                    let frame_number_b = *frame_number_b as f32;
                    let gradient = (clamped_frame_time - frame_number_a) / (frame_number_b - frame_number_a);

                    let (x_weight, y_weight, z_weight) = {
                        let InterpolationVector3 {x, y, z} = &track.position_interpolations()[frame_index_b];
                        (
                            bezier_interpolation(
                                x.x1 as f32 / 127.0,
                                x.x2 as f32 / 127.0,
                                x.y1 as f32 / 127.0,
                                x.y2 as f32 / 127.0,
                                gradient,
                            ),
                            bezier_interpolation(
                                y.x1 as f32 / 127.0,
                                y.x2 as f32 / 127.0,
                                y.y1 as f32 / 127.0,
                                y.y2 as f32 / 127.0,
                                gradient,
                            ),
                            bezier_interpolation(
                                z.x1 as f32 / 127.0,
                                z.x2 as f32 / 127.0,
                                z.y1 as f32 / 127.0,
                                z.y2 as f32 / 127.0,
                                gradient,
                            ),
                        )
                    };
                    let position_a = track.positions()[frame_index_a];
                    let position_b = track.positions()[frame_index_b];
                    bone.position = bone_rest_position + Vec3A::new(
                        position_a.x.lerp(position_b.x, x_weight),
                        position_a.y.lerp(position_b.y, y_weight),
                        position_a.z.lerp(position_b.z, z_weight),
                    );

                    let rotation_weight = {
                        let InterpolationScalar {x1, x2, y1, y2} = &track.rotation_interpolations()[frame_index_b];
                        bezier_interpolation(
                            *x1 as f32 / 127.0,
                            *x2 as f32 / 127.0,
                            *y1 as f32 / 127.0,
                            *y2 as f32 / 127.0,
                            gradient,
                        )
                    };
                    bone.rotation = track.rotations()[frame_index_a].slerp(track.rotations()[frame_index_b], rotation_weight);
                } else {
                    bone.position = bone_rest_position + Vec3A::from(track.positions()[frame_index_a]);
                    bone.rotation = track.rotations()[frame_index_a];
                }
            }
        }

        if !self.animation.morph_tracks().is_empty() {
            let animation_arena = mmd_model.animation_arena_mut();

            assert!(self.animation.morph_tracks().len() == self.morph_bind_index_map.len()
                && self.animation.morph_tracks().len() == self.state.morph_track_states.len());
            for i in 0..self.animation.morph_tracks().len() {
                let morph_indices = &self.morph_bind_index_map[i];

                let track = &self.animation.morph_tracks()[i];

                let clamped_frame_time = frame_time.clamp(track.start_frame() as f32, track.end_frame() as f32);
                let frame_index_b = Self::upper_bound_frame_index(
                    clamped_frame_time,
                    &track.frame_numbers,
                    &mut self.state.morph_track_states[i],
                );
                let frame_index_a = frame_index_b - 1;

                if let Some(frame_number_b) = track.frame_numbers.get(frame_index_b as usize) {
                    let frame_number_a = track.frame_numbers[frame_index_a as usize] as f32;
                    let frame_number_b = *frame_number_b as f32;
                    let gradient = (clamped_frame_time - frame_number_a) / (frame_number_b - frame_number_a);

                    let weight = track.weights()[frame_index_a] + (track.weights()[frame_index_b] - track.weights()[frame_index_a]) * gradient;

                    for morph_index in morph_indices.iter() {
                        let mut animation_morph_arena = animation_arena.morph_arena_mut();
                        let morph = match animation_morph_arena.get_mut(*morph_index as u32) {
                            Some(morph) => morph,
                            None => continue,
                        };
                        *morph = weight;
                    }
                } else {
                    for morph_index in morph_indices.iter() {
                        let mut animation_morph_arena = animation_arena.morph_arena_mut();
                        let morph = match animation_morph_arena.get_mut(*morph_index as u32) {
                            Some(morph) => morph,
                            None => continue,
                        };
                        *morph = track.weights()[frame_index_a];
                    }
                }
            }
        }

        let property_track = self.animation.property_track();
        if !property_track.frame_numbers.is_empty() {
            let animation_arena = mmd_model.animation_arena_mut();
            
            let clamp_frame_time = frame_time.clamp(
                property_track.start_frame() as f32,
                property_track.end_frame() as f32,
            );
            let step_index = Self::upper_bound_frame_index(
                clamp_frame_time,
                &property_track.frame_numbers,
                &mut self.state.property_track_state,
            ) - 1;
            
            assert!(property_track.ik_count() == self.ik_solver_bind_index_map.len());
            for i in 0..property_track.ik_count() {
                let ik_solver_index = self.ik_solver_bind_index_map[i];

                let mut animation_iksolver_state_arena = animation_arena.iksolver_state_arena_mut();
                let ik_state = match animation_iksolver_state_arena.get_mut(ik_solver_index as u32) {
                    Some(ik_state) => ik_state,
                    None => continue,
                };
                
                *ik_state = property_track.ik_states(i)[step_index];
            }
        }
    }
}
