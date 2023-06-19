import type { Material } from "@babylonjs/core";

import { PmxObject } from "@/loader/parser/PmxObject";

import { AppendTransformSolver } from "./AppendTransformSolver";
import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdBone, MmdMesh } from "./MmdMesh";
import { MmdMorphController } from "./MmdMorphController";

export class MmdModel {
    public readonly mesh: MmdMesh;
    public readonly morph: MmdMorphController;

    private readonly _sortedBones: readonly MmdBone[];
    private readonly _appendTransformSolver: AppendTransformSolver;

    public constructor(
        mmdMesh: MmdMesh,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material>,
        logger: ILogger
    ) {
        this.mesh = mmdMesh;
        this.morph = new MmdMorphController(
            mmdMesh.morphTargetManager,
            mmdMesh.skeleton,
            mmdMesh.material,
            materialProxyConstructor,
            mmdMesh.metadata.morphs,
            logger
        );

        this._sortedBones = mmdMesh.metadata.sortedBones;
        this._appendTransformSolver = new AppendTransformSolver(mmdMesh.skeleton);
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
        const sortedBones = this._sortedBones;

        // todo: apply bone animation

        for (let i = 0; i < sortedBones.length; ++i) {
            const bone = sortedBones[i];
            const boneMetadata = bone.metadata;
            const isTransformAfterPhysics = (bone.metadata.flag & PmxObject.Bone.Flag.TransformAfterPhysics) !== 0;
            if (isTransformAfterPhysics !== afterPhysicsStage) continue;

            if (boneMetadata.appendTransform !== undefined) {
                this._appendTransformSolver.update(bone);
            }

            if (boneMetadata.ik !== undefined) {
                this._updateWorldTransform(bone);

                // todo: solve ik
                // optimize: skip ik if affected bones are physically simulated
            }
        }

        if (!afterPhysicsStage /* && this.physicsEnabled */) {
            for (let i = 0; i < sortedBones.length; ++i) {
                const bone = sortedBones[i];
                const isTransformAfterPhysics = (bone.metadata.flag & PmxObject.Bone.Flag.TransformAfterPhysics) !== 0;
                if (isTransformAfterPhysics) continue;

                if (bone.getParent() === null) {
                    this._updateWorldTransform(bone);
                }
            }
        }
    }

    private readonly _boneStack: MmdBone[] = [];

    private _updateWorldTransform(bone: MmdBone): void {
        const initialSkinMatrix = this.mesh.getPoseMatrix();

        const stack: MmdBone[] = this._boneStack;
        stack.length = 0;
        stack.push(bone);

        while (stack.length > 0) {
            const bone = stack.pop()!;
            bone._childUpdateId += 1;
            const parentBone = bone.getParent();

            if (parentBone) {
                bone.getLocalMatrix().multiplyToRef(parentBone.getWorldMatrix(), bone.getWorldMatrix());
            } else {
                if (initialSkinMatrix) {
                    bone.getLocalMatrix().multiplyToRef(initialSkinMatrix, bone.getWorldMatrix());
                } else {
                    bone.getWorldMatrix().copyFrom(bone.getLocalMatrix());
                }
            }

            const chindren = bone.children;
            for (let index = 0; index < chindren.length; index++) {
                const child = chindren[index];
                if (child._childUpdateId !== bone._childUpdateId) {
                    stack.push(child);
                }
            }
        }
    }
}
