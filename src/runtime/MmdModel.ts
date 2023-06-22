import type { Bone, Material } from "@babylonjs/core";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";

import { AppendTransformSolver } from "./AppendTransformSolver";
import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdMesh } from "./MmdMesh";
import { MmdMorphController } from "./MmdMorphController";
import { MmdRuntimeBone } from "./MmdRuntimeBone";

export class MmdModel {
    public readonly mesh: MmdMesh;
    public readonly morph: MmdMorphController;

    private readonly _sortedRuntimeBones: readonly MmdRuntimeBone[];
    private readonly _sortedRuntimeRootBones: readonly MmdRuntimeBone[];

    public constructor(
        mmdMesh: MmdMesh,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material>,
        logger: ILogger
    ) {
        this.mesh = mmdMesh;

        const runtimeBones = this._buildRuntimeSkeleton(
            mmdMesh.skeleton.bones,
            mmdMesh.metadata.bones
        );

        const sortedBones = this._sortedRuntimeBones = [...runtimeBones];
        // sort must be stable (require ES2019)
        sortedBones.sort((a, b) => {
            return a.transformOrder - b.transformOrder;
        });

        const sortedRootBones: MmdRuntimeBone[] = [];
        for (let i = 0; i < sortedBones.length; ++i) {
            const bone = sortedBones[i];
            if (bone.parentBone === null) sortedRootBones.push(bone);
        }
        this._sortedRuntimeRootBones = sortedRootBones;

        this.morph = new MmdMorphController(
            mmdMesh.morphTargetManager,
            runtimeBones,
            mmdMesh.material,
            materialProxyConstructor,
            mmdMesh.metadata.morphs,
            logger
        );
    }

    public beforePhysics(): void {
        // todo: apply bone animation

        this.morph.update();

        this._update(false);
    }

    public afterPhysics(): void {
        this._update(true);
    }

    private _update(afterPhysicsStage: boolean): void {
        const sortedBones = this._sortedRuntimeBones;
        for (let i = 0; i < sortedBones.length; ++i) {
            const bone = sortedBones[i];
            if (bone.transformAfterPhysics !== afterPhysicsStage) continue;

            bone.updateLocalMatrix();
        }

        const sortedRootBones = this._sortedRuntimeRootBones;
        for (let i = 0; i < sortedRootBones.length; ++i) {
            const bone = sortedRootBones[i];
            if (bone.transformAfterPhysics !== afterPhysicsStage) continue;

            bone.updateWorldMatrix();
        }

        for (let i = 0; i < sortedBones.length; ++i) {
            const bone = sortedBones[i];
            if (bone.transformAfterPhysics !== afterPhysicsStage) continue;

            if (bone.appendTransformSolver != null) {
                bone.appendTransformSolver.update();
                bone.updateLocalMatrix();
                bone.updateWorldMatrix();
            }

            if (bone.ikSolver != null) {
                // todo: IK
            }
        }

        for (let i = 0; i < sortedRootBones.length; ++i) {
            const bone = sortedRootBones[i];
            if (bone.transformAfterPhysics !== afterPhysicsStage) continue;

            bone.updateWorldMatrix();
        }
    }

    private _buildRuntimeSkeleton(
        bones: Bone[],
        bonesMetadata: readonly MmdModelMetadata.Bone[]
    ): readonly MmdRuntimeBone[] {
        const runtimeBones: MmdRuntimeBone[] = [];
        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];
            runtimeBones.push(new MmdRuntimeBone(bones[i], boneMetadata));
        }

        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];
            const bone = runtimeBones[i];

            const parentBoneIndex = boneMetadata.parentBoneIndex;
            if (0 <= parentBoneIndex) {
                const parentBone = runtimeBones[parentBoneIndex];
                bone.parentBone = parentBone;
                parentBone.childrenBones.push(bone);
            }

            if (boneMetadata.appendTransform !== undefined) {
                const targetBoneIndex = boneMetadata.appendTransform.parentIndex;
                if (0 <= targetBoneIndex) {
                    bone.appendTransformSolver = new AppendTransformSolver(
                        boneMetadata.appendTransform,
                        bone,
                        runtimeBones[targetBoneIndex]
                    );
                }
            }
        }

        return runtimeBones;
    }
}
