import type { _IAnimationState } from "@babylonjs/core/Animations/animation";
import type { Material } from "@babylonjs/core/Materials/material";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Nullable } from "@babylonjs/core/types";

import { MmdModelAnimationGroup } from "@/Loader/Animation/mmdModelAnimationGroup";

import type { IIkStateContainer } from "../IIkStateContainer";
import type { ILogger } from "../ILogger";
import type { IMmdModel } from "../IMmdModel";
import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { MmdMorphControllerBase } from "../mmdMorphControllerBase";
import { CreateAnimationState } from "./Common/createAnimationState";
import { InduceMmdStandardMaterialRecompile, SetMorphTargetManagersNumMaxInfluencers } from "./Common/induceMmdStandardMaterialRecompile";
import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimationWithBindingInfo, MorphIndices } from "./IMmdRuntimeAnimation";

/**
 * Mmd runtime model animation that use animation container of babylon.js
 *
 * An object with mmd animation group and model binding information
 */
export class MmdRuntimeModelAnimationGroup implements IMmdRuntimeModelAnimationWithBindingInfo {
    /**
     * The animation data
     */
    public readonly animation: MmdModelAnimationGroup;

    /**
     * Bone bind index map
     */
    public readonly boneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[];

    /**
     * Movable bone bind index map
     */
    public readonly movableBoneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[];

    private readonly _morphController: MmdMorphControllerBase;

    /**
     * Morph bind index map
     */
    public readonly morphBindIndexMap: readonly Nullable<MorphIndices>[];

    private readonly _meshes: readonly Mesh[];

    /**
     * IK solver bind index map
     */
    public readonly ikSolverBindIndexMap: Int32Array;

    private readonly _ikSolverStates: IIkStateContainer;

    private _materialRecompileInduceInfo: readonly Material[] | null;

    private readonly _bonePositionAnimationStates: _IAnimationState[];
    private readonly _boneRotationAnimationStates: _IAnimationState[];
    private readonly _morphAnimationStates: _IAnimationState[];
    private readonly _propertyAnimationStates: _IAnimationState[];
    private readonly _visibilityAnimationState: _IAnimationState;

    private constructor(
        animation: MmdModelAnimationGroup,
        boneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[],
        movableBoneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[],
        morphController: MmdMorphControllerBase,
        morphBindIndexMap: readonly Nullable<MorphIndices>[],
        meshes: readonly Mesh[],
        ikSolverBindIndexMap: Int32Array,
        ikSolverStates: IIkStateContainer,
        materialRecompileInduceInfo: readonly Material[]
    ) {
        this.animation = animation;

        this.boneBindIndexMap = boneBindIndexMap;
        this.movableBoneBindIndexMap = movableBoneBindIndexMap;
        this._morphController = morphController;
        this.morphBindIndexMap = morphBindIndexMap;
        this._meshes = meshes;
        this.ikSolverBindIndexMap = ikSolverBindIndexMap;
        this._ikSolverStates = ikSolverStates;

        this._materialRecompileInduceInfo = materialRecompileInduceInfo;

        const bonePositionAnimationStates = this._bonePositionAnimationStates = new Array(animation.bonePositionAnimations.length);
        for (let i = 0; i < bonePositionAnimationStates.length; ++i) {
            bonePositionAnimationStates[i] = CreateAnimationState();
        }

        const boneRotationAnimationStates = this._boneRotationAnimationStates = new Array(animation.boneRotationAnimations.length);
        for (let i = 0; i < boneRotationAnimationStates.length; ++i) {
            boneRotationAnimationStates[i] = CreateAnimationState();
        }

        const morphAnimationStates = this._morphAnimationStates = new Array(animation.morphAnimations.length);
        for (let i = 0; i < morphAnimationStates.length; ++i) {
            morphAnimationStates[i] = CreateAnimationState();
        }

        const propertyAnimationStates = this._propertyAnimationStates = new Array(animation.propertyAnimations.length);
        for (let i = 0; i < propertyAnimationStates.length; ++i) {
            propertyAnimationStates[i] = CreateAnimationState();
        }

        this._visibilityAnimationState = CreateAnimationState();
    }

    private static readonly _BonePosition = new Vector3();
    // private static readonly _BoneRotation = new Quaternion();

    /**
     * Update animation
     * @param frameTime Frame time in 30fps
     */
    public animate(frameTime: number): void {
        const animation = this.animation;

        const boneTracks = animation.boneRotationAnimations;
        const boneBindIndexMap = this.boneBindIndexMap;
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            const bone = boneBindIndexMap[i];
            if (bone === null) continue;
            // Since mmd bones all have identity quaternions, we abandon the compatibility for skeletons that don't and improve performance

            // Quaternion.FromRotationMatrixToRef(bone.getRestMatrix(), MmdRuntimeModelAnimationGroup._BoneRotation);
            // bone.setRotationQuaternion(
            //     MmdRuntimeModelAnimationGroup._BoneRotation.multiplyInPlace(boneTrack._interpolate(frameTime, this._boneRotationAnimationStates[i])),
            //     Space.LOCAL
            // );

            bone.setRotationQuaternion(
                boneTrack._interpolate(frameTime, this._boneRotationAnimationStates[i]),
                Space.LOCAL
            );
        }

        const movableBoneTracks = animation.bonePositionAnimations;
        const movableBoneBindIndexMap = this.movableBoneBindIndexMap;
        for (let i = 0; i < movableBoneTracks.length; ++i) {
            const movableBoneTrack = movableBoneTracks[i];
            const bone = movableBoneBindIndexMap[i];
            if (bone === null) continue;
            bone.getRestMatrix().getTranslationToRef(MmdRuntimeModelAnimationGroup._BonePosition);
            bone.position = MmdRuntimeModelAnimationGroup._BonePosition.addInPlace(movableBoneTrack._interpolate(frameTime, this._bonePositionAnimationStates[i]));
        }

        const morphTracks = animation.morphAnimations;
        const morphBindIndexMap = this.morphBindIndexMap;
        const morphController = this._morphController;
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            const morphIndices = morphBindIndexMap[i];
            if (morphIndices === null) continue;
            const morphWeight = morphTrack._interpolate(frameTime, this._morphAnimationStates[i]);
            for (let j = 0; j < morphIndices.length; ++j) {
                morphController.setMorphWeightFromIndex(morphIndices[j], morphWeight);
            }
        }

        if (animation.visibilityAnimation !== null) {
            const meshes = this._meshes;
            const visibility = 1 + animation.visibilityAnimation._interpolate(frameTime, this._visibilityAnimationState) as number;
            for (let i = 0; i < meshes.length; ++i) meshes[i].visibility = visibility;
        }

        const propertyTracks = animation.propertyAnimations;
        const ikSolverBindIndexMap = this.ikSolverBindIndexMap;
        const ikSolverStates = this._ikSolverStates.ikSolverStates;
        for (let i = 0; i < propertyTracks.length; ++i) {
            const propertyTrack = propertyTracks[i];
            const ikSolverIndex = ikSolverBindIndexMap[i];
            if (ikSolverIndex === -1) continue;
            ikSolverStates[ikSolverIndex] = (0 < 1 + propertyTrack._interpolate(frameTime, this._propertyAnimationStates[i])) ? 1 : 0;
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
    public induceMaterialRecompile(updateMorphTarget: boolean, logger?: ILogger | undefined): void {
        if (this._materialRecompileInduceInfo === null) return;

        MmdRuntimeModelAnimationGroup.InduceMaterialRecompile(
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
     * Bind animation to model and prepare material for morph animation
     * @param animationGroup Animation to bind
     * @param model Bind target
     * @param retargetingMap Animation bone name to model bone name map
     * @param logger Logger
     * @return MmdRuntimeModelAnimationGroup instance
     */
    public static Create(
        animationGroup: MmdModelAnimationGroup,
        model: IMmdModel,
        retargetingMap?: { [key: string]: string },
        logger?: ILogger
    ): MmdRuntimeModelAnimationGroup {
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

        const boneBindIndexMap: Nullable<IMmdRuntimeLinkedBone>[] = new Array(animationGroup.boneRotationAnimations.length);
        const boneNameMap = animationGroup.boneRotationAnimationBindMap;
        for (let i = 0; i < boneNameMap.length; ++i) {
            const boneIndex = boneIndexMap.get(boneNameMap[i]);
            if (boneIndex === undefined) {
                logger?.warn(`Binding failed: bone ${boneNameMap[i]} not found`);
                boneBindIndexMap[i] = null;
            } else {
                boneBindIndexMap[i] = bones[boneIndex];
            }
        }

        const movableBoneBindIndexMap: Nullable<IMmdRuntimeLinkedBone>[] = new Array(animationGroup.bonePositionAnimations.length);
        const movableBoneNameMap = animationGroup.bonePositionAnimationBindMap;
        for (let i = 0; i < movableBoneNameMap.length; ++i) {
            const boneIndex = boneIndexMap.get(movableBoneNameMap[i]);
            if (boneIndex === undefined) {
                logger?.warn(`Binding failed: bone ${movableBoneNameMap[i]} not found`);
                movableBoneBindIndexMap[i] = null;
            } else {
                movableBoneBindIndexMap[i] = bones[boneIndex];
            }
        }

        const morphController = model.morph;
        const morphBindIndexMap: Nullable<MorphIndices>[] = new Array(animationGroup.morphAnimations.length);
        const morphNameMap = animationGroup.morphAnimationBindMap;
        for (let i = 0; i < morphNameMap.length; ++i) {
            const morphName = morphNameMap[i];
            const mappedName = retargetingMap?.[morphName] ?? morphName;
            const morphIndices = morphController.getMorphIndices(mappedName);
            if (morphIndices === undefined) {
                logger?.warn(`Binding failed: morph ${mappedName} not found`);
                morphBindIndexMap[i] = null;
            } else {
                morphBindIndexMap[i] = morphIndices;
            }
        }

        const runtimeBones = model.runtimeBones;
        const ikSolverBindIndexMap = new Int32Array(animationGroup.propertyAnimations.length);
        const propertyTrackIkBoneNames = animationGroup.propertyAnimationBindMap;
        for (let i = 0; i < propertyTrackIkBoneNames.length; ++i) {
            const ikBoneName = propertyTrackIkBoneNames[i];
            const ikBoneIndex = boneIndexMap.get(ikBoneName);
            if (ikBoneIndex === undefined) {
                logger?.warn(`Binding failed: IK bone ${ikBoneName} not found`);
                ikSolverBindIndexMap[i] = -1;
            } else {
                const ikSolverIndex = runtimeBones[ikBoneIndex].ikSolverIndex;
                if (ikSolverIndex === -1) {
                    logger?.warn(`Binding failed: IK solver for bone ${ikBoneName} not found`);
                    ikSolverBindIndexMap[i] = -1;
                } else {
                    ikSolverBindIndexMap[i] = ikSolverIndex;
                }
            }
        }

        return new MmdRuntimeModelAnimationGroup(
            animationGroup,
            boneBindIndexMap,
            movableBoneBindIndexMap,
            morphController,
            morphBindIndexMap,
            model.mesh.metadata.meshes,
            ikSolverBindIndexMap,
            model,
            model.mesh.metadata.materials
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

declare module "../../Loader/Animation/mmdModelAnimationGroup" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdModelAnimationGroup extends IMmdBindableModelAnimation<MmdRuntimeModelAnimationGroup> { }
}

/**
 * Create runtime model animation
 * @param model Bind target
 * @param retargetingMap Animation bone name to model bone name map
 * @param logger Logger
 * @returns MmdRuntimeModelAnimationGroup instance
 */
MmdModelAnimationGroup.prototype.createRuntimeModelAnimation = function(
    model: IMmdModel,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdRuntimeModelAnimationGroup {
    return MmdRuntimeModelAnimationGroup.Create(this, model, retargetingMap, logger);
};
