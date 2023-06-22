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

    private readonly _runtimeBones: readonly MmdRuntimeBone[];
    private readonly _sortedRuntimeBones: readonly MmdRuntimeBone[];

    public constructor(
        mmdMesh: MmdMesh,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material>,
        logger: ILogger
    ) {
        this.mesh = mmdMesh;

        const runtimeBones = this._runtimeBones = this._buildRuntimeSkeleton(
            mmdMesh.skeleton.bones,
            mmdMesh.metadata.bones
        );

        const sortedBones = this._sortedRuntimeBones = [...runtimeBones];
        // sort must be stable (require ES2019)
        sortedBones.sort((a, b) => {
            return a.transformOrder - b.transformOrder;
        });

        this.morph = new MmdMorphController(
            mmdMesh.morphTargetManager,
            runtimeBones,
            mmdMesh.material,
            materialProxyConstructor,
            mmdMesh.metadata.morphs,
            logger
        );

        // this._sortedBones = mmdMesh.metadata.sortedBones;
    }

    public beforePhysics(): void {
        this.mesh.skeleton.returnToRest();
        this.morph.update();

        this._update(false);
    }

    public afterPhysics(): void {
        this._update(true);
    }

    private _update(afterPhysicsStage: boolean): void {
        afterPhysicsStage;
        this._updateWorldTransform;
        const sortedBones = this._sortedRuntimeBones;
        this._runtimeBones;

        // todo: apply bone animation

        for (let i = 0; i < sortedBones.length; ++i) {
            const bone = sortedBones[i];
            bone;
            // const isTransformAfterPhysics = (bone.flag & PmxObject.Bone.Flag.TransformAfterPhysics) !== 0;
            // if (isTransformAfterPhysics !== afterPhysicsStage) continue;

            // if (bone.appendTransform !== undefined) {
            //     this._appendTransformSolver.update(bone);
            // }

            // if (bone.ik !== undefined) {
            //     this._updateWorldTransform(bone);

            //     // todo: solve ik
            //     // optimize: skip ik if affected bones are physically simulated
            // }
        }

        if (!afterPhysicsStage /* && this.physicsEnabled */) {
            // for (let i = 0; i < sortedBones.length; ++i) {
            //     const bone = sortedBones[i];
            //     const isTransformAfterPhysics = (bone.metadata.flag & PmxObject.Bone.Flag.TransformAfterPhysics) !== 0;
            //     if (isTransformAfterPhysics) continue;

            //     if (bone.getParent() === null) {
            //         this._updateWorldTransform(bone);
            //     }
            // }
        }
    }

    private readonly _boneStack: MmdRuntimeBone[] = [];

    private _updateWorldTransform(bone: MmdRuntimeBone): void {
        const stack: MmdRuntimeBone[] = this._boneStack;
        stack.length = 0;
        stack.push(bone);

        while (stack.length > 0) {
            const bone = stack.pop()!;
            bone;
            // bone._childUpdateId += 1;
            // const parentBone = bone.getParent();

            // if (parentBone) {
            //     bone.getLocalMatrix().multiplyToRef(parentBone.getWorldMatrix(), bone.getWorldMatrix());
            // } else {
            //     if (initialSkinMatrix) {
            //         bone.getLocalMatrix().multiplyToRef(initialSkinMatrix, bone.getWorldMatrix());
            //     } else {
            //         bone.getWorldMatrix().copyFrom(bone.getLocalMatrix());
            //     }
            // }

            // const chindren = bone.children;
            // for (let index = 0; index < chindren.length; index++) {
            //     const child = chindren[index];
            //     if (child._childUpdateId !== bone._childUpdateId) {
            //         stack.push(child);
            //     }
            // }
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
