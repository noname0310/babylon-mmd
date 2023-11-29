import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { MmdRuntimeBone } from "./mmdRuntimeBone";

type RemoveUndefined<T> = T extends undefined ? never : T;
type AppendTransformMetadata = RemoveUndefined<MmdModelMetadata.Bone["appendTransform"]>;

/**
 * Gives the effect of being in a child parent relationship regardless of the bone hierarchy. Similar to Unity's Parent constraint
 */
export class AppendTransformSolver {
    public readonly isLocal: boolean;

    /**
     * Whether to affect bone rotation
     */
    public readonly affectRotation: boolean;

    /**
     * Whether to affect bone position
     */
    public readonly affectPosition: boolean;

    /**
     * The ratio of the effect (can be negative)
     */
    public readonly ratio: number;

    /**
     * Affecting bones
     *
     * Similar to parent in bone hierarchy
     */
    public readonly targetBone: MmdRuntimeBone;

    /**
     * The offset of the position to be affected
     */
    public readonly appendPositionOffset = Vector3.Zero();

    /**
     * The offset of the rotation to be affected
     */
    public readonly appendRotationOffset = Quaternion.Identity();

    /**
     * Creates append transform solver
     * @param boneFlag bone flag of the bone to be affected
     * @param boneAppendTransformMetadata metadata of the bone to be affected
     * @param targetBone affecting bone
     */
    public constructor(
        boneFlag: number,
        boneAppendTransformMetadata: AppendTransformMetadata,
        targetBone: MmdRuntimeBone
    ) {
        this.isLocal = (boneFlag & PmxObject.Bone.Flag.LocalAppendTransform) !== 0;
        this.affectRotation = (boneFlag & PmxObject.Bone.Flag.HasAppendRotate) !== 0;
        this.affectPosition = (boneFlag & PmxObject.Bone.Flag.HasAppendMove) !== 0;
        this.ratio = boneAppendTransformMetadata.ratio;

        this.targetBone = targetBone;
    }

    private static readonly _IdentityQuaternion = Quaternion.Identity();

    /**
     * Updates the solver
     */
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
