import type { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";

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
    public readonly parentBone: Nullable<IMmdRuntimeBone>;

    /**
     * Child bones
     */
    public readonly childBones: readonly IMmdRuntimeBone[];

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

    public constructor() {
        // TODO
    }

    /**
     * Update the world matrix of this bone and its children bones recursively
     */
    public updateWorldMatrix(): void {
        
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

    }

    /**
     * Get the world translation of this bone
     * @param target target vector
     * @returns target vector
     */
    public getWorldTranslationToRef(target: Vector3): Vector3 {

    }

    /**
     * Set the world translation of this bone
     * @param source source vector
     */
    public setWorldTranslationFromRef(source: Vector3): void {

    }
}
