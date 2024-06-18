import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdWasmRuntime } from "../mmdWasmRuntime";
import type { IMmdWasmPhysicsRuntime } from "./IMmdWasmPhysicsRuntime";

/**
 * @internal
 */
export class MmdWasmPhysicsRuntime implements IMmdWasmPhysicsRuntime {
    public nextWorldId: number;

    private readonly _mmdRuntime: MmdWasmRuntime;
    private _maxSubSteps: number;
    private _fixedTimeStep: number;

    public constructor(
        mmdRuntime: MmdWasmRuntime
    ) {
        this.nextWorldId = 0;

        this._mmdRuntime = mmdRuntime;
        this._maxSubSteps = 120;
        this._fixedTimeStep = 1 / 120;
    }

    public get maxSubSteps(): number {
        return this._maxSubSteps;
    }

    public set maxSubSteps(value: number) {
        this._mmdRuntime.lock.wait();
        this._maxSubSteps = value;
        this._mmdRuntime.wasmInternal.setPhysicsMaxSubSteps(value);
    }

    public get fixedTimeStep(): number {
        return this._fixedTimeStep;
    }

    public set fixedTimeStep(value: number) {
        this._mmdRuntime.lock.wait();
        this._fixedTimeStep = value;
        this._mmdRuntime.wasmInternal.setPhysicsFixedTimeStep(value);
    }

    public setGravity(gravity: Vector3): void {
        this._mmdRuntime.lock.wait();
        this._mmdRuntime.wasmInternal.setPhysicsGravity(gravity.x, gravity.y, gravity.z);
    }

    public getGravity(result?: Vector3): Nullable<Vector3> {
        // get is thread safe because gravity is only set in the js side
        const gravityPtr = this._mmdRuntime.wasmInternal.getPhysicsGravity();
        if (gravityPtr === 0) {
            return null;
        }

        result ??= new Vector3();
        const gravity = this._mmdRuntime.wasmInstance.createTypedArray(Float32Array, gravityPtr, 3).array;
        return result.set(gravity[0], gravity[1], gravity[2]);
    }

    public overrideWorldGravity(worldId: number, gravity: Nullable<Vector3>): void {
        this._mmdRuntime.lock.wait();

        if (gravity === null) {
            this._mmdRuntime.wasmInternal.restorePhysicsGravity(worldId);
            return;
        }

        this._mmdRuntime.wasmInternal.overridePhysicsGravity(worldId, gravity.x, gravity.y, gravity.z);
    }

    public getWorldGravity(worldId: number, result?: Vector3): Nullable<Vector3> {
        // get is thread safe because gravity is only set in the js side
        const gravityPtr = this._mmdRuntime.wasmInternal.getPhysicsWorldGravity(worldId);
        if (gravityPtr === 0) {
            return null;
        }

        result ??= new Vector3();
        const gravity = this._mmdRuntime.wasmInstance.createTypedArray(Float32Array, gravityPtr, 3).array;
        return result.set(gravity[0], gravity[1], gravity[2]);
    }
}
