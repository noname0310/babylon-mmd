import type { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { IMmdRuntimeLinkedBone } from "./IMmdRuntimeLinkedBone";

/**
 * Bone for MMD runtime
 *
 * For mmd runtime, it is necessary to override the bone system because it has a different implementation than the usual matrix update method
 *
 * Which requires the mmd runtime bone, which is the wrapper of the babylon.js bone
 */
export interface IMmdRuntimeBone {
    /**
     * The Babylon.js bone
     */
    readonly linkedBone: IMmdRuntimeLinkedBone;

    /**
     * Name of the bone
     */
    readonly name: string;

    /**
     * Parent bone
     */
    readonly parentBone: Nullable<IMmdRuntimeBone>;

    /**
     * Child bones
     */
    readonly childBones: readonly IMmdRuntimeBone[];

    /**
     * Transform order
     */
    readonly transformOrder: number;

    /**
     * Bone flag
     *
     * @see PmxObject.Bone.Flag
     */
    readonly flag: number;

    /**
     * Whether the bone transform is applied after physics
     */
    readonly transformAfterPhysics: boolean;

    /**
     * World matrix of this bone
     *
     * Slice of `MmdModel.worldTransformMatrices` that corresponds to this bone
     */
    readonly worldMatrix: Float32Array;

    /**
     * Get the world matrix of this bone
     *
     * The result of this method is not same as `linkedBone.getFinalMatrix()`
     *
     * `linkedBone.getFinalMatrix()` updated at the end of the mmd runtime update, so it may not be the latest value
     * @param target target matrix
     * @returns target matrix
     */
    getWorldMatrixToRef(target: Matrix): Matrix;

    /**
     * Get the world translation of this bone
     * @param target target vector
     * @returns target vector
     */
    getWorldTranslationToRef(target: Vector3): Vector3;

    /**
     * Set the world translation of this bone
     * @param source source vector
     */
    setWorldTranslation(source: DeepImmutable<Vector3>): void;

    /**
     * Get ik solver index
     *
     * If the bone does not have an ik solver, it will return -1
     */
    get ikSolverIndex(): number;

    /**
     * Get rigid body index
     *
     * If the bone does not have a rigid body, it will return -1
     */
    get rigidBodyIndex(): number;
}
