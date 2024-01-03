import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { MmdRuntime } from "./wasm";

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

    /**
     * World matrix of this bone
     *
     * Slice of `MmdModel.worldTransformMatrices` that corresponds to this bone
     */
    public readonly worldMatrix: Float32Array;

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
     * @param worldTransformMatrices World transform matrices
     * @param boneIndex Bone index
     * @param ikSolverIndex IK solver index
     * @param wasmRuntime MMD WASM runtime
     * @param mmdModelPtr MMD WASM side model pointer
     */
    public constructor(
        linkedBone: IMmdRuntimeLinkedBone,
        boneMetadata: MmdModelMetadata.Bone,
        worldTransformMatrices: Float32Array,
        boneIndex: number,
        ikSolverIndex: number,
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

        this.worldMatrix = new Float32Array(worldTransformMatrices.buffer, worldTransformMatrices.byteOffset + boneIndex * 16 * 4, 16);

        this.ikSolverIndex = ikSolverIndex;

        this._boneIndex = boneIndex;
        this._wasmRuntime = wasmRuntime;
        this._mmdModelPtr = mmdModelPtr;
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
        return Matrix.FromArrayToRef(this.worldMatrix, 0, target);
    }

    /**
     * Get the world translation of this bone
     * @param target target vector
     * @returns target vector
     */
    public getWorldTranslationToRef(target: Vector3): Vector3 {
        return Vector3.FromArrayToRef(this.worldMatrix, 12, target);
    }

    /**
     * Set the world translation of this bone
     * @param source source vector
     */
    public setWorldTranslationFromRef(source: Vector3): void {
        this.worldMatrix[12] = source.x;
        this.worldMatrix[13] = source.y;
        this.worldMatrix[14] = source.z;
    }
}