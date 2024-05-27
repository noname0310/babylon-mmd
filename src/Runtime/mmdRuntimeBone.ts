import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { AppendTransformSolver } from "./appendTransformSolver";
import type { IkLinkInfo } from "./ikLinkInfo";
import type { IkSolver } from "./ikSolver";
import type { IMmdRuntimeBone } from "./IMmdRuntimeBone";
import type { IMmdRuntimeLinkedBone } from "./IMmdRuntimeLinkedBone";

/**
 * Bone for MMD runtime
 *
 * For mmd runtime, it is necessary to override the bone system because it has a different implementation than the usual matrix update method
 *
 * Which requires the mmd runtime bone, which is the wrapper of the babylon.js bone
 */
export class MmdRuntimeBone implements IMmdRuntimeBone {
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
    public parentBone: Nullable<MmdRuntimeBone>;

    /**
     * Child bones
     */
    public readonly childBones: MmdRuntimeBone[];

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
     * Append transform solver
     *
     * If the bone does not have an append transform solver, it will be null
     */
    public appendTransformSolver: Nullable<AppendTransformSolver>;

    /**
     * IK solver
     *
     * If the bone does not have an ik solver, it will be null
     */
    public ikSolver: Nullable<IkSolver>;

    /**
     * The position offset value to be moved by the bone morph
     *
     * This is a field that is primarily updated by the append transform solver
     */
    public readonly morphPositionOffset: Vector3;

    /**
     * The rotation offset value to be moved by the bone morph
     *
     * This is a field that is primarily updated by the append transform solver
     */
    public readonly morphRotationOffset: Quaternion;

    /**
     * IK chain bone states
     *
     * If this bone is an Ik chain, this value is non-null
     */
    public ikLinkInfo: Nullable<IkLinkInfo>;

    /**
     * World matrix of this bone
     *
     * Slice of `MmdModel.worldTransformMatrices` that corresponds to this bone
     */
    public readonly worldMatrix: Float32Array;

    // /**
    //  * Gets the position of a local transform with animations and bone morphs applied
    //  */
    // public getAnimatedPositionToRef: (target: Vector3) => Vector3;

    /**
     * Gets the rotation of a local transform with animations and bone morphs applied
     */
    public getAnimatedRotationToRef: (target: Quaternion) => Quaternion;

    /**
     * Get the position offset of the local transform with animation and bone morph applied
     *
     * Refers to the change from the rest position
     */
    public getAnimationPositionOffsetToRef: (target: Vector3) => Vector3;
    // public getAnimationRotationOffsetToRef: (target: Quaternion) => Quaternion;

    /**
     * Create MMD runtime bone
     * @param linkedBone Linked Babylon.js bone
     * @param boneMetadata Bone metadata
     * @param worldTransformMatrices World transform matrices
     * @param boneIndex Bone index
     */
    public constructor(
        linkedBone: IMmdRuntimeLinkedBone,
        boneMetadata: MmdModelMetadata.Bone,
        worldTransformMatrices: Float32Array,
        boneIndex: number
    ) {
        this.linkedBone = linkedBone;

        this.name = boneMetadata.name;
        this.parentBone = null;
        this.childBones = [];

        this.transformOrder = boneMetadata.transformOrder;
        this.flag = boneMetadata.flag;
        this.transformAfterPhysics = (boneMetadata.flag & PmxObject.Bone.Flag.TransformAfterPhysics) !== 0;

        this.appendTransformSolver = null;
        this.ikSolver = null;

        this.morphPositionOffset = Vector3.Zero();
        this.morphRotationOffset = Quaternion.Identity();

        this.ikLinkInfo = null;

        this.worldMatrix = new Float32Array(worldTransformMatrices.buffer, worldTransformMatrices.byteOffset + boneIndex * 16 * 4, 16);

        // this.getAnimatedPositionToRef = this._getAnimatedPositionToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationToRef;
        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetToRef;
    }

    // private _getAnimatedPositionWithMorphToRef(target: Vector3): Vector3 {
    //     target.copyFrom(this.linkedBone.position);
    //     return target.addInPlace(this.morphPositionOffset);
    // }

    // private _getAnimatedPositionToRef(target: Vector3): Vector3 {
    //     target.copyFrom(this.linkedBone.position);
    //     return target;
    // }

    private _getAnimatedRotationToRef(target: Quaternion): Quaternion {
        return target.copyFrom(this.linkedBone.rotationQuaternion);
    }

    private _getAnimatedRotationWithMorphToRef(target: Quaternion): Quaternion {
        target.copyFrom(this.linkedBone.rotationQuaternion);
        return this.morphRotationOffset.multiplyToRef(target, target);
    }

    private static readonly _TempVector3 = new Vector3();

    private _getAnimationPositionOffsetToRef(target: Vector3): Vector3 {
        target.copyFrom(this.linkedBone.position);
        this.linkedBone.getRestMatrix().getTranslationToRef(MmdRuntimeBone._TempVector3);
        return target.subtractInPlace(MmdRuntimeBone._TempVector3);
    }

    private _getAnimationPositionOffsetWithMorphToRef(target: Vector3): Vector3 {
        target.copyFrom(this.linkedBone.position);
        target.addInPlace(this.morphPositionOffset);
        this.linkedBone.getRestMatrix().getTranslationToRef(MmdRuntimeBone._TempVector3);
        return target.subtractInPlace(MmdRuntimeBone._TempVector3);
    }

    // a: rest quaternion
    // b: animation quaternion
    // c: animated quaternion

    // a * b = c

    // to get b from a and c:
    // a^-1 * c = b

    // private static readonly _TempQuaternion = new Quaternion();

    // private _getAnimationRotationOffsetToRef(target: Quaternion): Quaternion {
    //     target.copyFrom(this.linkedBone.rotationQuaternion);
    //     Quaternion.FromRotationMatrixToRef(this.linkedBone.getRestMatrix(), MmdRuntimeBone._TempQuaternion).invertInPlace();
    //     return MmdRuntimeBone._TempQuaternion.multiplyInPlace(target);
    // }

    // private _getAnimationRotationOffsetWithMorphToRef(target: Quaternion): Quaternion {
    //     target.copyFrom(this.linkedBone.rotationQuaternion);
    //     this.morphRotationOffset.multiplyToRef(target, target);
    //     Quaternion.FromRotationMatrixToRef(this.linkedBone.getRestMatrix(), MmdRuntimeBone._TempQuaternion).invertInPlace();
    //     return MmdRuntimeBone._TempQuaternion.multiplyInPlace(target);
    // }

    /**
     * Allows the animation of this bone to be affected by the `morphPositionOffset` and `morphRotationOffset` fields
     */
    public enableMorph(): void {
        // this.getAnimatedPositionToRef = this._getAnimatedPositionWithMorphToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationWithMorphToRef;

        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetWithMorphToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetWithMorphToRef;
    }

    /**
     * Disables the animation of this bone to be affected by the `morphPositionOffset` and `morphRotationOffset` fields
     */
    public disableMorph(): void {
        // this.getAnimatedPositionToRef = this._getAnimatedPositionToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationToRef;

        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetToRef;
    }

    /**
     * Reset world matrix, append transform, and ik chain state
     * @internal
     */
    public resetTransformState(): void {
        const worldMatrix = this.worldMatrix;
        worldMatrix[0] = 1;
        worldMatrix[1] = 0;
        worldMatrix[2] = 0;
        worldMatrix[3] = 0;

        worldMatrix[4] = 0;
        worldMatrix[5] = 1;
        worldMatrix[6] = 0;
        worldMatrix[7] = 0;

        worldMatrix[8] = 0;
        worldMatrix[9] = 0;
        worldMatrix[10] = 1;
        worldMatrix[11] = 0;

        worldMatrix[12] = 0;
        worldMatrix[13] = 0;
        worldMatrix[14] = 0;
        worldMatrix[15] = 1;

        if (this.ikLinkInfo !== null) {
            this.ikLinkInfo.localRotation.set(0, 0, 0, 1);
            this.ikLinkInfo.localPosition.set(0, 0, 0);
            this.ikLinkInfo.ikRotation.set(0, 0, 0, 1);
        }

        if (this.appendTransformSolver !== null) {
            this.appendTransformSolver.appendRotation.set(0, 0, 0, 1);
            this.appendTransformSolver.appendPosition.set(0, 0, 0);
        }
    }

    private static readonly _TempRotation = Quaternion.Identity();
    private static readonly _TempPosition = Vector3.Zero();
    private static readonly _TempPosition2 = Vector3.Zero();
    private static readonly _TempMatrix = Matrix.Identity();
    private static readonly _TempMatrix2 = Matrix.Identity();

    /**
     * Update the world matrix of this bone to account for append transform and ik
     * @param usePhysics Whether to use physics simulation
     * @param computeIk Whether to compute ik
     * @internal
     */
    public updateWorldMatrix(usePhysics: boolean, computeIk: boolean): void {
        const rotation = this.getAnimatedRotationToRef(MmdRuntimeBone._TempRotation);
        const position = this.getAnimationPositionOffsetToRef(MmdRuntimeBone._TempPosition);

        if (this.appendTransformSolver !== null) {
            this.appendTransformSolver.update(rotation, position);

            if (this.appendTransformSolver.affectRotation) {
                rotation.copyFrom(this.appendTransformSolver.appendRotation);
            }

            if (this.appendTransformSolver.affectPosition) {
                position.copyFrom(this.appendTransformSolver.appendPosition);
            }
        }

        if (this.ikLinkInfo !== null) {
            this.ikLinkInfo.localRotation.copyFrom(rotation);
            this.ikLinkInfo.localPosition.copyFrom(position);

            this.ikLinkInfo.ikRotation.multiplyToRef(rotation, rotation);
        }

        const worldMatrix = MmdRuntimeBone._TempMatrix;

        const scaling = this.linkedBone.scaling;
        if (scaling.x !== 1 || scaling.y !== 1 || scaling.z !== 1) {
            Matrix.ScalingToRef(scaling.x, scaling.y, scaling.z, worldMatrix);
            const rotationMatrix = Matrix.FromQuaternionToRef(rotation, MmdRuntimeBone._TempMatrix2);
            worldMatrix.multiplyToRef(rotationMatrix, worldMatrix);
        } else {
            Matrix.FromQuaternionToRef(rotation, worldMatrix);
        }

        const localPosition = this.linkedBone.getRestMatrix().getTranslationToRef(MmdRuntimeBone._TempPosition2);
        localPosition.addInPlace(position);
        worldMatrix.setTranslation(localPosition);

        if (this.parentBone !== null) {
            const parentWorldMatrix = this.parentBone.getWorldMatrixToRef(MmdRuntimeBone._TempMatrix2);
            worldMatrix.multiplyToRef(parentWorldMatrix, worldMatrix);
        }

        worldMatrix.copyToArray(this.worldMatrix);

        if (computeIk && this.ikSolver !== null) {
            if (!(usePhysics && this.ikSolver.canSkipWhenPhysicsEnabled)) {
                this.ikSolver.solve();
            }
        }
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
        source.toArray(this.worldMatrix, 12);
    }

    /**
     * Get ik solver index
     *
     * If the bone does not have an ik solver, it will return -1
     */
    public get ikSolverIndex(): number {
        return this.ikSolver !== null ? this.ikSolver.index : -1;
    }
}
