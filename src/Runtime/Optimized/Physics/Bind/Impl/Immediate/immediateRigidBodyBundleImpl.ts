import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable, Tuple } from "@babylonjs/core/types";

import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";

import type { IBulletWasmInstance } from "../../bulletWasmInstance";
import { BtTransformOffsets, Constants, MotionStateOffsetsInFloat32Array, TemporalKinematicState } from "../../constants";
import type { IRigidBodyBundleImpl } from "../IRigidBodyBundleImpl";

export class ImmediateRigidBodyBundleImpl implements IRigidBodyBundleImpl {
    public readonly shouldSync: boolean;

    private readonly _count: number;

    public constructor(count: number) {
        this.shouldSync = true;
        this._count = count;
    }

    public setTransformMatrixFromArray(
        motionStatesPtr: IWasmTypedArray<Float32Array>,
        temporalKinematicStatesPtr: IWasmTypedArray<Uint8Array>,
        index: number,
        array: DeepImmutable<Tuple<number, 16>>,
        offset: number
    ): void {
        const m = motionStatesPtr.array;
        const mOffset = index * Constants.MotionStateSizeInFloat32Array;

        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 0] = array[offset];
        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 0] = array[offset + 1];
        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 0] = array[offset + 2];

        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 1] = array[offset + 4];
        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 1] = array[offset + 5];
        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 1] = array[offset + 6];

        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 2] = array[offset + 8];
        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 2] = array[offset + 9];
        m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 2] = array[offset + 10];

        m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 0] = array[offset + 12];
        m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 1] = array[offset + 13];
        m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 2] = array[offset + 14];

        const temporalKinematicStates = temporalKinematicStatesPtr.array;
        if (temporalKinematicStates[index] !== TemporalKinematicState.Disabled) {
            temporalKinematicStates[index] = TemporalKinematicState.WaitForRestore;
        }
    }

    public setTransformMatricesFromArray(
        motionStatesPtr: IWasmTypedArray<Float32Array>,
        temporalKinematicStatesPtr: IWasmTypedArray<Uint8Array>,
        array: DeepImmutable<ArrayLike<number>>,
        offset: number
    ): void {
        const m = motionStatesPtr.array;
        const temporalKinematicStates = temporalKinematicStatesPtr.array;

        const count = this._count;
        let mOffset = 0;
        let aOffset = offset;
        for (let i = 0; i < count; ++i) {
            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 0] = array[aOffset];
            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 0] = array[aOffset + 1];
            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 0] = array[aOffset + 2];

            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 1] = array[aOffset + 4];
            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 1] = array[aOffset + 5];
            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 1] = array[aOffset + 6];

            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 2] = array[aOffset + 8];
            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 2] = array[aOffset + 9];
            m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 2] = array[aOffset + 10];

            m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 0] = array[aOffset + 12];
            m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 1] = array[aOffset + 13];
            m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 2] = array[aOffset + 14];

            if (temporalKinematicStates[i] !== TemporalKinematicState.Disabled) {
                temporalKinematicStates[i] = TemporalKinematicState.WaitForRestore;
            }

            mOffset += Constants.MotionStateSizeInFloat32Array;
            aOffset += 16;
        }
    }

    public setDynamicTransformMatrixFromArray(
        worldTransformPtrArray: Nullable<IWasmTypedArray<Float32Array>>[],
        index: number,
        array: DeepImmutable<Tuple<number, 16>>,
        offset: number
    ): void {
        const m = worldTransformPtrArray[index]!.array;

        m[BtTransformOffsets.MatrixRowX + 0] = array[offset];
        m[BtTransformOffsets.MatrixRowY + 0] = array[offset + 1];
        m[BtTransformOffsets.MatrixRowZ + 0] = array[offset + 2];

        m[BtTransformOffsets.MatrixRowX + 1] = array[offset + 4];
        m[BtTransformOffsets.MatrixRowY + 1] = array[offset + 5];
        m[BtTransformOffsets.MatrixRowZ + 1] = array[offset + 6];

        m[BtTransformOffsets.MatrixRowX + 2] = array[offset + 8];
        m[BtTransformOffsets.MatrixRowY + 2] = array[offset + 9];
        m[BtTransformOffsets.MatrixRowZ + 2] = array[offset + 10];

        m[BtTransformOffsets.Translation + 0] = array[offset + 12];
        m[BtTransformOffsets.Translation + 1] = array[offset + 13];
        m[BtTransformOffsets.Translation + 2] = array[offset + 14];
    }

    public setDamping(
        wasmInstance: IBulletWasmInstance,
        bundlePtr: number,
        index: number,
        linearDamping: number,
        angularDamping: number
    ): void {
        wasmInstance.rigidBodyBundleSetDamping(bundlePtr, index, linearDamping, angularDamping);
    }

    public getLinearDamping(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number): number {
        return wasmInstance.rigidBodyBundleGetLinearDamping(bundlePtr, index);
    }

    public getAngularDamping(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number): number {
        return wasmInstance.rigidBodyBundleGetAngularDamping(bundlePtr, index);
    }

    public setMassProps(
        wasmInstance: IBulletWasmInstance,
        bundlePtr: number,
        index: number,
        mass: number,
        localInertia: DeepImmutable<Vector3>
    ): void {
        wasmInstance.rigidBodyBundleSetMassProps(bundlePtr, index, mass, localInertia.x, localInertia.y, localInertia.z);
    }

    public getMass(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number): number {
        return wasmInstance.rigidBodyBundleGetMass(bundlePtr, index);
    }

    public getLocalInertia(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number): Vector3 {
        const outBufferPtr = wasmInstance.allocateBuffer(3 * Constants.A32BytesPerElement);
        const outBuffer = wasmInstance.createTypedArray(Float32Array, outBufferPtr, 3).array;
        wasmInstance.rigidBodyBundleGetLocalInertia(bundlePtr, index, outBufferPtr);
        const result = new Vector3(outBuffer[0], outBuffer[1], outBuffer[2]);
        wasmInstance.deallocateBuffer(outBufferPtr, 3 * Constants.A32BytesPerElement);
        return result;
    }

    public translate(wasmInstance: IBulletWasmInstance, bundlePtr: number, index: number, translation: DeepImmutable<Vector3>): void {
        wasmInstance.rigidBodyBundleTranslate(bundlePtr, index, translation.x, translation.y, translation.z);
    }
}
