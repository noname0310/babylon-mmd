import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { IWasmTypedArray } from "../Misc/IWasmTypedArray";
import type { IMmdWasmInstance } from "../mmdWasmInstance";
import type { MmdWasmModel } from "../mmdWasmModel";
import { type IPhysicsInitializeSet, type MmdWasmRuntime } from "../mmdWasmRuntime";
import type { IMmdWasmPhysicsRuntime } from "./IMmdWasmPhysicsRuntime";
import type { IMmdWasmPhysicsRuntimeImplCreationOptions, MmdWasmPhysicsRuntimeImpl } from "./mmdWasmPhysicsRuntimeImpl";

class PhysicsInitializer implements IPhysicsInitializeSet {
    private readonly _wasmInternal: ReturnType<IMmdWasmInstance["createMmdRuntime"]>;

    public constructor(wasmInternal: ReturnType<IMmdWasmInstance["createMmdRuntime"]>) {
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
    private readonly _physicsWorldPtr: number;
    private _maxSubSteps: number;
    private _fixedTimeStep: number;
    private readonly _gravity: Vector3;

    private _worldMatrixBuffer: IWasmTypedArray<Float32Array>;

    private _impl: Nullable<MmdWasmPhysicsRuntimeImpl>;

    public constructor(mmdRuntime: MmdWasmRuntime) {
        this.nextWorldId = 0;

        this.initializer = new PhysicsInitializer(mmdRuntime.wasmInternal);

        this._mmdRuntime = mmdRuntime;
        this._physicsWorldPtr = mmdRuntime.wasmInternal.getMultiPhysicsWorld();
        this._maxSubSteps = 5;
        this._fixedTimeStep = 1 / 60;
        this._gravity = new Vector3(0, -98, 0);

        const worldMatrixBufferPtr = mmdRuntime.wasmInstance.allocateBuffer(16 * 4);
        this._worldMatrixBuffer = mmdRuntime.wasmInstance.createTypedArray(Float32Array, worldMatrixBufferPtr, 16);

        this._impl = null;

        this.setGravity(this._gravity);
    }

    public dispose(): void {
        if (!this._worldMatrixBuffer) {
            return;
        }

        const worldMatrixBuffer = this._worldMatrixBuffer.array;
        this._mmdRuntime.wasmInstance.deallocateBuffer(worldMatrixBuffer.byteOffset, worldMatrixBuffer.byteLength);

        this._worldMatrixBuffer = null!;

        this._impl?.dispose();
        this._impl = null;
    }

    /**
     * For multiple physics world methods
     */
    private _nullCheck(): void {
        if (this._worldMatrixBuffer === null) {
            throw new Error("MmdWasmPhysicsRuntime is disposed");
        }
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

    public setGravity(gravity: DeepImmutable<Vector3>): void {
        if (this._impl !== null) {
            this._impl.setGravity(gravity);
        } else {
            this._nullCheck();
            this._mmdRuntime.lock.wait();
            this._mmdRuntime.wasmInstance.multiPhysicsWorldSetGravity(this._physicsWorldPtr, gravity.x, gravity.y, gravity.z);
            this._gravity.copyFrom(gravity);
        }
    }

    public getGravity(result?: Vector3): Nullable<Vector3> {
        if (this._impl !== null) {
            return this._impl.getGravityToRef(result ?? new Vector3());
        } else {
            result ??= new Vector3();
            return result.copyFrom(this._gravity);
        }
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

    public getImpl(implCtor: typeof MmdWasmPhysicsRuntimeImpl, options: IMmdWasmPhysicsRuntimeImplCreationOptions = {}): MmdWasmPhysicsRuntimeImpl {
        if (this._impl === null) {
            this._impl = new implCtor(this._mmdRuntime, this._gravity, options);
        }

        return this._impl;
    }

    public get impl(): Nullable<MmdWasmPhysicsRuntimeImpl> {
        return this._impl;
    }
}
