import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable, Tuple } from "@babylonjs/core/types";

import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";

import type { IBulletWasmInstance } from "../bulletWasmInstance";

export interface IRigidBodyBundleImpl {
    readonly shouldSync: boolean;
    readonly needToCommit?: boolean;
    commitToWasm?(
        wasmInstance: IBulletWasmInstance,
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
        wasmInstance: IBulletWasmInstance,
        bundlePtr: number,
        index: number,
        linearDamping: number,
        angularDamping: number
    ): void;
    getLinearDamping(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number): number;
    getAngularDamping(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number): number;
    setMassProps(
        wasmInstance: IBulletWasmInstance,
        bundlePtr: number,
        index: number,
        mass: number,
        localInertia: DeepImmutable<Vector3>
    ): void;
    getMass(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number): number;
    getLocalInertia(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number): Vector3;
    translate(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number, translation: DeepImmutable<Vector3>): void;
}
