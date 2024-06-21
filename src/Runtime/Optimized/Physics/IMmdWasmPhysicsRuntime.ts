import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdWasmModel } from "../mmdWasmModel";

/**
 * Mmd wasm physics runtime interface
 */
export interface IMmdWasmPhysicsRuntime {
    /**
     * Next world id (initial value is 0)
     *
     * When creating a new mmd model without specifying the world id, the next world id is used and incremented
     */
    nextWorldId: number;

    /**
     * Physics max sub steps (default 5)
     *
     * recommended value is 120 for high quality physics simulation
     *
     * The maximum number of physics sub steps
     */
    maxSubSteps: number;

    /**
     * Physics fixed time step (default 1 / 60)
     *
     * recommended value is 1 / 120 for high quality physics simulation
     *
     * The fixed time step of physics
     */
    fixedTimeStep: number;

    /**
     * Set the gravity of the all physics world (default 0, -98.0, 0)
     *
     * @param gravity gravity
     */
    setGravity(gravity: Vector3): void;

    /**
     * Get the gravity of the all physics world (default 0, -98.0, 0)
     */
    getGravity(result?: Vector3): Nullable<Vector3>;

    /**
     * Override the gravity of the physics world
     *
     * Physics world id must be unsigned 32 bit integer
     *
     * If the gravity is null, the gravity is reset to the default value
     * @param worldId physics world id
     * @param gravity gravity
     */
    overrideWorldGravity(worldId: number, gravity: Nullable<Vector3>): void;

    /**
     * Get the overridden gravity of the physics world
     *
     * Physics world id must be unsigned 32 bit integer
     *
     * If the gravity is not overridden, null is returned
     * @param worldId physics world id
     * @param result result vector
     * @returns gravity
     */
    getWorldGravity(worldId: number, result?: Vector3): Nullable<Vector3>;

    /**
     * Create a ground mmd model
     *
     * Physics world id must be unsigned 32 bit integer
     * @param affectedWorlds affected physics world ids
     * @param planeNormal plane normal (default 0, 1, 0)
     * @param planeConstant plane constant (default 0)
     */
    createGroundModel(affectedWorlds: number[], planeNormal?: Vector3, planeConstant?: number): MmdWasmModel;
}
