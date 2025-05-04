import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Nullable } from "@babylonjs/core/types";

import type { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ILogger } from "../ILogger";
import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import type { MmdModelPhysicsCreationOptions } from "../mmdRuntime";

/**
 * Mmd physics builder implementation object
 */
export interface IMmdPhysics {
    /**
     * The world id of the physics model
     *
     * when you not specify the world id, the physics model will be created in new world
     *
     * if nextWorldId is undefined, the physics implementation will not support multi world
     */
    nextWorldId?: number;

    /**
     * Build the physics model of the MMD model
     *
     * bodyToBoneMap is a map of rigid body index to runtime bone index
     *
     * bodyToBoneMap should be initialized to null with the size of the number of rigid bodies
     * @param rootMesh Root mesh of the MMD model
     * @param bones MMD runtime bones
     * @param rigidBodies rigid bodies information
     * @param joints joints information
     * @param bodyToBoneMap output body index to bone map
     * @param logger Logger
     * @param physicsOptions Optional physics options
     * @returns MMD physics model
     * @throws If the physics model cannot be built
     */
    buildPhysics(
        rootMesh: Mesh,
        bones: readonly IMmdRuntimeBone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        bodyToBoneMap: Nullable<IMmdRuntimeBone>[],
        logger: ILogger,
        physicsOptions: Nullable<MmdModelPhysicsCreationOptions>
    ): IMmdPhysicsModel;
}

/**
 * Physics model that contains the rigid bodies and joints of the MMD model
 */
export interface IMmdPhysicsModel {
    /**
     * Dispose the physics resources
     */
    dispose(): void;

    /**
     * Reset the rigid body positions and velocities
     */
    initialize(): void;

    /**
     * Set the rigid bodies transform to the bones transform
     */
    syncBodies(): void;

    /**
     * Set the bones transform to the rigid bodies transform
     */
    syncBones(): void;
}
