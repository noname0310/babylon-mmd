import { Matrix, Quaternion, Vector3 } from "@babylonjs/core";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";

export class MmdRuntimeBone {
    public readonly name: string;
    public readonly parentBoneIndex: number;
    public readonly transformOrder: number;
    public readonly flag: number;
    public readonly appendTransform: MmdModelMetadata.Bone["appendTransform"];

    public readonly morphLocalPositionOffset = Vector3.Zero();
    public readonly morphLocalRotationOffset = Quaternion.Identity();

    public readonly localMatrix = Matrix.Identity();
    public readonly worldMatrix = Matrix.Identity();

    public applyMorphToLocalPositionToRef: (localPosition: Vector3, target: Vector3) => Vector3;
    public applyMorphToLocalRotationToRef: (localRotation: Quaternion, target: Quaternion) => Quaternion;

    public constructor(boneMetadata: MmdModelMetadata.Bone) {
        this.name = boneMetadata.name;
        this.parentBoneIndex = boneMetadata.parentBoneIndex;
        this.transformOrder = boneMetadata.transformOrder;
        this.flag = boneMetadata.flag;
        this.appendTransform = boneMetadata.appendTransform;

        this.applyMorphToLocalPositionToRef = this._applyMorphToLocalPositionToRefDisabled;
        this.applyMorphToLocalRotationToRef = this._applyMorphToLocalRotationToRefDisabled;
    }

    private _applyMorphToLocalPositionToRefEnabled(localPosition: Vector3, target: Vector3): Vector3 {
        return localPosition.addToRef(this.morphLocalPositionOffset!, target);
    }

    private _applyMorphToLocalPositionToRefDisabled(localPosition: Vector3, target: Vector3): Vector3 {
        return target.copyFrom(localPosition);
    }

    private _applyMorphToLocalRotationToRefEnabled(localRotation: Quaternion, target: Quaternion): Quaternion {
        return localRotation.multiplyToRef(this.morphLocalRotationOffset!, target);
    }

    private _applyMorphToLocalRotationToRefDisabled(localRotation: Quaternion, target: Quaternion): Quaternion {
        return target.copyFrom(localRotation);
    }

    public enableMorph(): void {
        this.applyMorphToLocalPositionToRef = this._applyMorphToLocalPositionToRefEnabled;
        this.applyMorphToLocalRotationToRef = this._applyMorphToLocalRotationToRefEnabled;
    }

    public disableMorph(): void {
        this.applyMorphToLocalPositionToRef = this._applyMorphToLocalPositionToRefDisabled;
        this.applyMorphToLocalRotationToRef = this._applyMorphToLocalRotationToRefDisabled;
    }
}
