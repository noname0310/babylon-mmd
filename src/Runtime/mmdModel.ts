import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Material } from "@babylonjs/core/Materials/material";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

import type { IMmdBindableModelAnimation } from "./Animation/IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { MmdCompositeRuntimeModelAnimation } from "./Animation/mmdCompositeRuntimeModelAnimation";
import type { MmdRuntimeModelAnimation } from "./Animation/mmdRuntimeModelAnimation";
import type { MmdRuntimeModelAnimationGroup } from "./Animation/mmdRuntimeModelAnimationGroup";
import { AppendTransformSolver } from "./appendTransformSolver";
import { IkSolver } from "./ikSolver";
import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { IMmdModel } from "./IMmdModel";
import type { IMmdRuntimeBone } from "./IMmdRuntimeBone";
import type { IMmdLinkedBoneContainer, IMmdRuntimeLinkedBone } from "./IMmdRuntimeLinkedBone";
import type { MmdSkinnedMesh, RuntimeMmdMesh } from "./mmdMesh";
import { MmdMorphController } from "./mmdMorphController";
import type { MmdPhysics, MmdPhysicsModel } from "./mmdPhysics";
import { MmdRuntimeBone } from "./mmdRuntimeBone";

type RuntimeModelAnimation = MmdRuntimeModelAnimation | MmdRuntimeModelAnimationGroup | MmdCompositeRuntimeModelAnimation | IMmdRuntimeModelAnimation;

/**
 * MmdModel is a class that controls the `MmdSkinnedMesh` to animate the Mesh with MMD Runtime
 *
 * The mesh that instantiates `MmdModel` ignores some original implementations of Babylon.js and follows the MMD specifications
 *
 * The biggest difference is that the methods that get the absolute transform of `mesh.skeleton.bones` no longer work properly and can only get absolute transform through `mmdModel.worldTransformMatrices`
 *
 * Final matrix is guaranteed to be updated after `MmdModel.afterPhysics()` stage
 */
export class MmdModel implements IMmdModel {
    /**
     * The root mesh of this model
     */
    public readonly mesh: RuntimeMmdMesh;

    /**
     * The skeleton of this model
     *
     * This can be a instance of `Skeleton`, or if you are using a humanoid model, it will be referencing a virtualized bone tree
     *
     * So MmdModel.metadata.skeleton is not always equal to MmdModel.skeleton
     */
    public readonly skeleton: IMmdLinkedBoneContainer;

    /**
     * The array of final transform matrices of bones (ie. the matrix sent to shaders)
     */
    public readonly worldTransformMatrices: Float32Array;

    /**
     * Uint8Array that stores the state of IK solvers
     *
     * If `ikSolverState[MmdModel.runtimeBones[i].ikSolverIndex]` is 0, IK solver of `MmdModel.runtimeBones[i]` is disabled and vice versa
     */
    public readonly ikSolverStates: Uint8Array;

    /**
     * Runtime bones of this model
     *
     * You can get the final transform matrix of a bone by `MmdModel.runtimeBones[i].getFinalMatrixToRef()`
     */
    public readonly runtimeBones: readonly IMmdRuntimeBone[];

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

    /**
     * Observable triggered when the current animation is changed
     */
    public readonly onCurrentAnimationChangedObservable: Observable<Nullable<RuntimeModelAnimation>>;
    private readonly _animations: RuntimeModelAnimation[];
    private readonly _animationIndexMap: Map<string, number>;

    private _currentAnimation: Nullable<RuntimeModelAnimation>;
    private _needStateReset: boolean;

    /**
     * Create a MmdModel
     * @param mmdSkinnedMesh Mesh that able to instantiate `MmdModel`
     * @param skeleton The virtualized bone container of the mesh
     * @param materialProxyConstructor The constructor of `IMmdMaterialProxy`
     * @param mmdPhysics Physics builder
     * @param logger Logger
     */
    public constructor(
        mmdSkinnedMesh: MmdSkinnedMesh,
        skeleton: IMmdLinkedBoneContainer,
        materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<Material>>,
        mmdPhysics: Nullable<MmdPhysics>,
        logger: ILogger
    ) {
        this._logger = logger;

        const mmdMetadata = mmdSkinnedMesh.metadata;

        const runtimeMesh = mmdSkinnedMesh as unknown as RuntimeMmdMesh;
        runtimeMesh.metadata = {
            isRuntimeMmdModel: true,
            header: mmdMetadata.header,
            meshes: mmdMetadata.meshes,
            materials: mmdMetadata.materials,
            skeleton: mmdMetadata.skeleton
        };
        this.mesh = runtimeMesh;
        this.skeleton = skeleton;
        const worldTransformMatrices = this.worldTransformMatrices = new Float32Array(skeleton.bones.length * 16);
        {
            let ikSolverCount = 0;
            const bonesMetadata = mmdMetadata.bones;
            for (let i = 0; i < bonesMetadata.length; ++i) {
                if (bonesMetadata[i].ik !== undefined) ikSolverCount += 1;
            }
            this.ikSolverStates = new Uint8Array(ikSolverCount).fill(1);
        }

        // If you are not using MMD Runtime, you need to update the world matrix once. it could be waste of performance
        skeleton.prepare();

        this._disableSkeletonWorldMatrixUpdate(skeleton);

        const runtimeBones = this.runtimeBones = this._buildRuntimeSkeleton(
            skeleton.bones,
            mmdMetadata.bones,
            worldTransformMatrices
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

        const morphTargetManagers: MorphTargetManager[] = [];
        {
            const meshes = mmdMetadata.meshes;
            for (let i = 0; i < meshes.length; ++i) {
                const morphTargetManager = meshes[i].morphTargetManager;
                if (morphTargetManager !== null) morphTargetManagers.push(morphTargetManager);
            }
        }

        this.morph = new MmdMorphController(
            runtimeBones,
            mmdMetadata.materials,
            materialProxyConstructor,
            mmdMetadata.morphs,
            morphTargetManagers,
            logger
        );

        if (mmdPhysics !== null) {
            for (let i = 0; i < sortedBones.length; ++i) sortedBones[i].updateLocalMatrix();
            for (let i = 0; i < sortedRootBones.length; ++i) sortedRootBones[i].updateWorldMatrix();
            this._physicsModel = mmdPhysics.buildPhysics(
                mmdSkinnedMesh,
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
        this._needStateReset = false;
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

        const animations = this._animations;
        for (let i = 0; i < animations.length; ++i) {
            (animations[i] as IMmdRuntimeModelAnimation).dispose?.();
        }
        this._animations.length = 0;
        this._animationIndexMap.clear();

        (this.mesh as any).metadata = null;
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
            runtimeAnimation = animation.createRuntimeModelAnimation(this, retargetingMap, this._logger);
        } else {
            throw new Error("animation is not MmdAnimation or MmdModelAnimationGroup or MmdCompositeAnimation. are you missing import \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationGroup\" or \"babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeModelAnimation\"?");
        }
        this._animationIndexMap.set(animation.name, this._animations.length);
        this._animations.push(runtimeAnimation);
    }

    /**
     * Remove an animation from this model
     *
     * If index is out of range, do nothing
     * @param index The index of the animation to remove
     */
    public removeAnimation(index: number): void {
        const animation = this._animations[index];
        if (this._currentAnimation === animation) {
            this._currentAnimation = null;
            this._resetPose();
            this.onCurrentAnimationChangedObservable.notifyObservers(null);
        }

        this._animationIndexMap.delete(animation.animation.name);
        this._animations.splice(index, 1);
        (animation as IMmdRuntimeModelAnimation).dispose?.();
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
                this._resetPose();
                this.onCurrentAnimationChangedObservable.notifyObservers(null);
            }
            return;
        }

        const index = this._animationIndexMap.get(name);
        if (index === undefined) {
            throw new Error(`Animation '${name}' is not found.`);
        }

        if (this._currentAnimation !== null) {
            this._resetPose();
            this._needStateReset = true;
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
     * If frameTime is null, animations are not updated
     * @param frameTime The time elapsed since the last frame in 30fps
     */
    public beforePhysics(frameTime: Nullable<number>): void {
        if (frameTime !== null) {
            if (this._needStateReset) {
                this._needStateReset = false;

                this.morph.resetMorphWeights();
                this.ikSolverStates.fill(1);
            }

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
        this.mesh.metadata.skeleton._markAsDirty();
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

            if (bone.ikSolver !== null && this.ikSolverStates[bone.ikSolver.index] !== 0) {
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
        bones: IMmdRuntimeLinkedBone[],
        bonesMetadata: readonly MmdModelMetadata.Bone[],
        worldTransformMatrices: Float32Array
    ): readonly MmdRuntimeBone[] {
        const runtimeBones: MmdRuntimeBone[] = [];
        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];
            runtimeBones.push(new MmdRuntimeBone(bones[i], boneMetadata, worldTransformMatrices, i));
        }

        let ikSolverCount = 0;
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
                        boneMetadata.flag,
                        boneMetadata.appendTransform,
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
                        ikSolverCount,
                        bone,
                        runtimeBones[targetBoneIndex]
                    );
                    ikSolverCount += 1;
                    ikSolver.iteration = ikMetadata.iteration;
                    ikSolver.limitAngle = ikMetadata.rotationConstraint;
                    for (let j = 0; j < ikMetadata.links.length; ++j) {
                        const link = ikMetadata.links[j];
                        const linkBoneIndex = link.target;
                        if (0 <= linkBoneIndex && linkBoneIndex < runtimeBones.length) {
                            const linkBone = runtimeBones[linkBoneIndex];
                            ikSolver.addIkChain(
                                linkBone,
                                link.limitation?.minimumAngle ? Vector3.FromArray(link.limitation.minimumAngle) : null,
                                link.limitation?.maximumAngle ? Vector3.FromArray(link.limitation.maximumAngle) : null
                            );
                        } else {
                            this._logger.error(`Invalid IK link bone index: ${linkBoneIndex}`);
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

    private _disableSkeletonWorldMatrixUpdate(skeleton: IMmdLinkedBoneContainer): void {
        if (this._originalComputeTransformMatrices !== null) return;
        this._originalComputeTransformMatrices = (skeleton as any)._computeTransformMatrices;

        const worldTransformMatrices = this.worldTransformMatrices;

        (skeleton as any)._computeTransformMatrices = function(targetMatrix: Float32Array, _initialSkinMatrix: Nullable<Matrix>): void {
            this.onBeforeComputeObservable.notifyObservers(this);

            for (let index = 0; index < this.bones.length; index++) {
                const bone = this.bones[index] as Bone;
                bone._childUpdateId += 1;

                if (bone._index !== -1) {
                    const mappedIndex = bone._index === null ? index : bone._index;
                    bone.getAbsoluteInverseBindMatrix().multiplyToArray(
                        Matrix.FromArrayToRef(worldTransformMatrices, index * 16, bone.getFinalMatrix()),
                        targetMatrix,
                        mappedIndex * 16
                    );
                }
            }

            this._identity.copyToArray(targetMatrix, this.bones.length * 16);
        };
    }

    private _enableSkeletonWorldMatrixUpdate(): void {
        if (this._originalComputeTransformMatrices === null) return;
        (this.skeleton as any)._computeTransformMatrices = this._originalComputeTransformMatrices;
        this._originalComputeTransformMatrices = null;
    }

    private _resetPose(): void {
        const sortedBones = this._sortedRuntimeBones;

        const position = new Vector3();
        const identityRotation = Quaternion.Identity();

        for (let i = 0; i < sortedBones.length; ++i) {
            const bone = sortedBones[i].linkedBone;
            bone.getRestMatrix().getTranslationToRef(position);

            bone.position = position;
            bone.setRotationQuaternion(identityRotation, Space.LOCAL);
        }
        this.mesh.metadata.skeleton._markAsDirty();
    }
}
