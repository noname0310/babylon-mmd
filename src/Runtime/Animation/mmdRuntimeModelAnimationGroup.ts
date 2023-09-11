import type { _IAnimationState } from "@babylonjs/core/Animations/animation";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Material } from "@babylonjs/core/Materials/material";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import { MmdModelAnimationGroup } from "@/Loader/Animation/mmdModelAnimationGroup";

import type { IIkSolver } from "../ikSolver";
import type { ILogger } from "../ILogger";
import type { RuntimeMmdMesh } from "../mmdMesh";
import type { MmdModel } from "../mmdModel";
import type { MmdMorphController } from "../mmdMorphController";
import { createAnimationState } from "./Common/createAnimationState";
import { induceMmdStandardMaterialRecompile } from "./Common/induceMmdStandardMaterialRecompile";
import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "./IMmdRuntimeAnimation";

type MorphIndices = readonly number[];

/**
 * Mmd runtime model animation that use animation container of babylon.js
 *
 * An object with mmd animation group and model binding information
 */
export class MmdRuntimeModelAnimationGroup implements IMmdRuntimeModelAnimation {
    /**
     * The animation data
     */
    public readonly animation: MmdModelAnimationGroup;

    private readonly _boneBindIndexMap: Nullable<Bone>[];
    private readonly _moveableBoneBindIndexMap: Nullable<Bone>[];
    private readonly _morphController: MmdMorphController;
    private readonly _morphBindIndexMap: Nullable<MorphIndices>[];
    private readonly _mesh: RuntimeMmdMesh;
    private readonly _ikSolverBindIndexMap: Nullable<IIkSolver>[];

    private readonly _bonePositionAnimationStates: _IAnimationState[];
    private readonly _boneRotationAnimationStates: _IAnimationState[];
    private readonly _morphAnimationStates: _IAnimationState[];
    private readonly _propertyAnimationStates: _IAnimationState[];
    private readonly _visibilityAnimationState: _IAnimationState;

    private constructor(
        animation: MmdModelAnimationGroup,
        boneBindIndexMap: Nullable<Bone>[],
        moveableBoneBindIndexMap: Nullable<Bone>[],
        morphController: MmdMorphController,
        morphBindIndexMap: Nullable<MorphIndices>[],
        mesh: RuntimeMmdMesh,
        ikSolverBindIndexMap: Nullable<IIkSolver>[]
    ) {
        this.animation = animation;

        this._boneBindIndexMap = boneBindIndexMap;
        this._moveableBoneBindIndexMap = moveableBoneBindIndexMap;
        this._morphController = morphController;
        this._morphBindIndexMap = morphBindIndexMap;
        this._mesh = mesh;
        this._ikSolverBindIndexMap = ikSolverBindIndexMap;

        const bonePositionAnimationStates = this._bonePositionAnimationStates = new Array(animation.bonePositionAnimations.length);
        for (let i = 0; i < bonePositionAnimationStates.length; ++i) {
            bonePositionAnimationStates[i] = createAnimationState();
        }

        const boneRotationAnimationStates = this._boneRotationAnimationStates = new Array(animation.boneRotationAnimations.length);
        for (let i = 0; i < boneRotationAnimationStates.length; ++i) {
            boneRotationAnimationStates[i] = createAnimationState();
        }

        const morphAnimationStates = this._morphAnimationStates = new Array(animation.morphAnimations.length);
        for (let i = 0; i < morphAnimationStates.length; ++i) {
            morphAnimationStates[i] = createAnimationState();
        }

        const propertyAnimationStates = this._propertyAnimationStates = new Array(animation.propertyAnimations.length);
        for (let i = 0; i < propertyAnimationStates.length; ++i) {
            propertyAnimationStates[i] = createAnimationState();
        }

        this._visibilityAnimationState = createAnimationState();
    }

    private static readonly _BonePosition = new Vector3();
    private static readonly _BoneRotation = new Quaternion();

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    public animate(frameTime: number): void {
        const animation = this.animation;

        const boneTracks = animation.boneRotationAnimations;
        const boneBindIndexMap = this._boneBindIndexMap;
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            const bone = boneBindIndexMap[i];
            if (bone === null) continue;
            Quaternion.FromRotationMatrixToRef(bone.getRestMatrix(), MmdRuntimeModelAnimationGroup._BoneRotation);
            bone.setRotationQuaternion(
                MmdRuntimeModelAnimationGroup._BoneRotation.multiplyInPlace(boneTrack._interpolate(frameTime, this._boneRotationAnimationStates[i])),
                Space.LOCAL
            );
        }

        const moveableBoneTracks = animation.bonePositionAnimations;
        const moveableBoneBindIndexMap = this._moveableBoneBindIndexMap;
        for (let i = 0; i < moveableBoneTracks.length; ++i) {
            const moveableBoneTrack = moveableBoneTracks[i];
            const bone = moveableBoneBindIndexMap[i];
            if (bone === null) continue;
            bone.getRestMatrix().getTranslationToRef(MmdRuntimeModelAnimationGroup._BonePosition);
            bone.setPosition(
                MmdRuntimeModelAnimationGroup._BonePosition.addInPlace(moveableBoneTrack._interpolate(frameTime, this._bonePositionAnimationStates[i])),
                Space.LOCAL
            );
        }

        const morphTracks = animation.morphAnimations;
        const morphBindIndexMap = this._morphBindIndexMap;
        const morphController = this._morphController;
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            const morphIndices = morphBindIndexMap[i];
            if (morphIndices === null) continue;
            // this clamp will be removed when morph target recompilation problem is solved
            // ref: https://github.com/BabylonJS/Babylon.js/issues/14008
            const morphWeight = Math.max(morphTrack._interpolate(frameTime, this._morphAnimationStates[i]), 1e-16);
            for (let j = 0; j < morphIndices.length; ++j) {
                morphController.setMorphWeightFromIndex(morphIndices[j], morphWeight);
            }
        }

        const propertyTracks = animation.propertyAnimations;
        const ikSolverBindIndexMap = this._ikSolverBindIndexMap;
        for (let i = 0; i < propertyTracks.length; ++i) {
            const propertyTrack = propertyTracks[i];
            const ikSolver = ikSolverBindIndexMap[i];
            if (ikSolver === null) continue;
            ikSolver.enabled = 0 < 1 + propertyTrack._interpolate(frameTime, this._propertyAnimationStates[i]);
        }

        if (animation.visibilityAnimation !== null) {
            this._mesh.visibility = 1 + animation.visibilityAnimation._interpolate(frameTime, this._visibilityAnimationState) as number;
        }
    }

    private _materialRecompileInduced = false;

    /**
     * Induce material recompile
     *
     * This method must run once before the animation runs
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     * @param logger logger
     */
    public induceMaterialRecompile(logger?: ILogger | undefined): void {
        if (this._materialRecompileInduced) return;
        this._materialRecompileInduced = true;

        MmdRuntimeModelAnimationGroup.InduceMaterialRecompile(
            this._mesh.material.subMaterials,
            this._morphController,
            this._morphBindIndexMap,
            logger
        );
    }

    /**
     * Bind animation to model and prepare material for morph animation
     * @param animationGroup Animation to bind
     * @param model Bind target
     * @param retargetingMap Model bone name to animation bone name map
     * @param logger Logger
     * @return MmdRuntimeModelAnimationGroup instance
     */
    public static Create(
        animationGroup: MmdModelAnimationGroup,
        model: MmdModel,
        retargetingMap?: { [key: string]: string },
        logger?: ILogger
    ): MmdRuntimeModelAnimationGroup {
        const skeleton = model.mesh.skeleton;
        const bones = skeleton.bones;

        const boneIndexMap = new Map<string, Bone>();
        if (retargetingMap === undefined) {
            for (let i = 0; i < bones.length; ++i) {
                boneIndexMap.set(bones[i].name, bones[i]);
            }
        } else {
            for (let i = 0; i < bones.length; ++i) {
                boneIndexMap.set(retargetingMap[bones[i].name] ?? bones[i].name, bones[i]);
            }
        }

        const boneBindIndexMap: Nullable<Bone>[] = new Array(animationGroup.boneRotationAnimations.length);
        const boneNameMap = animationGroup.boneRotationAnimationBindMap;
        for (let i = 0; i < boneNameMap.length; ++i) {
            const bone = boneIndexMap.get(boneNameMap[i]);
            if (bone === undefined) {
                logger?.warn(`Binding failed: bone ${boneNameMap[i]} not found`);
                boneBindIndexMap[i] = null;
            } else {
                boneBindIndexMap[i] = bone;
            }
        }

        const moveableBoneBindIndexMap: Nullable<Bone>[] = new Array(animationGroup.bonePositionAnimations.length);
        const moveableBoneNameMap = animationGroup.bonePositionAnimationBindMap;
        for (let i = 0; i < moveableBoneNameMap.length; ++i) {
            const bone = boneIndexMap.get(moveableBoneNameMap[i]);
            if (bone === undefined) {
                logger?.warn(`Binding failed: bone ${moveableBoneNameMap[i]} not found`);
                moveableBoneBindIndexMap[i] = null;
            } else {
                moveableBoneBindIndexMap[i] = bone;
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

        const runtimeBones = model.sortedRuntimeBones;
        const runtimeBoneIndexMap = new Map<string, number>();
        if (retargetingMap === undefined) {
            for (let i = 0; i < bones.length; ++i) {
                runtimeBoneIndexMap.set(runtimeBones[i].name, i);
            }
        } else {
            for (let i = 0; i < bones.length; ++i) {
                runtimeBoneIndexMap.set(retargetingMap[runtimeBones[i].name] ?? runtimeBones[i].name, i);
            }
        }

        const ikSolverBindIndexMap: Nullable<IIkSolver>[] = new Array(animationGroup.propertyAnimations.length);
        const propertyTrackIkBoneNames = animationGroup.propertyAnimationBindMap;
        for (let i = 0; i < propertyTrackIkBoneNames.length; ++i) {
            const ikBoneName = propertyTrackIkBoneNames[i];
            const ikBoneIndex = runtimeBoneIndexMap.get(ikBoneName);
            if (ikBoneIndex === undefined) {
                logger?.warn(`Binding failed: IK bone ${ikBoneName} not found`);
                ikSolverBindIndexMap[i] = null;
            } else {
                const ikSolver = runtimeBones[ikBoneIndex].ikSolver;
                if (ikSolver === null) {
                    logger?.warn(`Binding failed: IK solver for bone ${ikBoneName} not found`);
                    ikSolverBindIndexMap[i] = null;
                } else {
                    ikSolverBindIndexMap[i] = ikSolver;
                }
            }
        }

        return new MmdRuntimeModelAnimationGroup(
            animationGroup,
            boneBindIndexMap,
            moveableBoneBindIndexMap,
            morphController,
            morphBindIndexMap,
            model.mesh,
            ikSolverBindIndexMap
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
        morphController: MmdMorphController,
        morphIndices: Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void = induceMmdStandardMaterialRecompile as (
        materials: Material[],
        morphController: MmdMorphController,
        morphIndices: Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void;
}

declare module "../../Loader/Animation/mmdModelAnimationGroup" {
    export interface MmdModelAnimationGroup extends IMmdBindableModelAnimation<MmdRuntimeModelAnimationGroup> { }
}

/**
 * Create runtime model animation
 * @param model Bind target
 * @param retargetingMap Model bone name to animation bone name map
 * @param logger Logger
 * @returns MmdRuntimeModelAnimationGroup instance
 */
MmdModelAnimationGroup.prototype.createRuntimeModelAnimation = function(
    model: MmdModel,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdRuntimeModelAnimationGroup {
    return MmdRuntimeModelAnimationGroup.Create(this, model, retargetingMap, logger);
};
