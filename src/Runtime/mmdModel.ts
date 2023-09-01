import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

import type { IMmdBindableModelAnimation } from "./Animation/IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { MmdRuntimeModelAnimation } from "./Animation/mmdRuntimeModelAnimation";
import type { MmdRuntimeModelAnimationGroup } from "./Animation/mmdRuntimeModelAnimationGroup";
import { AppendTransformSolver } from "./appendTransformSolver";
import { IkSolver } from "./ikSolver";
import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdMesh, RuntimeMmdMesh } from "./mmdMesh";
import { MmdMorphController } from "./mmdMorphController";
import type { MmdPhysics, MmdPhysicsModel } from "./mmdPhysics";
import type { IMmdRuntimeBone } from "./mmdRuntimeBone";
import { MmdRuntimeBone } from "./mmdRuntimeBone";

type RuntimeModelAnimation = MmdRuntimeModelAnimation | MmdRuntimeModelAnimationGroup | IMmdRuntimeModelAnimation;

/**
 * MmdModel is a class that controls the `MmdMesh` to animate the Mesh with MMD Runtime
 *
 * The mesh that instantiates `MmdModel` ignores some original implementations of Babylon.js and follows the MMD specifications
 *
 * The biggest difference is that the methods that get the absolute transform of `mesh.skeleton.bones` no longer work properly and can only get absolute transform through `bone.getFinalMatrix()`
 *
 * Final matrix is guaranteed to be updated after `MmdModel.afterPhysics()` stage
 */
export class MmdModel {
    /**
     * The mesh of this model
     */
    public readonly mesh: RuntimeMmdMesh;

    /**
     * The morph controller of this model
     *
     * The `MmdMorphController` not only wrapper of `MorphTargetManager` but also controls the CPU bound morphs (bone, material, group)
     */
    public readonly morph: MmdMorphController;

    private readonly _physicsModel: Nullable<MmdPhysicsModel>;

    private readonly _logger: ILogger;

    private readonly _sortedRuntimeBones: readonly MmdRuntimeBone[];
    private readonly _sortedRuntimeRootBones: readonly MmdRuntimeBone[];

    public readonly onCurrentAnimationChangedObservable: Observable<Nullable<RuntimeModelAnimation>>;
    private readonly _animations: RuntimeModelAnimation[];
    private readonly _animationIndexMap: Map<string, number>;

    private _currentAnimation: Nullable<RuntimeModelAnimation>;

    /**
     * Create a MmdModel
     * @param mmdMesh Mesh that able to instantiate `MmdModel`
     * @param materialProxyConstructor The constructor of `IMmdMaterialProxy`
     * @param mmdPhysics Physics builder
     * @param logger Logger
     */
    public constructor(
        mmdMesh: MmdMesh,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material>,
        mmdPhysics: Nullable<MmdPhysics>,
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

        // If you are not using MMD Runtime, you need to update the world matrix once. it could be waste of performance
        mmdMesh.skeleton.prepare();

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

        if (mmdPhysics !== null) {
            for (let i = 0; i < sortedBones.length; ++i) sortedBones[i].updateLocalMatrix();
            for (let i = 0; i < sortedRootBones.length; ++i) sortedRootBones[i].updateWorldMatrix();
            this._physicsModel = mmdPhysics.buildPhysics(
                mmdMesh,
                runtimeBones,
                mmdMetadata.rigidBodies,
                mmdMetadata.joints,
                logger
            );
        } else {
            this._physicsModel = null;
        }

        this.onCurrentAnimationChangedObservable = new Observable<Nullable<IMmdRuntimeModelAnimation>>();
        this._animations = [];
        this._animationIndexMap = new Map();

        this._currentAnimation = null;
    }

    /**
     * Dispose this model
     *
     * Restore the original bone matrix update behavior
     *
     * Dispose the physics resources if the physics is enabled
     */
    public dispose(): void {
        this._enableSkeletonWorldMatrixUpdate();
        this._physicsModel?.dispose();
        this.onCurrentAnimationChangedObservable.clear();
    }

    /**
     * Get the sorted bones of this model
     *
     * The bones are sorted by `transformOrder`
     */
    public get sortedRuntimeBones(): readonly IMmdRuntimeBone[] {
        return this._sortedRuntimeBones;
    }

    /**
     * Add an animation to this model
     * @param animation MMD animation or MMD model animation group to add
     * @param retargetingMap Model bone name to animation bone name map
     */
    public addAnimation(
        animation: IMmdBindableModelAnimation,
        retargetingMap?: { [key: string]: string }
    ): void {
        let runtimeAnimation: RuntimeModelAnimation;
        if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation !== undefined) {
            runtimeAnimation = (animation as IMmdBindableModelAnimation).createRuntimeModelAnimation(this, retargetingMap, this._logger);
        } else {
            throw new Error("animation is not MmdAnimation or MmdModelAnimationGroup. are you missing import \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationGroup\"?");
        }
        this._animationIndexMap.set(animation.name, this._animations.length);
        this._animations.push(runtimeAnimation);
    }

    /**
     * Remove an animation from this model
     *
     * if index is out of range, do nothing
     * @param index The index of the animation to remove
     */
    public removeAnimation(index: number): void {
        const animation = this._animations[index];
        if (this._currentAnimation === animation) this._currentAnimation = null;

        this._animationIndexMap.delete(animation.animation.name);
        this._animations.splice(index, 1);
    }

    /**
     * Set the current animation of this model
     * @param name The name of the animation to set
     * @throws {Error} if the animation is not found
     */
    public setAnimation(name: Nullable<string>): void {
        if (name === null) {
            if (this._currentAnimation !== null) {
                this._currentAnimation = null;
                this.onCurrentAnimationChangedObservable.notifyObservers(null);
            }
            return;
        }

        const index = this._animationIndexMap.get(name);
        if (index === undefined) {
            throw new Error(`Animation '${name}' is not found.`);
        }

        const animation = this._currentAnimation = this._animations[index];
        animation.induceMaterialRecompile(this._logger);
        this.onCurrentAnimationChangedObservable.notifyObservers(animation);
    }

    /**
     * Get the animations of this model
     */
    public get runtimeAnimations(): readonly RuntimeModelAnimation[] {
        return this._animations;
    }

    /**
     * Get the current animation of this model
     */
    public get currentAnimation(): Nullable<RuntimeModelAnimation> {
        return this._currentAnimation;
    }

    /**
     * Reset the morph weights and IK enabled state of this model
     */
    public resetState(): void {
        this.morph.resetMorphWeights();

        const sortedBones = this._sortedRuntimeBones;
        for (let i = 0; i < sortedBones.length; ++i) {
            const bone = sortedBones[i];

            if (bone.ikSolver !== null) {
                bone.ikSolver.enabled = true;
            }
        }
    }

    /**
     * Reset the rigid body positions and velocities of this model
     */
    public initializePhysics(): void {
        this._physicsModel?.initialize();
    }

    /**
     * Before the physics stage, update animations and run MMD runtime solvers
     *
     * This method must be called before the physics stage
     *
     * if frameTime is null, animations are not updated
     * @param frameTime The time elapsed since the last frame in 30fps
     */
    public beforePhysics(frameTime: Nullable<number>): void {
        if (frameTime !== null) {
            if (this._currentAnimation !== null) {
                this._currentAnimation.animate(frameTime);
            }
        }

        this.morph.update();
        this._update(false);
        this._physicsModel?.syncBodies();
    }

    /**
     * After the physics stage, run MMD runtime solvers
     *
     * This method must be called after the physics stage
     */
    public afterPhysics(): void {
        const physicsModel = this._physicsModel;
        if (physicsModel !== null) {
            physicsModel.syncBones();
        }
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
                parentBone.childBones.push(bone);
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

    private _originalComputeTransformMatrices: Nullable<(targetMatrix: Float32Array, initialSkinMatrix: Nullable<Matrix>) => void> = null;

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
                    bone.getAbsoluteInverseBindMatrix().multiplyToArray(bone.getFinalMatrix(), targetMatrix, mappedIndex * 16);
                }
            }

            this._identity.copyToArray(targetMatrix, this.bones.length * 16);
        };
    }

    private _enableSkeletonWorldMatrixUpdate(): void {
        if (this._originalComputeTransformMatrices === null) return;
        (this.mesh.skeleton as any)._computeTransformMatrices = this._originalComputeTransformMatrices;
    }
}
