import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Nullable } from "@babylonjs/core/types";

import { MmdModelAnimationGroup } from "@/Loader/Animation/mmdModelAnimationGroup";

import type { IIkSolver } from "../ikSolver";
import type { ILogger } from "../ILogger";
import type { RuntimeMmdMesh } from "../mmdMesh";
import type { MmdModel } from "../mmdModel";
import type { MmdMorphController } from "../mmdMorphController";
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
    }

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    public animate(frameTime: number): void {
        frameTime;

        this._boneBindIndexMap;
        this._moveableBoneBindIndexMap;
        this._morphController;
        this._morphBindIndexMap;
        this._mesh;
        this._ikSolverBindIndexMap;

        throw new Error("Method not implemented.");
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

        const boneBindIndexMap: Nullable<Bone>[] = [];
        const boneTracks = animationGroup.boneAnimations;
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            const bone = boneIndexMap.get(boneTrack.targetProperty);
            if (bone === undefined) {
                logger?.warn(`Binding failed: bone ${boneTrack.targetProperty} not found`);
                boneBindIndexMap.push(null);
            } else {
                boneBindIndexMap.push(bone);
            }
        }

        const moveableBoneBindIndexMap: Nullable<Bone>[] = [];
        const moveableBoneTracks = animationGroup.boneAnimations;
        for (let i = 0; i < moveableBoneTracks.length; ++i) {
            const moveableBoneTrack = moveableBoneTracks[i];
            const bone = boneIndexMap.get(moveableBoneTrack.targetProperty);
            if (bone === undefined) {
                logger?.warn(`Binding failed: bone ${moveableBoneTrack.targetProperty} not found`);
                moveableBoneBindIndexMap.push(null);
            } else {
                moveableBoneBindIndexMap.push(bone);
            }
        }

        const morphController = model.morph;
        const morphBindIndexMap: Nullable<MorphIndices>[] = [];
        const morphTracks = animationGroup.morphAnimations;
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            const mappedName = retargetingMap?.[morphTrack.targetProperty] ?? morphTrack.targetProperty;
            const morphIndices = morphController.getMorphIndices(mappedName);
            if (morphIndices === undefined) {
                logger?.warn(`Binding failed: morph ${mappedName} not found`);
                morphBindIndexMap.push(null);
            } else {
                morphBindIndexMap.push(morphIndices);
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

        const ikSolverBindIndexMap: Nullable<IIkSolver>[] = [];
        const propertyTrackIkBoneNames = animationGroup.propertyAnimations;
        for (let i = 0; i < propertyTrackIkBoneNames.length; ++i) {
            const ikBoneName = propertyTrackIkBoneNames[i].targetProperty;
            const ikBoneIndex = runtimeBoneIndexMap.get(ikBoneName);
            if (ikBoneIndex === undefined) {
                logger?.warn(`Binding failed: IK bone ${ikBoneName} not found`);
                ikSolverBindIndexMap.push(null);
            } else {
                const ikSolver = runtimeBones[ikBoneIndex].ikSolver;
                if (ikSolver === null) {
                    logger?.warn(`Binding failed: IK solver for bone ${ikBoneName} not found`);
                    ikSolverBindIndexMap.push(null);
                } else {
                    ikSolverBindIndexMap.push(ikSolver);
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
