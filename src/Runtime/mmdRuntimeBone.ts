import type { Bone } from "@babylonjs/core/Bones/bone";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

import type { AppendTransformSolver } from "./appendTransformSolver";
import type { IIkSolver, IkSolver } from "./ikSolver";

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
    readonly babylonBone: Bone;

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
     * IK solver
     */
    readonly ikSolver: Nullable<IIkSolver>;
}

export class MmdRuntimeBone implements IMmdRuntimeBone {
    public readonly babylonBone: Bone;

    public readonly name: string;
    public parentBone: Nullable<MmdRuntimeBone>;
    public readonly childBones: MmdRuntimeBone[];

    public readonly transformOrder: number;
    public readonly flag: number;
    public readonly transformAfterPhysics: boolean;

    public appendTransformSolver: Nullable<AppendTransformSolver>;
    public ikSolver: Nullable<IkSolver>;

    public readonly morphPositionOffset: Vector3;
    public readonly morphRotationOffset: Quaternion;

    public ikRotation: Nullable<Quaternion>;

    public readonly localMatrix: Matrix;
    public readonly worldMatrix: Matrix;

    public getAnimatedPositionToRef: (target: Vector3) => Vector3;
    public getAnimatedRotationToRef: (target: Quaternion) => Quaternion;
    public getAnimationPositionOffsetToRef: (target: Vector3) => Vector3;
    // public getAnimationRotationOffsetToRef: (target: Quaternion) => Quaternion;

    public constructor(babylonBone: Bone, boneMetadata: MmdModelMetadata.Bone) {
        this.babylonBone = babylonBone;

        this.name = boneMetadata.name;
        this.parentBone = null;
        this.childBones = [];

        this.transformOrder = boneMetadata.transformOrder;
        this.flag = boneMetadata.flag;
        this.transformAfterPhysics = boneMetadata.transformAfterPhysics;

        this.appendTransformSolver = null;
        this.ikSolver = null;

        this.morphPositionOffset = Vector3.Zero();
        this.morphRotationOffset = Quaternion.Identity();

        this.ikRotation = null;

        this.localMatrix = Matrix.Identity();
        this.worldMatrix = babylonBone.getFinalMatrix();

        this.getAnimatedPositionToRef = this._getAnimatedPositionToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationToRef;
        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetToRef;
    }

    private _getAnimatedPositionWithMorphToRef(target: Vector3): Vector3 {
        target.copyFrom(this.babylonBone.position);
        return target.addInPlace(this.morphPositionOffset);
    }

    private _getAnimatedPositionToRef(target: Vector3): Vector3 {
        target.copyFrom(this.babylonBone.position);
        return target;
    }

    private _getAnimatedRotationToRef(target: Quaternion): Quaternion {
        return target.copyFrom(this.babylonBone.rotationQuaternion);
    }

    private _getAnimatedRotationWithMorphToRef(target: Quaternion): Quaternion {
        target.copyFrom(this.babylonBone.rotationQuaternion);
        return target.multiplyInPlace(this.morphRotationOffset);
    }

    private static readonly _TempVector3 = new Vector3();

    private _getAnimationPositionOffsetToRef(target: Vector3): Vector3 {
        target.copyFrom(this.babylonBone.position);
        this.babylonBone.getRestMatrix().getTranslationToRef(MmdRuntimeBone._TempVector3);
        return target.subtractInPlace(MmdRuntimeBone._TempVector3);
    }

    private _getAnimationPositionOffsetWithMorphToRef(target: Vector3): Vector3 {
        target.copyFrom(this.babylonBone.position);
        target.addInPlace(this.morphPositionOffset);
        this.babylonBone.getRestMatrix().getTranslationToRef(MmdRuntimeBone._TempVector3);
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
    //     target.copyFrom(this.babylonBone.rotationQuaternion);
    //     Quaternion.FromRotationMatrixToRef(this.babylonBone.getRestMatrix(), MmdRuntimeBone._TempQuaternion).invertInPlace();
    //     return MmdRuntimeBone._TempQuaternion.multiplyInPlace(target);
    // }

    // private _getAnimationRotationOffsetWithMorphToRef(target: Quaternion): Quaternion {
    //     target.copyFrom(this.babylonBone.rotationQuaternion);
    //     target.multiplyInPlace(this.morphRotationOffset);
    //     Quaternion.FromRotationMatrixToRef(this.babylonBone.getRestMatrix(), MmdRuntimeBone._TempQuaternion).invertInPlace();
    //     return MmdRuntimeBone._TempQuaternion.multiplyInPlace(target);
    // }

    public enableMorph(): void {
        this.getAnimatedPositionToRef = this._getAnimatedPositionWithMorphToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationWithMorphToRef;

        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetWithMorphToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetWithMorphToRef;
    }

    public disableMorph(): void {
        this.getAnimatedPositionToRef = this._getAnimatedPositionToRef;
        this.getAnimatedRotationToRef = this._getAnimatedRotationToRef;

        this.getAnimationPositionOffsetToRef = this._getAnimationPositionOffsetToRef;
        // this.getAnimationRotationOffsetToRef = this._getAnimationRotationOffsetToRef;
    }

    private static readonly _TempScale = Vector3.Zero();
    private static readonly _TempRotation = Quaternion.Identity();
    private static readonly _TempPosition = Vector3.Zero();

    public updateLocalMatrix(): void {
        this.babylonBone.getScaleToRef(MmdRuntimeBone._TempScale);

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
            MmdRuntimeBone._TempScale,
            rotation,
            position,
            this.localMatrix
        );
    }

    private static readonly _Stack: MmdRuntimeBone[] = [];

    public updateWorldMatrix(): void {
        const stack = MmdRuntimeBone._Stack;
        stack.length = 0;
        stack.push(this);

        while (stack.length > 0) {
            const bone = stack.pop()!;

            const parentBone = bone.parentBone;
            if (parentBone !== null) {
                bone.localMatrix.multiplyToRef(parentBone.worldMatrix, bone.worldMatrix);
            } else {
                bone.worldMatrix.copyFrom(bone.localMatrix);
            }

            const childrenBones = bone.childBones;
            for (let i = 0, l = childrenBones.length; i < l; ++i) {
                stack.push(childrenBones[i]);
            }
        }
    }
}
