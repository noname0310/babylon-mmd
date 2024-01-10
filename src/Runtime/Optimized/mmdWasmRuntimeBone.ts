import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { MmdWasmInstance } from "./mmdWasmInstance";
import type { MmdRuntime } from "./wasm";
import { type WasmBufferedArray, WasmBufferedArraySpan } from "./wasmBufferedArray";

/**
 * Bone for MMD WASM runtime
 *
 * For mmd wasm runtime, it is necessary to override the bone system because it has a different implementation than the usual matrix update method
 *
 * Which requires the mmd wasm runtime bone, which is the wrapper of the babylon.js bone
 */
export class MmdWasmRuntimeBone implements IMmdRuntimeBone {
    /**
     * The Babylon.js bone
     */
    public readonly linkedBone: IMmdRuntimeLinkedBone;

    /**
     * Name of the bone
     */
    public readonly name: string;

    /**
     * Parent bone
     */
    public parentBone: Nullable<IMmdRuntimeBone>;

    /**
     * Child bones
     */
    public readonly childBones: IMmdRuntimeBone[];

    /**
     * Transform order
     */
    public readonly transformOrder: number;

    /**
     * Bone flag
     *
     * @see PmxObject.Bone.Flag
     */
    public readonly flag: number;

    /**
     * Whether the bone transform is applied after physics
     */
    public readonly transformAfterPhysics: boolean;

    private readonly _worldMatrix: WasmBufferedArraySpan<Float32Array>;

    /**
     * World matrix of this bone
     *
     * Slice of `MmdModel.worldTransformMatrices` that corresponds to this bone
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get worldMatrix(): Float32Array {
        return this._worldMatrix.array;
    }

    /**
     * Get ik solver index
     *
     * If the bone does not have an ik solver, it will return -1
     */
    public readonly ikSolverIndex: number;

    private readonly _boneIndex: number;
    private readonly _wasmRuntime: MmdRuntime;
    private readonly _mmdModelPtr: number;

    /**
     * Create MMD WASM runtime bone
     * @param linkedBone Linked Babylon.js bone
     * @param boneMetadata Bone metadata
     * @param worldTransformMatrices WASM buffered array of world transform matrices
     * @param boneIndex Bone index
     * @param ikSolverIndex IK solver index
     * @param wasmInstance MMD WASM instance
     * @param wasmRuntime MMD WASM runtime
     * @param mmdModelPtr MMD WASM side model pointer
     */
    public constructor(
        linkedBone: IMmdRuntimeLinkedBone,
        boneMetadata: MmdModelMetadata.Bone,
        worldTransformMatrices: WasmBufferedArray<Float32Array>,
        boneIndex: number,
        ikSolverIndex: number,
        wasmInstance: MmdWasmInstance,
        wasmRuntime: MmdRuntime,
        mmdModelPtr: number
    ) {
        this.linkedBone = linkedBone;

        this.name = boneMetadata.name;
        this.parentBone = null;
        this.childBones = [];

        this.transformOrder = boneMetadata.transformOrder;
        this.flag = boneMetadata.flag;
        this.transformAfterPhysics = (boneMetadata.flag & PmxObject.Bone.Flag.TransformAfterPhysics) !== 0;

        this._worldMatrix = new WasmBufferedArraySpan(wasmInstance, worldTransformMatrices, boneIndex * 16 * 4, 16);

        this.ikSolverIndex = ikSolverIndex;

        this._boneIndex = boneIndex;
        this._wasmRuntime = wasmRuntime;
        this._mmdModelPtr = mmdModelPtr;
    }

    /**
     * @internal
     * @param wasmInstance MMD WASM instance
     */
    public updateBackBufferReference(wasmInstance: MmdWasmInstance): void {
        this._worldMatrix.updateBackBufferReference(wasmInstance);
    }

    /**
     * Update the world matrix of this bone and its children bones recursively
     */
    public updateWorldMatrix(): void {
        this._wasmRuntime.updateBoneWorldMatrix(this._mmdModelPtr, this._boneIndex);
    }

    /**
     * Get the world matrix of this bone
     *
     * The result of this method is not same as `linkedBone.getFinalMatrix()`
     *
     * `linkedBone.getFinalMatrix()` updated at the end of the mmd runtime update, so it may not be the latest value
     * @param target target matrix
     * @returns target matrix
     */
    public getWorldMatrixToRef(target: Matrix): Matrix {
        return Matrix.FromArrayToRef(this._worldMatrix.array, 0, target);
    }

    /**
     * Get the world translation of this bone
     * @param target target vector
     * @returns target vector
     */
    public getWorldTranslationToRef(target: Vector3): Vector3 {
        return Vector3.FromArrayToRef(this._worldMatrix.array, 12, target);
    }

    /**
     * Set the world translation of this bone
     * @param source source vector
     */
    public setWorldTranslationFromRef(source: Vector3): void {
        const worldMatrix = this._worldMatrix.array;
        worldMatrix[12] = source.x;
        worldMatrix[13] = source.y;
        worldMatrix[14] = source.z;
    }
}
