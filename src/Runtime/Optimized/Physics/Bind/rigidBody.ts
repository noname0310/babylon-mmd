import type { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable, Tuple } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "./bulletWasmInstance";
import { Constants, MotionStateOffsetsInFloat32Array } from "./constants";
import type { IRigidBodyImpl } from "./Impl/IRigidBodyImpl";
import type { IPhysicsRuntime } from "./Impl/IPhysicsRuntime";
import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";
import { MotionType } from "./motionType";
import type { PhysicsShape } from "./physicsShape";
import type { RigidBodyConstructionInfo } from "./rigidBodyConstructionInfo";
import type { RigidBodyConstructionInfoList } from "./rigidBodyConstructionInfoList";

class RigidBodyInner {
    private readonly _wasmInstance: WeakRef<BulletWasmInstance>;
    private _ptr: number;
    private readonly _vector3Buffer1: IWasmTypedArray<Float32Array>;
    private readonly _vector3Buffer2: IWasmTypedArray<Float32Array>;
    private _shapeReference: Nullable<PhysicsShape>;
    private _referenceCount: number;
    private _shadowCount: number;

    public constructor(wasmInstance: BulletWasmInstance, ptr: number, shapeReference: PhysicsShape) {
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

function rigidBodyFinalizer(inner: RigidBodyInner): void {
    inner.dispose();
}

const physicsRigidBodyRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<RigidBodyInner>>();

export class RigidBody {
    public readonly runtime: IPhysicsRuntime;

    private readonly _motionStatePtr: IWasmTypedArray<Float32Array>;
    private _bufferedMotionStatePtr: IWasmTypedArray<Float32Array>;
    // save only dynamic body ptr for temporal kinematic
    private readonly _worldTransformPtr: Nullable<IWasmTypedArray<Float32Array>>;
    private readonly _temporalKinematicStatePtr: IWasmTypedArray<Uint8Array>;

    private readonly _inner: RigidBodyInner;

    private _worldReference: Nullable<object>;

    public impl: IRigidBodyImpl;
    public readonly isDynamic: boolean;

    public constructor(runtime: IPhysicsRuntime, info: RigidBodyConstructionInfo);

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
        const temporalKinematicStatePtr = wasmInstance.rigidBodyGetTemporalKinematicStatePtr(ptr);
        this._temporalKinematicStatePtr = wasmInstance.createTypedArray(Uint8Array, temporalKinematicStatePtr, 1);
        this._inner = new RigidBodyInner(runtime.wasmInstance, ptr, shape);
        this._worldReference = null;

        let registry = physicsRigidBodyRegistryMap.get(wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(rigidBodyFinalizer);
            physicsRigidBodyRegistryMap.set(wasmInstance, registry);
        }

        registry.register(this, this._inner, this);

        this.impl = runtime.createRigidBodyImpl();
        this.isDynamic = isDynamic;
    }

    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = physicsRigidBodyRegistryMap.get(this.runtime.wasmInstance);
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

    public setTransformMatrix(matrix: Matrix): void {
        this.setTransformMatrixFromArray(matrix.m, 0);
    }

    public setTransformMatrixFromArray(array: DeepImmutable<Tuple<number, 16>>, offset: number = 0): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setTransformMatrixFromArray(this._motionStatePtr, this._temporalKinematicStatePtr, array, offset);
    }

    public setDynamicTransformMatrix(matrix: Matrix, fallbackToSetTransformMatrix: boolean = false): void {
        this.setDynamicTransformMatrixFromArray(matrix.m, 0, fallbackToSetTransformMatrix);
    }

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

    public setDamping(linearDamping: number, angularDamping: number): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setDamping(this.runtime.wasmInstance, this._inner.ptr, linearDamping, angularDamping);
    }

    public getLinearDamping(): number {
        this._nullCheck();
        // does not need to synchronization because damping is not changed by physics simulation
        return this.impl.getLinearDamping(this.runtime.wasmInstance, this._inner.ptr);
    }

    public getAngularDamping(): number {
        this._nullCheck();
        // does not need to synchronization because damping is not changed by physics simulation
        return this.impl.getAngularDamping(this.runtime.wasmInstance, this._inner.ptr);
    }

    public setMassProps(mass: number, localInertia: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.setMassProps(this.runtime.wasmInstance, this._inner.ptr, mass, localInertia);
    }

    public getMass(): number {
        this._nullCheck();
        // does not need to synchronization because mass is not changed by physics simulation
        return this.impl.getMass(this.runtime.wasmInstance, this._inner.ptr);
    }

    public getLocalInertia(): Vector3 {
        this._nullCheck();
        // does not need to synchronization because local inertia is not changed by physics simulation
        return this.impl.getLocalInertia(this.runtime.wasmInstance, this._inner.ptr);
    }

    public translate(translation: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences && this.impl.shouldSync) {
            this.runtime.lock.wait();
        }
        this.impl.translate(this.runtime.wasmInstance, this._inner.ptr, translation);
    }

    public get needToCommit(): boolean {
        return this.impl.needToCommit ?? false;
    }

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
            this._temporalKinematicStatePtr,
            this._worldTransformPtr
        );
    }

    // these methods need to be always synchronized

    public getTotalForceToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetTotalForce(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    public getTotalTorqueToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetTotalTorque(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    public applyCentralForce(force: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyCentralForce(this._inner.ptr, force.x, force.y, force.z);
    }

    public applyTorque(torque: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyTorque(this._inner.ptr, torque.x, torque.y, torque.z);
    }

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

    public applyCentralImpulse(impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyCentralImpulse(this._inner.ptr, impulse.x, impulse.y, impulse.z);
    }

    public applyTorqueImpulse(impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyTorqueImpulse(this._inner.ptr, impulse.x, impulse.y, impulse.z);
    }

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

    public getPushVelocityToRef(result: Vector3): DeepImmutable<Vector3> {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetPushVelocity(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    public getTurnVelocityToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetTurnVelocity(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    public setPushVelocity(velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodySetPushVelocity(this._inner.ptr, velocity.x, velocity.y, velocity.z);
    }

    public setTurnVelocity(velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodySetTurnVelocity(this._inner.ptr, velocity.x, velocity.y, velocity.z);
    }

    public applyCentralPushImpulse(impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyCentralPushImpulse(this._inner.ptr, impulse.x, impulse.y, impulse.z);
    }

    public applyTorqueTurnImpulse(impulse: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyApplyTorqueTurnImpulse(this._inner.ptr, impulse.x, impulse.y, impulse.z);
    }

    public clearForces(): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodyClearForces(this._inner.ptr);
    }

    public getLinearVelocityToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetLinearVelocity(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    public getAngularVelocityToRef(result: Vector3): Vector3 {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        const vector3Buffer1 = this._inner.vector3Buffer1.array;
        this.runtime.wasmInstance.rigidBodyGetAngularVelocity(this._inner.ptr, vector3Buffer1.byteOffset);
        return result.set(vector3Buffer1[0], vector3Buffer1[1], vector3Buffer1[2]);
    }

    public setLinearVelocity(velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodySetLinearVelocity(this._inner.ptr, velocity.x, velocity.y, velocity.z);
    }

    public setAngularVelocity(velocity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.rigidBodySetAngularVelocity(this._inner.ptr, velocity.x, velocity.y, velocity.z);
    }

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

    public getShape(): PhysicsShape {
        this._nullCheck();
        return this._inner.getShapeReference();
    }

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
