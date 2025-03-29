import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable, Tuple } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "../bulletWasmInstance";
import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";

export interface IRigidBodyImpl {
    readonly shouldSync: boolean;
    readonly needToCommit?: boolean;
    commitToWasm?(
        wasmInstance: BulletWasmInstance,
        bodyPtr: number,
        motionStatePtr: IWasmTypedArray<Float32Array>,
        temporalKinematicStatePtr: IWasmTypedArray<Uint8Array>,
        worldTransformPtr: Nullable<IWasmTypedArray<Float32Array>>
    ): void;
    setTransformMatrixFromArray(
        motionStatePtr: IWasmTypedArray<Float32Array>,
        temporalKinematicStatePtr: IWasmTypedArray<Uint8Array>,
        array: DeepImmutable<Tuple<number, 16>>,
        offset: number
    ): void;
    setDynamicTransformMatrixFromArray(
        worldTransformPtr: IWasmTypedArray<Float32Array>,
        array: DeepImmutable<Tuple<number, 16>>,
        offset: number
    ): void;
    setDamping(
        wasmInstance: BulletWasmInstance,
        bodyPtr: number,
        linearDamping: number,
        angularDamping: number
    ): void;
    getLinearDamping(wasmInstance: BulletWasmInstance, bodyPtr: number): number;
    getAngularDamping(wasmInstance: BulletWasmInstance, bodyPtr: number): number;
    setMassProps(
        wasmInstance: BulletWasmInstance,
        bodyPtr: number,
        mass: number,
        localInertia: DeepImmutable<Vector3>
    ): void;
    getMass(wasmInstance: BulletWasmInstance, bodyPtr: number): number;
    getLocalInertia(wasmInstance: BulletWasmInstance, bodyPtr: number): Vector3;
    translate(wasmInstance: BulletWasmInstance, bodyPtr: number, translation: DeepImmutable<Vector3>): void;
}
