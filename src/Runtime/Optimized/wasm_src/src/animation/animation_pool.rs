use wasm_bindgen::prelude::*;
use web_sys::js_sys::{Uint32Array, Uint8Array, Float32Array};

use crate::animation::mmd_animation_track::{MmdBoneAnimationTrack, MmdPropertyAnimationTrack, MmdMovableBoneAnimationTrack};

use super::{mmd_animation::MmdAnimation, mmd_runtime_animation::MmdRuntimeAnimation, mmd_animation_track::MmdMorphAnimationTrack};

#[wasm_bindgen]
pub struct AnimationPool {
    animations: Vec<MmdAnimation>,
    runtime_animations: Vec<MmdRuntimeAnimation>,
    next_animation_id: u32,
    next_runtime_animation_id: u32,
}

#[wasm_bindgen]
impl AnimationPool {
    pub(crate) fn new() -> Self {
        Self {
            animations: Vec::new(),
            runtime_animations: Vec::new(),
            next_animation_id: 0,
            next_runtime_animation_id: 0,
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

    #[wasm_bindgen(js_name = "trackLengthsBufferToUint32Array")]
    pub fn track_lengths_buffer_to_uint32_array(&self, ptr: *mut u32, track_count: usize) -> Uint32Array {
        let slice = unsafe {
            std::slice::from_raw_parts_mut(ptr, track_count)
        };
        unsafe {
            Uint32Array::view(slice)
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
    pub fn get_bone_track_frame_numbers(&self, tracks: *mut usize, index: usize) -> Uint32Array {
        let tracks = tracks as *mut MmdBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.frame_numbers_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getBoneTrackRotations")]
    pub fn get_bone_track_rotations(&self, tracks: *mut usize, index: usize) -> Float32Array {
        let tracks = tracks as *mut MmdBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.rotations_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getBoneTrackRotationInterpolations")]
    pub fn get_bone_track_rotation_interpolations(&self, tracks: *mut usize, index: usize) -> Uint8Array {
        let tracks = tracks as *mut MmdBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.rotation_interpolations_typed_array()
        }
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
    pub fn get_movable_bone_track_frame_numbers(&self, tracks: *mut usize, index: usize) -> Uint32Array {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.frame_numbers_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackPositions")]
    pub fn get_movable_bone_track_positions(&self, tracks: *mut usize, index: usize) -> Float32Array {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.positions_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackPositionInterpolations")]
    pub fn get_movable_bone_track_position_interpolations(&self, tracks: *mut usize, index: usize) -> Uint8Array {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.position_interpolations_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackRotations")]
    pub fn get_movable_bone_track_rotations(&self, tracks: *mut usize, index: usize) -> Float32Array {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.rotations_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getMovableBoneTrackRotationInterpolations")]
    pub fn get_movable_bone_track_rotation_interpolations(&self, tracks: *mut usize, index: usize) -> Uint8Array {
        let tracks = tracks as *mut MmdMovableBoneAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.rotation_interpolations_typed_array()
        }
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
    pub fn get_morph_track_frame_numbers(&self, tracks: *mut usize, index: usize) -> Uint32Array {
        let tracks = tracks as *mut MmdMorphAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.frame_numbers_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getMorphTrackWeights")]
    pub fn get_morph_track_weights(&self, tracks: *mut usize, index: usize) -> Float32Array {
        let tracks = tracks as *mut MmdMorphAnimationTrack;
        let track = unsafe {
            &mut *tracks.add(index)
        };
        unsafe {
            track.weights_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "createAnimation")]
    pub fn create_animation(
        &mut self,
        bone_tracks_ptr: *mut usize,
        bone_track_count: usize,
        movable_bone_tracks_ptr: *mut usize,
        movable_bone_track_count: usize,
        morph_tracks_ptr: *mut usize,
        morph_track_count: usize,
        property_track_length: u8,
        property_track_ik_count: u8
    ) -> u32 {
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

        let id = self.next_animation_id;
        let animation = MmdAnimation::new(
            self.next_animation_id,
            bone_tracks,
            movable_bone_tracks,
            morph_tracks,
            property_track,
        );
        self.animations.push(animation);
        self.next_animation_id += 1;
        id
    }

    #[wasm_bindgen(js_name = "getAnimationPtr")]
    pub fn get_animation_ptr(&self, id: u32) -> *mut usize {
        let animation = match self.animations.iter().find(|animation| animation.id == id) {
            Some(animation) => animation,
            None => return std::ptr::null_mut(),
        };
        let ptr = animation as *const MmdAnimation as *mut usize;
        ptr
    }

    #[wasm_bindgen(js_name = "getPropertyTrackFrameNumbers")]
    pub fn get_property_track_frame_numbers(&self, animation_ptr: *mut usize) -> Uint32Array {
        let animation_ptr = animation_ptr as *mut MmdAnimation;
        let animation = unsafe {
            &mut *animation_ptr
        };
        unsafe {
            animation.property_track.frame_numbers_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getPropertyTrackVisibles")]
    pub fn get_property_track_visibles(&self, animation_ptr: *mut usize) -> Uint8Array {
        let animation_ptr = animation_ptr as *mut MmdAnimation;
        let animation = unsafe {
            &mut *animation_ptr
        };
        unsafe {
            animation.property_track.visibles_typed_array()
        }
    }

    #[wasm_bindgen(js_name = "getPropertyTrackIkStates")]
    pub fn get_property_track_ik_states(&self, animation_ptr: *mut usize, index: usize) -> Uint8Array {
        let animation_ptr = animation_ptr as *mut MmdAnimation;
        let animation = unsafe {
            &mut *animation_ptr
        };
        unsafe {
            animation.property_track.ik_states_typed_array(index)
        }
    }

    #[wasm_bindgen(js_name = "destroyAnimation")]
    pub fn destroy_animation(&mut self, id: u32) {
        let index = match self.animations.iter().position(|animation| animation.id == id) {
            Some(index) => index,
            None => return,
        };
        self.animations.remove(index);

        if let Some(index) = self.runtime_animations.iter().position(|animation| animation.animation_id == id) {
            self.runtime_animations.remove(index);
        }
    }
}
