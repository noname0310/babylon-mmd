import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

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
     * The maximum number of physics sub steps
     */
    maxSubSteps: number;

    /**
     * Physics fixed time step (default 1 / 100)
     *
     * The fixed time step of physics
     */
    fixedTimeStep: number;

    /**
     * Set the gravity of the all physics world (default 0, -98.0, 0)
     *
     * @param gravity gravity
     */
    setGravity(gravity: DeepImmutable<Vector3>): void;

    /**
     * Get the gravity of the all physics world (default 0, -98.0, 0)
     */
    getGravity(result?: Vector3): Nullable<Vector3>;
}
