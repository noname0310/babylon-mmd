import { Quaternion, Vector3 } from "@babylonjs/core";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";

import type { MmdRuntimeBone } from "./MmdRuntimeBone";

type RemoveUndefined<T> = T extends undefined ? never : T;
type AppendTransformMetadata = RemoveUndefined<MmdModelMetadata.Bone["appendTransform"]>;

export class AppendTransformSolver {
    public readonly isLocal: boolean;
    public readonly affectRotation: boolean;
    public readonly affectPosition: boolean;
    public readonly ratio: number;

    public readonly bone: MmdRuntimeBone;
    public readonly targetBone: MmdRuntimeBone;

    public readonly appendPositionOffset = Vector3.Zero();
    public readonly appendRotationOffset = Quaternion.Identity();

    public constructor(
        boneMetadata: AppendTransformMetadata,
        bone: MmdRuntimeBone,
        targetBone: MmdRuntimeBone
    ) {
        this.isLocal = boneMetadata.isLocal;
        this.affectRotation = boneMetadata.affectRotation;
        this.affectPosition = boneMetadata.affectPosition;
        this.ratio = boneMetadata.ratio;

        this.bone = bone;
        this.targetBone = targetBone;
    }

    private static readonly _IdentityQuaternion = Quaternion.Identity();

    public update(): void {
        const targetBone = this.targetBone;

        if (this.affectRotation) {
            const appendRotationOffset = this.appendRotationOffset;
            if (this.isLocal) {
                targetBone.getAnimatedRotationToRef(appendRotationOffset);
            } else {
                if (targetBone.appendTransformSolver != null) {
                    appendRotationOffset.copyFrom(targetBone.appendTransformSolver.appendRotationOffset);
                } else {
                    targetBone.getAnimatedRotationToRef(appendRotationOffset);
                }
            }

            if (targetBone.ikSolver != null && targetBone.ikSolver.enabled) {
                appendRotationOffset.multiplyInPlace(targetBone.ikSolver.ikRotation);
            }

            Quaternion.SlerpToRef(
                AppendTransformSolver._IdentityQuaternion,
                appendRotationOffset,
                this.ratio,
                appendRotationOffset
            );
        }

        if (this.affectPosition) {
            const appendPositionOffset = this.appendPositionOffset;
            if (this.isLocal) {
                targetBone.getAnimatedPositionToRef(appendPositionOffset);
            } else {
                if (targetBone.appendTransformSolver != null) {
                    appendPositionOffset.copyFrom(targetBone.appendTransformSolver.appendPositionOffset);
                } else {
                    targetBone.getAnimatedPositionToRef(appendPositionOffset);
                }
            }

            appendPositionOffset.scaleInPlace(this.ratio);
        }
    }
}
