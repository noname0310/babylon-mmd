import type { Nullable } from "@babylonjs/core/types";

import type { IMmdAnimation } from "@/Loader/Animation/IMmdAnimation";

import type { ILogger } from "../ILogger";
import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";

/**
 * MMD Runtime Camera Animation
 */
export interface IMmdRuntimeCameraAnimation {
    readonly animation: IMmdAnimation;

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    animate(frameTime: number): void;

    /**
     * Dispose
     */
    dispose?(): void;
}

/**
 * MMD Runtime Model Animation
 */
export interface IMmdRuntimeModelAnimation {
    /**
     * The animation data
     */
    readonly animation: IMmdAnimation;

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    animate(frameTime: number): void;

    /**
     * Induce material recompile
     *
     * This method must run once before the animation runs
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     * @param updateMorphTarget Whether to update morph target manager numMaxInfluencers
     * @param logger logger
     */
    induceMaterialRecompile(updateMorphTarget: boolean, logger?: ILogger): void;

    /**
     * Dispose
     */
    dispose?(): void;
}

/**
 * Morph indices for morph bind index map
 */
export type MorphIndices = readonly number[];

/**
 * MMD Runtime Model Animation with bind index map
 */
export interface IMmdRuntimeModelAnimationWithBindingInfo extends IMmdRuntimeModelAnimation {
    /**
     * Bone bind index map
     */
    readonly boneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[];

    /**
     * Movable bone bind index map
     */
    readonly movableBoneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[];

    /**
     * Morph bind index map
     */
    readonly morphBindIndexMap: readonly Nullable<MorphIndices>[];

    /**
     * IK solver bind index map
     */
    readonly ikSolverBindIndexMap: Int32Array;

    /**
     * Bone to rigid body bind index map
     */
    readonly boneToBodyBindIndexMap: readonly Nullable<readonly number[]>[];

    /**
     * Movable bone to rigid body bind index map
     */
    readonly movableBoneToBodyBindIndexMap: readonly Nullable<readonly number[]>[];
}
