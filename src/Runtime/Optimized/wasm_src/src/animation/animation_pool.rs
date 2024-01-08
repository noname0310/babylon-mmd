use wasm_bindgen::prelude::*;

use crate::animation::mmd_animation_track::{MmdBoneAnimationTrack, MmdPropertyAnimationTrack, MmdMovableBoneAnimationTrack};

use super::{mmd_animation::MmdAnimation, mmd_runtime_animation::MmdRuntimeAnimation, mmd_animation_track::MmdMorphAnimationTrack};

#[wasm_bindgen]
pub struct AnimationPool {
    #[allow(clippy::vec_box)]
    animations: Vec<Box<MmdAnimation>>,
    #[allow(clippy::vec_box)]
    runtime_animations: Vec<Box<MmdRuntimeAnimation>>,
}

#[wasm_bindgen]
impl AnimationPool {
    pub(crate) fn new() -> Self {
        Self {
            animations: Vec::new(),
            runtime_animations: Vec::new(),
        }
    }

    #[wasm_bindgen(js_name = "allocateTrackLengthsBuffer")]
    pub fn allocate_track_lengths_buffer(&self, track_count: usize) -> *mut u32 {
        let mut vec = vec![0; track_count].into_boxed_slice();
        let ptr = vec.as_mut_ptr();
        std::mem::forget(vec);
        ptr
    }

    #[wasm_bindgen(js_name = "deallocateTrackLengthsBuffer")]
    pub fn deallocate_track_lengths_buffer(&self, ptr: *mut u32, track_count: usize) {
        unsafe {
            let _ = Box::from_raw(std::slice::from_raw_parts_mut(ptr, track_count));
        }
    }

    #[wasm_bindgen(js_name = "createBoneTracks")]
    pub fn create_bone_tracks(&mut self, track_lengths: *const u32, track_count: usize) -> *mut usize {
        let mut tracks = Vec::with_capacity(track_count);
        for i in 0..track_count {
            let track_length = unsafe {
                *track_lengths.add(i)
            };
            let track = MmdBoneAnimationTrack::new(track_length as usize);
            tracks.push(track);
        }
        let mut tracks = tracks.into_boxed_slice();
        let ptr = tracks.as_mut_ptr();
        std::mem::forget(tracks);
        ptr as *mut usize
    }

    #[wasm_bindgen(js_name = "getBoneTrackFrameNumbers")]
    pub fn get_bone_track_frame_numbers(&self, tracks: *mut usize, index: usize) -> *mut u32 {
        let tracks = tracks as *mut MmdBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.frame_numbers.as_mut_ptr()
    }

    #[wasm_bindgen(js_name = "getBoneTrackRotations")]
    pub fn get_bone_track_rotations(&self, tracks: *mut usize, index: usize) -> *mut f32 {
        let tracks = tracks as *mut MmdBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.rotations.as_mut_ptr() as *mut f32
    }

    #[wasm_bindgen(js_name = "getBoneTrackRotationInterpolations")]
    pub fn get_bone_track_rotation_interpolations(&self, tracks: *mut usize, index: usize) -> *mut u8 {
        let tracks = tracks as *mut MmdBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.rotation_interpolations.as_mut_ptr() as *mut u8
    }

    #[wasm_bindgen(js_name = "createMovableBoneTracks")]
    pub fn create_movable_bone_tracks(&mut self, track_lengths: *const u32, track_count: usize) -> *mut usize {
        let mut tracks = Vec::with_capacity(track_count);
        for i in 0..track_count {
            let track_length = unsafe {
                *track_lengths.add(i)
            };
            let track = MmdMovableBoneAnimationTrack::new(track_length as usize);
            tracks.push(track);
        }
        let mut tracks = tracks.into_boxed_slice();
        let ptr = tracks.as_mut_ptr();
        std::mem::forget(tracks);
        ptr as *mut usize
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackFrameNumbers")]
    pub fn get_movable_bone_track_frame_numbers(&self, tracks: *mut usize, index: usize) -> *mut u32 {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.frame_numbers.as_mut_ptr()
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackPositions")]
    pub fn get_movable_bone_track_positions(&self, tracks: *mut usize, index: usize) -> *mut f32 {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.positions.as_mut_ptr() as *mut f32
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackPositionInterpolations")]
    pub fn get_movable_bone_track_position_interpolations(&self, tracks: *mut usize, index: usize) -> *mut u8 {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.position_interpolations.as_mut_ptr() as *mut u8
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackRotations")]
    pub fn get_movable_bone_track_rotations(&self, tracks: *mut usize, index: usize) -> *mut f32 {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.rotations.as_mut_ptr() as *mut f32
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackRotationInterpolations")]
    pub fn get_movable_bone_track_rotation_interpolations(&self, tracks: *mut usize, index: usize) -> *mut u8 {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.rotation_interpolations.as_mut_ptr() as *mut u8
    }

    #[wasm_bindgen(js_name = "createMorphTracks")]
    pub fn create_morph_tracks(&mut self, track_lengths: *const u32, track_count: usize) -> *mut usize {
        let mut tracks = Vec::with_capacity(track_count);
        for i in 0..track_count {
            let track_length = unsafe {
                *track_lengths.add(i)
            };
            let track = MmdMorphAnimationTrack::new(track_length as usize);
            tracks.push(track);
        }
        let mut tracks = tracks.into_boxed_slice();
        let ptr = tracks.as_mut_ptr();
        std::mem::forget(tracks);
        ptr as *mut usize
    }

    #[wasm_bindgen(js_name = "getMorphTrackFrameNumbers")]
    pub fn get_morph_track_frame_numbers(&self, tracks: *mut usize, index: usize) -> *mut u32 {
        let tracks = tracks as *mut MmdMorphAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.frame_numbers.as_mut_ptr()
    }

    #[wasm_bindgen(js_name = "getMorphTrackWeights")]
    pub fn get_morph_track_weights(&self, tracks: *mut usize, index: usize) -> *mut f32 {
        let tracks = tracks as *mut MmdMorphAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        track.weights.as_mut_ptr()
    }

    #[wasm_bindgen(js_name = "createAnimation")]
    #[allow(clippy::too_many_arguments)]
    pub fn create_animation(
        &mut self,
        bone_tracks_ptr: *mut usize,
        bone_track_count: usize,
        movable_bone_tracks_ptr: *mut usize,
        movable_bone_track_count: usize,
        morph_tracks_ptr: *mut usize,
        morph_track_count: usize,
        property_track_length: u8,
        property_track_ik_count: u8,
    ) -> *mut usize {
        let bone_tracks_ptr = bone_tracks_ptr as *mut MmdBoneAnimationTrack;
        let movable_bone_tracks_ptr = movable_bone_tracks_ptr as *mut MmdMovableBoneAnimationTrack;
        let morph_tracks_ptr = morph_tracks_ptr as *mut MmdMorphAnimationTrack;

        let bone_tracks = unsafe {
            Box::from_raw(std::slice::from_raw_parts_mut(bone_tracks_ptr, bone_track_count))
        };
        let movable_bone_tracks = unsafe {
            Box::from_raw(std::slice::from_raw_parts_mut(movable_bone_tracks_ptr, movable_bone_track_count))
        };
        let morph_tracks = unsafe {
            Box::from_raw(std::slice::from_raw_parts_mut(morph_tracks_ptr, morph_track_count))
        };
        let property_track = MmdPropertyAnimationTrack::new(property_track_length as usize, property_track_ik_count as usize);

        let animation = Box::new(MmdAnimation::new(
            bone_tracks,
            movable_bone_tracks,
            morph_tracks,
            property_track,
        ));
        let ptr = &*animation as *const MmdAnimation as *mut usize;
        self.animations.push(animation);
        ptr
    }

    #[wasm_bindgen(js_name = "getPropertyTrackFrameNumbers")]
    pub fn get_property_track_frame_numbers(&self, animation_ptr: *mut usize) -> *mut u32 {
        self.check_animation_ptr(animation_ptr);
        let animation_ptr = animation_ptr as *mut MmdAnimation;
        let animation = unsafe {
            &mut *animation_ptr
        };
        animation.property_track().frame_numbers.as_ptr() as *mut u32
    }

    #[wasm_bindgen(js_name = "getPropertyTrackIkStates")]
    pub fn get_property_track_ik_states(&self, animation_ptr: *mut usize, index: usize) -> *mut u8 {
        self.check_animation_ptr(animation_ptr);
        let animation_ptr = animation_ptr as *mut MmdAnimation;
        let animation = unsafe {
            &mut *animation_ptr
        };
        animation.property_track().ik_states[index].as_ptr() as *mut u8
    }

    #[wasm_bindgen(js_name = "destroyAnimation")]
    pub fn destroy_animation(&mut self, animation_ptr: *const usize) {
        self.check_animation_ptr(animation_ptr);
        let animation_ptr = animation_ptr as *const MmdAnimation;

        let index = match self.animations.iter().position(|animation| &**animation as *const MmdAnimation == animation_ptr) {
            Some(index) => index,
            None => return,
        };
        self.animations.remove(index);

        if let Some(index) = self.runtime_animations.iter().position(|animation| animation.animation() as *const MmdAnimation == animation_ptr) {
            self.runtime_animations.remove(index);
        }
    }

    #[wasm_bindgen(js_name = "createBoneBindIndexMap")]
    pub fn create_bone_bind_index_map(&mut self, animation_ptr: *const usize) -> *mut i32 {
        self.check_animation_ptr(animation_ptr);
        let animation_ptr = animation_ptr as *const MmdAnimation;
        let animation = unsafe {
            &*animation_ptr
        };

        let mut bone_bind_index_map = Vec::with_capacity(animation.bone_tracks().len());
        for _ in 0..animation.bone_tracks().len() {
            bone_bind_index_map.push(-1);
        }
        let bone_bind_index_map = bone_bind_index_map.into_boxed_slice();
        let ptr = bone_bind_index_map.as_ptr();
        std::mem::forget(bone_bind_index_map);
        ptr as *mut i32
    }

    #[wasm_bindgen(js_name = "createMovableBoneBindIndexMap")]
    pub fn create_movable_bone_bind_index_map(&mut self, animation_ptr: *const usize) -> *mut i32 {
        self.check_animation_ptr(animation_ptr);
        let animation_ptr = animation_ptr as *const MmdAnimation;
        let animation = unsafe {
            &*animation_ptr
        };

        let mut movable_bone_bind_index_map = Vec::with_capacity(animation.movable_bone_tracks().len());
        for _ in 0..animation.movable_bone_tracks().len() {
            movable_bone_bind_index_map.push(-1);
        }
        let movable_bone_bind_index_map = movable_bone_bind_index_map.into_boxed_slice();
        let ptr = movable_bone_bind_index_map.as_ptr();
        std::mem::forget(movable_bone_bind_index_map);
        ptr as *mut i32
    }

    #[wasm_bindgen(js_name = "createMorphBindIndexMap")]
    pub fn create_morph_bind_index_map(&mut self, animation_ptr: *const usize) -> *mut i32 {
        self.check_animation_ptr(animation_ptr);
        let animation_ptr = animation_ptr as *const MmdAnimation;
        let animation = unsafe {
            &*animation_ptr
        };

        let mut morph_bind_index_map = Vec::with_capacity(animation.morph_tracks().len());
        for _ in 0..animation.morph_tracks().len() {
            morph_bind_index_map.push(-1);
        }
        let morph_bind_index_map = morph_bind_index_map.into_boxed_slice();
        let ptr = morph_bind_index_map.as_ptr();
        std::mem::forget(morph_bind_index_map);
        ptr as *mut i32
    }

    #[wasm_bindgen(js_name = "createIkSolverBindIndexMap")]
    pub fn create_ik_solver_bind_index_map(&mut self, animation_ptr: *const usize) -> *mut i32 {
        self.check_animation_ptr(animation_ptr);
        let animation_ptr = animation_ptr as *const MmdAnimation;
        let animation = unsafe {
            &*animation_ptr
        };

        let mut ik_solver_bind_index_map = Vec::with_capacity(animation.property_track().ik_states.len());
        for _ in 0..animation.property_track().ik_states.len() {
            ik_solver_bind_index_map.push(-1);
        }
        let ik_solver_bind_index_map = ik_solver_bind_index_map.into_boxed_slice();
        let ptr = ik_solver_bind_index_map.as_ptr();
        std::mem::forget(ik_solver_bind_index_map);
        ptr as *mut i32
    }

    #[wasm_bindgen(js_name = "createRuntimeAnimation")]
    pub fn create_runtime_animation(
        &mut self,
        animation_ptr: *const usize,
        bone_bind_index_map: *mut i32,
        movable_bone_bind_index_map: *mut i32,
        morph_bind_index_map: *mut i32,
        ik_solver_bind_index_map: *mut i32,
    ) -> *mut usize {
        self.check_animation_ptr(animation_ptr);
        let animation_ptr = animation_ptr as *const MmdAnimation;
        let animation = unsafe {
            &*animation_ptr
        };

        let bone_bind_index_map = unsafe {
            Box::from_raw(std::slice::from_raw_parts_mut(bone_bind_index_map, animation.bone_tracks().len()))
        };
        let movable_bone_bind_index_map = unsafe {
            Box::from_raw(std::slice::from_raw_parts_mut(movable_bone_bind_index_map, animation.movable_bone_tracks().len()))
        };
        let morph_bind_index_map = unsafe {
            Box::from_raw(std::slice::from_raw_parts_mut(morph_bind_index_map, animation.morph_tracks().len()))
        };
        let ik_solver_bind_index_map = unsafe {
            Box::from_raw(std::slice::from_raw_parts_mut(ik_solver_bind_index_map, animation.property_track().ik_states.len()))
        };

        let runtime_animation = Box::new(MmdRuntimeAnimation::new(
            animation,
            bone_bind_index_map,
            movable_bone_bind_index_map,
            morph_bind_index_map,
            ik_solver_bind_index_map,
        ));
        let ptr = &*runtime_animation as *const MmdRuntimeAnimation as *mut usize;
        self.runtime_animations.push(runtime_animation);
        ptr
    }

    #[cfg(debug_assertions)]
    fn check_animation_ptr(&self, animation_ptr: *const usize) {
        let animation_ptr = animation_ptr as *const MmdAnimation;
        assert!(self.animations.iter().any(|animation| &**animation as *const MmdAnimation == animation_ptr), "AnimationPool: animation_ptr is invalid");
    }

    #[cfg(not(debug_assertions))]
    #[inline(always)]
    fn check_animation_ptr(&self, _animation_ptr: *const usize) {}

    #[cfg(debug_assertions)]
    fn check_runtime_animation_ptr(&self, animation_ptr: *const usize) {
        let animation_ptr = animation_ptr as *const MmdRuntimeAnimation;
        assert!(self.runtime_animations.iter().any(|animation| &**animation as *const MmdRuntimeAnimation == animation_ptr), "AnimationPool: animation_ptr is invalid");
    }

    #[cfg(not(debug_assertions))]
    #[inline(always)]
    fn check_runtime_animation_ptr(&self, _animation_ptr: *const usize) {}
}
