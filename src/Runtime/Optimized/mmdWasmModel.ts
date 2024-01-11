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
import type { MmdRuntimeModelAnimationGroup } from "../Animation/mmdRuntimeModelAnimationGroup";
import type { IMmdMaterialProxyConstructor } from "../IMmdMaterialProxy";
import type { IMmdModel } from "../IMmdModel";
import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import type { IMmdLinkedBoneContainer, IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { MmdSkinnedMesh, RuntimeMmdMesh } from "../mmdMesh";
import type { MmdPhysics, MmdPhysicsModel } from "../mmdPhysics";
import type { MmdWasmAnimation } from "./Animation/mmdWasmAnimation";
import type { MmdWasmRuntimeModelAnimation } from "./Animation/mmdWasmRuntimeModelAnimation";
import type { MmdWasmInstance } from "./mmdWasmInstance";
import { MmdWasmMorphController } from "./mmdWasmMorphController";
import type { MmdWasmRuntime } from "./mmdWasmRuntime";
import { MmdWasmRuntimeAnimationEvaluationType } from "./mmdWasmRuntime";
import { MmdWasmRuntimeBone } from "./mmdWasmRuntimeBone";
import type { MmdRuntime as MmdWasmRuntimeInternal } from "./wasm";
import { WasmBufferedArray } from "./wasmBufferedArray";
import type { WasmTypedArray } from "./wasmTypedArray";

type RuntimeModelAnimation = MmdWasmRuntimeModelAnimation | MmdRuntimeModelAnimation | MmdRuntimeModelAnimationGroup | MmdCompositeRuntimeModelAnimation | IMmdRuntimeModelAnimation;

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
    public readonly mesh: RuntimeMmdMesh;

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
        return this._worldTransformMatrices.frontBuffer;
    }

    private readonly _boneAnimationStates: WasmTypedArray<Float32Array>;

    /**
     * Wasm side bone animation states. this value is automatically synchronized with `MmdWasmModel.skeleton` on `MmdWasmModel.beforePhysics()` stage
     *
     * repr: [..., positionX, positionY, positionZ, padding, rotationX, rotationY, rotationZ, rotationW, scaleX, scaleY, scaleZ, padding, ...]
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get boneAnimationStates(): Float32Array {
        return this._boneAnimationStates.array;
    }

    private readonly _ikSolverStates: WasmTypedArray<Uint8Array>;

    /**
     * Uint8Array that stores the state of IK solvers
     *
     * If `ikSolverState[MmdModel.runtimeBones[i].ikSolverIndex]` is 0, IK solver of `MmdModel.runtimeBones[i]` is disabled and vice versa
     *
     * This array reference should not be copied elsewhere and must be read and written with minimal scope
     */
    public get ikSolverStates(): Uint8Array {
        return this._ikSolverStates.array;
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

    private readonly _physicsModel: Nullable<MmdPhysicsModel>;

    private readonly _runtime: MmdWasmRuntime;

    private readonly _sortedRuntimeBones: readonly MmdWasmRuntimeBone[];

    public readonly onCurrentAnimationChangedObservable: Observable<Nullable<RuntimeModelAnimation>>;
    private readonly _animations: RuntimeModelAnimation[];
    private readonly _animationIndexMap: Map<string, number>;

    private _currentAnimation: Nullable<RuntimeModelAnimation>;

    /**
     * Create a MmdWasmModel
     * @param wasmRuntime MMD WASM runtime
     * @param ptr Pointer to wasm side MmdModel
     * @param mmdSkinnedMesh Mesh that able to instantiate `MmdWasmModel`
     * @param skeleton The virtualized bone container of the mesh
     * @param materialProxyConstructor The constructor of `IMmdMaterialProxy`
     * @param wasmMorphIndexMap Mmd morph to WASM morph index map
     * @param externalPhysics The external physics engine
     */
    public constructor(
        wasmRuntime: MmdWasmRuntime,
        ptr: number,
        mmdSkinnedMesh: MmdSkinnedMesh,
        skeleton: IMmdLinkedBoneContainer,
        materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<Material>>,
        wasmMorphIndexMap: Int32Array,
        externalPhysics: Nullable<MmdPhysics>
    ) {
        const wasmInstance = wasmRuntime.wasmInstance;
        const wasmRuntimeInternal = wasmRuntime.wasmInternal;

        this._runtime = wasmRuntime;

        const mmdMetadata = mmdSkinnedMesh.metadata;

        const runtimeModelNode = mmdSkinnedMesh as unknown as RuntimeMmdMesh;
        runtimeModelNode.metadata = {
            isRuntimeMmdModel: true,
            header: mmdMetadata.header,
            meshes: mmdMetadata.meshes,
            materials: mmdMetadata.materials,
            skeleton: mmdMetadata.skeleton
        };
        this.ptr = ptr;
        this.mesh = runtimeModelNode;
        this.skeleton = skeleton;

        const worldTransformMatricesPtr = wasmRuntimeInternal.getBoneWorldMatrixArena(ptr);
        const boneAnimationStatesPtr = wasmRuntimeInternal.getAnimationArena(ptr);
        const ikSolverStatesPtr = wasmRuntimeInternal.getAnimationIkSolverStateArena(ptr);
        const morphWeightsPtr = wasmRuntimeInternal.getAnimationMorphArena(ptr);

        const worldTransformMatricesFrontBuffer = wasmInstance.createTypedArray(Float32Array, worldTransformMatricesPtr, mmdMetadata.bones.length * 16);
        const worldTransformMatrices = this._worldTransformMatrices = new WasmBufferedArray(worldTransformMatricesFrontBuffer);
        this._boneAnimationStates = wasmInstance.createTypedArray(Float32Array, boneAnimationStatesPtr, mmdMetadata.bones.length * 12);

        let ikCount = 0;
        for (let i = 0; i < mmdMetadata.bones.length; ++i) if (mmdMetadata.bones[i].ik) ikCount += 1;
        this._ikSolverStates = wasmInstance.createTypedArray(Uint8Array, ikSolverStatesPtr, ikCount);

        // If you are not using MMD Runtime, you need to update the world matrix once. it could be waste of performance
        skeleton.prepare();

        this._disableSkeletonWorldMatrixUpdate(skeleton);

        const runtimeBones = this.runtimeBones = this._buildRuntimeSkeleton(
            skeleton.bones,
            mmdMetadata.bones,
            worldTransformMatrices,
            wasmInstance,
            wasmRuntimeInternal,
            ptr
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
            materialProxyConstructor,
            mmdMetadata.morphs,
            morphTargetManagers,
            wasmRuntime
        );

        if (externalPhysics !== null) {
            this.beforePhysicsAndWasm(null); // for apply bone morph
            wasmRuntimeInternal.updataBoneLocalMatrices(ptr);
            for (let i = 0; i < sortedBones.length; ++i) {
                if (sortedBones[i].parentBone === null) sortedBones[i].updateWorldMatrix();
            }
            this._physicsModel = externalPhysics.buildPhysics(
                mmdSkinnedMesh,
                runtimeBones,
                mmdMetadata.rigidBodies,
                mmdMetadata.joints,
                wasmRuntime
            );
        } else {
            this._physicsModel = null;
        }

        this.onCurrentAnimationChangedObservable = new Observable<Nullable<RuntimeModelAnimation>>();
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
        this.onCurrentAnimationChangedObservable.clear();
        (this.mesh as any).metadata = null;

        const animations = this._animations;
        for (let i = 0; i < animations.length; ++i) {
            (animations[i] as IMmdRuntimeModelAnimation).dispose?.();
        }
        this._animations.length = 0;
        this._animationIndexMap.clear();
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
        animation: IMmdBindableModelAnimation | MmdWasmAnimation,
        retargetingMap?: { [key: string]: string }
    ): void {
        let runtimeAnimation: RuntimeModelAnimation;
        if ((animation as MmdWasmAnimation).createWasmRuntimeModelAnimation !== undefined) {
            runtimeAnimation = (animation as MmdWasmAnimation).createWasmRuntimeModelAnimation(this, () => {
                this._removeAnimationByReference(runtimeAnimation);
            }, retargetingMap, this._runtime);
        } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation !== undefined) {
            runtimeAnimation = animation.createRuntimeModelAnimation(this, retargetingMap, this._runtime);
            if ((animation as MmdWasmAnimation).ptr !== undefined) {
                this._runtime.warn("MmdWasmAnimation has better performance in the wasm animation runtime. consider importing \"babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation\" instead of \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation\"");
            }
        } else {
            throw new Error("animation is not MmdWasmAnimation or MmdAnimation or MmdModelAnimationGroup or MmdCompositeAnimation. are you missing import \"babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationGroup\" or \"babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeModelAnimation\"?");
        }
        this._animationIndexMap.set(animation.name, this._animations.length);
        this._animations.push(runtimeAnimation);
    }

    private _removeAnimationByReference(animation: RuntimeModelAnimation): void {
        const index = this._animations.indexOf(animation);
        if (index === -1) return;
        this.removeAnimation(index);
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

        if (this._currentAnimation !== null) this._resetPose();
        const animation = this._currentAnimation = this._animations[index];
        animation.induceMaterialRecompile(this._runtime);
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
        this.ikSolverStates.fill(1);
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
            const currentAnimation = this._currentAnimation;
            if (currentAnimation !== null) {
                if ((currentAnimation as MmdWasmRuntimeModelAnimation).wasmAnimate !== undefined) {
                    (currentAnimation as MmdWasmRuntimeModelAnimation).wasmAnimate(frameTime);
                    (currentAnimation as MmdWasmRuntimeModelAnimation).lateAnimate(frameTime);
                } else {
                    (currentAnimation as IMmdRuntimeModelAnimation).animate(frameTime);
                }
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
        worldTransformMatrices: WasmBufferedArray<Float32Array>,
        wasmInstance: MmdWasmInstance,
        wasmRuntimeInternal: MmdWasmRuntimeInternal,
        mmdModelPtr: number
    ): readonly MmdWasmRuntimeBone[] {
        const runtimeBones: MmdWasmRuntimeBone[] = [];

        let ikSolverCount = 0;
        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];

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
                    ikSolverIndex,
                    wasmInstance,
                    wasmRuntimeInternal,
                    mmdModelPtr
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
}
