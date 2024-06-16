import type { MmdWasmInstance } from "../mmdWasmInstance";
import type { IMmdWasmPhysicsRuntime } from "./IMmdWasmPhysicsRuntime";

export class MmdWasmPhysicsRuntime implements IMmdWasmPhysicsRuntime {
    public nextWorldId: number;

    private readonly _wasmRuntime: InstanceType<MmdWasmInstance["MmdRuntime"]>;
    private _maxSubSteps: number;
    private _fixedTimeStep: number;

    public constructor(wasmRuntime: InstanceType<MmdWasmInstance["MmdRuntime"]>) {
        this.nextWorldId = 0;

        this._wasmRuntime = wasmRuntime;
        this._maxSubSteps = 120;
        this._fixedTimeStep = 1 / 120;
    }

    public get maxSubSteps(): number {
        return this._maxSubSteps;
    }

    public set maxSubSteps(value: number) {
        this._maxSubSteps = value;
        this._wasmRuntime.setPhysicsMaxSubSteps(value);
    }

    public get fixedTimeStep(): number {
        return this._fixedTimeStep;
    }

    public set fixedTimeStep(value: number) {
        this._fixedTimeStep = value;
        this._wasmRuntime.setPhysicsFixedTimeStep(value);
    }
}
