import type { Scene } from "@babylonjs/core/scene";

import type { MmdWasmRuntime } from "../mmdWasmRuntime";
import { MmdWasmPhysicsMetadataEncoder } from "./mmdWasmPhysicsMetadataEncoder";
import { MmdWasmPhysicsRuntime } from "./mmdWasmPhysicsRuntime";

/**
 * Mmd wasm integrated physics runtime helper object
 *
 * For use physics integrated mmd wasm runtime you need to pass this object to the mmd runtime constructor
 */
export class MmdWasmPhysics {
    /**
     * Create mmd wasm integrated physics runtime helper object
     * @param scene scene
     */
    public constructor(scene: Scene) {
        scene;
    }

    /**
     * @internal
     */
    public createRuntime(mmdRuntime: MmdWasmRuntime): MmdWasmPhysicsRuntime {
        return new MmdWasmPhysicsRuntime(mmdRuntime);
    }

    /**
     * @internal
     */
    public createMetadataEncoder(physicsRuntime: MmdWasmPhysicsRuntime): MmdWasmPhysicsMetadataEncoder {
        return new MmdWasmPhysicsMetadataEncoder(physicsRuntime);
    }
}
