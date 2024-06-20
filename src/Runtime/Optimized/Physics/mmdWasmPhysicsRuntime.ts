import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { IWasmTypedArray } from "../IWasmTypedArray";
import type { MmdWasmInstance } from "../mmdWasmInstance";
import type { MmdWasmModel } from "../mmdWasmModel";
import type { MmdWasmRuntime, PhysicsInitializeSet } from "../mmdWasmRuntime";
import type { IMmdWasmPhysicsRuntime } from "./IMmdWasmPhysicsRuntime";

class PhysicsInitializer implements PhysicsInitializeSet {
    private readonly _wasmInternal: InstanceType<MmdWasmInstance["MmdRuntime"]>;

    public constructor(wasmInternal: InstanceType<MmdWasmInstance["MmdRuntime"]>) {
        this._wasmInternal = wasmInternal;
    }

    public add(model: MmdWasmModel): void {
        // this operation is thread safe
        this._wasmInternal.markMmdModelPhysicsAsNeedInit(model.ptr);
    }
}

/**
 * @internal
 */
export class MmdWasmPhysicsRuntime implements IMmdWasmPhysicsRuntime {
    public nextWorldId: number;

    public readonly initializer: PhysicsInitializer;

    private readonly _mmdRuntime: MmdWasmRuntime;
    private _maxSubSteps: number;
    private _fixedTimeStep: number;

    private _worldMatrixBuffer: IWasmTypedArray<Float32Array>;

    public constructor(
        mmdRuntime: MmdWasmRuntime
    ) {
        this.nextWorldId = 0;

        this.initializer = new PhysicsInitializer(mmdRuntime.wasmInternal);

        this._mmdRuntime = mmdRuntime;
        this._maxSubSteps = 120;
        this._fixedTimeStep = 1 / 120;

        const worldMatrixBufferPtr = mmdRuntime.wasmInternal.allocateBuffer(16 * 4);
        this._worldMatrixBuffer = mmdRuntime.wasmInstance.createTypedArray(Float32Array, worldMatrixBufferPtr, 16);
    }

    public dispose(): void {
        if (!this._worldMatrixBuffer) {
            return;
        }

        const worldMatrixBuffer = this._worldMatrixBuffer.array;
        this._mmdRuntime.wasmInternal.deallocateBuffer(worldMatrixBuffer.byteOffset, worldMatrixBuffer.byteLength);

        this._worldMatrixBuffer = null!;
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

    public setMmdModelsWorldMatrix(mmdModels: MmdWasmModel[]): void {
        // set world matrix is thread safe because world matrix applied on before physics step
        const wasmInternal = this._mmdRuntime.wasmInternal;
        const worldMatrixBuffer = this._worldMatrixBuffer;

        for (let i = 0, len = mmdModels.length; i < len; ++i) {
            const mmdModel = mmdModels[i];

            const worldMatrixArray = worldMatrixBuffer.array;
            mmdModel.mesh.getWorldMatrix().copyToArray(worldMatrixArray, 0);
            wasmInternal.setMmdModelWorldMatrix(mmdModel.ptr, worldMatrixArray.byteOffset);
        }
    }
}
