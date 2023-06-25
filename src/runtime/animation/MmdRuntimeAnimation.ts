import type { Bone } from "@babylonjs/core";

import type { MmdModelAnimation } from "@/loader/animation/MmdAnimation";

import type { IkSolver } from "../IkSolver";
import type { ILogger } from "../ILogger";
import type { RuntimeMmdMesh } from "../MmdMesh";
import type { MmdModel } from "../MmdModel";
import type { MmdMorphController } from "../MmdMorphController";

type MorphIndices = readonly number[];

export class MmdRuntimeModelAnimation {
    public readonly animation: MmdModelAnimation;

    private readonly _boneBindIndexMap: Bone[];
    private readonly _morphController: MmdMorphController;
    private readonly _morphBindIndexMap: MorphIndices[];
    private readonly _mesh: RuntimeMmdMesh;
    private readonly _ikSolverBindIndexMap: IkSolver[];

    private constructor(
        animation: MmdModelAnimation,
        boneBindIndexMap: Bone[],
        morphController: MmdMorphController,
        morphBindIndexMap: MorphIndices[],
        mesh: RuntimeMmdMesh,
        ikSolverBindIndexMap: IkSolver[]
    ) {
        this.animation = animation;

        this._boneBindIndexMap = boneBindIndexMap;
        this._morphController = morphController;
        this._morphBindIndexMap = morphBindIndexMap;
        this._mesh = mesh;
        this._ikSolverBindIndexMap = ikSolverBindIndexMap;
    }

    public animate(frameTime: number): void {
        frameTime;
        this._boneBindIndexMap;
        this._morphController;
        this._morphBindIndexMap;
        this._mesh;
        this._ikSolverBindIndexMap;
        throw new Error("Not implemented");
    }

    public static Create(animation: MmdModelAnimation, model: MmdModel, logger?: ILogger): MmdRuntimeModelAnimation {
        animation;
        model;
        logger;
        console.log(animation);
        return new MmdRuntimeModelAnimation(animation, [], null!, [], null!, []);
    }
}
