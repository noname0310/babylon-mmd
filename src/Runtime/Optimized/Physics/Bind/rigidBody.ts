import type { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable, Tuple } from "@babylonjs/core/types";

import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";

import type { IBulletWasmInstance } from "./bulletWasmInstance";
import { Constants, MotionStateOffsetsInFloat32Array } from "./constants";
import type { IPhysicsRuntime } from "./Impl/IPhysicsRuntime";
import type { IRigidBodyImpl } from "./Impl/IRigidBodyImpl";
import { MotionType } from "./motionType";
import type { PhysicsShape } from "./physicsShape";
import type { RigidBodyConstructionInfo } from "./rigidBodyConstructionInfo";
import type { RigidBodyConstructionInfoList } from "./rigidBodyConstructionInfoList";

class RigidBodyInner {
    private readonly _wasmInstance: WeakRef<IBulletWasmInstance>;
    private _ptr: number;
    private readonly _vector3Buffer1: IWasmTypedArray<Float32Array>;
    private readonly _vector3Buffer2: IWasmTypedArray<Float32Array>;
    private _shapeReference: Nullable<PhysicsShape>;
    private _referenceCount: number;
    private _shadowCount: number;

    public constructor(wasmInstance: IBulletWasmInstance, ptr: number, shapeReference: PhysicsShape) {
        this._wasmInstance = new WeakRef(wasmInstance);
        this._ptr = ptr;

        const vector3Buffer1Ptr = wasmInstance.allocateBuffer(3 * Constants.A32BytesPerElement);
        this._vector3Buffer1 = wasmInstance.createTypedArray(Float32Array, vector3Buffer1Ptr, 3);

        const vector3Buffer2Ptr = wasmInstance.allocateBuffer(3 * Constants.A32BytesPerElement);
        this._vector3Buffer2 = wasmInstance.createTypedArray(Float32Array, vector3Buffer2Ptr, 3);

        this._shapeReference = shapeReference;
        shapeReference.addReference();
        this._referenceCount = 0;
        this._shadowCount = 0;
    }

    public dispose(): void {
        if (this._referenceCount > 0) {
            throw new Error("Cannot dispose rigid body while it still has references");
        }

        if (this._shadowCount > 0) {
            throw new Error("Cannot dispose rigid body while it still has shadows");
        }

        if (this._ptr === 0) {
            return;
        }

        const wasmInstance = this._wasmInstance.deref();

        if (wasmInstance !== undefined) {
            wasmInstance.deallocateBuffer(this._vector3Buffer1.array.byteOffset, 3 * Constants.A32BytesPerElement);
            wasmInstance.deallocateBuffer(this._vector3Buffer2.array.byteOffset, 3 * Constants.A32BytesPerElement);

            // this operation is thread-safe because the rigid body is not belong to any physics world
            wasmInstance.destroyRigidBody(this._ptr);
        }

        this._ptr = 0;
        this._shapeReference!.removeReference();
        this._shapeReference = null;
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

    public getShapeReference(): PhysicsShape {
        return this._shapeReference!;
    }

    public setShapeReference(shape: PhysicsShape): void {
        this._shapeReference!.removeReference();
        this._shapeReference = shape;
        shape.addReference();
    }
}

function RigidBodyFinalizer(inner: RigidBodyInner): void {
    inner.dispose();
}

const PhysicsRigidBodyRegistryMap = new WeakMap<IBulletWasmInstance, FinalizationRegistry<RigidBodyInner>>();

/**
 * bullet physics rigid body
 */
export class RigidBody {
    /**
     * @internal
     */
    public readonly runtime: IPhysicsRuntime;

    private readonly _motionStatePtr: IWasmTypedArray<Float32Array>;
    private _bufferedMotionStatePtr: IWasmTypedArray<Float32Array>;
    // save only dynamic body ptr for temporal kinematic
    private readonly _worldTransformPtr: Nullable<IWasmTypedArray<Float32Array>>;
    private readonly _kinematicStatePtr: IWasmTypedArray<Uint8Array>;

    private readonly _inner: RigidBodyInner;

    private _worldReference: Nullable<object>;

    /**
     * @internal
     */
    public impl: IRigidBodyImpl;

    /**
     * Whether this rigid body is dynamic or not(kinematic or static)
     */
    public readonly isDynamic: boolean;

    /**
     * Create a new rigid body with the given construction info
     * @param runtime The physics runtime
     * @param info The construction info for the rigid body
     */
    public constructor(runtime: IPhysicsRuntime, info: RigidBodyConstructionInfo);

    /**
     * Create a new rigid body with the given construction info list
     * @param runtime The physics runtime
     * @param info The construction info list for the rigid body
     * @param n The index of the construction info in the list
     */
    public constructor(runtime: IPhysicsRuntime, info: RigidBodyConstructionInfoList, n: number);

    public constructor(runtime: IPhysicsRuntime, info: RigidBodyConstructionInfo | RigidBodyConstructionInfoList, n?: number) {
        const infoPtr = n !== undefined ? (info as RigidBodyConstructionInfoList).getPtr(n) : (info as RigidBodyConstructionInfo).ptr;

        if (infoPtr === 0) {
            throw new Error("Cannot create rigid body with null pointer");
        }

        let shape: Nullable<PhysicsShape>;
        if (n !== undefined) {
            shape = (info as RigidBodyConstructionInfoList).getShape(n);
        } else {
            shape = (info as RigidBodyConstructionInfo).shape;
        }
        if (shape === null) {
            throw new Error("Cannot create rigid body with null shape");
        }
        if (shape.runtime !== runtime) {
            throw new Error("Cannot create rigid body with shapes from different runtimes");
        }

        const isDynamic = n !== undefined
            ? (info as RigidBodyConstructionInfoList).getMotionType(n) === MotionType.Dynamic
            : (info as RigidBodyConstructionInfo).motionType === MotionType.Dynamic;

        this.runtime = runtime;
        const wasmInstance = runtime.wasmInstance;
        const ptr = wasmInstance.createRigidBody(infoPtr);
        const motionStatePtr = wasmInstance.rigidBodyGetMotionStatePtr(ptr);
        this._motionStatePtr = wasmInstance.createTypedArray(Float32Array, motionStatePtr, Constants.MotionStateSizeInFloat32Array);
        const bufferedMotionStatePtr = wasmInstance.rigidBodyGetBufferedMotionStatePtr(ptr);
        this._bufferedMotionStatePtr = wasmInstance.createTypedArray(Float32Array, bufferedMotionStatePtr, Constants.MotionStateSizeInFloat32Array);
        if (isDynamic) {
            const worldTransformPtr = wasmInstance.rigidBodyGetWorldTransformPtr(ptr);
            this._worldTransformPtr = wasmInstance.createTypedArray(Float32Array, worldTransformPtr, Constants.BtTransformSizeInFloat32Array);
        } else {
            this._worldTransformPtr = null;
        }
        const kinematicStatePtr = wasmInstance.rigidBodyGetKinematicStatePtr(ptr);
        this._kinematicStatePtr = wasmInstance.createTypedArray(Uint8Array, kinematicStatePtr, 1);
        this._inner = new RigidBodyInner(runtime.wasmInstance, ptr, shape);
        this._worldReference = null;

        let registry = PhysicsRigidBodyRegistryMap.get(wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(RigidBodyFinalizer);
            PhysicsRigidBodyRegistryMap.set(wasmInstance, registry);
        }

        registry.register(this, this._inner, this);

        this.impl = runtime.createRigidBodyImpl();
        this.isDynamic = isDynamic;
    }

    /**
     * Dispose the rigid body
     *
     * rigid body must be removed from the world before disposing
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = PhysicsRigidBodyRegistryMap.get(this.runtime.wasmInstance);
        registry?.unregister(this);
    }

    /**
     * @internal
     */
    public get ptr(): number {
        return this._inner.ptr;
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
            throw new Error("Cannot add rigid body to multiple worlds");
        }
        if (this._worldReference === worldReference) {
            return;
        }
        this._worldReference = worldReference;
        if (this._worldReference !== null) {
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
    public updateBufferedMotionState(forceUseFrontBuffer: boolean): void {
        this._nullCheck();
        if (forceUseFrontBuffer) {
            const motionStatePtr = this.runtime.wasmInstance.rigidBodyGetMotionStatePtr(this._inner.ptr);
            this._bufferedMotionStatePtr = this.runtime.wasmInstance.createTypedArray(Float32Array, motionStatePtr, Constants.MotionStateSizeInFloat32Array);
        } else {
            const bufferedMotionStatePtr = this.runtime.wasmInstance.rigidBodyGetBufferedMotionStatePtr(this._inner.ptr);
            this._bufferedMotionStatePtr = this.runtime.wasmInstance.createTypedArray(Float32Array, bufferedMotionStatePtr, Constants.MotionStateSizeInFloat32Array);
        }
    }

    private _nullCheck(): void {
        if (this._inner.ptr === 0) {
            throw new Error("Cannot access disposed rigid body");
        }
    }

    /**
     * Get the transform matrix of the rigid body
     * @param result The matrix to store the result
     * @returns The transform matrix of the rigid body
     */
    public getTransformMatrixToRef(result: Matrix): Matrix {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }

        const m = this._bufferedMotionStatePtr.array;
        return result.set(
            m[MotionStateOffsetsInFloat32Array.MatrixRowX + 0],
            m[MotionStateOffsetsInFloat32Array.MatrixRowY + 0],
            m[MotionStateOffsetsInFloat32Array.MatrixRowZ + 0],
            0,
            m[MotionStateOffsetsInFloat32Array.MatrixRowX + 1],
            m[MotionStateOffsetsInFloat32Array.MatrixRowY + 1],
            m[MotionStateOffsetsInFloat32Array.MatrixRowZ + 1],
            0,
            m[MotionStateOffsetsInFloat32Array.MatrixRowX + 2],
            m[MotionStateOffsetsInFloat32Array.MatrixRowY + 2],
            m[MotionStateOffsetsInFloat32Array.MatrixRowZ + 2],
            0,
            m[MotionStateOffsetsInFloat32Array.Translation + 0],
            m[MotionStateOffsetsInFloat32Array.Translation + 1],
            m[MotionStateOffsetsInFloat32Array.Translation + 2],
            1
        );
    }

    /**
     * Get the transform matrix of the rigid body
     * @param result The array to store the result
     * @param offset The offset in the array to store the result
     */
    public getTransformMatrixToArray(result: Float32Array, offset: number = 0): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }

        const m = this._bufferedMotionStatePtr.array;

        result[offset + 0] = m[MotionStateOffsetsInFloat32Array.MatrixRowX + 0];
        result[offset + 1] = m[MotionStateOffsetsInFloat32Array.MatrixRowY + 0];
        result[offset + 2] = m[MotionStateOffsetsInFloat32Array.MatrixRowZ + 0];
        result[offset + 3] = 0;

        result[offset + 4] = m[MotionStateOffsetsInFloat32Array.MatrixRowX + 1];
        result[offset + 5] = m[MotionStateOffsetsInFloat32Array.MatrixRowY + 1];
        result[offset + 6] = m[MotionStateOffsetsInFloat32Array.MatrixRowZ + 1];
        result[offset + 7] = 0;

        result[offset + 8] = m[MotionStateOffsetsInFloat32Array.MatrixRowX + 2];
        result[offset + 9] = m[MotionStateOffsetsInFloat32Array.MatrixRowY + 2];
        result[offset + 10] = m[MotionStateOffsetsInFloat32Array.MatrixRowZ + 2];
        result[offset + 11] = 0;

        result[offset + 12] = m[MotionStateOffsetsInFloat32Array.Translation + 0];
        result[offset + 13] = m[MotionStateOffsetsInFloat32Array.Translation + 1];
        result[offset + 14] = m[MotionStateOffsetsInFloat32Array.Translation + 2];
        result[offset + 15] = 1;
    }

    /**
     * Set the transform matrix of the rigid body
     *
     * This method will work only if the rigid body motion type is kinematic
     *
     * Application can be deferred to the next frame when world evaluating the rigid body
     * @param matrix The transform matrix to set
     */
    public setTransformMatrix(matrix: Matrix): void {
        this.setTransformMatrixFromArray(matrix.m, 0);
    }

    /**
     * Set the transform matrix of the rigid body
     *
     * This method will work only if the rigid body motion type is kinematic
     *
     * Application can be deferred to the next frame when world evaluating the rigid body
     * @param array The array to set the transform matrix from
     * @param offset The offset in the array to set the transform matrix from
     */
    public setTransformMatrixFromArray(array: DeepImmutable<Tuple<number, 16>>, offset: number = 0): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setTransformMatrixFromArray(this._motionStatePtr, this._kinematicStatePtr, array, offset);
    }

    /**
     * Set the dynamic transform matrix of the rigid body
     *
     * This method will work only if the rigid body motion type is dynamic
     *
     * Application can be deferred to the next frame when world evaluating the rigid body
     * @param matrix The transform matrix to set
     * @param fallbackToSetTransformMatrix Whether to fallback to setTransformMatrix if the rigid body is not dynamic
     */
    public setDynamicTransformMatrix(matrix: Matrix, fallbackToSetTransformMatrix: boolean = false): void {
        this.setDynamicTransformMatrixFromArray(matrix.m, 0, fallbackToSetTransformMatrix);
    }

    /**
     * Set the dynamic transform matrix of the rigid body
     *
     * This method will work only if the rigid body motion type is dynamic
     *
     * Application can be deferred to the next frame when world evaluating the rigid body
     * @param array The array to set the transform matrix from
     * @param offset The offset in the array to set the transform matrix from
     * @param fallbackToSetTransformMatrix Whether to fallback to setTransformMatrix if the rigid body is not dynamic
     */
    public setDynamicTransformMatrixFromArray(array: DeepImmutable<Tuple<number, 16>>, offset: number = 0, fallbackToSetTransformMatrix: boolean = false): void {
        if (this._worldTransformPtr === null) {
            if (fallbackToSetTransformMatrix) {
                this.setTransformMatrixFromArray(array, offset);
                return;
            } else {
                throw new Error("Cannot set dynamic transform of non-dynamic body");
            }
        }
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setDynamicTransformMatrixFromArray(this._worldTransformPtr, array, offset);
    }

    /**
     * Set the linear and angular damping of the rigid body
     *
     * Application can be deferred to the next frame when world evaluating the rigid body
     * @param linearDamping
     * @param angularDamping
     */
    public setDamping(linearDamping: number, angularDamping: number): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setDamping(this.runtime.wasmInstance, this._inner.ptr, linearDamping, angularDamping);
    }

    /**
     * Get the linear damping of the rigid body
     * @returns The linear damping of the rigid body
     */
    public getLinearDamping(): number {
        this._nullCheck();
        // does not need to synchronization because damping is not changed by physics simulation
        return this.impl.getLinearDamping(this.runtime.wasmInstance, this._inner.ptr);
    }

    /**
     * Get the angular damping of the rigid body
     * @returns The angular damping of the rigid body
     */
    public getAngularDamping(): number {
        this._nullCheck();
        // does not need to synchronization because damping is not changed by physics simulation
        return this.impl.getAngularDamping(this.runtime.wasmInstance, this._inner.ptr);
    }

    /**
     * Set the mass and local inertia of the rigid body
     *
     * Application can be deferred to the next frame when world evaluating the rigid body
     * @param mass The mass of the rigid body
     * @param localInertia The local inertia of the rigid body
     */
    public setMassProps(mass: number, localInertia: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setMassProps(this.runtime.wasmInstance, this._inner.ptr, mass, localInertia);
    }

    /**
     * Get the mass of the rigid body
     * @returns The mass of the rigid body
     */
    public getMass(): number {
        this._nullCheck();
        // does not need to synchronization because mass is not changed by physics simulation
        return this.impl.getMass(this.runtime.wasmInstance, this._inner.ptr);
    }

    /**
     * Get the local inertia of the rigid body
     * @returns The local inertia of the rigid body
     */
    public getLocalInertia(): Vector3 {
        this._nullCheck();
        // does not need to synchronization because local inertia is not changed by physics simulation
        return this.impl.getLocalInertia(this.runtime.wasmInstance, this._inner.ptr);
    }

    /**
     * Translate the rigid body
     *
     * Application can be deferred to the next frame when world evaluating the rigid body
     * @param translation The translation vector
     */
    public translate(translation: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.translate(this.runtime.wasmInstance, this._inner.ptr, translation);
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
            this._motionStatePtr,
            this._kinematicStatePtr,
            this._worldTransformPtr
        );
    }

    // these methods need to be always synchronized

    /**
     * Get the total force of the rigid body
     *
     * This operation is always synchronized
     * @param result The vector to store the result
     * @returns The total force of the rigid body
     */
    public getTotalForceToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetTotalForce(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Get the total torque of the rigid body
     *
     * This operation is always synchronized
     * @param result The vector to store the result
     * @returns The total torque of the rigid body
     */
    public getTotalTorqueToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetTotalTorque(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Apply a central force to the rigid body
     *
     * This operation is always synchronized
     * @param force The force vector to apply
     */
    public applyCentralForce(force: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyCentralForce(this._inner.ptr, force.x, force.y, force.z);
    }

    /**
     * Apply a torque to the rigid body
     *
     * This operation is always synchronized
     * @param torque The torque vector to apply
     */
    public applyTorque(torque: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyTorque(this._inner.ptr, torque.x, torque.y, torque.z);
    }

    /**
     * Apply a force to the rigid body
     *
     * This operation is always synchronized
     * @param force The force vector to apply
     * @param relativePosition The relative position vector to apply the force at
     */
    public applyForce(force: DeepImmutable<Vector3>, relativePosition: DeepImmutable<Vector3>): void {
        this._nullCheck();
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
        this.runtime.wasmInstance.rigidBodyApplyForce(this._inner.ptr, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
    }

    /**
     * Apply a central impulse to the rigid body
     *
     * This operation is always synchronized
     * @param impulse The impulse vector to apply
     */
    public applyCentralImpulse(impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyCentralImpulse(this._inner.ptr, impulse.x, impulse.y, impulse.z);
    }

    /**
     * Apply a torque impulse to the rigid body
     *
     * This operation is always synchronized
     * @param impulse The impulse vector to apply
     */
    public applyTorqueImpulse(impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyTorqueImpulse(this._inner.ptr, impulse.x, impulse.y, impulse.z);
    }

    /**
     * Apply an impulse to the rigid body
     *
     * This operation is always synchronized
     * @param impulse The impulse vector to apply
     * @param relativePosition The relative position vector to apply the impulse at
     */
    public applyImpulse(impulse: DeepImmutable<Vector3>, relativePosition: DeepImmutable<Vector3>): void {
        this._nullCheck();
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
        this.runtime.wasmInstance.rigidBodyApplyImpulse(this._inner.ptr, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
    }

    /**
     * Apply a push impulse to the rigid body
     *
     * This operation is always synchronized
     * @param impulse The impulse vector to apply
     * @param relativePosition The relative position vector to apply the impulse at
     */
    public applyPushImpulse(impulse: DeepImmutable<Vector3>, relativePosition: DeepImmutable<Vector3>): void {
        this._nullCheck();
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
        this.runtime.wasmInstance.rigidBodyApplyPushImpulse(this._inner.ptr, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
    }

    /**
     * Get the push velocity of the rigid body
     *
     * This operation is always synchronized
     * @param result The vector to store the result
     * @returns The push velocity of the rigid body
     */
    public getPushVelocityToRef(result: Vector3): DeepImmutable<Vector3> {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetPushVelocity(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Get the turn velocity of the rigid body
     *
     * This operation is always synchronized
     * @param result The vector to store the result
     * @returns The turn velocity of the rigid body
     */
    public getTurnVelocityToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetTurnVelocity(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Set the push velocity of the rigid body
     *
     * This operation is always synchronized
     * @param velocity The velocity vector to set
     */
    public setPushVelocity(velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodySetPushVelocity(this._inner.ptr, velocity.x, velocity.y, velocity.z);
    }

    /**
     * Set the turn velocity of the rigid body
     *
     * This operation is always synchronized
     * @param velocity The velocity vector to set
     */
    public setTurnVelocity(velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodySetTurnVelocity(this._inner.ptr, velocity.x, velocity.y, velocity.z);
    }

    /**
     * Apply a central push impulse to the rigid body
     *
     * This operation is always synchronized
     * @param impulse The impulse vector to apply
     */
    public applyCentralPushImpulse(impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyCentralPushImpulse(this._inner.ptr, impulse.x, impulse.y, impulse.z);
    }

    /**
     * Apply a torque turn impulse to the rigid body
     *
     * This operation is always synchronized
     * @param impulse The impulse vector to apply
     */
    public applyTorqueTurnImpulse(impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyTorqueTurnImpulse(this._inner.ptr, impulse.x, impulse.y, impulse.z);
    }

    /**
     * Clear the forces of the rigid body
     *
     * This operation is always synchronized
     */
    public clearForces(): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyClearForces(this._inner.ptr);
    }

    /**
     * Get the linear velocity of the rigid body
     *
     * This operation is always synchronized
     * @param result The vector to store the result
     * @returns The linear velocity of the rigid body
     */
    public getLinearVelocityToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetLinearVelocity(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Get the angular velocity of the rigid body
     *
     * This operation is always synchronized
     * @param result The vector to store the result
     * @returns The angular velocity of the rigid body
     */
    public getAngularVelocityToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetAngularVelocity(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    /**
     * Set the linear velocity of the rigid body
     *
     * This operation is always synchronized
     * @param velocity The velocity vector to set
     */
    public setLinearVelocity(velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodySetLinearVelocity(this._inner.ptr, velocity.x, velocity.y, velocity.z);
    }

    /**
     * Set the angular velocity of the rigid body
     *
     * This operation is always synchronized
     * @param velocity The velocity vector to set
     */
    public setAngularVelocity(velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodySetAngularVelocity(this._inner.ptr, velocity.x, velocity.y, velocity.z);
    }

    /**
     * Get the velocity of the rigid body in local point
     *
     * This operation is always synchronized
     * @param relativePosition The relative position vector to get the velocity at
     * @param result The vector to store the result
     * @returns The velocity of the rigid body in local point
     */
    public getVelocityInLocalPointToRef(relativePosition: DeepImmutable<Vector3>, result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        const vector3Buffer2 = this._inner.vector3Buffer2.array;
        vector3Buffer1[0] = relativePosition.x;
        vector3Buffer1[1] = relativePosition.y;
        vector3Buffer1[2] = relativePosition.z;
        this.runtime.wasmInstance.rigidBodyGetVelocityInLocalPoint(this._inner.ptr, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
        return result.set(vector3Buffer2[0], vector3Buffer2[1], vector3Buffer2[2]);
    }

    /**
     * Get the push velocity of the rigid body in local point
     *
     * This operation is always synchronized
     * @param relativePosition The relative position vector to get the push velocity at
     * @param result The vector to store the result
     * @returns The push velocity of the rigid body in local point
     */
    public getPushVelocityInLocalPointToRef(relativePosition: DeepImmutable<Vector3>, result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        const vector3Buffer2 = this._inner.vector3Buffer2.array;
        vector3Buffer1[0] = relativePosition.x;
        vector3Buffer1[1] = relativePosition.y;
        vector3Buffer1[2] = relativePosition.z;
        this.runtime.wasmInstance.rigidBodyGetPushVelocityInLocalPoint(this._inner.ptr, vector3Buffer1.byteOffset, vector3Buffer2.byteOffset);
        return result.set(vector3Buffer2[0], vector3Buffer2[1], vector3Buffer2[2]);
    }

    /**
     * Get shape of the rigid body
     * @returns The shape of the rigid body
     */
    public getShape(): PhysicsShape {
        this._nullCheck();
        return this._inner.getShapeReference();
    }

    /**
     * Set shape of the rigid body
     *
     * This operation is always synchronized
     * @param shape The shape to set
     */
    public setShape(shape: PhysicsShape): void {
        this._nullCheck();
        if (shape.runtime !== this.runtime) {
            throw new Error("Cannot set shape from different runtime");
        }
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this._inner.setShapeReference(shape);
        this.runtime.wasmInstance.rigidBodySetShape(this._inner.ptr, shape.ptr);
    }
}
