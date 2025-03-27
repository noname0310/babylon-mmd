import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable, Tuple } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "../bulletWasmInstance";
import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";

export interface IRigidBodyBundleImpl {
    readonly shouldSync: boolean;
    readonly needToCommit?: boolean;
    commitToWasm?(
        wasmInstance: BulletWasmInstance,
        bundlePtr: number,
        motionStatesPtr: IWasmTypedArray<Float32Array>,
        temporalKinematicStatesPtr: IWasmTypedArray<Uint8Array>,
        worldTransformPtrArray: Nullable<IWasmTypedArray<Float32Array>>[]
    ): void;
    setTransformMatrixFromArray(
        motionStatesPtr: IWasmTypedArray<Float32Array>,
        temporalKinematicStatesPtr: IWasmTypedArray<Uint8Array>,
        index: number,
        array: DeepImmutable<Tuple<number, 16>>,
        offset: number
    ): void;
    setTransformMatricesFromArray(
        motionStatesPtr: IWasmTypedArray<Float32Array>,
        temporalKinematicStatesPtr: IWasmTypedArray<Uint8Array>,
        array: DeepImmutable<ArrayLike<number>>,
        offset: number
    ): void;
    setDynamicTransformMatrixFromArray(
        worldTransformPtrArray: Nullable<IWasmTypedArray<Float32Array>>[],
        index: number,
        array: DeepImmutable<Tuple<number, 16>>,
        offset: number
    ): void;
    setDamping(
        wasmInstance: BulletWasmInstance,
        bundlePtr: number,
        index: number,
        linearDamping: number,
        angularDamping: number
    ): void;
    getLinearDamping(wasmInstance: BulletWasmInstance, bundlePtr: number, index: number): number;
    getAngularDamping(wasmInstance: BulletWasmInstance, bundlePtr: number, index: number): number;
    setMassProps(
        wasmInstance: BulletWasmInstance,
        bundlePtr: number,
        index: number,
        mass: number,
        localInertia: DeepImmutable<Vector3>
    ): void;
    getMass(wasmInstance: BulletWasmInstance, bundlePtr: number, index: number): number;
    getLocalInertia(wasmInstance: BulletWasmInstance, bundlePtr: number, index: number): Vector3;
    translate(wasmInstance: BulletWasmInstance, bundlePtr: number, index: number, translation: DeepImmutable<Vector3>): void;
}
