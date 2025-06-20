import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable, Tuple } from "@babylonjs/core/types";

import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";

import type { IBulletWasmInstance } from "../bulletWasmInstance";

export interface IRigidBodyImpl {
    readonly shouldSync: boolean;
    readonly needToCommit?: boolean;
    commitToWasm?(
        wasmInstance: IBulletWasmInstance,
        bodyPtr: number,
        motionStatePtr: IWasmTypedArray<Float32Array>,
        kinematicStatePtr: IWasmTypedArray<Uint8Array>,
        worldTransformPtr: Nullable<IWasmTypedArray<Float32Array>>
    ): void;
    setTransformMatrixFromArray(
        motionStatePtr: IWasmTypedArray<Float32Array>,
        kinematicStatePtr: IWasmTypedArray<Uint8Array>,
        array: DeepImmutable<Tuple<number, 16>>,
        offset: number
    ): void;
    setDynamicTransformMatrixFromArray(
        worldTransformPtr: IWasmTypedArray<Float32Array>,
        array: DeepImmutable<Tuple<number, 16>>,
        offset: number
    ): void;
    setDamping(
        wasmInstance: IBulletWasmInstance,
        bodyPtr: number,
        linearDamping: number,
        angularDamping: number
    ): void;
    getLinearDamping(wasmInstance: IBulletWasmInstance, bodyPtr: number): number;
    getAngularDamping(wasmInstance: IBulletWasmInstance, bodyPtr: number): number;
    setMassProps(
        wasmInstance: IBulletWasmInstance,
        bodyPtr: number,
        mass: number,
        localInertia: DeepImmutable<Vector3>
    ): void;
    getMass(wasmInstance: IBulletWasmInstance, bodyPtr: number): number;
    getLocalInertia(wasmInstance: IBulletWasmInstance, bodyPtr: number): Vector3;
    translate(wasmInstance: IBulletWasmInstance, bodyPtr: number, translation: DeepImmutable<Vector3>): void;
}
