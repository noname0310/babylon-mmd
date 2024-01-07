use crate::animation_arena::AnimationArena;

use super::mmd_animation::MmdAnimation;

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
    morph_bind_index_map: Box<[i32]>,
    ik_solver_bind_index_map: Box<[i32]>,
}

impl<'a> MmdRuntimeAnimation {
    pub(crate) fn new(
        animation: &'static MmdAnimation,
        bone_bind_index_map: Box<[i32]>,
        movable_bone_bind_index_map: Box<[i32]>,
        morph_bind_index_map: Box<[i32]>,
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

    pub(crate) fn animate(frame_time: f32, animation_arena: &mut AnimationArena) {

    }
}
