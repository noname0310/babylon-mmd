import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

import type { MmdRuntimeBone } from "./mmdRuntimeBone";

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
                // Since mmd bones all have identity quaternions, we abandon the compatibility for skeletons that don't and improve performance

                // targetBone.getAnimationRotationOffsetToRef(appendRotationOffset);
                targetBone.getAnimatedRotationToRef(appendRotationOffset);
            } else {
                if (targetBone.appendTransformSolver !== null) {
                    appendRotationOffset.copyFrom(targetBone.appendTransformSolver.appendRotationOffset);
                } else {
                    // targetBone.getAnimationRotationOffsetToRef(appendRotationOffset);
                    targetBone.getAnimatedRotationToRef(appendRotationOffset);
                }
            }

            if (targetBone.ikRotation !== null) {
                targetBone.ikRotation.multiplyToRef(appendRotationOffset, appendRotationOffset);
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
                targetBone.getAnimationPositionOffsetToRef(appendPositionOffset);
            } else {
                if (targetBone.appendTransformSolver !== null) {
                    appendPositionOffset.copyFrom(targetBone.appendTransformSolver.appendPositionOffset);
                } else {
                    targetBone.getAnimationPositionOffsetToRef(appendPositionOffset);
                }
            }

            appendPositionOffset.scaleInPlace(this.ratio);
        }
    }
}
