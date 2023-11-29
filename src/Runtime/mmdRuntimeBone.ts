import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { AppendTransformSolver } from "./appendTransformSolver";
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
     * The rotation offset value to be moved by the IK solver
     *
     * If this bone is an Ik chain, this value is non-null
     */
    public ikRotation: Nullable<Quaternion>;

    /**
     * Local matrix of this bone
     */
    public readonly localMatrix: Matrix;

    /**
     * World matrix of this bone
     *
     * Slice of `MmdModel.worldTransformMatrices` that corresponds to this bone
     */
    public readonly worldMatrix: Float32Array;

    /**
     * Gets the position of a local transform with animations and bone morphs applied
     */
    public getAnimatedPositionToRef: (target: Vector3) => Vector3;

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

        this.ikRotation = null;

        this.localMatrix = Matrix.Identity();
        this.worldMatrix = new Float32Array(worldTransformMatrices.buffer, worldTransformMatrices.byteOffset + boneIndex * 16 * 4, 16);

        this.getAnimatedPositionToRef = this._getAnimatedPositionToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationToRef;
        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetToRef;
    }

    private _getAnimatedPositionWithMorphToRef(target: Vector3): Vector3 {
        target.copyFrom(this.linkedBone.position);
        return target.addInPlace(this.morphPositionOffset);
    }

    private _getAnimatedPositionToRef(target: Vector3): Vector3 {
        target.copyFrom(this.linkedBone.position);
        return target;
    }

    private _getAnimatedRotationToRef(target: Quaternion): Quaternion {
        return target.copyFrom(this.linkedBone.rotationQuaternion);
    }

    private _getAnimatedRotationWithMorphToRef(target: Quaternion): Quaternion {
        target.copyFrom(this.linkedBone.rotationQuaternion);
        return target.multiplyInPlace(this.morphRotationOffset);
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
    //     target.multiplyInPlace(this.morphRotationOffset);
    //     Quaternion.FromRotationMatrixToRef(this.linkedBone.getRestMatrix(), MmdRuntimeBone._TempQuaternion).invertInPlace();
    //     return MmdRuntimeBone._TempQuaternion.multiplyInPlace(target);
    // }

    /**
     * Allows the animation of this bone to be affected by the `morphPositionOffset` and `morphRotationOffset` fields
     */
    public enableMorph(): void {
        this.getAnimatedPositionToRef = this._getAnimatedPositionWithMorphToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationWithMorphToRef;

        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetWithMorphToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetWithMorphToRef;
    }

    /**
     * Disables the animation of this bone to be affected by the `morphPositionOffset` and `morphRotationOffset` fields
     */
    public disableMorph(): void {
        this.getAnimatedPositionToRef = this._getAnimatedPositionToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationToRef;

        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetToRef;
    }

    private static readonly _TempRotation = Quaternion.Identity();
    private static readonly _TempPosition = Vector3.Zero();

    /**
     * Update the local matrix of this bone
     */
    public updateLocalMatrix(): void {
        const rotation = this.getAnimatedRotationToRef(MmdRuntimeBone._TempRotation);
        if (this.ikRotation !== null) {
            this.ikRotation.multiplyToRef(rotation, rotation);
        }

        const position = this.getAnimatedPositionToRef(MmdRuntimeBone._TempPosition);

        if (this.appendTransformSolver !== null) {
            if (this.appendTransformSolver.affectRotation) {
                rotation.multiplyInPlace(this.appendTransformSolver.appendRotationOffset);
            }
            if (this.appendTransformSolver.affectPosition) {
                position.addInPlace(this.appendTransformSolver.appendPositionOffset);
            }
        }

        Matrix.ComposeToRef(
            this.linkedBone.scaling,
            rotation,
            position,
            this.localMatrix
        );
    }

    private static readonly _Stack: MmdRuntimeBone[] = [];
    private static readonly _ParentWorldMatrix = Matrix.Identity();

    /**
     * Update the world matrix of this bone and its children bones recursively
     */
    public updateWorldMatrix(): void {
        const stack = MmdRuntimeBone._Stack;
        stack.length = 0;
        stack.push(this);

        const parentWorldMatrix = MmdRuntimeBone._ParentWorldMatrix;

        while (stack.length > 0) {
            const bone = stack.pop()!;

            const parentBone = bone.parentBone;
            if (parentBone !== null) {
                bone.localMatrix.multiplyToArray(
                    Matrix.FromArrayToRef(parentBone.worldMatrix, 0, parentWorldMatrix),
                    bone.worldMatrix,
                    0
                );
            } else {
                bone.localMatrix.copyToArray(bone.worldMatrix);
            }

            const childrenBones = bone.childBones;
            for (let i = 0, l = childrenBones.length; i < l; ++i) {
                stack.push(childrenBones[i]);
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
