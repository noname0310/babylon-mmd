import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Nullable } from "@babylonjs/core/types";

import { InduceMmdStandardMaterialRecompile, SetMorphTargetManagersNumMaxInfluencers } from "@/Runtime/Animation/Common/induceMmdStandardMaterialRecompile";
import type { BodyIndices, MorphIndices } from "@/Runtime/Animation/IMmdRuntimeAnimation";
import { MmdRuntimeAnimation } from "@/Runtime/Animation/mmdRuntimeAnimation";
import type { ILogger } from "@/Runtime/ILogger";
import type { IMmdRuntimeLinkedBone } from "@/Runtime/IMmdRuntimeLinkedBone";
import type { MmdMorphControllerBase } from "@/Runtime/mmdMorphControllerBase";

import type { IWasmTypedArray } from "../Misc/IWasmTypedArray";
import type { MmdWasmModel } from "../mmdWasmModel";
import type { MmdWasmMorphController } from "../mmdWasmMorphController";
import { MmdWasmAnimation } from "./mmdWasmAnimation";

/**
 * Mmd WASM runtime model animation
 *
 * An object with mmd animation and model binding information
 */
export class MmdWasmRuntimeModelAnimation extends MmdRuntimeAnimation<MmdWasmAnimation> {
    /**
     * Pointer to the animation data in wasm memory
     */
    public readonly ptr: number;

    private readonly _modelPtr: number;

    private _onDispose: Nullable<() => void>;

    /**
     * The animation data
     */
    public readonly animation: MmdWasmAnimation;

    private readonly _boneBindIndexMap: IWasmTypedArray<Int32Array>;

    /**
     * Bone bind index map
     */
    public get boneBindIndexMap(): Int32Array {
        return this._boneBindIndexMap.array;
    }

    private readonly _movableBoneBindIndexMap: IWasmTypedArray<Int32Array>;

    /**
     * Movable bone bind index map
     */
    public get movableBoneBindIndexMap(): Int32Array {
        return this._movableBoneBindIndexMap.array;
    }

    private readonly _morphController: MmdWasmMorphController;

    /**
     * Morph bind index map
     */
    public readonly morphBindIndexMap: readonly Nullable<MorphIndices>[];

    private readonly _meshes: readonly Mesh[];

    private readonly _ikSolverBindIndexMap: IWasmTypedArray<Int32Array>;

    /**
     * IK solver bind index map
     */
    public get ikSolverBindIndexMap(): Int32Array {
        return this._ikSolverBindIndexMap.array;
    }

    private _materialRecompileInduceInfo: readonly Material[] | null;

    private constructor(
        ptr: number,
        modelPtr: number,
        animation: MmdWasmAnimation,
        boneBindIndexMap: IWasmTypedArray<Int32Array>,
        movableBoneBindIndexMap: IWasmTypedArray<Int32Array>,
        morphController: MmdWasmMorphController,
        morphBindIndexMap: readonly Nullable<MorphIndices>[],
        meshes: readonly Mesh[],
        ikSolverBindIndexMap: IWasmTypedArray<Int32Array>,
        materialRecompileInduceInfo: readonly Material[],
        onDispose: () => void
    ) {
        super();

        this.ptr = ptr;
        this._modelPtr = modelPtr;
        this._onDispose = onDispose;
        this.animation = animation;

        this._boneBindIndexMap = boneBindIndexMap;
        this._movableBoneBindIndexMap = movableBoneBindIndexMap;
        this._morphController = morphController;
        this.morphBindIndexMap = morphBindIndexMap;
        this._meshes = meshes;
        this._ikSolverBindIndexMap = ikSolverBindIndexMap;

        this._materialRecompileInduceInfo = materialRecompileInduceInfo;
    }

    /**
     * Dispose this instance
     * @param fromAnimation Dispose from animation (default: false) (internal use only)
     */
    public dispose(fromAnimation = false): void {
        if (this._onDispose === null) return;

        if (!fromAnimation) {
            const runtimeModelAnimations = this.animation._runtimeModelAnimations;
            if (runtimeModelAnimations !== undefined) {
                const index = runtimeModelAnimations.indexOf(this);
                if (index !== -1) runtimeModelAnimations.splice(index, 1);
            }
        }

        this._onDispose();
        this._onDispose = null;

        const animationPool = this.animation._poolWrapper.pool;
        animationPool.destroyRuntimeAnimation(this.ptr);

    }

    /**
     * Run wasm side animation evaluation
     *
     * Update bone / bone morphs / ik solver state
     *
     * IMPORTANT: when wasm runtime using buffered evaluation, this method must be called before waiting for the WasmMmdRuntime.lock
     * otherwise, it can cause a datarace
     * @param frameTime Frame time in 30fps
     */
    public wasmAnimate(frameTime: number): void {
        this.animation._poolWrapper.pool.animateMmdModel(this.ptr, this._modelPtr, frameTime);
    }

    /**
     * Update vertex / uv morphs and visibility
     * @param frameTime Frame time in 30fps
     */
    public animate(frameTime: number): void {
        const animation = this.animation;

        const morphTracks = animation.morphTracks;
        if (0 < morphTracks.length) {
            const morphController = this._morphController;
            const morphBindIndexMap = this.morphBindIndexMap;
            for (let i = 0; i < morphTracks.length; ++i) {
                const morphIndices = morphBindIndexMap[i];
                if (morphIndices === null) continue;

                const morphTrack = morphTracks[i];
                if (morphTrack.frameNumbers.length === 0) {
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], 0);
                    }
                    continue;
                }

                const clampedFrameTime = Math.max(morphTrack.startFrame, Math.min(morphTrack.endFrame, frameTime));
                const upperBoundIndex = this._upperBoundFrameIndex(clampedFrameTime, morphTrack);
                const upperBoundIndexMinusOne = upperBoundIndex - 1;

                const frameNumberB = morphTrack.frameNumbers[upperBoundIndex];
                if (frameNumberB === undefined) {
                    const weight = morphTrack.weights[upperBoundIndexMinusOne];
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], weight, false);
                    }
                } else {
                    const frameNumberA = morphTrack.frameNumbers[upperBoundIndexMinusOne];
                    const relativeTime = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const weightA = morphTrack.weights[upperBoundIndexMinusOne];
                    const weightB = morphTrack.weights[upperBoundIndex];

                    const weight = weightA + (weightB - weightA) * relativeTime;
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], weight, false);
                    }
                }
            }
        }

        if (0 < animation.propertyTrack.frameNumbers.length) {
            const propertyTrack = animation.propertyTrack;

            const clampedFrameTime = Math.max(propertyTrack.startFrame, Math.min(propertyTrack.endFrame, frameTime));
            const stepIndex = this._upperBoundFrameIndex(clampedFrameTime, propertyTrack) - 1;

            const visibility = propertyTrack.visibles[stepIndex];
            const meshes = this._meshes;
            for (let i = 0; i < meshes.length; ++i) {
                meshes[i].visibility = visibility;
            }
        }
    }

    /**
     * Induce material recompile
     *
     * This method must run once before the animation runs
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     * @param updateMorphTarget Whether to update morph target manager numMaxInfluencers
     * @param logger logger
     */
    public induceMaterialRecompile(updateMorphTarget: boolean, logger?: ILogger): void {
        if (this._materialRecompileInduceInfo === null) return;

        MmdWasmRuntimeModelAnimation.InduceMaterialRecompile(
            this._materialRecompileInduceInfo,
            this._morphController,
            this.morphBindIndexMap,
            logger
        );
        if (updateMorphTarget) {
            SetMorphTargetManagersNumMaxInfluencers(this._morphController, this.morphBindIndexMap);
        }
        this._materialRecompileInduceInfo = null;
    }

    /**
     * @internal
     * Bind animation to model and prepare material for morph animation
     * @param animation Animation to bind
     * @param model Bind target
     * @param onDispose Callback when this instance is disposed
     * @param retargetingMap Animation bone name to model bone name map
     * @param logger Logger
     * @return MmdRuntimeModelAnimation instance
     */
    public static Create(animation: MmdWasmAnimation, model: MmdWasmModel, onDispose: () => void, retargetingMap?: { [key: string]: string }, logger?: ILogger): MmdWasmRuntimeModelAnimation {
        const wasmInstance = animation._poolWrapper.instance;
        const animationPool = animation._poolWrapper.pool;

        const skeleton = model.skeleton;
        const runtimeBoneIndexMap = new Map<string, number>();
        {
            const bones = skeleton.bones;
            const linkedBoneMap = new Map<string, IMmdRuntimeLinkedBone>();
            if (retargetingMap === undefined) {
                for (let i = 0; i < bones.length; ++i) {
                    const linkedBone = bones[i];
                    linkedBoneMap.set(linkedBone.name, linkedBone);
                }
            } else {
                for (let i = 0; i < bones.length; ++i) {
                    const linkedBone = bones[i];
                    linkedBoneMap.set(retargetingMap[linkedBone.name] ?? linkedBone.name, linkedBone);
                }
            }

            const runtimeBones = model.runtimeBones;
            const linkedBoneToRuntimeBoneIndexMap = new Map<IMmdRuntimeLinkedBone, number>();
            for (let i = 0; i < runtimeBones.length; ++i) {
                linkedBoneToRuntimeBoneIndexMap.set(runtimeBones[i].linkedBone, i);
            }
            for (const [name, linkedBone] of linkedBoneMap) {
                const runtimeBoneIndex = linkedBoneToRuntimeBoneIndexMap.get(linkedBone);
                if (runtimeBoneIndex === undefined) {
                    logger?.warn(`Binding warning: bone ${name} not found in runtime bones`);
                    continue;
                }
                runtimeBoneIndexMap.set(name, runtimeBoneIndex);
            }
        }

        const boneBindIndexMapPtr = animationPool.createBoneBindIndexMap(animation.ptr);
        const boneBindIndexMap = wasmInstance.createTypedArray(Int32Array, boneBindIndexMapPtr, animation.boneTracks.length);
        {
            const boneTracks = animation.boneTracks;
            const boneBindIndexMapArray = boneBindIndexMap.array;
            for (let i = 0; i < boneTracks.length; ++i) {
                const boneTrack = boneTracks[i];
                const boneIndex = runtimeBoneIndexMap.get(boneTrack.name);
                if (boneIndex === undefined) {
                    logger?.warn(`Binding failed: bone ${boneTrack.name} not found`);
                    boneBindIndexMapArray[i] = -1;
                } else {
                    boneBindIndexMapArray[i] = boneIndex;
                }
            }
        }

        const movableBoneBindIndexMapPtr = animationPool.createMovableBoneBindIndexMap(animation.ptr);
        const movableBoneBindIndexMap = wasmInstance.createTypedArray(Int32Array, movableBoneBindIndexMapPtr, animation.movableBoneTracks.length);
        {
            const movableBoneBindIndexMapArray = movableBoneBindIndexMap.array;
            const movableBoneTracks = animation.movableBoneTracks;
            for (let i = 0; i < movableBoneTracks.length; ++i) {
                const movableBoneTrack = movableBoneTracks[i];
                const boneIndex = runtimeBoneIndexMap.get(movableBoneTrack.name);
                if (boneIndex === undefined) {
                    logger?.warn(`Binding failed: bone ${movableBoneTrack.name} not found`);
                    movableBoneBindIndexMapArray[i] = -1;
                } else {
                    movableBoneBindIndexMapArray[i] = boneIndex;
                }
            }
        }

        const morphController = model.morph;
        const morphBindIndexMap: Nullable<MorphIndices>[] = new Array(animation.morphTracks.length);
        const morphTracks = animation.morphTracks;
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            const mappedName = retargetingMap?.[morphTrack.name] ?? morphTrack.name;
            const morphIndices = morphController.getMorphIndices(mappedName);
            if (morphIndices === undefined) {
                logger?.warn(`Binding failed: morph ${mappedName} not found`);
                morphBindIndexMap[i] = null;
            } else {
                morphBindIndexMap[i] = morphIndices;
            }
        }

        const morphLengthBufferPtr = animationPool.allocateLengthsBuffer(morphTracks.length);
        const morphLengthBuffer = wasmInstance.createTypedArray(Uint32Array, morphLengthBufferPtr, morphTracks.length);
        {
            const morphLengthBufferArray = morphLengthBuffer.array;
            const wasmMorphIndexMap = morphController.wasmMorphIndexMap;
            for (let i = 0; i < morphTracks.length; ++i) {
                let indicesCount = 0;
                const morphIndices = morphBindIndexMap[i];
                if (morphIndices !== null) {
                    for (let j = 0; j < morphIndices.length; ++j) {
                        const remappedIndex = wasmMorphIndexMap[morphIndices[j]];
                        if (remappedIndex !== undefined && remappedIndex !== -1) indicesCount += 1;
                    }
                }
                morphLengthBufferArray[i] = indicesCount;
            }
        }
        const morphBindIndexMapPtr = animationPool.createMorphBindIndexMap(animation.ptr, morphLengthBufferPtr);
        {
            const wasmMorphIndexMap = morphController.wasmMorphIndexMap;
            for (let i = 0; i < morphTracks.length; ++i) {
                const nthMorphIndicesPtr = animationPool.getNthMorphBindIndexMap(morphBindIndexMapPtr, i);
                const nthMorphIndices = wasmInstance.createTypedArray(Int32Array, nthMorphIndicesPtr, morphLengthBuffer.array[i]).array;

                let indicesCount = 0;
                const morphIndices = morphBindIndexMap[i];
                if (morphIndices !== null) {
                    for (let j = 0; j < morphIndices.length; ++j) {
                        const remappedIndex = wasmMorphIndexMap[morphIndices[j]];
                        if (remappedIndex !== undefined && remappedIndex !== -1) {
                            nthMorphIndices[indicesCount] = remappedIndex;
                            indicesCount += 1;
                        }
                    }
                }
            }
        }
        animationPool.deallocateLengthsBuffer(morphLengthBufferPtr, morphTracks.length);

        const ikSolverBindIndexMapPtr = animationPool.createIkSolverBindIndexMap(animation.ptr);
        const ikSolverBindIndexMap = wasmInstance.createTypedArray(Int32Array, ikSolverBindIndexMapPtr, animation.propertyTrack.ikBoneNames.length);
        {
            const ikSolverBindIndexMapArray = ikSolverBindIndexMap.array;
            const runtimeBones = model.runtimeBones;
            const propertyTrackIkBoneNames = animation.propertyTrack.ikBoneNames;
            for (let i = 0; i < propertyTrackIkBoneNames.length; ++i) {
                const ikBoneName = propertyTrackIkBoneNames[i];
                const ikBoneIndex = runtimeBoneIndexMap.get(ikBoneName);
                if (ikBoneIndex === undefined) {
                    logger?.warn(`Binding failed: IK bone ${ikBoneName} not found`);
                    ikSolverBindIndexMapArray[i] = -1;
                } else {
                    const ikSolverIndex = runtimeBones[ikBoneIndex].ikSolverIndex;
                    if (ikSolverIndex === -1) {
                        logger?.warn(`Binding failed: IK solver for bone ${ikBoneName} not found`);
                        ikSolverBindIndexMapArray[i] = -1;
                    } else {
                        ikSolverBindIndexMapArray[i] = ikSolverIndex;
                    }
                }
            }
        }

        const boneToBodyBindIndexMap: Nullable<BodyIndices>[] = new Array(animation.boneTracks.length + animation.movableBoneTracks.length);
        {
            const runtimeBones = model.runtimeBones;
            {
                const boneTracks = animation.boneTracks;
                for (let i = 0; i < boneTracks.length; ++i) {
                    const boneTrack = boneTracks[i];
                    const runtimeBoneIndex = runtimeBoneIndexMap.get(boneTrack.name);
                    if (runtimeBoneIndex === undefined) {
                        logger?.warn(`Binding failed: runtime bone ${boneTrack.name} not found`);
                        boneToBodyBindIndexMap[i] = null;
                    } else {
                        boneToBodyBindIndexMap[i] = runtimeBones[runtimeBoneIndex].rigidBodyIndices;
                    }
                }
            }
            {
                const movableBoneTracks = animation.movableBoneTracks;
                const offset = animation.boneTracks.length;
                for (let i = 0; i < movableBoneTracks.length; ++i) {
                    const movableBoneTrack = movableBoneTracks[i];
                    const runtimeBoneIndex = runtimeBoneIndexMap.get(movableBoneTrack.name);
                    if (runtimeBoneIndex === undefined) {
                        logger?.warn(`Binding failed: runtime bone ${movableBoneTrack.name} not found`);
                        boneToBodyBindIndexMap[i + offset] = null;
                    } else {
                        boneToBodyBindIndexMap[i + offset] = runtimeBones[runtimeBoneIndex].rigidBodyIndices;
                    }
                }
            }
        }
        const bodyLengthBufferPtr = animationPool.allocateLengthsBuffer(boneToBodyBindIndexMap.length);
        const bodyLengthBuffer = wasmInstance.createTypedArray(Uint32Array, bodyLengthBufferPtr, boneToBodyBindIndexMap.length);
        {
            const bodyLengthBufferArray = bodyLengthBuffer.array;
            for (let i = 0; i < boneToBodyBindIndexMap.length; ++i) {
                const bodyIndices = boneToBodyBindIndexMap[i];
                if (bodyIndices === null) {
                    bodyLengthBufferArray[i] = 0;
                } else {
                    bodyLengthBufferArray[i] = bodyIndices.length;
                }
            }
        }
        const boneToBodyBindIndexMapPtr = animationPool.createBoneToBodyBindIndexMap(animation.ptr, bodyLengthBufferPtr);
        for (let i = 0; i < boneToBodyBindIndexMap.length; ++i) {
            const nthBodyIndicesPtr = animationPool.getNthBoneToBodyBindIndexMap(boneToBodyBindIndexMapPtr, i);
            const nthBodyIndices = wasmInstance.createTypedArray(Int32Array, nthBodyIndicesPtr, bodyLengthBuffer.array[i]).array;

            const bodyIndices = boneToBodyBindIndexMap[i];
            if (bodyIndices === null) continue;

            for (let j = 0; j < bodyIndices.length; ++j) {
                nthBodyIndices[j] = bodyIndices[j];
            }
        }
        animationPool.deallocateLengthsBuffer(bodyLengthBufferPtr, boneToBodyBindIndexMap.length);

        const runtimeAnimationPtr = animationPool.createRuntimeAnimation(
            animation.ptr,
            boneBindIndexMapPtr,
            movableBoneBindIndexMapPtr,
            morphBindIndexMapPtr,
            ikSolverBindIndexMapPtr,
            boneToBodyBindIndexMapPtr
        );

        return new MmdWasmRuntimeModelAnimation(
            runtimeAnimationPtr,
            model.ptr,
            animation,
            boneBindIndexMap,
            movableBoneBindIndexMap,
            morphController,
            morphBindIndexMap,
            model.mesh.metadata.meshes,
            ikSolverBindIndexMap,
            model.mesh.metadata.materials,
            onDispose
        );
    }

    /**
     * Induce material recompile
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     *
     * This method is exposed as public because it must be overrideable
     *
     * If you are using a material other than `MmdStandardMaterial`, you must implement this method yourself
     * @param materials Materials
     * @param morphController Morph controller
     * @param morphIndices Morph indices to induce recompile
     * @param logger logger
     */
    public static InduceMaterialRecompile: (
        materials: readonly Material[],
        morphController: MmdMorphControllerBase,
        morphIndices: readonly Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void = InduceMmdStandardMaterialRecompile as (
        materials: readonly Material[],
        morphController: MmdMorphControllerBase,
        morphIndices: readonly Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void;
}

declare module "./mmdWasmAnimation" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdWasmAnimation {
        /**
         * @internal
         */
        _runtimeModelAnimations: MmdWasmRuntimeModelAnimation[];

        /**
         * @internal
         * Create wasm runtime model animation
         * @param model Bind target
         * @param onDispose Callback when this instance is disposed
         * @param retargetingMap Animation bone name to model bone name map
         * @param logger Logger
         * @returns MmdRuntimeModelAnimation instance
         */
        createWasmRuntimeModelAnimation(
            model: MmdWasmModel,
            onDispose: () => void,
            retargetingMap?: { [key: string]: string },
            logger?: ILogger
        ): MmdWasmRuntimeModelAnimation;
    }
}

/**
 * @internal
 * Create runtime model animation
 * @param model Bind target
 * @param onDispose Callback when this instance is disposed
 * @param retargetingMap Animation bone name to model bone name map
 * @param logger Logger
 * @returns MmdRuntimeModelAnimation instance
 */
MmdWasmAnimation.prototype.createWasmRuntimeModelAnimation = function(
    model: MmdWasmModel,
    onDispose: () => void,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdWasmRuntimeModelAnimation {
    if (this._runtimeModelAnimations === undefined) this._runtimeModelAnimations = [];

    const runtimeAnimation = MmdWasmRuntimeModelAnimation.Create(this, model, onDispose, retargetingMap, logger);
    this._runtimeModelAnimations.push(runtimeAnimation);
    return runtimeAnimation;
};

const MmdWasmAnimationDispose = MmdWasmAnimation.prototype.dispose;

MmdWasmAnimation.prototype.dispose = function(): void {
    if (this.isDisposed) return;

    const runtimeModelAnimations = this._runtimeModelAnimations;
    if (runtimeModelAnimations !== undefined) {
        for (let i = 0; i < runtimeModelAnimations.length; ++i) {
            runtimeModelAnimations[i].dispose(true);
        }
        this._runtimeModelAnimations = undefined!;
    }

    MmdWasmAnimationDispose.call(this);
};
