import type { Mesh } from "@babylonjs/core/Meshes/mesh";

import type { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ILogger } from "../ILogger";
import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";

export interface IMmdPhysics {
    /**
     * Build the physics model of the MMD model
     * @param rootMesh Root mesh of the MMD model
     * @param bones MMD runtime bones
     * @param rigidBodies rigid bodies information
     * @param joints joints information
     * @param logger Logger
     * @returns MMD physics model
     * @throws If the physics model cannot be built
     */
    buildPhysics(
        rootMesh: Mesh,
        bones: readonly IMmdRuntimeBone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        logger: ILogger
    ): IMmdPhysicsModel;
}

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
