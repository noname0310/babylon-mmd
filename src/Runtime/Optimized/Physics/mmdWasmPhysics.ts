import type { Scene } from "@babylonjs/core/scene";

import type { MmdWasmInstance } from "../mmdWasmInstance";
import { MmdWasmPhysicsMetadataEncoder } from "./mmdWasmPhysicsMetadataEncoder";
import { MmdWasmPhysicsRuntime } from "./mmdWasmPhysicsRuntime";

export class MmdWasmPhysics {
    public constructor(scene: Scene) {
        scene;
    }

    public createRuntime(mmdRuntime: InstanceType<MmdWasmInstance["MmdRuntime"]>): MmdWasmPhysicsRuntime {
        return new MmdWasmPhysicsRuntime(mmdRuntime);
    }

    public createMetadataEncoder(physicsRuntime: MmdWasmPhysicsRuntime): MmdWasmPhysicsMetadataEncoder {
        return new MmdWasmPhysicsMetadataEncoder(physicsRuntime);
    }
}
