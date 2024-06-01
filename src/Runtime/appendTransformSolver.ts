import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable } from "@babylonjs/core/types";

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
     * Append transformed position
     */
    public readonly appendPosition = Vector3.Zero();

    /**
     * Append transformed rotation
     */
    public readonly appendRotation = Quaternion.Identity();

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
    private static readonly _TargetBoneWorldMatrix = Matrix.Identity();

    /**
     * Updates the solver
     * @param animatedRotation rotation animation evaluation result with bone morphing applied
     * @param animatedPositionOffset position animation evaluation result with bone morphing applied
     */
    public update(
        animatedRotation: DeepImmutable<Quaternion>,
        animatedPositionOffset: DeepImmutable<Vector3>
    ): void {
        const targetBone = this.targetBone;

        if (this.affectRotation) {
            const appendRotation = this.appendRotation;
            if (this.isLocal) {
                const targetBoneWorldMatrix = targetBone.getWorldMatrixToRef(AppendTransformSolver._TargetBoneWorldMatrix);
                Quaternion.FromRotationMatrixToRef(targetBoneWorldMatrix, appendRotation);
            } else {
                if (targetBone.appendTransformSolver !== null && targetBone.appendTransformSolver.affectRotation) {
                    appendRotation.copyFrom(targetBone.appendTransformSolver.appendRotation);
                } else {
                    targetBone.getAnimatedRotationToRef(appendRotation);
                }
            }

            if (targetBone.ikChainInfo !== null && !this.isLocal) {
                targetBone.ikChainInfo.ikRotation.multiplyToRef(appendRotation, appendRotation);
            }

            if (this.ratio !== 1) {
                Quaternion.SlerpToRef(
                    AppendTransformSolver._IdentityQuaternion,
                    appendRotation,
                    this.ratio,
                    appendRotation
                );
            }

            animatedRotation.multiplyToRef(appendRotation, appendRotation);
        }

        if (this.affectPosition) {
            const appendPosition = this.appendPosition;
            if (this.isLocal) {
                const targetBoneWorldMatrix = targetBone.getWorldMatrixToRef(AppendTransformSolver._TargetBoneWorldMatrix);
                targetBoneWorldMatrix.multiplyToRef(targetBone.linkedBone.getAbsoluteInverseBindMatrix(), targetBoneWorldMatrix);
                targetBoneWorldMatrix.getTranslationToRef(appendPosition);
            } else {
                if (targetBone.appendTransformSolver !== null && targetBone.appendTransformSolver.affectPosition) {
                    appendPosition.copyFrom(targetBone.appendTransformSolver.appendPosition);
                } else {
                    targetBone.getAnimationPositionOffsetToRef(appendPosition);
                }
            }

            if (this.ratio !== 1) {
                appendPosition.scaleInPlace(this.ratio);
            }

            appendPosition.addInPlace(animatedPositionOffset);
        }
    }
}
