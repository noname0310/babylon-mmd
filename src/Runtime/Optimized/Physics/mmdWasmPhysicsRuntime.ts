import type { IMmdWasmPhysicsRuntime } from "./IMmdWasmPhysicsRuntime";

export class MmdWasmPhysicsRuntime implements IMmdWasmPhysicsRuntime {
    public nextWorldId: number;

    public constructor() {
        this.nextWorldId = 0;
    }
}
