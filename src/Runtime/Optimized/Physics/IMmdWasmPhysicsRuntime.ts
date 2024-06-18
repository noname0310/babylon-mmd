import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

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
     * Physics max sub steps (default 120)
     *
     * The maximum number of physics sub steps
     */
    maxSubSteps: number;

    /**
     * Physics fixed time step (default 1 / 120)
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
}
