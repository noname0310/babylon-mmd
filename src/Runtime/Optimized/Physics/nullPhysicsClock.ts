import type { IPhysicsClock } from "./IPhysicsClock";

/**
 * Null physics clock
 *
 * This class is used when wasm intergrated physics is not used
 */
export class NullPhysicsClock implements IPhysicsClock {
    public getDeltaTime(): undefined {
        return undefined;
    }
}
