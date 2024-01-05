import type { Nullable } from "@babylonjs/core/types";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { MmdAnimationBase } from "@/Loader/Animation/mmdAnimationBase";
import { MmdCameraAnimationTrack } from "@/Loader/Animation/mmdAnimationTrack";
import type { IDisposeObservable } from "@/Runtime/IDisposeObserable";

import type { MmdWasmInstance } from "../mmdWasmInstance";
import type { AnimationPool as WasmAnimationPool } from "../wasm";
import { AnimationPool } from "./animationPool";
import { MmdWasmBoneAnimationTrack, MmdWasmMorphAnimationTrack, MmdWasmMovableBoneAnimationTrack, MmdWasmPropertyAnimationTrack } from "./mmdWasmAnimationTrack";

/**
 * MmdWasmAnimation is a Mmd animation data container that allocates data in WASM memory
 *
 * It is used to pass animation data to WASM
 *
 * IMPORTANT: The typed arrays in the track are pointers to wasm memory.
 * It is important to note that when wasm memory is resized, the typed arrays will no longer be valid.
 * It is designed to always return a valid typed array at the time of a get,
 * so as long as you don't copy the typed array references inside this container elsewhere, you are safe.
 */
export class MmdWasmAnimation extends MmdAnimationBase<
    MmdWasmBoneAnimationTrack,
    MmdWasmMovableBoneAnimationTrack,
    MmdWasmMorphAnimationTrack,
    MmdWasmPropertyAnimationTrack
> {
    private readonly _id: number;
    private readonly _pool: WasmAnimationPool;

    private readonly _bindedDispose: () => void;
    private readonly _disposeObservableObject: Nullable<IDisposeObservable>;

    /**
     * Create a MmdWasmAnimation instance
     *
     * In general disposeObservable should be `Scene` of Babylon.js
     *
     * @param disposeObservable Objects that limit the lifetime of this instance
     */
    public constructor(
        mmdAnimation: MmdAnimation,
        wasmInstance: MmdWasmInstance,
        disposeObservable: Nullable<IDisposeObservable>
    ) {
        const animationPool = AnimationPool.Get(wasmInstance);

        const mmdAnimationBoneTracks = mmdAnimation.boneTracks;

        const boneTrackLengthsBufferPtr = animationPool.allocateTrackLengthsBuffer(mmdAnimationBoneTracks.length);
        const boneTrackLengthsBuffer = wasmInstance.createTypedArray(Uint32Array, boneTrackLengthsBufferPtr, mmdAnimationBoneTracks.length).array;
        for (let i = 0; i < mmdAnimationBoneTracks.length; ++i) boneTrackLengthsBuffer[i] = mmdAnimationBoneTracks[i].frameNumbers.length;
        const boneTracksPtr = animationPool.createBoneTracks(boneTrackLengthsBufferPtr, boneTrackLengthsBuffer.length);
        animationPool.deallocateTrackLengthsBuffer(boneTrackLengthsBufferPtr, boneTrackLengthsBuffer.length);

        const newBoneTracks = new Array<MmdWasmBoneAnimationTrack>(mmdAnimationBoneTracks.length);
        for (let i = 0; i < mmdAnimationBoneTracks.length; ++i) {
            const mmdAnimationBoneTrack = mmdAnimationBoneTracks[i];

            const frameNumbersPtr = animationPool.getBoneTrackFrameNumbers(boneTracksPtr, i);
            const rotationsPtr = animationPool.getBoneTrackRotations(boneTracksPtr, i);
            const rotationInterpolationsPtr = animationPool.getBoneTrackRotationInterpolations(boneTracksPtr, i);

            const newBoneTrack = new MmdWasmBoneAnimationTrack(
                mmdAnimationBoneTrack.name,
                mmdAnimationBoneTrack.frameNumbers.length,
                wasmInstance,
                frameNumbersPtr,
                rotationsPtr,
                rotationInterpolationsPtr
            );
            newBoneTrack.frameNumbers.set(mmdAnimationBoneTrack.frameNumbers);
            newBoneTrack.rotations.set(mmdAnimationBoneTrack.rotations);
            newBoneTrack.rotationInterpolations.set(mmdAnimationBoneTrack.rotationInterpolations);
            newBoneTracks[i] = newBoneTrack;
        }


        const mmdAnimationMovableBoneTracks = mmdAnimation.movableBoneTracks;

        const movableBoneTrackLengthsBufferPtr = animationPool.allocateTrackLengthsBuffer(mmdAnimationMovableBoneTracks.length);
        const movableBoneTrackLengthsBuffer = wasmInstance.createTypedArray(Uint32Array, movableBoneTrackLengthsBufferPtr, mmdAnimationMovableBoneTracks.length).array;
        for (let i = 0; i < mmdAnimationMovableBoneTracks.length; ++i) movableBoneTrackLengthsBuffer[i] = mmdAnimationMovableBoneTracks[i].frameNumbers.length;
        const movableBoneTracksPtr = animationPool.createMovableBoneTracks(movableBoneTrackLengthsBufferPtr, movableBoneTrackLengthsBuffer.length);
        animationPool.deallocateTrackLengthsBuffer(movableBoneTrackLengthsBufferPtr, movableBoneTrackLengthsBuffer.length);

        const newMovableBoneTracks = new Array<MmdWasmMovableBoneAnimationTrack>(mmdAnimationMovableBoneTracks.length);
        for (let i = 0; i < mmdAnimationMovableBoneTracks.length; ++i) {
            const mmdAnimationMovableBoneTrack = mmdAnimationMovableBoneTracks[i];

            const frameNumbersPtr = animationPool.getMovableBoneTrackFrameNumbers(movableBoneTracksPtr, i);
            const positionsPtr = animationPool.getMovableBoneTrackPositions(movableBoneTracksPtr, i);
            const positionInterpolationsPtr = animationPool.getMovableBoneTrackPositionInterpolations(movableBoneTracksPtr, i);
            const rotationsPtr = animationPool.getMovableBoneTrackRotations(movableBoneTracksPtr, i);
            const rotationInterpolationsPtr = animationPool.getMovableBoneTrackRotationInterpolations(movableBoneTracksPtr, i);

            const newMovableBoneTrack = new MmdWasmMovableBoneAnimationTrack(
                mmdAnimationMovableBoneTrack.name,
                mmdAnimationMovableBoneTrack.frameNumbers.length,
                wasmInstance,
                frameNumbersPtr,
                positionsPtr,
                positionInterpolationsPtr,
                rotationsPtr,
                rotationInterpolationsPtr
            );
            newMovableBoneTrack.frameNumbers.set(mmdAnimationMovableBoneTrack.frameNumbers);
            newMovableBoneTrack.positions.set(mmdAnimationMovableBoneTrack.positions);
            newMovableBoneTrack.positionInterpolations.set(mmdAnimationMovableBoneTrack.positionInterpolations);
            newMovableBoneTrack.rotations.set(mmdAnimationMovableBoneTrack.rotations);
            newMovableBoneTrack.rotationInterpolations.set(mmdAnimationMovableBoneTrack.rotationInterpolations);
            newMovableBoneTracks[i] = newMovableBoneTrack;
        }


        const mmdAnimationMorphTracks = mmdAnimation.morphTracks;

        const morphTrackLengthsBufferPtr = animationPool.allocateTrackLengthsBuffer(mmdAnimationMorphTracks.length);
        const morphTrackLengthsBuffer = wasmInstance.createTypedArray(Uint32Array, morphTrackLengthsBufferPtr, mmdAnimationMorphTracks.length).array;
        for (let i = 0; i < mmdAnimationMorphTracks.length; ++i) morphTrackLengthsBuffer[i] = mmdAnimationMorphTracks[i].frameNumbers.length;
        const morphTracksPtr = animationPool.createMorphTracks(morphTrackLengthsBufferPtr, morphTrackLengthsBuffer.length);
        animationPool.deallocateTrackLengthsBuffer(morphTrackLengthsBufferPtr, morphTrackLengthsBuffer.length);

        const newMorphTracks = new Array<MmdWasmMorphAnimationTrack>(mmdAnimationMorphTracks.length);
        for (let i = 0; i < mmdAnimationMorphTracks.length; ++i) {
            const mmdAnimationMorphTrack = mmdAnimationMorphTracks[i];

            const frameNumbersPtr = animationPool.getMorphTrackFrameNumbers(morphTracksPtr, i);
            const weightsPtr = animationPool.getMorphTrackWeights(morphTracksPtr, i);

            const newMorphTrack = new MmdWasmMorphAnimationTrack(
                mmdAnimationMorphTrack.name,
                mmdAnimationMorphTrack.frameNumbers.length,
                wasmInstance,
                frameNumbersPtr,
                weightsPtr
            );
            newMorphTrack.frameNumbers.set(mmdAnimationMorphTrack.frameNumbers);
            newMorphTrack.weights.set(mmdAnimationMorphTrack.weights);
            newMorphTracks[i] = newMorphTrack;
        }

        const mmdAnimationPropertyTrack = mmdAnimation.propertyTrack;
        const animationId = animationPool.createAnimation(
            boneTracksPtr,
            newBoneTracks.length,
            movableBoneTracksPtr,
            newMovableBoneTracks.length,
            morphTracksPtr,
            newMorphTracks.length,
            mmdAnimationPropertyTrack.frameNumbers.length,
            mmdAnimationPropertyTrack.ikBoneNames.length
        );
        const animationPtr = animationPool.getAnimationPtr(animationId);

        const propertyTrackFrameNumbersPtr = animationPool.getPropertyTrackFrameNumbers(animationPtr);

        let visibles: Uint8Array;
        if (mmdAnimationPropertyTrack.visibles.buffer.byteLength - mmdAnimationPropertyTrack.visibles.byteLength < mmdAnimationPropertyTrack.visibles.byteLength) {
            visibles = mmdAnimationPropertyTrack.visibles;
        } else {
            visibles = new Uint8Array(mmdAnimationPropertyTrack.visibles.length);
            visibles.set(mmdAnimationPropertyTrack.visibles);
        }

        const ikStateByteOffsets: number[] = [];
        for (let i = 0; i < mmdAnimationPropertyTrack.ikBoneNames.length; ++i) {
            const ikStatesPtr = animationPool.getPropertyTrackIkStates(animationPtr, i);
            ikStateByteOffsets.push(ikStatesPtr);
        }

        const newPropertyTrack = new MmdWasmPropertyAnimationTrack(
            mmdAnimationPropertyTrack.frameNumbers.length,
            mmdAnimationPropertyTrack.ikBoneNames,
            wasmInstance,
            propertyTrackFrameNumbersPtr,
            visibles,
            ikStateByteOffsets
        );
        newPropertyTrack.frameNumbers.set(mmdAnimationPropertyTrack.frameNumbers);
        for (let i = 0; i < mmdAnimationPropertyTrack.ikBoneNames.length; ++i) {
            const mmdAnimationPropertyTrackIkStates = mmdAnimationPropertyTrack.getIkState(i);
            newPropertyTrack.getIkState(i).set(mmdAnimationPropertyTrackIkStates);
        }

        const mmdAnimationCameraTrack = mmdAnimation.cameraTrack;
        const cameraTrackByteLength = mmdAnimationCameraTrack.frameNumbers.byteLength +
            mmdAnimationCameraTrack.positions.byteLength +
            mmdAnimationCameraTrack.positionInterpolations.byteLength +
            mmdAnimationCameraTrack.rotations.byteLength +
            mmdAnimationCameraTrack.rotationInterpolations.byteLength +
            mmdAnimationCameraTrack.distances.byteLength +
            mmdAnimationCameraTrack.distanceInterpolations.byteLength +
            mmdAnimationCameraTrack.fovs.byteLength +
            mmdAnimationCameraTrack.fovInterpolations.byteLength;
        let cameraTrack: MmdCameraAnimationTrack;
        if (mmdAnimationCameraTrack.frameNumbers.buffer.byteLength - cameraTrackByteLength < cameraTrackByteLength) {
            cameraTrack = mmdAnimationCameraTrack;
        } else {
            cameraTrack = new MmdCameraAnimationTrack(mmdAnimationCameraTrack.frameNumbers.length);
            cameraTrack.frameNumbers.set(mmdAnimationCameraTrack.frameNumbers);
            cameraTrack.positions.set(mmdAnimationCameraTrack.positions);
            cameraTrack.positionInterpolations.set(mmdAnimationCameraTrack.positionInterpolations);
            cameraTrack.rotations.set(mmdAnimationCameraTrack.rotations);
            cameraTrack.rotationInterpolations.set(mmdAnimationCameraTrack.rotationInterpolations);
            cameraTrack.distances.set(mmdAnimationCameraTrack.distances);
            cameraTrack.distanceInterpolations.set(mmdAnimationCameraTrack.distanceInterpolations);
            cameraTrack.fovs.set(mmdAnimationCameraTrack.fovs);
            cameraTrack.fovInterpolations.set(mmdAnimationCameraTrack.fovInterpolations);
        }

        super(
            mmdAnimation.name,
            newBoneTracks,
            newMovableBoneTracks,
            newMorphTracks,
            newPropertyTrack,
            cameraTrack
        );

        this._id = animationId;
        this._pool = animationPool;

        this._bindedDispose = this.dispose.bind(this);
        this._disposeObservableObject = disposeObservable;
        if (this._disposeObservableObject !== null) {
            this._disposeObservableObject.onDisposeObservable.add(this._bindedDispose);
        }
    }

    public dispose(): void {
        this._pool.destroyAnimation(this._id);

        if (this._disposeObservableObject !== null) {
            this._disposeObservableObject.onDisposeObservable.removeCallback(this._bindedDispose);
        }
    }
}
