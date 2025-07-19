import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Material } from "@babylonjs/core/Materials/material";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { IMmdBindableModelAnimation } from "./Animation/IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { MmdCompositeRuntimeModelAnimation } from "./Animation/mmdCompositeRuntimeModelAnimation";
import type { MmdRuntimeModelAnimation } from "./Animation/mmdRuntimeModelAnimation";
import type { MmdRuntimeModelAnimationContainer } from "./Animation/mmdRuntimeModelAnimationContainer";
import { AppendTransformSolver } from "./appendTransformSolver";
import { IkSolver } from "./ikSolver";
import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { IMmdModel } from "./IMmdModel";
import type { IMmdRuntimeBone } from "./IMmdRuntimeBone";
import type { IMmdLinkedBoneContainer, IMmdRuntimeLinkedBone } from "./IMmdRuntimeLinkedBone";
import type { MmdSkinnedMesh, TrimmedMmdSkinnedMesh } from "./mmdMesh";
import { MmdMorphController } from "./mmdMorphController";
import type { IMmdModelPhysicsCreationOptions } from "./mmdRuntime";
import type { MmdRuntimeAnimationHandle } from "./mmdRuntimeAnimationHandle";
import { CreateMmdRuntimeAnimationHandle } from "./mmdRuntimeAnimationHandle";
import { MmdRuntimeBone } from "./mmdRuntimeBone";
import type { IMmdPhysics, IMmdPhysicsModel } from "./Physics/IMmdPhysics";

type RuntimeModelAnimation = MmdRuntimeModelAnimation | MmdRuntimeModelAnimationContainer | MmdCompositeRuntimeModelAnimation | IMmdRuntimeModelAnimation;

/**
 * Physics options for construct MmdModel
 */
export interface IMmdModelCtorPhysicsOptions {
    physicsImpl: IMmdPhysics;
    physicsOptions: Nullable<IMmdModelPhysicsCreationOptions>;
}


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
    public readonly mesh: MmdSkinnedMesh | TrimmedMmdSkinnedMesh;

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
     * If `ikSolverState[MmdModel.runtimeBones[i].ikSolverIndex]` is 0, IK solver of `MmdModel.runtimeBones[i]` is disabled and if it is 1, IK solver is enabled
     */
    public readonly ikSolverStates: Uint8Array;

    /**
     * Uint8Array that stores the state of RigidBody
     *
     * - If bone position is driven by physics, the value is 1
     * - If bone position is driven by only animation, the value is 0
     *
     * You can get the state of the rigid body by `rigidBodyStates[MmdModel.runtimeBones[i].rigidBodyIndex]`
     */
    public readonly rigidBodyStates: Uint8Array;

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

    private readonly _physicsModel: Nullable<IMmdPhysicsModel>;

    private readonly _logger: ILogger;

    private readonly _sortedRuntimeBones: readonly MmdRuntimeBone[];

    /**
     * Observable triggered when the animation duration is changed
     *
     * Value is 30fps frame time duration of the animation
     */
    public readonly onAnimationDurationChangedObservable: Observable<number>;
    private readonly _animationHandleMap: Map<MmdRuntimeAnimationHandle, RuntimeModelAnimation>;

    private _currentAnimation: Nullable<RuntimeModelAnimation>;
    private _needStateReset: boolean;

    /**
     * Create a MmdModel
     * @param mmdSkinnedMesh Mesh that able to instantiate `MmdModel`
     * @param skeleton The virtualized bone container of the mesh
     * @param materialProxyConstructor The constructor of `IMmdMaterialProxy`
     * @param physicsParams Physics options
     * @param trimMetadata Whether to trim the metadata of the model
     * @param logger Logger
     */
    public constructor(
        mmdSkinnedMesh: MmdSkinnedMesh,
        skeleton: IMmdLinkedBoneContainer,
        materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<Material>>,
        physicsParams: Nullable<IMmdModelCtorPhysicsOptions>,
        trimMetadata: boolean,
        logger: ILogger
    ) {
        this._logger = logger;

        const mmdMetadata = mmdSkinnedMesh.metadata;
        if (trimMetadata) {
            const runtimeMesh = mmdSkinnedMesh as unknown as TrimmedMmdSkinnedMesh;
            runtimeMesh.metadata = {
                isTrimmedMmdSkinedModel: true,
                header: mmdMetadata.header,
                meshes: mmdMetadata.meshes,
                materials: mmdMetadata.materials,
                skeleton: mmdMetadata.skeleton
            };
        }
        this.mesh = mmdSkinnedMesh;
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
            mmdMetadata.rigidBodies,
            worldTransformMatrices,
            physicsParams !== null
        );

        const sortedBones = this._sortedRuntimeBones = [...runtimeBones];
        // sort must be stable (require ES2019)
        sortedBones.sort((a, b) => {
            return a.transformOrder - b.transformOrder;
        });

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
            mmdMetadata.meshes,
            materialProxyConstructor,
            mmdMetadata.morphs,
            morphTargetManagers
        );

        if (physicsParams !== null) {
            this._physicsModel = physicsParams.physicsImpl.buildPhysics(
                mmdSkinnedMesh,
                runtimeBones,
                mmdMetadata.rigidBodies,
                mmdMetadata.joints,
                logger,
                physicsParams.physicsOptions
            );
            this.rigidBodyStates = new Uint8Array(mmdMetadata.rigidBodies.length).fill(1);
        } else {
            this._physicsModel = null;
            this.rigidBodyStates = new Uint8Array(0);
        }

        this.onAnimationDurationChangedObservable = new Observable<number>();
        this._animationHandleMap = new Map();

        this._currentAnimation = null;
        this._needStateReset = false;
    }

    /**
     * Dispose this model
     *
     * Use MmdWasmRuntime.destroyMmdModel instead of this method
     *
     * Restore the original bone matrix update behavior
     *
     * Dispose the physics resources if the physics is enabled
     *
     * @internal
     */
    public _dispose(): void {
        this._enableSkeletonWorldMatrixUpdate();
        this._physicsModel?.dispose();
        this.onAnimationDurationChangedObservable.clear();

        this.setRuntimeAnimation(null, false);
        for (const animation of this._animationHandleMap.values()) {
            (animation as IMmdRuntimeModelAnimation).dispose?.();
        }
        this._animationHandleMap.clear();

        if ((this.mesh as TrimmedMmdSkinnedMesh).metadata.isTrimmedMmdSkinedModel) {
            (this.mesh as any).metadata = null;
        }
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
     * Bind the animation to this model and return a handle to the runtime animation
     * @param animation MMD animation or MMD model animation group to add
     * @param retargetingMap Animation bone name to model bone name map
     * @returns A handle to the runtime animation
     */
    public createRuntimeAnimation(
        animation: IMmdBindableModelAnimation,
        retargetingMap?: { [key: string]: string }
    ): MmdRuntimeAnimationHandle {
        let runtimeAnimation: RuntimeModelAnimation;
        if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation !== undefined) {
            runtimeAnimation = animation.createRuntimeModelAnimation(this, retargetingMap, this._logger);
        } else {
            throw new Error("animation is not MmdAnimation or MmdModelAnimationContainer or MmdCompositeAnimation. are you missing import \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationContainer\" or \"babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeModelAnimation\"?");
        }

        const handle = CreateMmdRuntimeAnimationHandle();
        this._animationHandleMap.set(handle, runtimeAnimation);
        return handle;
    }

    /**
     * Destroy a runtime animation by its handle
     * @param handle The handle of the runtime animation to destroy
     * @returns True if the animation was destroyed, false if it was not found
     */
    public destroyRuntimeAnimation(handle: MmdRuntimeAnimationHandle): boolean {
        const animation = this._animationHandleMap.get(handle);
        if (animation === undefined) return false;

        if (this._currentAnimation === animation) {
            this._currentAnimation = null;
            this._resetPose();
            if (animation.animation.endFrame !== 0) {
                this.onAnimationDurationChangedObservable.notifyObservers(0);
            }
        }

        this._animationHandleMap.delete(handle);
        (animation as IMmdRuntimeModelAnimation).dispose?.();
        return true;
    }

    /**
     * Set the current animation of this model
     *
     * If handle is null, the current animation will be cleared
     * @param handle The handle of the animation to set as current
     * @param updateMorphTarget Whether to update morph target manager numMaxInfluencers (default: true)
     * @throws {Error} if the animation with the handle is not found
     */
    public setRuntimeAnimation(handle: Nullable<MmdRuntimeAnimationHandle>, updateMorphTarget = true): void {
        if (handle === null) {
            if (this._currentAnimation !== null) {
                const endFrame = this._currentAnimation.animation.endFrame;
                this._currentAnimation = null;
                this._resetPose();
                if (endFrame !== 0) {
                    this.onAnimationDurationChangedObservable.notifyObservers(0);
                }
            }
            return;
        }

        const animation = this._animationHandleMap.get(handle);
        if (animation === undefined) {
            throw new Error(`Animation with handle ${handle} is not found.`);
        }

        if (this._currentAnimation !== null) {
            this._resetPose();
            this._needStateReset = true;
        }
        const oldAnimationEndFrame = this._currentAnimation?.animation.endFrame ?? 0;
        this._currentAnimation = animation;
        animation.induceMaterialRecompile(updateMorphTarget, this._logger);
        if (oldAnimationEndFrame !== animation.animation.endFrame) {
            this.onAnimationDurationChangedObservable.notifyObservers(animation.animation.endFrame);
        }
    }

    /**
     * Get the runtime animation map of this model
     */
    public get runtimeAnimations(): ReadonlyMap<MmdRuntimeAnimationHandle, RuntimeModelAnimation> {
        return this._animationHandleMap;
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
                this.rigidBodyStates.fill(1);
            }

            if (this._currentAnimation !== null) {
                this._currentAnimation.animate(frameTime);
            }
        }

        this.morph.update();

        for (let i = 0; i < this._sortedRuntimeBones.length; ++i) {
            this._sortedRuntimeBones[i].resetTransformState();
        }
        this._physicsModel?.commitBodyStates(this.rigidBodyStates);
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
        const usePhysics = this._physicsModel !== null && !this._physicsModel.needDeoptimize;

        const sortedBones = this._sortedRuntimeBones;
        for (let i = 0; i < sortedBones.length; ++i) {
            const bone = sortedBones[i];
            if (bone.transformAfterPhysics !== afterPhysicsStage) continue;

            bone.updateWorldMatrix(
                usePhysics,
                this.ikSolverStates[bone.ikSolverIndex] !== 0 // if bone.ikSolverIndex is -1, evaluated as undefined !== 0 which is true
            );
        }
    }

    private _buildRuntimeSkeleton(
        bones: IMmdRuntimeLinkedBone[],
        bonesMetadata: readonly MmdModelMetadata.Bone[],
        rigidBodiesMetadata: MmdModelMetadata["rigidBodies"],
        worldTransformMatrices: Float32Array,
        buildRigidBodyIndices: boolean
    ): readonly MmdRuntimeBone[] {
        const boneToRigidBodiesIndexMap: number[][] = new Array(bonesMetadata.length);
        for (let i = 0; i < boneToRigidBodiesIndexMap.length; ++i) boneToRigidBodiesIndexMap[i] = [];

        if (buildRigidBodyIndices) {
            for (let rbIndex = 0; rbIndex < rigidBodiesMetadata.length; ++rbIndex) {
                const rigidBodyMetadata = rigidBodiesMetadata[rbIndex];
                if (0 <= rigidBodyMetadata.boneIndex && rigidBodyMetadata.boneIndex < bonesMetadata.length) {
                    boneToRigidBodiesIndexMap[rigidBodyMetadata.boneIndex].push(rbIndex);
                }
            }
        }

        const runtimeBones: MmdRuntimeBone[] = [];
        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];
            const rigidBodyIndices = boneToRigidBodiesIndexMap[i];
            runtimeBones.push(new MmdRuntimeBone(bones[i], boneMetadata, worldTransformMatrices, i, rigidBodyIndices));
        }

        const physicsBoneSet = new Set<MmdRuntimeBone>();
        {
            const boneNameMap = new Map<string, MmdRuntimeBone>();
            for (let i = 0; i < runtimeBones.length; ++i) {
                const bone = runtimeBones[i];
                boneNameMap.set(bone.name, bone);
            }

            for (let i = 0; i < rigidBodiesMetadata.length; ++i) {
                const rigidBody = rigidBodiesMetadata[i];
                if (rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone) continue;

                let bone: MmdRuntimeBone | undefined = runtimeBones[rigidBody.boneIndex];
                if (bone === undefined) {
                    bone = boneNameMap.get(rigidBodiesMetadata[i].name);
                }
                if (bone !== undefined) physicsBoneSet.add(bone);
            }
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
                                physicsBoneSet.has(linkBone),
                                link.limitation
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
