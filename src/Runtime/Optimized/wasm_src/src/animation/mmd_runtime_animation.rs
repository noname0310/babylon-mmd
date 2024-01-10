use glam::Vec3A;

use crate::mmd_model::MmdModel;

use super::mmd_animation::MmdAnimation;
use super::bezier_interpolation::bezier_interpolation;
use super::mmd_animation_track::{InterpolationVector3, InterpolationScalar};

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
    pub(crate) fn new(
        animation: &'static MmdAnimation,
        bone_bind_index_map: Box<[i32]>,
        movable_bone_bind_index_map: Box<[i32]>,
        morph_bind_index_map: Box<[Box<[i32]>]>,
        ik_solver_bind_index_map: Box<[i32]>,
    ) -> Self {
        let mut bone_track_states = Vec::with_capacity(animation.bone_tracks().len());
        for _ in 0..animation.bone_tracks().len() {
            bone_track_states.push(AnimationTrackState {
                frame_time: f32::NEG_INFINITY,
                frame_index: 0,
            });
        }

        let mut movable_bone_track_states = Vec::with_capacity(animation.movable_bone_tracks().len());
        for _ in 0..animation.movable_bone_tracks().len() {
            movable_bone_track_states.push(AnimationTrackState {
                frame_time: f32::NEG_INFINITY,
                frame_index: 0,
            });
        }

        let mut morph_track_states = Vec::with_capacity(animation.morph_tracks().len());
        for _ in 0..animation.morph_tracks().len() {
            morph_track_states.push(AnimationTrackState {
                frame_time: f32::NEG_INFINITY,
                frame_index: 0,
            });
        }

        let property_track_state = AnimationTrackState {
            frame_time: f32::NEG_INFINITY,
            frame_index: 0,
        };

        let state = AnimationState {
            bone_track_states: bone_track_states.into_boxed_slice(),
            movable_bone_track_states: movable_bone_track_states.into_boxed_slice(),
            morph_track_states: morph_track_states.into_boxed_slice(),
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
    pub(crate) fn animation(&self) -> &'static MmdAnimation {
        self.animation
    }

    fn upper_bound_frame_index(frame_time: f32, frame_numbers: &[u32], track_state: &mut AnimationTrackState) -> u32 {
        let AnimationTrackState {frame_time: last_frame_time, frame_index: last_frame_index} = track_state;

        if (frame_time - *last_frame_time).abs() < 6.0 { // if frame time is close to last frame time, use iterative search
            let mut frame_index = *last_frame_index;
            while 0 < frame_index && frame_time < frame_numbers[(frame_index - 1) as usize] as f32 {
                frame_index -= 1;
            }
            while frame_index < frame_numbers.len() as u32 && frame_numbers[frame_index as usize] as f32 <= frame_time {
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
                if frame_time < frame_numbers[mid as usize] as f32 {
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

            for i in 0..self.animation.bone_tracks().len() {
                let bone = self.bone_bind_index_map[i];
                let bone = match animation_arena.bone_arena_mut().get_mut(bone as usize) {
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
                        let InterpolationScalar {x1, x2, y1, y2} = &track.rotation_interpolations[frame_index_b as usize];
                        bezier_interpolation(
                            *x1 as f32 / 127.0,
                            *x2 as f32 / 127.0,
                            *y1 as f32 / 127.0,
                            *y2 as f32 / 127.0,
                            gradient,
                        )
                    };
                    bone.rotation = track.rotations[frame_index_a as usize].slerp(track.rotations[frame_index_b as usize], weight);
                } else {
                    bone.rotation = track.rotations[frame_index_a as usize];
                }
            }
        }

        if !self.animation.movable_bone_tracks().is_empty() {
            for i in 0..self.animation.movable_bone_tracks().len() {
                let bone_index = self.movable_bone_bind_index_map[i];
                let bone_rest_position = match mmd_model.bone_arena_mut().get(bone_index as usize) {
                    Some(bone) => bone.rest_position,
                    None => continue,
                };
                let bone = &mut mmd_model.animation_arena_mut().bone_arena_mut()[bone_index as usize];

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
                        let InterpolationVector3 {x, y, z} = &track.position_interpolations[frame_index_b as usize];
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
                    let position_a = track.positions[frame_index_a as usize];
                    let position_b = track.positions[frame_index_b as usize];
                    bone.position = bone_rest_position + Vec3A::new(
                        position_a.x + (position_b.x - position_a.x) * x_weight,
                        position_a.y + (position_b.y - position_a.y) * y_weight,
                        position_a.z + (position_b.z - position_a.z) * z_weight,
                    );

                    let rotation_weight = {
                        let InterpolationScalar {x1, x2, y1, y2} = &track.rotation_interpolations[frame_index_b as usize];
                        bezier_interpolation(
                            *x1 as f32 / 127.0,
                            *x2 as f32 / 127.0,
                            *y1 as f32 / 127.0,
                            *y2 as f32 / 127.0,
                            gradient,
                        )
                    };
                    bone.rotation = track.rotations[frame_index_a as usize].slerp(track.rotations[frame_index_b as usize], rotation_weight);
                } else {
                    bone.position = bone_rest_position + Vec3A::from(track.positions[frame_index_a as usize]);
                    bone.rotation = track.rotations[frame_index_a as usize];
                }
            }
        }

        if !self.animation.morph_tracks().is_empty() {
            let animation_arena = mmd_model.animation_arena_mut();

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

                    let weight = track.weights[frame_index_a as usize] + (track.weights[frame_index_b as usize] - track.weights[frame_index_a as usize]) * gradient;

                    for morph_index in morph_indices.iter() {
                        let morph = match animation_arena.morph_arena_mut().get_mut(*morph_index as usize) {
                            Some(morph) => morph,
                            None => continue,
                        };
                        *morph = weight;
                    }
                } else {
                    for morph_index in morph_indices.iter() {
                        let morph = match animation_arena.morph_arena_mut().get_mut(*morph_index as usize) {
                            Some(morph) => morph,
                            None => continue,
                        };
                        *morph = track.weights[frame_index_a as usize];
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
            ) as usize - 1;
            
            for i in 0..property_track.ik_states.len() {
                let ik_solver_index = self.ik_solver_bind_index_map[i];

                let ik_state = match animation_arena.iksolver_state_arena_mut().get_mut(ik_solver_index as usize) {
                    Some(ik_state) => ik_state,
                    None => continue,
                };
                
                *ik_state = property_track.ik_states[i][step_index];
            }
        }
    }
}
