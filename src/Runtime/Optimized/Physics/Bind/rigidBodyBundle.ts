import type { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable, Tuple } from "@babylonjs/core/types";

import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";

import type { IBulletWasmInstance } from "./bulletWasmInstance";
import { Constants, MotionStateOffsetsInFloat32Array } from "./constants";
import type { IPhysicsRuntime } from "./Impl/IPhysicsRuntime";
import type { IRigidBodyBundleImpl } from "./Impl/IRigidBodyBundleImpl";
import { MotionType } from "./motionType";
import type { PhysicsShape } from "./physicsShape";
import type { RigidBodyConstructionInfoList } from "./rigidBodyConstructionInfoList";

class RigidBodyBundleInner {
    private readonly _wasmInstance: WeakRef<IBulletWasmInstance>;
    private _ptr: number;
    private readonly _vector3Buffer1: IWasmTypedArray<Float32Array>;
    private readonly _vector3Buffer2: IWasmTypedArray<Float32Array>;
    private readonly _shapeReferences: PhysicsShape[];
    private _referenceCount: number;
    private _shadowCount: number;

    public constructor(wasmInstance: IBulletWasmInstance, ptr: number, shapeReferences: PhysicsShape[]) {
        this._wasmInstance = new WeakRef(wasmInstance);
        this._ptr = ptr;

        const vector3Buffer1Ptr = wasmInstance.allocateBuffer(3 * Constants.A32BytesPerElement);
        this._vector3Buffer1 = wasmInstance.createTypedArray(Float32Array, vector3Buffer1Ptr, 3);

        const vector3Buffer2Ptr = wasmInstance.allocateBuffer(3 * Constants.A32BytesPerElement);
        this._vector3Buffer2 = wasmInstance.createTypedArray(Float32Array, vector3Buffer2Ptr, 3);

        this._shapeReferences = shapeReferences;
        for (let i = 0; i < shapeReferences.length; ++i) {
            shapeReferences[i].addReference();
        }
        this._referenceCount = 0;
        this._shadowCount = 0;
    }

    public dispose(): void {
        if (this._referenceCount > 0) {
            throw new Error("Cannot dispose rigid body bundle while it still has references");
        }

        if (this._ptr === 0) {
            return;
        }

        const wasmInstance = this._wasmInstance.deref();

        if (wasmInstance !== undefined) {
            wasmInstance.deallocateBuffer(this._vector3Buffer1.array.byteOffset, 3 * Constants.A32BytesPerElement);
            wasmInstance.deallocateBuffer(this._vector3Buffer2.array.byteOffset, 3 * Constants.A32BytesPerElement);

            // this operation is thread-safe because the rigid body bundle is not belong to any physics world
            wasmInstance.destroyRigidBodyBundle(this._ptr);
        }

        this._ptr = 0;
        for (const shape of this._shapeReferences) {
            shape.removeReference();
        }
        this._shapeReferences.length = 0;
    }

    public get ptr(): number {
        return this._ptr;
    }

    public get vector3Buffer1(): IWasmTypedArray<Float32Array> {
        return this._vector3Buffer1;
    }

    public get vector3Buffer2(): IWasmTypedArray<Float32Array> {
        return this._vector3Buffer2;
    }

    public addReference(): void {
        this._referenceCount += 1;
    }

    public removeReference(): void {
        this._referenceCount -= 1;
    }

    public get hasReferences(): boolean {
        return 0 < this._referenceCount;
    }

    public addShadow(): void {
        this._shadowCount += 1;
    }

    public removeShadow(): void {
        this._shadowCount -= 1;
    }

    public get hasShadows(): boolean {
        return 0 < this._shadowCount;
    }

    public getShapeReference(index: number): PhysicsShape {
        return this._shapeReferences[index];
    }

    public setShapeReference(index: number, shape: PhysicsShape): void {
        this._shapeReferences[index].removeReference();
        this._shapeReferences[index] = shape;
        shape.addReference();
    }
}

function RigidBodyBundleFinalizer(inner: RigidBodyBundleInner): void {
    inner.dispose();
}

const PhysicsRigidBodyBundleRegistryMap = new WeakMap<IBulletWasmInstance, FinalizationRegistry<RigidBodyBundleInner>>();

/**
 * bundle of bullet physics rigid bodies
 *
 * rigid body bundle is a collection of rigid bodies
 * that allocates all of its motion state data
 * in the one big linearly contiguous memory
 *
 * Bundle is useful for following cases:
 * - when you have a lot of rigid bodies
 * - when you want manage several rigid bodies as a group
 */
export class RigidBodyBundle {
    /**
     * @internal
     */
    public readonly runtime: IPhysicsRuntime;

    private readonly _motionStatesPtr: IWasmTypedArray<Float32Array>;
    private _bufferedMotionStatesPtr: IWasmTypedArray<Float32Array>;
    // save only dynamic body ptr for temporal kinematic
    private readonly _worldTransformPtrArray: Nullable<IWasmTypedArray<Float32Array>>[];
    private readonly _kinematicStatesPtr: IWasmTypedArray<Uint8Array>;

    private readonly _inner: RigidBodyBundleInner;
    private readonly _count: number;

    private _worldReference: Nullable<object>;

    /**
     * @internal
     */
    public impl: IRigidBodyBundleImpl;

    /**
     * Whether this bundle contains dynamic rigid bodies
     */
    public readonly isContainsDynamic: boolean;

    /**
     * Create a new rigid body bundle
     * @param runtime The physics runtime
     * @param info The rigid body construction info list
     * @param countOverride The number of rigid bodies in the bundle
     */
    public constructor(runtime: IPhysicsRuntime, info: RigidBodyConstructionInfoList, countOverride?: number) {
        if (info.ptr === 0) {
            throw new Error("Cannot create rigid body bundle with null pointer");
        }
        if (countOverride !== undefined) {
            if (info.count < countOverride) {
                throw new Error("Cannot create rigid body bundle with count greater than info count");
            }
            countOverride = Math.max(0, countOverride);
        }
        const count = countOverride ?? info.count;
        const shapeReferences: PhysicsShape[] = [];
        for (let i = 0; i < count; ++i) {
            const shape = info.getShape(i);
            if (shape === null) {
                throw new Error("Cannot create rigid body bundle with null shape");
            }
            if (shape.runtime !== runtime) {
                throw new Error("Cannot create rigid body bundle with shapes from different runtimes");
            }
            shapeReferences.push(shape);
        }

        this.runtime = runtime;
        const wasmInstance = runtime.wasmInstance;
        const ptr = wasmInstance.createRigidBodyBundle(info.ptr, count);
        const motionStatesPtr = wasmInstance.rigidBodyBundleGetMotionStatesPtr(ptr);
        this._motionStatesPtr = wasmInstance.createTypedArray(Float32Array, motionStatesPtr, count * Constants.MotionStateSizeInFloat32Array);
        const bufferedMotionStatesPtr = wasmInstance.rigidBodyBundleGetBufferedMotionStatesPtr(ptr);
        this._bufferedMotionStatesPtr = wasmInstance.createTypedArray(Float32Array, bufferedMotionStatesPtr, count * Constants.MotionStateSizeInFloat32Array);
        const worldTransformPtrArray: Nullable<IWasmTypedArray<Float32Array>>[] = [];
        let isContainsDynamic = false;
        for (let i = 0; i < count; ++i) {
            if (info.getMotionType(i) === MotionType.Dynamic) {
                isContainsDynamic = true;
                const worldTransformPtr = wasmInstance.rigidBodyBundleGetWorldTransformPtr(ptr, i);
                worldTransformPtrArray.push(wasmInstance.createTypedArray(Float32Array, worldTransformPtr, Constants.BtTransformSizeInFloat32Array));
            } else {
                worldTransformPtrArray.push(null);
            }
        }
        this._worldTransformPtrArray = worldTransformPtrArray;
        const kinematicStatesPtr = wasmInstance.rigidBodyBundleGetKinematicStatesPtr(ptr);
        this._kinematicStatesPtr = wasmInstance.createTypedArray(Uint8Array, kinematicStatesPtr, count);
        this._inner = new RigidBodyBundleInner(runtime.wasmInstance, ptr, shapeReferences);
        this._count = count;
        this._worldReference = null;

        let registry = PhysicsRigidBodyBundleRegistryMap.get(wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(RigidBodyBundleFinalizer);
            PhysicsRigidBodyBundleRegistryMap.set(wasmInstance, registry);
        }

        registry.register(this, this._inner, this);

        this.impl = runtime.createRigidBodyBundleImpl(this);
        this.isContainsDynamic = isContainsDynamic;
    }

    /**
     * Dispose the rigid body bundle
     *
     * rigid body bundle must be removed from the world before disposing
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = PhysicsRigidBodyBundleRegistryMap.get(this.runtime.wasmInstance);
        registry?.unregister(this);
    }

    /**
     * @internal
     */
    public get ptr(): number {
        return this._inner.ptr;
    }

    /**
     * The number of rigid bodies in the bundle
     */
    public get count(): number {
        return this._count;
    }

    /**
     * @internal
     */
    public addReference(): void {
        this._inner.addReference();
    }

    /**
     * @internal
     */
    public removeReference(): void {
        this._inner.removeReference();
    }

    /**
     * @internal
     */
    public addShadowReference(): void {
        this._inner.addShadow();
    }

    /**
     * @internal
     */
    public removeShadowReference(): void {
        this._inner.removeShadow();
    }

    /**
     * @internal
     */
    public get hasShadows(): boolean {
        return this._inner.hasShadows;
    }

    /**
     * @internal
     */
    public setWorldReference(worldReference: Nullable<object>): void {
        if (this._worldReference !== null && worldReference !== null) {
            throw new Error("Cannot add rigid body bundle to multiple worlds");
        }
        if (this._worldReference === worldReference) {
            return;
        }
        this._worldReference = worldReference;
        if (worldReference !== null) {
            this._inner.addReference();
        } else {
            this._inner.removeReference();
        }
    }

    /**
     * @internal
     */
    public getWorldReference(): Nullable<object> {
        return this._worldReference;
    }

    /**
     * @internal
     */
    public updateBufferedMotionStates(forceUseFrontBuffer: boolean): void {
        this._nullCheck();
        if (forceUseFrontBuffer) {
            const motionStatesPtr = this.runtime.wasmInstance.rigidBodyBundleGetMotionStatesPtr(this._inner.ptr);
            this._bufferedMotionStatesPtr = this.runtime.wasmInstance.createTypedArray(Float32Array, motionStatesPtr, this._count * Constants.MotionStateSizeInFloat32Array);
        } else {
            const bufferedMotionStatesPtr = this.runtime.wasmInstance.rigidBodyBundleGetBufferedMotionStatesPtr(this._inner.ptr);
            this._bufferedMotionStatesPtr = this.runtime.wasmInstance.createTypedArray(Float32Array, bufferedMotionStatesPtr, this._count * Constants.MotionStateSizeInFloat32Array);
        }
    }


    private _nullCheck(): void {
        if (this._inner.ptr === 0) {
            throw new Error("Cannot access disposed rigid body bundle");
        }
    }

    /**
     * Get the transform matrix of the rigid body at the given index
     * @param index Index of the rigid body
     * @param result The matrix to store the result
     * @returns The transform matrix of the rigid body
     */
    public getTransformMatrixToRef(index: number, result: Matrix): Matrix {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }

        const m = this._bufferedMotionStatesPtr.array;
        const offset = index * Constants.MotionStateSizeInFloat32Array;

        return result.set(
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowX + 0],
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowY + 0],
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 0],
            0,
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowX + 1],
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowY + 1],
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 1],
            0,
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowX + 2],
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowY + 2],
            m[offset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 2],
            0,
            m[offset + MotionStateOffsetsInFloat32Array.Translation + 0],
            m[offset + MotionStateOffsetsInFloat32Array.Translation + 1],
            m[offset + MotionStateOffsetsInFloat32Array.Translation + 2],
            1
        );
    }

    /**
     * Get the transform matrix of the rigid body at the given index
     * @param index Index of the rigid body
     * @param result The matrix to store the result
     * @param offset The offset in the result matrix
     */
    public getTransformMatrixToArray(index: number, result: Float32Array, offset: number = 0): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }

        const m = this._bufferedMotionStatesPtr.array;
        const mOffset = index * Constants.MotionStateSizeInFloat32Array;

        result[offset + 0] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 0];
        result[offset + 1] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 0];
        result[offset + 2] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 0];
        result[offset + 3] = 0;

        result[offset + 4] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 1];
        result[offset + 5] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 1];
        result[offset + 6] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 1];
        result[offset + 7] = 0;

        result[offset + 8] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 2];
        result[offset + 9] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 2];
        result[offset + 10] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 2];
        result[offset + 11] = 0;

        result[offset + 12] = m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 0];
        result[offset + 13] = m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 1];
        result[offset + 14] = m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 2];
        result[offset + 15] = 1;
    }

    /**
     * Get the transform matrices of the rigid bodies in the bundle
     * @param result The array to store the result
     * @param offset The offset in the result array
     */
    public getTransformMatricesToArray(result: Float32Array, offset: number = 0): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }

        const m = this._bufferedMotionStatesPtr.array;

        const count = this._count;
        let mOffset = 0;
        let rOffset = offset;
        for (let i = 0; i < count; ++i) {
            result[rOffset + 0] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 0];
            result[rOffset + 1] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 0];
            result[rOffset + 2] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 0];
            result[rOffset + 3] = 0;

            result[rOffset + 4] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 1];
            result[rOffset + 5] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 1];
            result[rOffset + 6] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 1];
            result[rOffset + 7] = 0;

            result[rOffset + 8] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowX + 2];
            result[rOffset + 9] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowY + 2];
            result[rOffset + 10] = m[mOffset + MotionStateOffsetsInFloat32Array.MatrixRowZ + 2];
            result[rOffset + 11] = 0;

            result[rOffset + 12] = m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 0];
            result[rOffset + 13] = m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 1];
            result[rOffset + 14] = m[mOffset + MotionStateOffsetsInFloat32Array.Translation + 2];
            result[rOffset + 15] = 1;

            mOffset += Constants.MotionStateSizeInFloat32Array;
            rOffset += 16;
        }
    }

    /**
     * Set the transform matrix of the rigid body at the given index
     *
     * This method will work only if the rigid body motion type is kinematic
     *
     * Application can be deferred to the next frame when world evaluating the bundle
     * @param index Index of the rigid body
     * @param matrix The transform matrix to set
     */
    public setTransformMatrix(index: number, matrix: Matrix): void {
        this.setTransformMatrixFromArray(index, matrix.m, 0);
    }

    /**
     * Set the transform matrix of the rigid body at the given index
     *
     * This method will work only if the rigid body motion type is kinematic
     *
     * Application can be deferred to the next frame when world evaluating the bundle
     * @param index Index of the rigid body
     * @param array The array to set
     * @param offset The offset in the array
     */
    public setTransformMatrixFromArray(index: number, array: DeepImmutable<Tuple<number, 16>>, offset: number = 0): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setTransformMatrixFromArray(this._motionStatesPtr, this._kinematicStatesPtr, index, array, offset);
    }

    /**
     * Set the transform matrices of the rigid bodies in the bundle
     *
     * This method will work only if the rigid body motion type is kinematic
     *
     * Application can be deferred to the next frame when world evaluating the bundle
     * @param array The array to set
     * @param offset The offset in the array
     */
    public setTransformMatricesFromArray(array: DeepImmutable<ArrayLike<number>>, offset: number = 0): void {
        this._nullCheck();
        if (array.length < this._count * 16) {
            throw new RangeError("Array is too short");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setTransformMatricesFromArray(this._motionStatesPtr, this._kinematicStatesPtr, array, offset);
    }

    /**
     * Set the dynamic transform matrix of the rigid body at the given index
     *
     * This method will work only if the rigid body motion type is dynamic
     *
     * Application can be deferred to the next frame when world evaluating the bundle
     * @param index Index of the rigid body
     * @param matrix The transform matrix to set
     * @param fallbackToSetTransformMatrix Whether to fallback to setTransformMatrix if the rigid body is not dynamic
     */
    public setDynamicTransformMatrix(index: number, matrix: Matrix, fallbackToSetTransformMatrix: boolean = false): void {
        this.setDynamicTransformMatrixFromArray(index, matrix.m, 0, fallbackToSetTransformMatrix);
    }

    /**
     * Set the dynamic transform matrix of the rigid body at the given index
     *
     * This method will work only if the rigid body motion type is dynamic
     *
     * Application can be deferred to the next frame when world evaluating the bundle
     * @param index Index of the rigid body
     * @param array The array to set
     * @param offset The offset in the array
     * @param fallbackToSetTransformMatrix Whether to fallback to setTransformMatrix if the rigid body is not dynamic
     */
    public setDynamicTransformMatrixFromArray(index: number, array: DeepImmutable<Tuple<number, 16>>, offset: number = 0, fallbackToSetTransformMatrix: boolean = false): void {
        if (this._worldTransformPtrArray[index] === null) {
            if (fallbackToSetTransformMatrix) {
                this.setTransformMatrixFromArray(index, array, offset);
                return;
            } else {
                throw new Error("Cannot set dynamic transform of non-dynamic body");
            }
        }
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setDynamicTransformMatrixFromArray(this._worldTransformPtrArray, index, array, offset);
    }

    /**
     * Set the linear and angular damping of the rigid body at the given index
     *
     * Application can be deferred to the next frame when world evaluating the bundle
     * @param index Index of the rigid body
     * @param linearDamping Linear damping
     * @param angularDamping Angular damping
     */
    public setDamping(index: number, linearDamping: number, angularDamping: number): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setDamping(this.runtime.wasmInstance, this._inner.ptr, index, linearDamping, angularDamping);
    }

    /**
     * Get the linear damping of the rigid body at the given index
     * @param index Index of the rigid body
     * @return The linear damping of the rigid body
     */
    public getLinearDamping(index: number): number {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        // does not need to synchronization because local inertia is not changed by physics simulation
        return this.impl.getLinearDamping(this.runtime.wasmInstance, this._inner.ptr, index);
    }

    /**
     * Get the angular damping of the rigid body at the given index
     * @param index Index of the rigid body
     * @return The angular damping of the rigid body
     */
    public getAngularDamping(index: number): number {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        // does not need to synchronization because local inertia is not changed by physics simulation
        return this.impl.getAngularDamping(this.runtime.wasmInstance, this._inner.ptr, index);
    }

    /**
     * Set the mass and local inertia of the rigid body at the given index
     *
     * Application can be deferred to the next frame when world evaluating the bundle
     * @param index Index of the rigid body
     * @param mass Mass
     * @param localInertia Local inertia
     */
    public setMassProps(index: number, mass: number, localInertia: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setMassProps(this.runtime.wasmInstance, this._inner.ptr, index, mass, localInertia);
    }

    /**
     * Get the mass of the rigid body at the given index
     * @param index Index of the rigid body
     * @return The mass of the rigid body
     */
    public getMass(index: number): number {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        // does not need to synchronization because local inertia is not changed by physics simulation
        return this.impl.getMass(this.runtime.wasmInstance, this._inner.ptr, index);
    }

    /**
     * Get the local inertia of the rigid body at the given index
     * @param index Index of the rigid body
     * @return The local inertia of the rigid body
     */
    public getLocalInertia(index: number): Vector3 {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        // does not need to synchronization because local inertia is not changed by physics simulation
        return this.impl.getLocalInertia(this.runtime.wasmInstance, this._inner.ptr, index);
    }

    /**
     * Translate the rigid body at the given index
     *
     * Application can be deferred to the next frame when world evaluating the bundle
     * @param index Index of the rigid body
     * @param translation The translation vector
     */
    public translate(index: number, translation: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }

        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.translate(this.runtime.wasmInstance, this._inner.ptr, index, translation);
    }

    /**
     * @internal
     */
    public get needToCommit(): boolean {
        return this.impl.needToCommit ?? false;
    }

    /**
     * @internal
     */
    public commitToWasm(): void {
        if (this.impl.commitToWasm === undefined) {
            throw new Error("commit only avalible on buffered evaluation mode");
        }
        this._nullCheck();
        this.runtime.lock.wait();

        this.impl.commitToWasm(
            this.runtime.wasmInstance,
            this._inner.ptr,
            this._motionStatesPtr,
            this._kinematicStatesPtr,
            this._worldTransformPtrArray
        );
    }

    // these methods need to be always synchronized

    /**
     * Get the total force of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param result The vector to store the result
     * @returns The total force of the rigid body
     */
    public getTotalForceToRef(index: number, result: Vector3): Vector3 {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyBundleGetTotalForce(this._inner.ptr, index, vector3Buffer1.byteOffset);
        return result.copyFromFloats(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Get the total torque of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param result The vector to store the result
     * @returns The total torque of the rigid body
     */
    public getTotalTorqueToRef(index: number, result: Vector3): Vector3 {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyBundleGetTotalTorque(this._inner.ptr, index, vector3Buffer1.byteOffset);
        return result.copyFromFloats(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Apply a central force to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param force The force vector
     */
    public applyCentralForce(index: number, force: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleApplyCentralForce(this._inner.ptr, index, force.x, force.y, force.z);
    }

    /**
     * Apply a torque to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param torque The torque vector
     */
    public applyTorque(index: number, torque: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleApplyTorque(this._inner.ptr, index, torque.x, torque.y, torque.z);
    }

    /**
     * Apply a force to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param force The force vector
     * @param relativePosition The relative position vector
     */
    public applyForce(index: number, force: DeepImmutable<Vector3>, relativePosition: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        vector3Buffer1[0] = force.x;
        vector3Buffer1[1] = force.y;
        vector3Buffer1[2] = force.z;
        const vector3Buffer2 = this._inner.vector3Buffer2.array;
        vector3Buffer2[0] = relativePosition.x;
        vector3Buffer2[1] = relativePosition.y;
        vector3Buffer2[2] = relativePosition.z;
        this.runtime.wasmInstance.rigidBodyBundleApplyForce(this._inner.ptr, index, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
    }

    /**
     * Apply a push force to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param impulse The impulse vector
     */
    public applyCentralImpulse(index: number, impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleApplyCentralImpulse(this._inner.ptr, index, impulse.x, impulse.y, impulse.z);
    }

    /**
     * Apply a torque impulse to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param impulse The impulse vector
     */
    public applyTorqueImpulse(index: number, impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleApplyTorqueImpulse(this._inner.ptr, index, impulse.x, impulse.y, impulse.z);
    }

    /**
     * Apply an impulse to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param impulse The impulse vector
     * @param relativePosition The relative position vector
     */
    public applyImpulse(index: number, impulse: DeepImmutable<Vector3>, relativePosition: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        vector3Buffer1[0] = impulse.x;
        vector3Buffer1[1] = impulse.y;
        vector3Buffer1[2] = impulse.z;
        const vector3Buffer2 = this._inner.vector3Buffer2.array;
        vector3Buffer2[0] = relativePosition.x;
        vector3Buffer2[1] = relativePosition.y;
        vector3Buffer2[2] = relativePosition.z;
        this.runtime.wasmInstance.rigidBodyBundleApplyImpulse(this._inner.ptr, index, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
    }

    /**
     * Apply a push impulse to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param impulse The impulse vector
     * @param relativePosition The relative position vector
     */
    public applyPushImpulse(index: number, impulse: DeepImmutable<Vector3>, relativePosition: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        vector3Buffer1[0] = impulse.x;
        vector3Buffer1[1] = impulse.y;
        vector3Buffer1[2] = impulse.z;
        const vector3Buffer2 = this._inner.vector3Buffer2.array;
        vector3Buffer2[0] = relativePosition.x;
        vector3Buffer2[1] = relativePosition.y;
        vector3Buffer2[2] = relativePosition.z;
        this.runtime.wasmInstance.rigidBodyBundleApplyPushImpulse(this._inner.ptr, index, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
    }

    /**
     * Get the push velocity of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param result The vector to store the result
     * @returns The push velocity of the rigid body
     */
    public getPushVelocityToRef(index: number, result: Vector3): DeepImmutable<Vector3> {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyBundleGetPushVelocity(this._inner.ptr, index, vector3Buffer1.byteOffset);
        return result.copyFromFloats(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Get the turn velocity of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param result The vector to store the result
     * @returns The turn velocity of the rigid body
     */
    public getTurnVelocityToRef(index: number, result: Vector3): Vector3 {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyBundleGetTurnVelocity(this._inner.ptr, index, vector3Buffer1.byteOffset);
        return result.copyFromFloats(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Set the push velocity of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param velocity The push velocity vector
     */
    public setPushVelocity(index: number, velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleSetPushVelocity(this._inner.ptr, index, velocity.x, velocity.y, velocity.z);
    }

    /**
     * Set the turn velocity of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param velocity The turn velocity vector
     */
    public setTurnVelocity(index: number, velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleSetTurnVelocity(this._inner.ptr, index, velocity.x, velocity.y, velocity.z);
    }

    /**
     * Apply a central push impulse to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param impulse The impulse vector
     */
    public applyCentralPushImpulse(index: number, impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleApplyCentralPushImpulse(this._inner.ptr, index, impulse.x, impulse.y, impulse.z);
    }

    /**
     * Apply a torque turn impulse to the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param impulse The impulse vector
     */
    public applyTorqueTurnImpulse(index: number, impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleApplyTorqueTurnImpulse(this._inner.ptr, index, impulse.x, impulse.y, impulse.z);
    }

    /**
     * Clear the forces of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     */
    public clearForces(index: number): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleClearForces(this._inner.ptr, index);
    }

    /**
     * Get the linear velocity of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param result The vector to store the result
     * @returns The linear velocity of the rigid body
     */
    public getLinearVelocityToRef(index: number, result: Vector3): Vector3 {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyBundleGetLinearVelocity(this._inner.ptr, index, vector3Buffer1.byteOffset);
        return result.copyFromFloats(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Get the angular velocity of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param result The vector to store the result
     * @returns The angular velocity of the rigid body
     */
    public getAngularVelocityToRef(index: number, result: Vector3): Vector3 {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyBundleGetAngularVelocity(this._inner.ptr, index, vector3Buffer1.byteOffset);
        return result.copyFromFloats(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Set the linear velocity of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param velocity The linear velocity vector
     */
    public setLinearVelocity(index: number, velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleSetLinearVelocity(this._inner.ptr, index, velocity.x, velocity.y, velocity.z);
    }

    /**
     * Set the angular velocity of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param velocity The angular velocity vector
     */
    public setAngularVelocity(index: number, velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyBundleSetAngularVelocity(this._inner.ptr, index, velocity.x, velocity.y, velocity.z);
    }

    /**
     * Get the velocity of the rigid body at the given index in the local point
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param relativePosition The relative position vector
     * @param result The vector to store the result
     * @returns The velocity of the rigid body at the given index in the local point
     */
    public getVelocityInLocalPointToRef(index: number, relativePosition: DeepImmutable<Vector3>, result: Vector3): Vector3 {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        const vector3Buffer2 = this._inner.vector3Buffer2.array;
        vector3Buffer1[0] = relativePosition.x;
        vector3Buffer1[1] = relativePosition.y;
        vector3Buffer1[2] = relativePosition.z;
        this.runtime.wasmInstance.rigidBodyBundleGetVelocityInLocalPoint(this._inner.ptr, index, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
        return result.set(vector3Buffer2[0], vector3Buffer2[1], vector3Buffer2[2]);
    }

    /**
     * Get the push velocity of the rigid body at the given index in the local point
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param relativePosition The relative position vector
     * @param result The vector to store the result
     * @returns The push velocity of the rigid body at the given index in the local point
     */
    public getPushVelocityInLocalPointToRef(index: number, relativePosition: DeepImmutable<Vector3>, result: Vector3): Vector3 {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        const vector3Buffer2 = this._inner.vector3Buffer2.array;
        vector3Buffer1[0] = relativePosition.x;
        vector3Buffer1[1] = relativePosition.y;
        vector3Buffer1[2] = relativePosition.z;
        this.runtime.wasmInstance.rigidBodyBundleGetPushVelocityInLocalPoint(this._inner.ptr, index, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
        return result.set(vector3Buffer2[0], vector3Buffer2[1], vector3Buffer2[2]);
    }

    /**
     * Get the shape of the rigid body at the given index
     * @param index Index of the rigid body
     * @returns The shape of the rigid body
     */
    public getShape(index: number): PhysicsShape {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        return this._inner.getShapeReference(index);
    }

    /**
     * Set the shape of the rigid body at the given index
     *
     * This operation is always synchronized
     * @param index Index of the rigid body
     * @param shape The shape to set
     */
    public setShape(index: number, shape: PhysicsShape): void {
        this._nullCheck();
        if (index < 0 || this._count <= index) {
            throw new RangeError("Index out of range");
        }
        if (shape.runtime !== this.runtime) {
            throw new Error("Cannot set shape from different runtime");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this._inner.setShapeReference(index, shape);
        this.runtime.wasmInstance.rigidBodyBundleSetShape(this._inner.ptr, index, shape.ptr);
    }
}
