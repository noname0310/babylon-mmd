import type { IMmdAnimationTrack, IMmdBoneAnimationTrack, IMmdMorphAnimationTrack, IMmdMovableBoneAnimationTrack, IMmdPropertyAnimationTrack } from "@/Loader/Animation/IMmdAnimationTrack";

import type { IWasmTypedArray } from "../Misc/IWasmTypedArray";
import type { IMmdWasmInstance } from "../mmdWasmInstance";

/**
 * MMD WASM animation track base class
 */
export abstract class MmdWasmAnimationTrack implements IMmdAnimationTrack {
    /**
     * Track type
     */
    public readonly trackType: string;

    /**
     * Track name for bind to model's bone/morph
     */
    public readonly name: string;

    private readonly _frameNumbers: IWasmTypedArray<Uint32Array>;

    /**
     * Frame numbers of this track
     *
     * The frame numbers must be sorted in ascending order
     *
     * Repr: [..., frameNumber, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get frameNumbers(): Uint32Array {
        return this._frameNumbers.array;
    }

    /**
     * Create a new `MmdWasmAnimationTrack` instance
     * @param trackType Track type
     * @param trackName Track name for bind to model
     * @param frameCount Frame count of this track
     * @param wasmInstance MMD WASM instance
     * @param byteOffset Byte offset of frame numbers in wasm memory
     */
    public constructor(
        trackType: string,
        trackName: string,
        frameCount: number,
        wasmInstance: IMmdWasmInstance,
        byteOffset: number
    ) {
        this.trackType = trackType;

        this.name = trackName;

        this._frameNumbers = wasmInstance.createTypedArray(Uint32Array, byteOffset, frameCount);
    }

    /**
     * The start frame of this animation
     */
    public get startFrame(): number {
        const frameNumbers = this._frameNumbers.array;
        if (frameNumbers.length === 0) return 0;
        return frameNumbers[0];
    }

    /**
     * The end frame of this animation
     *
     * If mmdAnimationTrack.validate() is false, the return value is not valid
     */
    public get endFrame(): number {
        const frameNumbers = this._frameNumbers.array;
        if (frameNumbers.length === 0) return 0;
        return frameNumbers[frameNumbers.length - 1];
    }
}

/**
 * MMD WASM bone animation track
 *
 * Contains bone rotation and rotation cubic interpolation data
 */
export class MmdWasmBoneAnimationTrack extends MmdWasmAnimationTrack implements IMmdBoneAnimationTrack {
    private readonly _rotations: IWasmTypedArray<Float32Array>;

    /**
     * Bone rotation data in quaternion
     *
     * The rotation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x, y, z, w, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get rotations(): Float32Array {
        return this._rotations.array;
    }

    private readonly _rotationInterpolations: IWasmTypedArray<Uint8Array>;

    /**
     * Rotation cubic interpolation data
     *
     * The rotation interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x1, x2, y1, y2, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get rotationInterpolations(): Uint8Array {
        return this._rotationInterpolations.array;
    }

    private readonly _physicsToggles: IWasmTypedArray<Uint8Array>;

    /**
     * Physics toggle data
     *
     * The physics toggle data must be sorted by frame number in ascending order
     *
     * If the value is 1, the bone will be driven by physics,
     * if the value is 0, the bone will not be driven by animation
     *
     * Repr: [..., physicsToggle, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get physicsToggles(): Uint8Array {
        return this._physicsToggles.array;
    }

    /**
     * Create a new `MmdBoneAnimationTrack` instance
     * @param trackName track name for bind to model's bone
     * @param frameCount frame count of this track
     * @param wasmInstance MMD WASM instance
     * @param frameNumberByteOffset Byte offset of frame numbers in wasm memory
     * @param rotationByteOffset Byte offset of rotations in wasm memory
     * @param rotationInterpolationByteOffset Byte offset of rotation interpolations in wasm memory
     * @param physicsToggleByteOffset Byte offset of physics toggles in wasm memory
     */
    public constructor(
        trackName: string,
        frameCount: number,
        wasmInstance: IMmdWasmInstance,
        frameNumberByteOffset: number,
        rotationByteOffset: number,
        rotationInterpolationByteOffset: number,
        physicsToggleByteOffset: number
    ) {
        super("bone", trackName, frameCount, wasmInstance, frameNumberByteOffset);

        this._rotations = wasmInstance.createTypedArray(Float32Array, rotationByteOffset, frameCount * 4);
        this._rotationInterpolations = wasmInstance.createTypedArray(Uint8Array, rotationInterpolationByteOffset, frameCount * 4);
        this._physicsToggles = wasmInstance.createTypedArray(Uint8Array, physicsToggleByteOffset, frameCount);
    }
}

/**
 * MMD WASM movable bone animation track
 *
 * Contains bone position, rotation and position/rotation cubic interpolation data
 */
export class MmdWasmMovableBoneAnimationTrack extends MmdWasmAnimationTrack implements IMmdMovableBoneAnimationTrack {
    private readonly _positions: IWasmTypedArray<Float32Array>;

    /**
     * Bone position data in vector3
     *
     * The position data must be sorted by frame number in ascending order
     *
     * Repr: [..., x, y, z, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get positions(): Float32Array {
        return this._positions.array;
    }

    private readonly _positionInterpolations: IWasmTypedArray<Uint8Array>;

    /**
     * Position cubic interpolation data
     *
     * The position interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get positionInterpolations(): Uint8Array {
        return this._positionInterpolations.array;
    }

    private readonly _rotations: IWasmTypedArray<Float32Array>;

    /**
     * Bone rotation data in quaternion
     *
     * The rotation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x, y, z, w, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get rotations(): Float32Array {
        return this._rotations.array;
    }

    private readonly _rotationInterpolations: IWasmTypedArray<Uint8Array>;

    /**
     * Rotation cubic interpolation data
     *
     * The rotation interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x1, x2, y1, y2, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get rotationInterpolations(): Uint8Array {
        return this._rotationInterpolations.array;
    }

    private readonly _physicsToggles: IWasmTypedArray<Uint8Array>;

    /**
     * Physics toggle data
     *
     * The physics toggle data must be sorted by frame number in ascending order
     *
     * If the value is 1, the bone will be driven by physics,
     * if the value is 0, the bone will not be driven by animation
     *
     * Repr: [..., physicsToggle, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get physicsToggles(): Uint8Array {
        return this._physicsToggles.array;
    }

    /**
     * Create a new `MmdMovableBoneAnimationTrack` instance
     * @param trackName Track name for bind to model's bone
     * @param frameCount Frame count of this track
     * @param wasmInstance MMD WASM instance
     * @param frameNumberByteOffset Byte offset of frame numbers in wasm memory
     * @param positionByteOffset Byte offset of positions in wasm memory
     * @param positionInterpolationByteOffset Byte offset of position interpolations in wasm memory
     * @param rotationByteOffset Byte offset of rotations in wasm memory
     * @param rotationInterpolationByteOffset Byte offset of rotation interpolations in wasm memory
     * @param physicsToggleByteOffset Byte offset of physics toggles in wasm memory
     */
    public constructor(
        trackName: string,
        frameCount: number,
        wasmInstance: IMmdWasmInstance,
        frameNumberByteOffset: number,
        positionByteOffset: number,
        positionInterpolationByteOffset: number,
        rotationByteOffset: number,
        rotationInterpolationByteOffset: number,
        physicsToggleByteOffset: number
    ) {
        super("movableBone", trackName, frameCount, wasmInstance, frameNumberByteOffset);

        this._positions = wasmInstance.createTypedArray(Float32Array, positionByteOffset, frameCount * 3);
        this._positionInterpolations = wasmInstance.createTypedArray(Uint8Array, positionInterpolationByteOffset, frameCount * 12);

        this._rotations = wasmInstance.createTypedArray(Float32Array, rotationByteOffset, frameCount * 4);
        this._rotationInterpolations = wasmInstance.createTypedArray(Uint8Array, rotationInterpolationByteOffset, frameCount * 4);

        this._physicsToggles = wasmInstance.createTypedArray(Uint8Array, physicsToggleByteOffset, frameCount);
    }
}

/**
 * MMD WASM morph animation track
 *
 * Contains morph weight data
 *
 * Weight data will be linear interpolated so there is no interpolation data
 */
export class MmdWasmMorphAnimationTrack extends MmdWasmAnimationTrack implements IMmdMorphAnimationTrack {
    private readonly _weights: IWasmTypedArray<Float32Array>;

    /**
     * Morph weight data
     *
     * The weight data must be sorted by frame number in ascending order
     *
     * Repr: [..., weight, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get weights(): Float32Array {
        return this._weights.array;
    }

    /**
     * Create a new `MmdMorphAnimationTrack` instance
     * @param trackName Track name for bind to model's morph
     * @param frameCount Frame count of this track
     * @param wasmInstance MMD WASM instance
     * @param frameNumberByteOffset Byte offset of frame numbers in arrayBuffer
     * @param weightByteOffset Byte offset of weights in arrayBuffer
     */
    public constructor(
        trackName: string,
        frameCount: number,
        wasmInstance: IMmdWasmInstance,
        frameNumberByteOffset: number,
        weightByteOffset: number
    ) {
        super("morph", trackName, frameCount, wasmInstance, frameNumberByteOffset);

        this._weights = wasmInstance.createTypedArray(Float32Array, weightByteOffset, frameCount);
    }
}

/**
 * MMD WASM property animation track
 *
 * Contains visibility and ik state data
 *
 * Visibility and ik state will be step interpolated
 */
export class MmdWasmPropertyAnimationTrack extends MmdWasmAnimationTrack implements IMmdPropertyAnimationTrack {
    /**
     * Visibility data
     *
     * The visibility data must be sorted by frame number in ascending order
     *
     * Repr: [..., visible, ...]
     */
    public readonly visibles: Uint8Array;

    /**
     * IK bone names
     *
     * Repr: [..., ikBoneName, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public readonly ikBoneNames: readonly string[];

    private readonly _ikStates: IWasmTypedArray<Uint8Array>[];

    /**
     * Create a new `MmdPropertyAnimationTrack` instance
     * @param frameCount Frame count of this track
     * @param ikBoneCount IK bone count of this track
     * @param wasmInstance MMD WASM instance
     * @param frameNumberByteOffset Byte offset of frame numbers in wasm memory
     * @param visibles Visibilities data
     * @param ikStateByteOffsets Byte offsets of IK states in wasm memory
     */
    public constructor(
        frameCount: number,
        ikBoneNames: readonly string[],
        wasmInstance: IMmdWasmInstance,
        frameNumberByteOffset: number,
        visibles: Uint8Array,
        ikStateByteOffsets: number[]
    ) {
        super("property", "propertyTrack", frameCount, wasmInstance, frameNumberByteOffset);

        if (visibles.length !== frameCount) throw new Error("visibles.length !== frameCount");
        this.visibles = visibles;

        this.ikBoneNames = ikBoneNames;
        this._ikStates = new Array(ikBoneNames.length);
        if (ikStateByteOffsets === undefined) ikStateByteOffsets = new Array(ikBoneNames.length);
        for (let i = 0; i < ikBoneNames.length; ++i) {
            this._ikStates[i] = wasmInstance.createTypedArray(Uint8Array, ikStateByteOffsets[i], frameCount);
        }
    }

    /**
     * Get nth bone IK state data
     *
     * The IK state data must be sorted by frame number in ascending order
     *
     * Repr: [..., ikState, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     * @param n Ik bone index
     * @returns IK state key frame values
     */
    public getIkState(n: number): Uint8Array {
        return this._ikStates[n].array;
    }
}
