import type { Nullable } from "@babylonjs/core/types";

import type { IIkStateContainer } from "./IIkStateContainer";
import type { IMmdRuntimeBone } from "./IMmdRuntimeBone";
import type { IMmdLinkedBoneContainer } from "./IMmdRuntimeLinkedBone";
import type { IRigidBodyStateContainer } from "./IRIgidBodyStateContainer";
import type { MmdSkinnedMesh, TrimmedMmdSkinnedMesh } from "./mmdMesh";
import type { MmdMorphControllerBase } from "./mmdMorphControllerBase";
import type { IMmdBindableModelAnimation } from "./Animation/IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { MmdRuntimeAnimationHandle } from "./mmdRuntimeAnimationHandle";

/**
 * IMmdModel is a model that can bind animation.
 */
export interface IMmdModel extends IIkStateContainer, IRigidBodyStateContainer {
    /**
     * The root mesh of this model
     */
    readonly mesh: MmdSkinnedMesh | TrimmedMmdSkinnedMesh;

    /**
     * The skeleton of this model
     *
     * This can be a instance of `Skeleton`, or if you are using a humanoid model, it will be referencing a virtualized bone tree
     *
     * So MmdModel.metadata.skeleton is not always equal to MmdModel.skeleton
     */
    readonly skeleton: IMmdLinkedBoneContainer;

    /**
     * The array of final transform matrices of bones (ie. the matrix sent to shaders)
     */
    readonly worldTransformMatrices: Float32Array;

    /**
     * Uint8Array that stores the state of IK solvers
     *
     * If `ikSolverState[MmdModel.runtimeBones[i].ikSolverIndex]` is 0, IK solver of `MmdModel.runtimeBones[i]` is disabled and vice versa
     */
    readonly ikSolverStates: Uint8Array;

    /**
     * Uint8Array that stores the state of RigidBody
     *
     * - If bone position is driven by physics, the value is 1
     * - If bone position is driven by only animation, the value is 0
     *
     * You can get the state of the rigid body by `rigidBodyStates[MmdModel.runtimeBones[i].rigidBodyIndex]`
     */
    readonly rigidBodyStates: Uint8Array;

    /**
     * Runtime bones of this model
     *
     * You can get the final transform matrix of a bone by `MmdModel.runtimeBones[i].getFinalMatrixToRef()`
     */
    readonly runtimeBones: readonly IMmdRuntimeBone[];

    /**
     * The morph controller of this model
     *
     * The `MmdMorphControllerBase` not only wrapper of `MorphTargetManager` but also controls the CPU bound morphs (bone, material, group)
     */
    readonly morph: MmdMorphControllerBase;

    /**
     * Create a runtime animation from the given animation
     *
     * @param animation MMD animation or MMD model animation group to add
     * @param retargetingMap Animation bone name to model bone name map
     * @returns A handle to the runtime animation
     */
    createRuntimeAnimation(animation: IMmdBindableModelAnimation, retargetingMap?: { [key: string]: string }): MmdRuntimeAnimationHandle;

    /**
     * Set the current animation of this model
     *
     * If handle is null, the current animation will be cleared
     * @param handle The handle of the animation to set as current
     * @param updateMorphTarget Whether to update morph target manager numMaxInfluencers (default: true)
     */
    setRuntimeAnimation(handle: Nullable<MmdRuntimeAnimationHandle>, updateMorphTarget?: boolean): void;

    /**
     * Get the current animation of this model
     */
    readonly currentAnimation: Nullable<IMmdRuntimeModelAnimation>;
}
