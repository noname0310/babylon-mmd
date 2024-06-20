import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";

import type { IPhysicsClock } from "./IPhysicsClock";

/**
 * Physics clock
 *
 * This class is for getting delta time for wasm integrated physics
 */
export class PhysicsClock implements IPhysicsClock {
    private readonly _engine: AbstractEngine;

    public constructor(engine: AbstractEngine) {
        this._engine = engine;
    }

    public getDeltaTime(): number {
        return this._engine.getDeltaTime() / 1000;
    }
}
