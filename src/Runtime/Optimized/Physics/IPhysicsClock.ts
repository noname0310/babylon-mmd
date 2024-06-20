/**
 * Interface for a wasm integrated physics delta time clock
 */
export interface IPhysicsClock {
    /**
     * Get delta time in seconds
     */
    getDeltaTime(): number | undefined;
}
