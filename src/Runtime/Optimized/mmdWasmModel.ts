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

import type { IMmdBindableModelAnimation } from "../Animation/IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "../Animation/IMmdRuntimeAnimation";
import type { MmdCompositeRuntimeModelAnimation } from "../Animation/mmdCompositeRuntimeModelAnimation";
import type { MmdRuntimeModelAnimation } from "../Animation/mmdRuntimeModelAnimation";
import type { MmdRuntimeModelAnimationContainer } from "../Animation/mmdRuntimeModelAnimationContainer";
import type { IMmdMaterialProxyConstructor } from "../IMmdMaterialProxy";
import type { IMmdModel } from "../IMmdModel";
import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import type { IMmdLinkedBoneContainer, IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { MmdSkinnedMesh, TrimmedMmdSkinnedMesh } from "../mmdMesh";
import type { IMmdModelCtorPhysicsOptions } from "../mmdModel";
import { CreateMmdRuntimeAnimationHandle, type MmdRuntimeAnimationHandle } from "../mmdRuntimeAnimationHandle";
import type { IMmdPhysicsModel } from "../Physics/IMmdPhysics";
import type { MmdWasmAnimation } from "./Animation/mmdWasmAnimation";
import type { MmdWasmRuntimeModelAnimation } from "./Animation/mmdWasmRuntimeModelAnimation";
import type { IWasmTypedArray } from "./Misc/IWasmTypedArray";
import { WasmBufferedArray } from "./Misc/wasmBufferedArray";
import { MmdWasmMorphController } from "./mmdWasmMorphController";
import type { MmdWasmRuntime } from "./mmdWasmRuntime";
import { MmdWasmRuntimeAnimationEvaluationType } from "./mmdWasmRuntime";
import { MmdWasmRuntimeBone } from "./mmdWasmRuntimeBone";

type RuntimeModelAnimation = MmdWasmRuntimeModelAnimation | MmdRuntimeModelAnimation | MmdRuntimeModelAnimationContainer | MmdCompositeRuntimeModelAnimation | IMmdRuntimeModelAnimation;

/**
 * MmdWasmModel is a class that controls the `MmdSkinnedMesh` to animate the Mesh with MMD Wasm Runtime
 *
 * The mesh that instantiates `MmdWasmModel` ignores some original implementations of Babylon.js and follows the MMD specifications
 *
 * The biggest difference is that the methods that get the absolute transform of `mesh.skeleton.bones` no longer work properly and can only get absolute transform through `mmdModel.worldTransformMatrices`
 *
 * Final matrix is guaranteed to be updated after `MmdWasmModel.afterPhysics()` stage
 *
 * IMPORTANT: The typed array members of this class are pointers to wasm memory.
 * Note that when wasm memory is resized, the typed array is no longer valid.
 * It is designed to always return a valid typed array at the time of a get,
 * so as long as you don't copy the typed array reference in an instance of this class elsewhere, you are safe.
 */
export class MmdWasmModel implements IMmdModel {
    /**
     * Pointer to wasm side MmdModel
     */
    public readonly ptr: number;

    /**
     * The root mesh of this model
     */
    public readonly mesh: MmdSkinnedMesh | TrimmedMmdSkinnedMesh;

    /**
     * The skeleton of this model
     *
     * This can be a instance of `Skeleton`, or if you are using a humanoid model, it will be referencing a virtualized bone tree
     *
     * So MmdWasmModel.metadata.skeleton is not always equal to MmdWasmModel.skeleton
     */
    public readonly skeleton: IMmdLinkedBoneContainer;

    private readonly _worldTransformMatrices: WasmBufferedArray<Float32Array>;

    /**
     * The array of final transform matrices of bones (ie. the matrix sent to shaders)
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get worldTransformMatrices(): Float32Array {
        // we don't need to wait for the lock here because double buffering is used
        return this._worldTransformMatrices.frontBuffer;
    }

    private readonly _boneAnimationStates: IWasmTypedArray<Float32Array>;

    /**
     * Wasm side bone animation states. this value is automatically synchronized with `MmdWasmModel.skeleton` on `MmdWasmModel.beforePhysics()` stage
     *
     * repr: [..., positionX, positionY, positionZ, padding, rotationX, rotationY, rotationZ, rotationW, scaleX, scaleY, scaleZ, padding, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get boneAnimationStates(): Float32Array {
        this._runtime.lock.wait();
        return this._boneAnimationStates.array;
    }

    private readonly _ikSolverStates: IWasmTypedArray<Uint8Array>;

    /**
     * Uint8Array that stores the state of IK solvers
     *
     * If `ikSolverState[MmdModel.runtimeBones[i].ikSolverIndex]` is 0, IK solver of `MmdModel.runtimeBones[i]` is disabled and if it is 1, IK solver is enabled
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get ikSolverStates(): Uint8Array {
        this._runtime.lock.wait();
        return this._ikSolverStates.array;
    }

    private readonly _rigidBodyStates: IWasmTypedArray<Uint8Array>;

    /**
     * Uint8Array that stores the state of RigidBody
     *
     * - If bone position is driven by physics, the value is 1
     * - If bone position is driven by only animation, the value is 0
     *
     * You can get the state of the rigid body by `rigidBodyStates[MmdModel.runtimeBones[i].rigidBodyIndex]`
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get rigidBodyStates(): Uint8Array {
        this._runtime.lock.wait();
        return this._rigidBodyStates.array;
    }

    /**
     * Runtime bones of this model
     *
     * You can get the final transform matrix of a bone by `MmdModel.runtimeBones[i].getFinalMatrixToRef()`
     */
    public readonly runtimeBones: readonly IMmdRuntimeBone[];

    /**
     * The morph controller of this model
     *
     * The `MmdWasmMorphController` not only wrapper of `MorphTargetManager` but also controls the CPU bound morphs (bone, material, group)
     */
    public readonly morph: MmdWasmMorphController;

    private readonly _physicsModel: Nullable<IMmdPhysicsModel>;

    private readonly _runtime: MmdWasmRuntime;

    private readonly _sortedRuntimeBones: readonly MmdWasmRuntimeBone[];

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
     * Create a MmdWasmModel
     *
     * IMPORTANT: when wasm runtime using buffered evaluation, this constructor must be called before waiting for the WasmMmdRuntime.lock
     * otherwise, it will cause a datarace
     * @param wasmRuntime MMD WASM runtime
     * @param ptr Pointer to wasm side MmdModel
     * @param mmdSkinnedMesh Mesh that able to instantiate `MmdWasmModel`
     * @param skeleton The virtualized bone container of the mesh
     * @param materialProxyConstructor The constructor of `IMmdMaterialProxy`
     * @param wasmMorphIndexMap Mmd morph to WASM morph index map
     * @param physicsParams Physics options
     * @param trimMetadata Whether to trim the metadata of the model
     */
    public constructor(
        wasmRuntime: MmdWasmRuntime,
        ptr: number,
        mmdSkinnedMesh: MmdSkinnedMesh,
        skeleton: IMmdLinkedBoneContainer,
        materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<Material>>,
        wasmMorphIndexMap: Int32Array,
        physicsParams: Nullable<IMmdModelCtorPhysicsOptions>,
        trimMetadata: boolean
    ) {
        const wasmInstance = wasmRuntime.wasmInstance;
        const wasmRuntimeInternal = wasmRuntime.wasmInternal;

        this._runtime = wasmRuntime;

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
        this.ptr = ptr;
        this.mesh = mmdSkinnedMesh;
        this.skeleton = skeleton;

        const worldTransformMatricesPtr = wasmRuntimeInternal.getBoneWorldMatrixArena(ptr);
        const boneAnimationStatesPtr = wasmRuntimeInternal.getAnimationArena(ptr);
        const ikSolverStatesPtr = wasmRuntimeInternal.getAnimationIkSolverStateArena(ptr);
        const rigidBodyStatesPtr = wasmRuntimeInternal.getAnimationRigidBodyStateArena(ptr);
        const morphWeightsPtr = wasmRuntimeInternal.getAnimationMorphArena(ptr);

        const worldTransformMatricesFrontBuffer = wasmInstance.createTypedArray(Float32Array, worldTransformMatricesPtr, mmdMetadata.bones.length * 16);
        let worldTransformMatricesBackBuffer = worldTransformMatricesFrontBuffer;
        if (wasmRuntime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered) {
            const worldTransformMatricesBackBufferPtr = wasmRuntimeInternal.createBoneWorldMatrixBackBuffer(this.ptr);
            worldTransformMatricesBackBuffer = wasmInstance.createTypedArray(Float32Array, worldTransformMatricesBackBufferPtr, mmdMetadata.bones.length * 16);
        }
        const worldTransformMatrices = this._worldTransformMatrices = new WasmBufferedArray(worldTransformMatricesFrontBuffer, worldTransformMatricesBackBuffer);
        this._boneAnimationStates = wasmInstance.createTypedArray(Float32Array, boneAnimationStatesPtr, mmdMetadata.bones.length * 12);

        let ikCount = 0;
        for (let i = 0; i < mmdMetadata.bones.length; ++i) if (mmdMetadata.bones[i].ik) ikCount += 1;
        this._ikSolverStates = wasmInstance.createTypedArray(Uint8Array, ikSolverStatesPtr, ikCount);

        const rigidBodyStatesCount = wasmRuntimeInternal.getAnimationRigidBodyStateArenaSize(ptr);
        this._rigidBodyStates = wasmInstance.createTypedArray(Uint8Array, rigidBodyStatesPtr, rigidBodyStatesCount);

        // If you are not using MMD Runtime, you need to update the world matrix once. it could be waste of performance
        skeleton.prepare();

        this._disableSkeletonWorldMatrixUpdate(skeleton);

        const runtimeBones = this.runtimeBones = this._buildRuntimeSkeleton(
            skeleton.bones,
            mmdMetadata.bones,
            mmdMetadata.rigidBodies,
            worldTransformMatrices,
            rigidBodyStatesCount !== 0 || physicsParams !== null,
            wasmRuntime
        );

        const sortedBones = this._sortedRuntimeBones = [...runtimeBones];
        // sort must be stable (require ES2019)
        sortedBones.sort((a, b) => {
            return a.transformOrder - b.transformOrder;
        });

        const morphs = mmdMetadata.morphs;
        let morphCount = 0;
        for (let i = 0; i < morphs.length; ++i) {
            const morph = morphs[i];

            switch (morph.type) {
            case PmxObject.Morph.Type.BoneMorph:
            case PmxObject.Morph.Type.GroupMorph:
                morphCount += 1;
                break;
            }
        }
        const morphWeights = wasmInstance.createTypedArray(Float32Array, morphWeightsPtr, morphCount);

        const morphTargetManagers: MorphTargetManager[] = [];
        {
            const meshes = mmdMetadata.meshes;
            for (let i = 0; i < meshes.length; ++i) {
                const morphTargetManager = meshes[i].morphTargetManager;
                if (morphTargetManager !== null) morphTargetManagers.push(morphTargetManager);
            }
        }

        this.morph = new MmdWasmMorphController(
            morphWeights,
            wasmMorphIndexMap,
            mmdMetadata.materials,
            mmdMetadata.meshes,
            materialProxyConstructor,
            mmdMetadata.morphs,
            morphTargetManagers
        );

        if (physicsParams !== null) {
            wasmRuntimeInternal.useExternalPhysics(ptr, mmdMetadata.rigidBodies.length);
            const newRigidBodyStatesPtr = wasmRuntimeInternal.getAnimationRigidBodyStateArena(ptr);
            this._rigidBodyStates = wasmInstance.createTypedArray(Uint8Array, newRigidBodyStatesPtr, mmdMetadata.rigidBodies.length);

            this._physicsModel = physicsParams.physicsImpl.buildPhysics(
                mmdSkinnedMesh,
                runtimeBones,
                mmdMetadata.rigidBodies,
                mmdMetadata.joints,
                wasmRuntime,
                physicsParams.physicsOptions
            );
        } else {
            this._physicsModel = null;
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
        animation: IMmdBindableModelAnimation | MmdWasmAnimation,
        retargetingMap?: { [key: string]: string }
    ): MmdRuntimeAnimationHandle {
        const handle = CreateMmdRuntimeAnimationHandle();
        let runtimeAnimation: RuntimeModelAnimation;
        if ((animation as MmdWasmAnimation).createWasmRuntimeModelAnimation !== undefined) {
            this._runtime.lock.wait();
            runtimeAnimation = (animation as MmdWasmAnimation).createWasmRuntimeModelAnimation(this, () => {
                this._destroyRuntimeAnimation(handle, true);
            }, retargetingMap, this._runtime);
        } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation !== undefined) {
            runtimeAnimation = animation.createRuntimeModelAnimation(this, retargetingMap, this._runtime);
            if ((animation as MmdWasmAnimation).ptr !== undefined) {
                this._runtime.warn("MmdWasmAnimation has better performance in the wasm animation runtime. consider importing \"babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation\" instead of \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation\"");
            }
        } else {
            throw new Error("animation is not MmdWasmAnimation or MmdAnimation or MmdModelAnimationContainer or MmdCompositeAnimation. are you missing import \"babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationContainer\" or \"babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeModelAnimation\"?");
        }

        this._animationHandleMap.set(handle, runtimeAnimation);
        return handle;
    }

    /**
     * Destroy a runtime animation by its handle
     * @param handle The handle of the runtime animation to destroy
     * @returns True if the animation was destroyed, false if it was not found
     */
    public destroyRuntimeAnimation(handle: MmdRuntimeAnimationHandle): boolean {
        return this._destroyRuntimeAnimation(handle, false);
    }

    public _destroyRuntimeAnimation(handle: MmdRuntimeAnimationHandle, fromDisposeEvent: boolean): boolean {
        const animation = this._animationHandleMap.get(handle);
        if (animation === undefined) return false;

        if (this._currentAnimation === animation) {
            this._resetPose();
            if ((this._currentAnimation as MmdWasmRuntimeModelAnimation).wasmAnimate !== undefined) {
                this._runtime.lock.wait(); // ensure that the runtime is not evaluating animations
                this._runtime.wasmInternal.setRuntimeAnimation(this.ptr, 0);
            }
            this._currentAnimation = null;
            if (animation.animation.endFrame !== 0) {
                this.onAnimationDurationChangedObservable.notifyObservers(0);
            }
        }

        this._animationHandleMap.delete(handle);
        if (!fromDisposeEvent) {
            (animation as IMmdRuntimeModelAnimation).dispose?.();
        }
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
                this._resetPose();
                if ((this._currentAnimation as MmdWasmRuntimeModelAnimation).wasmAnimate !== undefined) {
                    this._runtime.lock.wait(); // ensure that the runtime is not evaluating animations
                    this._runtime.wasmInternal.setRuntimeAnimation(this.ptr, 0);
                }
                this._currentAnimation = null;
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
        if ((animation as MmdWasmRuntimeModelAnimation).wasmAnimate !== undefined) {
            this._runtime.lock.wait(); // ensure that the runtime is not evaluating animations
            this._runtime.wasmInternal.setRuntimeAnimation(this.ptr, (animation as MmdWasmRuntimeModelAnimation).ptr);
        }
        animation.induceMaterialRecompile(updateMorphTarget, this._runtime);
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
     * Before the "physics stage" and before the "wasm before solver" stage
     *
     * This method must be called before the physics stage
     *
     * If frameTime is null, animations are not updated
     * @param frameTime The time elapsed since the last frame in 30fps
     */
    public beforePhysicsAndWasm(frameTime: Nullable<number>): void {
        if (frameTime !== null) {
            if (this._needStateReset) {
                this._needStateReset = false;

                this.ikSolverStates.fill(1);
                this.morph.resetMorphWeights();
            }

            if (this._currentAnimation !== null) {
                this._currentAnimation.animate(frameTime);
            }
        }

        this.morph.update();

        if ((this._currentAnimation as MmdWasmRuntimeModelAnimation)?.wasmAnimate === undefined) {
            const bones = this.skeleton.bones;
            const boneAnimationStates = this.boneAnimationStates;
            for (let i = 0; i < bones.length; ++i) {
                const bone = bones[i];
                const boneAnimationStateIndex = i * 12;
                {
                    const { x, y, z } = bone.position;
                    boneAnimationStates[boneAnimationStateIndex + 0] = x;
                    boneAnimationStates[boneAnimationStateIndex + 1] = y;
                    boneAnimationStates[boneAnimationStateIndex + 2] = z;
                }
                {
                    const { x, y, z, w } = bone.rotationQuaternion;
                    boneAnimationStates[boneAnimationStateIndex + 4] = x;
                    boneAnimationStates[boneAnimationStateIndex + 5] = y;
                    boneAnimationStates[boneAnimationStateIndex + 6] = z;
                    boneAnimationStates[boneAnimationStateIndex + 7] = w;
                }
                {
                    const { x, y, z } = bone.scaling;
                    boneAnimationStates[boneAnimationStateIndex + 8] = x;
                    boneAnimationStates[boneAnimationStateIndex + 9] = y;
                    boneAnimationStates[boneAnimationStateIndex + 10] = z;
                }
            }
        }

        this._physicsModel?.commitBodyStates(this._rigidBodyStates.array);
    }

    /**
     * Before the "physics stage" and after the "wasm before solver" stage
     */
    public beforePhysics(): void {
        this._physicsModel?.syncBodies();
    }

    /**
     * After the "physics stage" and before the "wasm after solver" stage
     */
    public afterPhysicsAndWasm(): void {
        const physicsModel = this._physicsModel;
        if (physicsModel !== null) {
            physicsModel.syncBones();
        }
    }

    /**
     * After the "physics stage" and after the "wasm after solver" stage
     *
     * mmd solvers are run by wasm runtime
     *
     * This method must be called after the physics stage
     */
    public afterPhysics(): void {
        this.mesh.metadata.skeleton._markAsDirty();
    }

    private _buildRuntimeSkeleton(
        bones: IMmdRuntimeLinkedBone[],
        bonesMetadata: readonly MmdModelMetadata.Bone[],
        rigidBodiesMetadata: MmdModelMetadata["rigidBodies"],
        worldTransformMatrices: WasmBufferedArray<Float32Array>,
        buildRigidBodyIndices: boolean,
        runtime: MmdWasmRuntime
    ): readonly MmdWasmRuntimeBone[] {
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

        const runtimeBones: MmdWasmRuntimeBone[] = [];

        let ikSolverCount = 0;
        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];
            const rigidBodyIndices = boneToRigidBodiesIndexMap[i];

            let ikSolverIndex = -1;
            if (boneMetadata.ik !== undefined) {
                ikSolverIndex = ikSolverCount;
                ikSolverCount += 1;
            }

            runtimeBones.push(
                new MmdWasmRuntimeBone(
                    bones[i],
                    boneMetadata,
                    worldTransformMatrices,
                    i,
                    rigidBodyIndices,
                    ikSolverIndex,
                    runtime
                )
            );
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
        }

        return runtimeBones;
    }

    private _originalComputeTransformMatrices: Nullable<(targetMatrix: Float32Array, initialSkinMatrix: Nullable<Matrix>) => void> = null;

    private _disableSkeletonWorldMatrixUpdate(skeleton: IMmdLinkedBoneContainer): void {
        if (this._originalComputeTransformMatrices !== null) return;
        this._originalComputeTransformMatrices = (skeleton as any)._computeTransformMatrices;

        const worldTransformMatrices = this._worldTransformMatrices;

        (skeleton as any)._computeTransformMatrices = function(targetMatrix: Float32Array, _initialSkinMatrix: Nullable<Matrix>): void {
            this.onBeforeComputeObservable.notifyObservers(this);

            const worldTransformMatricesFrontBuffer = worldTransformMatrices.frontBuffer;

            for (let index = 0; index < this.bones.length; index++) {
                const bone = this.bones[index] as Bone;
                bone._childUpdateId += 1;

                if (bone._index !== -1) {
                    const mappedIndex = bone._index === null ? index : bone._index;
                    bone.getAbsoluteInverseBindMatrix().multiplyToArray(
                        Matrix.FromArrayToRef(worldTransformMatricesFrontBuffer, index * 16, bone.getFinalMatrix()),
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
        const position = new Vector3();
        if ((this._currentAnimation as MmdWasmRuntimeModelAnimation)?.wasmAnimate === undefined) {
            const sortedBones = this._sortedRuntimeBones;
            const identityRotation = Quaternion.Identity();

            for (let i = 0; i < sortedBones.length; ++i) {
                const bone = sortedBones[i].linkedBone;
                bone.getRestMatrix().getTranslationToRef(position);

                bone.position = position;
                bone.setRotationQuaternion(identityRotation, Space.LOCAL);
            }
        } else {
            this._runtime.lock.wait(); // ensure that the runtime is not evaluating animations

            const bones = this.skeleton.bones;
            const boneAnimationStates = this.boneAnimationStates;
            for (let i = 0; i < bones.length; ++i) {
                const bone = bones[i];
                const boneAnimationStateIndex = i * 12;
                const { x, y, z } = bone.getRestMatrix().getTranslationToRef(position);
                boneAnimationStates[boneAnimationStateIndex + 0] = x;
                boneAnimationStates[boneAnimationStateIndex + 1] = y;
                boneAnimationStates[boneAnimationStateIndex + 2] = z;

                // rotation
                boneAnimationStates[boneAnimationStateIndex + 4] = 0;
                boneAnimationStates[boneAnimationStateIndex + 5] = 0;
                boneAnimationStates[boneAnimationStateIndex + 6] = 0;
                boneAnimationStates[boneAnimationStateIndex + 7] = 1;

                // scale
                boneAnimationStates[boneAnimationStateIndex + 8] = 1;
                boneAnimationStates[boneAnimationStateIndex + 9] = 1;
                boneAnimationStates[boneAnimationStateIndex + 10] = 1;
            }
        }

        this.mesh.metadata.skeleton._markAsDirty();
    }

    /**
     * @internal
     * @param evaluationType New evaluation type
     */
    public onEvaluationTypeChanged(evaluationType: MmdWasmRuntimeAnimationEvaluationType): void {
        if (evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered) {
            const worldTransformMatrices = this._worldTransformMatrices;
            if (worldTransformMatrices.frontBuffer === worldTransformMatrices.backBuffer) {
                const wasmInstance = this._runtime.wasmInstance;
                const wasmRuntimeInternal = this._runtime.wasmInternal;

                const worldTransformMatricesBackBufferPtr = wasmRuntimeInternal.createBoneWorldMatrixBackBuffer(this.ptr);
                const worldTransformMatricesBackBuffer = wasmInstance.createTypedArray(Float32Array, worldTransformMatricesBackBufferPtr, worldTransformMatrices.frontBuffer.length);
                worldTransformMatrices.setBackBuffer(worldTransformMatricesBackBuffer);

                const bones = this._sortedRuntimeBones;
                for (let i = 0; i < bones.length; ++i) {
                    bones[i].updateBackBufferReference(wasmInstance);
                }
            }
        }
    }

    /**
     * @internal
     * swap the front and back buffer of the world transform matrices
     */
    public swapWorldTransformMatricesBuffer(): void {
        this._worldTransformMatrices.swap();
    }
}
