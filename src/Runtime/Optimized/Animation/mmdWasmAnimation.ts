import type { Nullable } from "@babylonjs/core/types";

import { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { MmdBoneAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack } from "@/Loader/Animation/mmdAnimationTrack";
import type { IDisposeObservable } from "@/Runtime/IDisposeObserable";

import type { MmdWasmInstance } from "../mmdWasmInstance";
import type { AnimationPool as WasmAnimationPool } from "../wasm";
import { AnimationPool } from "./animationPool";

/**
 * MmdWasmAnimation is a Mmd animation data container that allocates data in WASM memory
 *
 * It is used to pass animation data to WASM
 */
export class MmdWasmAnimation extends MmdAnimation {
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
        const boneTrackLengthsBuffer = animationPool.trackLengthsBufferToUint32Array(boneTrackLengthsBufferPtr, mmdAnimationBoneTracks.length);
        for (let i = 0; i < mmdAnimationBoneTracks.length; ++i) boneTrackLengthsBuffer[i] = mmdAnimationBoneTracks[i].frameNumbers.length;
        const boneTracksPtr = animationPool.createBoneTracks(boneTrackLengthsBufferPtr, boneTrackLengthsBuffer.length);
        animationPool.deallocateTrackLengthsBuffer(boneTrackLengthsBufferPtr, boneTrackLengthsBuffer.length);

        const newBoneTracks = new Array<MmdBoneAnimationTrack>(mmdAnimationBoneTracks.length);
        for (let i = 0; i < mmdAnimationBoneTracks.length; ++i) {
            const mmdAnimationBoneTrack = mmdAnimationBoneTracks[i];

            const frameNumbers = animationPool.getBoneTrackFrameNumbers(boneTracksPtr, i);
            const rotations = animationPool.getBoneTrackRotations(boneTracksPtr, i);
            const rotationInterpolations = animationPool.getBoneTrackRotationInterpolations(boneTracksPtr, i);

            frameNumbers.set(mmdAnimationBoneTrack.frameNumbers);
            rotations.set(mmdAnimationBoneTrack.rotations);
            rotationInterpolations.set(mmdAnimationBoneTrack.rotationInterpolations);

            const newBoneTrack = new MmdBoneAnimationTrack(
                mmdAnimationBoneTrack.name,
                frameNumbers.length,
                frameNumbers.buffer,
                frameNumbers.byteOffset,
                rotations.byteOffset,
                rotationInterpolations.byteOffset
            );
            newBoneTracks[i] = newBoneTrack;
        }


        const mmdAnimationMovableBoneTracks = mmdAnimation.movableBoneTracks;

        const movableBoneTrackLengthsBufferPtr = animationPool.allocateTrackLengthsBuffer(mmdAnimationMovableBoneTracks.length);
        const movableBoneTrackLengthsBuffer = animationPool.trackLengthsBufferToUint32Array(movableBoneTrackLengthsBufferPtr, mmdAnimationMovableBoneTracks.length);
        for (let i = 0; i < mmdAnimationMovableBoneTracks.length; ++i) movableBoneTrackLengthsBuffer[i] = mmdAnimationMovableBoneTracks[i].frameNumbers.length;
        const movableBoneTracksPtr = animationPool.createMovableBoneTracks(movableBoneTrackLengthsBufferPtr, movableBoneTrackLengthsBuffer.length);
        animationPool.deallocateTrackLengthsBuffer(movableBoneTrackLengthsBufferPtr, movableBoneTrackLengthsBuffer.length);

        const newMovableBoneTracks = new Array<MmdMovableBoneAnimationTrack>(mmdAnimationMovableBoneTracks.length);
        for (let i = 0; i < mmdAnimationMovableBoneTracks.length; ++i) {
            const mmdAnimationMovableBoneTrack = mmdAnimationMovableBoneTracks[i];

            const frameNumbers = animationPool.getMovableBoneTrackFrameNumbers(movableBoneTracksPtr, i);
            const positions = animationPool.getMovableBoneTrackPositions(movableBoneTracksPtr, i);
            const positionInterpolations = animationPool.getMovableBoneTrackPositionInterpolations(movableBoneTracksPtr, i);
            const rotations = animationPool.getMovableBoneTrackRotations(movableBoneTracksPtr, i);
            const rotationInterpolations = animationPool.getMovableBoneTrackRotationInterpolations(movableBoneTracksPtr, i);

            frameNumbers.set(mmdAnimationMovableBoneTrack.frameNumbers);
            positions.set(mmdAnimationMovableBoneTrack.positions);
            positionInterpolations.set(mmdAnimationMovableBoneTrack.positionInterpolations);
            rotations.set(mmdAnimationMovableBoneTrack.rotations);
            rotationInterpolations.set(mmdAnimationMovableBoneTrack.rotationInterpolations);

            const newMovableBoneTrack = new MmdMovableBoneAnimationTrack(
                mmdAnimationMovableBoneTrack.name,
                frameNumbers.length,
                frameNumbers.buffer,
                frameNumbers.byteOffset,
                positions.byteOffset,
                positionInterpolations.byteOffset,
                rotations.byteOffset,
                rotationInterpolations.byteOffset
            );
            newMovableBoneTracks[i] = newMovableBoneTrack;
        }


        const mmdAnimationMorphTracks = mmdAnimation.morphTracks;

        const morphTrackLengthsBufferPtr = animationPool.allocateTrackLengthsBuffer(mmdAnimationMorphTracks.length);
        const morphTrackLengthsBuffer = animationPool.trackLengthsBufferToUint32Array(morphTrackLengthsBufferPtr, mmdAnimationMorphTracks.length);
        for (let i = 0; i < mmdAnimationMorphTracks.length; ++i) morphTrackLengthsBuffer[i] = mmdAnimationMorphTracks[i].frameNumbers.length;
        const morphTracksPtr = animationPool.createMorphTracks(morphTrackLengthsBufferPtr, morphTrackLengthsBuffer.length);
        animationPool.deallocateTrackLengthsBuffer(morphTrackLengthsBufferPtr, morphTrackLengthsBuffer.length);

        const newMorphTracks = new Array<MmdMorphAnimationTrack>(mmdAnimationMorphTracks.length);
        for (let i = 0; i < mmdAnimationMorphTracks.length; ++i) {
            const mmdAnimationMorphTrack = mmdAnimationMorphTracks[i];

            const frameNumbers = animationPool.getMorphTrackFrameNumbers(morphTracksPtr, i);
            const weights = animationPool.getMorphTrackWeights(morphTracksPtr, i);

            frameNumbers.set(mmdAnimationMorphTrack.frameNumbers);
            weights.set(mmdAnimationMorphTrack.weights);

            const newMorphTrack = new MmdMorphAnimationTrack(
                mmdAnimationMorphTrack.name,
                frameNumbers.length,
                frameNumbers.buffer,
                frameNumbers.byteOffset,
                weights.byteOffset
            );
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

        const propertyTrackFrameNumbers = animationPool.getPropertyTrackFrameNumbers(animationPtr);
        const propertyTrackVisibles = animationPool.getPropertyTrackVisibles(animationPtr);
        propertyTrackFrameNumbers.set(mmdAnimationPropertyTrack.frameNumbers);
        propertyTrackVisibles.set(mmdAnimationPropertyTrack.visibles);

        const ikStateByteOffsets: number[] = [];
        for (let i = 0; i < mmdAnimationPropertyTrack.ikBoneNames.length; ++i) {
            const mmdAnimationPropertyTrackIkStates = mmdAnimationPropertyTrack.getIkState(i);
            const ikStates = animationPool.getPropertyTrackIkStates(animationPtr, i);
            ikStates.set(mmdAnimationPropertyTrackIkStates);
            ikStateByteOffsets.push(ikStates.byteOffset);
        }

        const newPropertyTrack = new MmdPropertyAnimationTrack(
            propertyTrackFrameNumbers.length,
            mmdAnimationPropertyTrack.ikBoneNames,
            propertyTrackFrameNumbers.buffer,
            propertyTrackFrameNumbers.byteOffset,
            propertyTrackVisibles.byteOffset,
            ikStateByteOffsets
        );

        super(
            mmdAnimation.name,
            newBoneTracks,
            newMovableBoneTracks,
            newMorphTracks,
            newPropertyTrack,
            mmdAnimation.cameraTrack
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
