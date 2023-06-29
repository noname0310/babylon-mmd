import { type Bone, type Material, type Matrix, type Nullable, type Skeleton, Vector3 } from "@babylonjs/core";

import type { MmdAnimation } from "@/loader/animation/MmdAnimation";
import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";

import { MmdRuntimeModelAnimation } from "./animation/MmdRuntimeAnimation";
import { AppendTransformSolver } from "./AppendTransformSolver";
import { IkSolver } from "./IkSolver";
import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdMesh, RuntimeMmdMesh } from "./MmdMesh";
import { MmdMorphController } from "./MmdMorphController";
import type { IMmdRuntimeBone} from "./MmdRuntimeBone";
import { MmdRuntimeBone } from "./MmdRuntimeBone";

export class MmdModel {
    public readonly mesh: RuntimeMmdMesh;
    public readonly morph: MmdMorphController;

    private readonly _logger: ILogger;

    private readonly _sortedRuntimeBones: readonly MmdRuntimeBone[];
    private readonly _sortedRuntimeRootBones: readonly MmdRuntimeBone[];

    private readonly _animations: MmdRuntimeModelAnimation[];
    private readonly _animationIndexMap: Map<string, number>;

    private _currentAnimation: MmdRuntimeModelAnimation | null;

    public constructor(
        mmdMesh: MmdMesh,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material>,
        logger: ILogger
    ) {
        this._logger = logger;

        const mmdMetadata = mmdMesh.metadata;

        const runtimeMesh = mmdMesh as unknown as RuntimeMmdMesh;
        runtimeMesh.metadata = {
            isRuntimeMmdModel: true,
            header: mmdMesh.metadata.header
        };
        this.mesh = runtimeMesh;

        this._disableSkeletonWorldMatrixUpdate(mmdMesh.skeleton);

        const runtimeBones = this._buildRuntimeSkeleton(
            mmdMesh.skeleton.bones,
            mmdMetadata.bones
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
            mmdMetadata.morphs,
            logger
        );

        this._animations = [];
        this._animationIndexMap = new Map();

        this._currentAnimation = null;
    }

    public get sortedRuntimeBones(): readonly IMmdRuntimeBone[] {
        return this._sortedRuntimeBones;
    }

    public addAnimation(animation: MmdAnimation, retargetingMap?: { [key: string]: string }): void {
        const runtimeAnimation = MmdRuntimeModelAnimation.Create(animation, this, retargetingMap, this._logger);
        this._animationIndexMap.set(animation.name, this._animations.length);
        this._animations.push(runtimeAnimation);
    }

    public removeAnimation(index: number): void {
        const animation = this._animations[index];
        if (this._currentAnimation === animation) this._currentAnimation = null;

        this._animationIndexMap.delete(animation.animation.name);
        this._animations.splice(index, 1);
    }

    public setAnimation(name: string | null): void {
        if (name === null) {
            this._currentAnimation = null;
            return;
        }

        const index = this._animationIndexMap.get(name);
        if (index === undefined) {
            this._logger.error(`Animation not found: ${name}`);
            return;
        }

        this._currentAnimation = this._animations[index];
    }

    public get runtimeAnimations(): readonly MmdRuntimeModelAnimation[] {
        return this._animations;
    }

    public beforePhysics(frameTime: number | null): void {
        if (frameTime !== null) {
            if (this._currentAnimation !== null) {
                this.mesh.skeleton.returnToRest();
                this._currentAnimation.animate(frameTime);
            }
        }

        this.morph.update();

        this._update(false);
    }

    public afterPhysics(): void {
        this._update(true);
        this.mesh.skeleton._markAsDirty();
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

            if (bone.appendTransformSolver !== null) {
                bone.appendTransformSolver.update();
                bone.updateLocalMatrix();
                bone.updateWorldMatrix();
            }

            if (bone.ikSolver !== null) {
                bone.ikSolver.solve();
                bone.updateWorldMatrix();
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
            if (0 <= parentBoneIndex && parentBoneIndex < runtimeBones.length) {
                const parentBone = runtimeBones[parentBoneIndex];
                bone.parentBone = parentBone;
                parentBone.childrenBones.push(bone);
            }

            if (boneMetadata.appendTransform !== undefined) {
                const targetBoneIndex = boneMetadata.appendTransform.parentIndex;
                if (0 <= targetBoneIndex && targetBoneIndex < runtimeBones.length) {
                    bone.appendTransformSolver = new AppendTransformSolver(
                        boneMetadata.appendTransform,
                        bone,
                        runtimeBones[targetBoneIndex]
                    );
                } else {
                    this._logger.error(`Invalid append transform target bone index: ${targetBoneIndex}`);
                }
            }

            if (boneMetadata.ik !== undefined) {
                const ikMetadata = boneMetadata.ik;
                const targetBoneIndex = ikMetadata.target;
                if (0 <= targetBoneIndex && targetBoneIndex < runtimeBones.length) {
                    const ikSolver = bone.ikSolver = new IkSolver(
                        bone,
                        runtimeBones[targetBoneIndex]
                    );
                    ikSolver.iteration = ikMetadata.iteration;
                    ikSolver.limitAngle = ikMetadata.rotationConstraint;
                    for (let j = 0; j < ikMetadata.links.length; ++j) {
                        const link = ikMetadata.links[j];
                        const linkBoneIndex = link.target;
                        if (0 <= linkBoneIndex) {
                            const linkBone = runtimeBones[linkBoneIndex];
                            ikSolver.addIkChain(
                                linkBone,
                                link.limitation?.minimumAngle ? Vector3.FromArray(link.limitation.minimumAngle) : null,
                                link.limitation?.maximumAngle ? Vector3.FromArray(link.limitation.maximumAngle) : null
                            );
                        }
                    }
                } else {
                    this._logger.error(`Invalid IK target bone index: ${targetBoneIndex}`);
                }
            }
        }

        return runtimeBones;
    }

    private _originalComputeTransformMatrices: ((targetMatrix: Float32Array, initialSkinMatrix: Nullable<Matrix>) => void) | null = null;

    private _disableSkeletonWorldMatrixUpdate(skeleton: Skeleton): void {
        if (this._originalComputeTransformMatrices !== null) return;

        this._originalComputeTransformMatrices = (skeleton as any)._computeTransformMatrices;

        (skeleton as any)._computeTransformMatrices = function(targetMatrix: Float32Array, _initialSkinMatrix: Nullable<Matrix>): void {
            this.onBeforeComputeObservable.notifyObservers(this);

            for (let index = 0; index < this.bones.length; index++) {
                const bone = this.bones[index] as Bone;
                bone._childUpdateId += 1;

                if (bone._index !== -1) {
                    const mappedIndex = bone._index === null ? index : bone._index;
                    bone.getInvertedAbsoluteTransform().multiplyToArray(bone.getWorldMatrix(), targetMatrix, mappedIndex * 16);
                }
            }

            this._identity.copyToArray(targetMatrix, this.bones.length * 16);
        };
    }

    public enableSkeletonWorldMatrixUpdate(): void {
        if (this._originalComputeTransformMatrices === null) return;
        (this.mesh.skeleton as any)._computeTransformMatrices = this._originalComputeTransformMatrices;
    }
}
