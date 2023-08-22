import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Nullable } from "@babylonjs/core/types";

import { MmdModelAnimationGroup } from "@/Loader/Animation/mmdModelAnimationGroup";

import type { IIkSolver } from "../ikSolver";
import type { ILogger } from "../ILogger";
import type { RuntimeMmdMesh } from "../mmdMesh";
import type { MmdModel } from "../mmdModel";
import type { MmdMorphController } from "../mmdMorphController";
import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "./IMmdRuntimeAnimation";

type MorphIndices = readonly number[];

/**
 * Mmd runtime model animation that use animation runtime of babylon.js
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

        logger;
        throw new Error("Method not implemented.");
    }

    /**
     * Bind animation to model and prepare material for morph animation
     * @param animation Animation to bind
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
        animationGroup;
        model;
        retargetingMap;
        logger;
        throw new Error("Not implemented");
    }
}

declare module "../../Loader/Animation/mmdModelAnimationGroup" {
    export interface MmdModelAnimationGroup extends IMmdBindableModelAnimation<MmdRuntimeModelAnimationGroup> { }
}

MmdModelAnimationGroup.prototype.createRuntimeAnimation = function(
    model: MmdModel,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdRuntimeModelAnimationGroup {
    return MmdRuntimeModelAnimationGroup.Create(this, model, retargetingMap, logger);
};
