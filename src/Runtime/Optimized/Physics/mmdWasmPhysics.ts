import type { Scene } from "@babylonjs/core/scene";

import type { MmdWasmRuntime } from "../mmdWasmRuntime";
import type { IPhysicsClock } from "./IPhysicsClock";
import { MmdWasmPhysicsMetadataEncoder } from "./mmdWasmPhysicsMetadataEncoder";
import { MmdWasmPhysicsRuntime } from "./mmdWasmPhysicsRuntime";
import { PhysicsClock } from "./physicsClock";

/**
 * Mmd wasm integrated physics runtime helper object
 *
 * For use physics integrated mmd wasm runtime you need to pass this object to the mmd runtime constructor
 */
export class MmdWasmPhysics {
    private readonly _scene: Scene;

    /**
     * Create mmd wasm integrated physics runtime helper object
     * @param scene scene
     */
    public constructor(scene: Scene) {
        this._scene = scene;
    }

    /**
     * create mmd wasm physics runtime
     *
     * MmdWasmPhysicsRuntime must be disposed when it is no longer needed
     * @param mmdRuntime mmd wasm runtime
     * @returns mmd wasm physics runtime
     */
    public createRuntime(mmdRuntime: MmdWasmRuntime): MmdWasmPhysicsRuntime {
        return new MmdWasmPhysicsRuntime(mmdRuntime);
    }

    /**
     * create physics clock
     * @returns physics clock
     */
    public createPhysicsClock(): IPhysicsClock {
        return new PhysicsClock(this._scene.getEngine());
    }

    /**
     * create physics metadata encoder
     * @param physicsRuntime physics runtime
     * @returns physics metadata encoder
     */
    public createMetadataEncoder(physicsRuntime: MmdWasmPhysicsRuntime): MmdWasmPhysicsMetadataEncoder {
        return new MmdWasmPhysicsMetadataEncoder(physicsRuntime);
    }
}
