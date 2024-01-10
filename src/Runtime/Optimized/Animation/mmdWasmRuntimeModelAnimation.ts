import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Nullable } from "@babylonjs/core/types";

import { induceMmdStandardMaterialRecompile } from "@/Runtime/Animation/Common/induceMmdStandardMaterialRecompile";
import { MmdRuntimeAnimation } from "@/Runtime/Animation/mmdRuntimeAnimation";
import type { ILogger } from "@/Runtime/ILogger";
import type { MmdMorphControllerBase } from "@/Runtime/mmdMorphControllerBase";

import type { MmdWasmModel } from "../mmdWasmModel";
import type { MmdWasmMorphController } from "../mmdWasmMorphController";
import type { WasmTypedArray } from "../wasmTypedArray";
import { MmdWasmAnimation } from "./mmdWasmAnimation";

type MorphIndices = readonly number[];

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

    private readonly _boneBindIndexMap: WasmTypedArray<Int32Array>;

    /**
     * Bone bind index map
     */
    public get boneBindIndexMap(): Int32Array {
        return this._boneBindIndexMap.array;
    }

    private readonly _movableBoneBindIndexMap: WasmTypedArray<Int32Array>;

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

    private readonly _ikSolverBindIndexMap: WasmTypedArray<Int32Array>;

    /**
     * IK solver bind index map
     */
    public get ikSolverBindIndexMap(): Int32Array {
        return this._ikSolverBindIndexMap.array;
    }

    private _materialRecompileInduceInfo: Material[] | null;

    private constructor(
        ptr: number,
        modelPtr: number,
        animation: MmdWasmAnimation,
        boneBindIndexMap: WasmTypedArray<Int32Array>,
        movableBoneBindIndexMap: WasmTypedArray<Int32Array>,
        morphController: MmdWasmMorphController,
        morphBindIndexMap: readonly Nullable<MorphIndices>[],
        meshes: readonly Mesh[],
        ikSolverBindIndexMap: WasmTypedArray<Int32Array>,
        materialRecompileInduceInfo: Material[],
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

        const animationPool = this.animation._poolWrapper.pool;
        animationPool.destroyRuntimeAnimation(this.ptr);

        this._onDispose();
        this._onDispose = null;
    }

    /**
     * Run wasm side animation evaluation
     *
     * Update bone / bone morphs / ik solver state
     * @param frameTime Frame time in 30fps
     */
    public wasmAnimate(frameTime: number): void {
        this.animation._poolWrapper.pool.animateMmdModel(this.ptr, this._modelPtr, frameTime);
    }

    /**
     * Late update animation
     *
     * Update vertex / uv morphs and visibility
     * @param frameTime Frame time in 30fps
     */
    public lateAnimate(frameTime: number): void {
        const animation = this.animation;

        const morphTracks = animation.morphTracks;
        if (0 < morphTracks.length) {
            const morphController = this._morphController;
            const morphBindIndexMap = this.morphBindIndexMap;
            for (let i = 0; i < morphTracks.length; ++i) {
                const morphIndices = morphBindIndexMap[i];
                if (morphIndices === null) continue;

                const morphTrack = morphTracks[i];

                const clampedFrameTime = Math.max(morphTrack.startFrame, Math.min(morphTrack.endFrame, frameTime));
                const upperBoundIndex = this._upperBoundFrameIndex(clampedFrameTime, morphTrack);
                const upperBoundIndexMinusOne = upperBoundIndex - 1;

                const frameNumberB = morphTrack.frameNumbers[upperBoundIndex];
                if (frameNumberB === undefined) {
                    // this clamp will be removed when morph target recompilation problem is solved
                    // ref: https://github.com/BabylonJS/Babylon.js/issues/14008
                    const weight = Math.max(morphTrack.weights[upperBoundIndexMinusOne], 1e-16);
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], weight, false);
                    }
                } else {
                    const frameNumberA = morphTrack.frameNumbers[upperBoundIndexMinusOne];
                    const relativeTime = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const weightA = morphTrack.weights[upperBoundIndexMinusOne];
                    const weightB = morphTrack.weights[upperBoundIndex];

                    // this clamp will be removed when morph target recompilation problem is solved
                    // ref: https://github.com/BabylonJS/Babylon.js/issues/14008
                    const weight = Math.max(weightA + (weightB - weightA) * relativeTime, 1e-16);
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
     * @param logger logger
     */
    public induceMaterialRecompile(logger?: ILogger): void {
        if (this._materialRecompileInduceInfo === null) return;

        MmdWasmRuntimeModelAnimation.InduceMaterialRecompile(
            this._materialRecompileInduceInfo,
            this._morphController,
            this.morphBindIndexMap,
            logger
        );
        this._materialRecompileInduceInfo = null;
    }

    /**
     * @internal
     * Bind animation to model and prepare material for morph animation
     * @param animation Animation to bind
     * @param model Bind target
     * @param onDispose Callback when this instance is disposed
     * @param retargetingMap Model bone name to animation bone name map
     * @param logger Logger
     * @return MmdRuntimeModelAnimation instance
     */
    public static Create(animation: MmdWasmAnimation, model: MmdWasmModel, onDispose: () => void, retargetingMap?: { [key: string]: string }, logger?: ILogger): MmdWasmRuntimeModelAnimation {
        const wasmInstance = animation._poolWrapper.instance;
        const animationPool = animation._poolWrapper.pool;

        const skeleton = model.skeleton;
        const bones = skeleton.bones;

        const boneIndexMap = new Map<string, number>();
        if (retargetingMap === undefined) {
            for (let i = 0; i < bones.length; ++i) {
                boneIndexMap.set(bones[i].name, i);
            }
        } else {
            for (let i = 0; i < bones.length; ++i) {
                boneIndexMap.set(retargetingMap[bones[i].name] ?? bones[i].name, i);
            }
        }

        const boneBindIndexMapPtr = animationPool.createBoneBindIndexMap(animation.ptr);
        const boneBindIndexMap = wasmInstance.createTypedArray(Int32Array, boneBindIndexMapPtr, animation.boneTracks.length);
        {
            const boneTracks = animation.boneTracks;
            const boneBindIndexMapArray = boneBindIndexMap.array;
            for (let i = 0; i < boneTracks.length; ++i) {
                const boneTrack = boneTracks[i];
                const boneIndex = boneIndexMap.get(boneTrack.name);
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
                const boneIndex = boneIndexMap.get(movableBoneTrack.name);
                if (boneIndex === undefined) {
                    logger?.warn(`Binding failed: bone ${movableBoneTrack.name} not found`);
                    movableBoneBindIndexMapArray[i] = -1;
                } else {
                    movableBoneBindIndexMapArray[i] = boneIndex;
                }
            }
        }

        const morphBindIndexMap: Nullable<MorphIndices>[] = new Array(animation.morphTracks.length);
        const morphController = model.morph;
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
                const ikBoneIndex = boneIndexMap.get(ikBoneName);
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

        const runtimeAnimationPtr = animationPool.createRuntimeAnimation(
            animation.ptr,
            boneBindIndexMapPtr,
            movableBoneBindIndexMapPtr,
            morphBindIndexMapPtr,
            ikSolverBindIndexMapPtr
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
        materials: Material[],
        morphController: MmdMorphControllerBase,
        morphIndices: readonly Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void = induceMmdStandardMaterialRecompile as (
        materials: Material[],
        morphController: MmdMorphControllerBase,
        morphIndices: readonly Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void;
}

declare module "./mmdWasmAnimation" {
    export interface MmdWasmAnimation {
        /**
         * @internal
         */
        _runtimeModelAnimations: MmdWasmRuntimeModelAnimation[];

        /**
         * Create wasm runtime model animation
         * @param model Bind target
         * @param onDispose Callback when this instance is disposed
         * @param retargetingMap Model bone name to animation bone name map
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
 * Create runtime model animation
 * @param model Bind target
 * @param onDispose Callback when this instance is disposed
 * @param retargetingMap Model bone name to animation bone name map
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

const mmdWasmAnimationDispose = MmdWasmAnimation.prototype.dispose;

MmdWasmAnimation.prototype.dispose = function(): void {
    if (this.isDisposed) return;

    const runtimeModelAnimations = this._runtimeModelAnimations;
    if (runtimeModelAnimations !== undefined) {
        for (let i = 0; i < runtimeModelAnimations.length; ++i) {
            runtimeModelAnimations[i].dispose(true);
        }
        this._runtimeModelAnimations = undefined!;
    }

    mmdWasmAnimationDispose.call(this);
};
