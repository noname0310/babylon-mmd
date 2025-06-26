import type { Nullable } from "@babylonjs/core/types";

import type { IMmdPropertyAnimationTrack } from "@/Loader/Animation/IMmdAnimationTrack";
import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { MmdAnimationBase } from "@/Loader/Animation/mmdAnimationBase";
import { MmdCameraAnimationTrack, MmdPropertyAnimationTrack } from "@/Loader/Animation/mmdAnimationTrack";
import type { IDisposeObservable } from "@/Runtime/IDisposeObserable";

import type { IMmdWasmInstance } from "../mmdWasmInstance";
import { AnimationPoolWrapper } from "./animationPoolWrapper";
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
    IMmdPropertyAnimationTrack
> {
    /**
     * Pointer to the animation data in wasm memory
     */
    public readonly ptr: number;

    /**
     * @internal
     */
    public readonly _poolWrapper: AnimationPoolWrapper;

    private _disposed: boolean;
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
        wasmInstance: IMmdWasmInstance,
        disposeObservable: Nullable<IDisposeObservable>
    ) {
        const animationPoolWrapper = AnimationPoolWrapper.Get(wasmInstance);
        animationPoolWrapper.addReference();
        const animationPool = animationPoolWrapper.pool;

        const mmdAnimationBoneTracks = mmdAnimation.boneTracks;

        const boneTrackLengthsBufferPtr = animationPool.allocateLengthsBuffer(mmdAnimationBoneTracks.length);
        const boneTrackLengthsBuffer = wasmInstance.createTypedArray(Uint32Array, boneTrackLengthsBufferPtr, mmdAnimationBoneTracks.length).array;
        for (let i = 0; i < mmdAnimationBoneTracks.length; ++i) boneTrackLengthsBuffer[i] = mmdAnimationBoneTracks[i].frameNumbers.length;
        const boneTracksPtr = animationPool.createBoneTracks(boneTrackLengthsBufferPtr, boneTrackLengthsBuffer.length);
        animationPool.deallocateLengthsBuffer(boneTrackLengthsBufferPtr, boneTrackLengthsBuffer.length);

        const newBoneTracks = new Array<MmdWasmBoneAnimationTrack>(mmdAnimationBoneTracks.length);
        for (let i = 0; i < mmdAnimationBoneTracks.length; ++i) {
            const mmdAnimationBoneTrack = mmdAnimationBoneTracks[i];

            const frameNumbersPtr = animationPool.getBoneTrackFrameNumbers(boneTracksPtr, i);
            const rotationsPtr = animationPool.getBoneTrackRotations(boneTracksPtr, i);
            const rotationInterpolationsPtr = animationPool.getBoneTrackRotationInterpolations(boneTracksPtr, i);
            const physicsTogglesPtr = animationPool.getBoneTrackPhysicsToggles(boneTracksPtr, i);

            const newBoneTrack = new MmdWasmBoneAnimationTrack(
                mmdAnimationBoneTrack.name,
                mmdAnimationBoneTrack.frameNumbers.length,
                wasmInstance,
                frameNumbersPtr,
                rotationsPtr,
                rotationInterpolationsPtr,
                physicsTogglesPtr
            );
            newBoneTrack.frameNumbers.set(mmdAnimationBoneTrack.frameNumbers);
            newBoneTrack.rotations.set(mmdAnimationBoneTrack.rotations);
            newBoneTrack.rotationInterpolations.set(mmdAnimationBoneTrack.rotationInterpolations);
            newBoneTrack.physicsToggles.set(mmdAnimationBoneTrack.physicsToggles);
            newBoneTracks[i] = newBoneTrack;
        }


        const mmdAnimationMovableBoneTracks = mmdAnimation.movableBoneTracks;

        const movableBoneTrackLengthsBufferPtr = animationPool.allocateLengthsBuffer(mmdAnimationMovableBoneTracks.length);
        const movableBoneTrackLengthsBuffer = wasmInstance.createTypedArray(Uint32Array, movableBoneTrackLengthsBufferPtr, mmdAnimationMovableBoneTracks.length).array;
        for (let i = 0; i < mmdAnimationMovableBoneTracks.length; ++i) movableBoneTrackLengthsBuffer[i] = mmdAnimationMovableBoneTracks[i].frameNumbers.length;
        const movableBoneTracksPtr = animationPool.createMovableBoneTracks(movableBoneTrackLengthsBufferPtr, movableBoneTrackLengthsBuffer.length);
        animationPool.deallocateLengthsBuffer(movableBoneTrackLengthsBufferPtr, movableBoneTrackLengthsBuffer.length);

        const newMovableBoneTracks = new Array<MmdWasmMovableBoneAnimationTrack>(mmdAnimationMovableBoneTracks.length);
        for (let i = 0; i < mmdAnimationMovableBoneTracks.length; ++i) {
            const mmdAnimationMovableBoneTrack = mmdAnimationMovableBoneTracks[i];

            const frameNumbersPtr = animationPool.getMovableBoneTrackFrameNumbers(movableBoneTracksPtr, i);
            const positionsPtr = animationPool.getMovableBoneTrackPositions(movableBoneTracksPtr, i);
            const positionInterpolationsPtr = animationPool.getMovableBoneTrackPositionInterpolations(movableBoneTracksPtr, i);
            const rotationsPtr = animationPool.getMovableBoneTrackRotations(movableBoneTracksPtr, i);
            const rotationInterpolationsPtr = animationPool.getMovableBoneTrackRotationInterpolations(movableBoneTracksPtr, i);
            const physicsTogglesPtr = animationPool.getMovableBoneTrackPhysicsToggles(movableBoneTracksPtr, i);

            const newMovableBoneTrack = new MmdWasmMovableBoneAnimationTrack(
                mmdAnimationMovableBoneTrack.name,
                mmdAnimationMovableBoneTrack.frameNumbers.length,
                wasmInstance,
                frameNumbersPtr,
                positionsPtr,
                positionInterpolationsPtr,
                rotationsPtr,
                rotationInterpolationsPtr,
                physicsTogglesPtr
            );
            newMovableBoneTrack.frameNumbers.set(mmdAnimationMovableBoneTrack.frameNumbers);
            newMovableBoneTrack.positions.set(mmdAnimationMovableBoneTrack.positions);
            newMovableBoneTrack.positionInterpolations.set(mmdAnimationMovableBoneTrack.positionInterpolations);
            newMovableBoneTrack.rotations.set(mmdAnimationMovableBoneTrack.rotations);
            newMovableBoneTrack.rotationInterpolations.set(mmdAnimationMovableBoneTrack.rotationInterpolations);
            newMovableBoneTrack.physicsToggles.set(mmdAnimationMovableBoneTrack.physicsToggles);
            newMovableBoneTracks[i] = newMovableBoneTrack;
        }


        const mmdAnimationMorphTracks = mmdAnimation.morphTracks;

        const morphTrackLengthsBufferPtr = animationPool.allocateLengthsBuffer(mmdAnimationMorphTracks.length);
        const morphTrackLengthsBuffer = wasmInstance.createTypedArray(Uint32Array, morphTrackLengthsBufferPtr, mmdAnimationMorphTracks.length).array;
        for (let i = 0; i < mmdAnimationMorphTracks.length; ++i) morphTrackLengthsBuffer[i] = mmdAnimationMorphTracks[i].frameNumbers.length;
        const morphTracksPtr = animationPool.createMorphTracks(morphTrackLengthsBufferPtr, morphTrackLengthsBuffer.length);
        animationPool.deallocateLengthsBuffer(morphTrackLengthsBufferPtr, morphTrackLengthsBuffer.length);

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
        const animationPtr = animationPool.createAnimation(
            boneTracksPtr,
            newBoneTracks.length,
            movableBoneTracksPtr,
            newMovableBoneTracks.length,
            morphTracksPtr,
            newMorphTracks.length,
            mmdAnimationPropertyTrack.frameNumbers.length,
            mmdAnimationPropertyTrack.ikBoneNames.length
        );

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

        this.ptr = animationPtr;
        this._poolWrapper = animationPoolWrapper;

        this._disposed = false;
        this._bindedDispose = this.dispose.bind(this);
        this._disposeObservableObject = disposeObservable;
        if (this._disposeObservableObject !== null) {
            this._disposeObservableObject.onDisposeObservable.add(this._bindedDispose);
        }
    }

    /**
     * Dispose this instance
     *
     * all typed arrays in this instance will be invalid after this method is called
     */
    public dispose(): void {
        if (this._disposed) return;
        this._disposed = true;

        this._poolWrapper.pool.destroyAnimation(this.ptr);
        this._poolWrapper.removeReference();
        (this._poolWrapper as AnimationPoolWrapper) = null!;

        (this.boneTracks as MmdWasmBoneAnimationTrack[]).length = 0;
        (this.movableBoneTracks as MmdWasmMovableBoneAnimationTrack[]).length = 0;
        (this.morphTracks as MmdWasmMorphAnimationTrack[]).length = 0;
        (this.propertyTrack as IMmdPropertyAnimationTrack) = new MmdPropertyAnimationTrack(0, []);
        (this.cameraTrack as MmdCameraAnimationTrack) = new MmdCameraAnimationTrack(0);

        if (this._disposeObservableObject !== null) {
            this._disposeObservableObject.onDisposeObservable.removeCallback(this._bindedDispose);
        }
    }

    /**
     * Whether this instance is disposed
     */
    public get isDisposed(): boolean {
        return this._disposed;
    }
}
