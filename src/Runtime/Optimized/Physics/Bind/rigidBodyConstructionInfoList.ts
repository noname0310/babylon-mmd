import type { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "./bulletWasmInstance";
import { Constants, RigidBodyConstructionInfoOffsets } from "./constants";
import { ConstructionInfoDataMask } from "./constructionInfoDataMask";
import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";
import { MotionType } from "./motionType";
import type { PhysicsShape } from "./physicsShape";

class RigidBodyConstructionInfoListInner {
    private readonly _wasmInstance: WeakRef<BulletWasmInstance>;
    private _ptr: number;
    private readonly _count: number;
    private readonly _shapeReferences: Nullable<PhysicsShape>[];

    public constructor(wasmInstance: WeakRef<BulletWasmInstance>, ptr: number, count: number) {
        this._wasmInstance = wasmInstance;
        this._ptr = ptr;
        this._count = count;
        this._shapeReferences = new Array<Nullable<PhysicsShape>>(count).fill(null);
    }

    public dispose(): void {
        if (this._ptr === 0) {
            return;
        }

        this._wasmInstance.deref()?.deallocateBuffer(
            this._ptr,
            Constants.RigidBodyConstructionInfoSize * this._count
        );
        this._ptr = 0;
        for (let i = 0; i < this._shapeReferences.length; ++i) {
            const shape = this._shapeReferences[i];
            shape?.removeReference();
        }
        this._shapeReferences.fill(null);
    }

    /**
     * @internal
     */
    public get ptr(): number {
        return this._ptr;
    }

    public get count(): number {
        return this._count;
    }

    public getShape(n: number): Nullable<PhysicsShape> {
        return this._shapeReferences[n] ?? null;
    }

    public setShape(n: number, value: Nullable<PhysicsShape>): void {
        if (n < 0 || this._count <= n) {
            throw new RangeError("Index out of range");
        }

        const previousShape = this._shapeReferences[n];
        if (previousShape) {
            previousShape.removeReference();
        }

        this._shapeReferences[n] = value;

        if (value) {
            value.addReference();
        }
    }
}

function rigidBodyConstructionInfoListFinalizer(inner: RigidBodyConstructionInfoListInner): void {
    inner.dispose();
}

const rigidBodyConstructionInfoListRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<RigidBodyConstructionInfoListInner>>();

/**
 * RigidBodyConstructionInfoList stores the construction information for multiple rigid bodies in a single buffer
 */
export class RigidBodyConstructionInfoList {
    private readonly _wasmInstance: BulletWasmInstance;

    private readonly _uint32Ptr: IWasmTypedArray<Uint32Array>;
    private readonly _float32Ptr: IWasmTypedArray<Float32Array>;
    private readonly _uint8Ptr: IWasmTypedArray<Uint8Array>;
    private readonly _uint16Ptr: IWasmTypedArray<Uint16Array>;

    private readonly _inner: RigidBodyConstructionInfoListInner;

    /**
     * Creates a new RigidBodyConstructionInfoList
     * @param wasmInstance The BulletWasmInstance to use
     */
    public constructor(wasmInstance: BulletWasmInstance, count: number) {
        this._wasmInstance = wasmInstance;

        // Allocate buffer
        const ptr = wasmInstance.allocateBuffer(Constants.RigidBodyConstructionInfoSize * count);
        this._uint32Ptr = wasmInstance.createTypedArray(Uint32Array, ptr, Constants.RigidBodyConstructionInfoSize / Constants.A32BytesPerElement * count);
        this._float32Ptr = wasmInstance.createTypedArray(Float32Array, ptr, Constants.RigidBodyConstructionInfoSize / Constants.A32BytesPerElement * count);
        this._uint8Ptr = wasmInstance.createTypedArray(Uint8Array, ptr, Constants.RigidBodyConstructionInfoSize / Constants.A8BytesPerElement * count);
        this._uint16Ptr = wasmInstance.createTypedArray(Uint16Array, ptr, Constants.RigidBodyConstructionInfoSize / Constants.A16BytesPerElement * count);

        this._inner = new RigidBodyConstructionInfoListInner(new WeakRef(wasmInstance), ptr, count);

        // Initialize to default values
        const uint32Ptr = this._uint32Ptr.array;
        const float32Ptr = this._float32Ptr.array;
        const uint8Ptr = this._uint8Ptr.array;
        const uint16Ptr = this._uint16Ptr.array;

        for (let i = 0; i < count; ++i) {
            const offset = i * Constants.RigidBodyConstructionInfoSize;

            // shape
            uint32Ptr[(offset + RigidBodyConstructionInfoOffsets.Shape) / Constants.A32BytesPerElement] = 0;

            // initial_transform
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 0] = 1;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 1] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 2] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 3] = 0;

            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 4] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 5] = 1;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 6] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 7] = 0;

            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 8] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 9] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 10] = 1;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 11] = 0;

            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 12] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 13] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 14] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 15] = 1;

            // dataMask
            uint16Ptr[(offset + RigidBodyConstructionInfoOffsets.DataMask) / Constants.A16BytesPerElement] = 0x0000;

            // motionType
            uint8Ptr[(offset + RigidBodyConstructionInfoOffsets.MotionType) / Constants.A8BytesPerElement] = MotionType.Dynamic;

            // mass
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.Mass) / Constants.A32BytesPerElement] = 1.0;

            // localInertia
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 0] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 1] = 0;
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 2] = 0;

            // linearDamping
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LinearDamping) / Constants.A32BytesPerElement] = 0;

            // angularDamping
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.AngularDamping) / Constants.A32BytesPerElement] = 0;

            // friction
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.Friction) / Constants.A32BytesPerElement] = 0.5;

            // restitution
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.Restitution) / Constants.A32BytesPerElement] = 0.0;

            // linearSleepingThreshold
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LinearSleepingThreshold) / Constants.A32BytesPerElement] = 0.0;

            // angularSleepingThreshold
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.AngularSleepingThreshold) / Constants.A32BytesPerElement] = 1.0;

            // collisionGroup
            uint16Ptr[(offset + RigidBodyConstructionInfoOffsets.CollisionGroup) / Constants.A16BytesPerElement] = 1 << 0;

            // collisionMask
            uint16Ptr[(offset + RigidBodyConstructionInfoOffsets.CollisionMask) / Constants.A16BytesPerElement] = 0xFFFF;

            // additionalDamping
            uint8Ptr[(offset + RigidBodyConstructionInfoOffsets.AdditionalDamping) / Constants.A8BytesPerElement] = +false;

            // noContactResponse
            uint8Ptr[(offset + RigidBodyConstructionInfoOffsets.NoContactResponse) / Constants.A8BytesPerElement] = +false;

            // disableDeactivation
            uint8Ptr[(offset + RigidBodyConstructionInfoOffsets.DisableDeactivation) / Constants.A8BytesPerElement] = +false;
        }

        // finalization registry
        let registry = rigidBodyConstructionInfoListRegistryMap.get(wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(rigidBodyConstructionInfoListFinalizer);
            rigidBodyConstructionInfoListRegistryMap.set(wasmInstance, registry);
        }

        registry.register(this, this._inner, this);
    }

    /**
     * Disposes the RigidBodyConstructionInfoList
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = rigidBodyConstructionInfoListRegistryMap.get(this._wasmInstance);
        registry?.unregister(this);
    }

    /**
     * @internal
     */
    public get ptr(): number {
        return this._inner.ptr;
    }

    /**
     * The number of rigid body construction info
     */
    public get count(): number {
        return this._inner.count;
    }

    /**
     * @internal
     */
    public getPtr(n: number): number {
        this._nullCheck();
        return this._inner.ptr + n * Constants.RigidBodyConstructionInfoSize;
    }

    private _nullCheck(): void {
        if (this._inner.ptr === 0) {
            throw new Error("Cannot access disposed RigidBodyConstructionInfo");
        }
    }

    /**
     * Get the shape of the rigid body at index n
     * @param n The index of the rigid body
     * @return The shape of the rigid body
     */
    public getShape(n: number): Nullable<PhysicsShape> {
        this._nullCheck();
        return this._inner.getShape(n);
    }

    /**
     * Set the shape of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The shape of the rigid body
     */
    public setShape(n: number, value: Nullable<PhysicsShape>): void {
        this._nullCheck();
        this._inner.setShape(n, value);

        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._uint32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.Shape) / Constants.A32BytesPerElement] = value ? value.ptr : 0;
    }

    /**
     * Get the initial transform of the rigid body at index n
     * @param n The index of the rigid body
     * @param result The matrix to store the result
     * @returns The initial transform of the rigid body
     */
    public getInitialTransformToRef(n: number, result: Matrix): Matrix {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        const float32Ptr = this._float32Ptr.array;

        result.set(
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 0],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 1],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 2],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 3],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 4],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 5],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 6],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 7],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 8],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 9],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 10],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 11],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 12],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 13],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 14],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement + 15]
        );

        return result;
    }

    /**
     * Set the initial transform of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The initial transform of the rigid body
     */
    public setInitialTransform(n: number, value: Matrix): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        const float32Ptr = this._float32Ptr.array;

        value.copyToArray(float32Ptr, (offset + RigidBodyConstructionInfoOffsets.InitialTransform) / Constants.A32BytesPerElement);
    }

    /**
     * Get the motion type of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The motion type of the rigid body
     */
    public getMotionType(n: number): MotionType {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._uint8Ptr.array[(offset + RigidBodyConstructionInfoOffsets.MotionType) / Constants.A8BytesPerElement];
    }

    /**
     * Set the motion type of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The motion type of the rigid body
     * @returns The motion type of the rigid body
     */
    public setMotionType(n: number, value: MotionType): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._uint8Ptr.array[(offset + RigidBodyConstructionInfoOffsets.MotionType) / Constants.A8BytesPerElement] = value;
    }

    /**
     * Get the mass of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The mass of the rigid body
     */
    public getMass(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.Mass) / Constants.A32BytesPerElement];
    }

    /**
     * Set the mass of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The mass of the rigid body
     */
    public setMass(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.Mass) / Constants.A32BytesPerElement] = value;
    }

    /**
     * Get the local inertia of the rigid body at index n
     * @param n The index of the rigid body
     * @param result The vector to store the result
     * @returns The local inertia of the rigid body
     */
    public getLocalInertiaToRef(n: number, result: Vector3): Nullable<Vector3> {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        const maskValue = this._uint16Ptr.array[(offset + RigidBodyConstructionInfoOffsets.DataMask) / Constants.A16BytesPerElement];
        if ((maskValue & ConstructionInfoDataMask.LocalInertia) === 0) {
            return null;
        }

        const float32Ptr = this._float32Ptr.array;
        result.set(
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 0],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 1],
            float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 2]
        );
        return result;
    }

    /**
     * Set the local inertia of the rigid body at index n
     * 
     * If the local inertia is not set, it will be calculated from the shape
     * @param n The index of the rigid body
     * @param value The local inertia of the rigid body
     */
    public setLocalInertia(n: number, value: Nullable<Vector3>): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        if (value === null) {
            this._uint16Ptr.array[(offset + RigidBodyConstructionInfoOffsets.DataMask) / Constants.A16BytesPerElement] &= ~ConstructionInfoDataMask.LocalInertia;
            return;
        }

        this._uint16Ptr.array[(offset + RigidBodyConstructionInfoOffsets.DataMask) / Constants.A16BytesPerElement] |= ConstructionInfoDataMask.LocalInertia;

        const float32Ptr = this._float32Ptr.array;
        float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 0] = value.x;
        float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 1] = value.y;
        float32Ptr[(offset + RigidBodyConstructionInfoOffsets.LocalInertia) / Constants.A32BytesPerElement + 2] = value.z;
    }

    /**
     * Get linear damping of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The linear damping of the rigid body
     */
    public getLinearDamping(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.LinearDamping) / Constants.A32BytesPerElement];
    }

    /**
     * Set linear damping of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The linear damping of the rigid body
     */
    public setLinearDamping(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.LinearDamping) / Constants.A32BytesPerElement] = value;
    }

    /**
     * Get angular damping of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The angular damping of the rigid body
     */
    public getAngularDamping(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.AngularDamping) / Constants.A32BytesPerElement];
    }

    /**
     * Set angular damping of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The angular damping of the rigid body
     */
    public setAngularDamping(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.AngularDamping) / Constants.A32BytesPerElement] = value;
    }

    /**
     * Get friction of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The friction of the rigid body
     */
    public getFriction(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.Friction) / Constants.A32BytesPerElement];
    }

    /**
     * Set friction of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The friction of the rigid body
     */
    public setFriction(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.Friction) / Constants.A32BytesPerElement] = value;
    }

    /**
     * Get restitution of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The restitution of the rigid body
     */
    public getRestitution(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.Restitution) / Constants.A32BytesPerElement];
    }

    /**
     * Set restitution of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The restitution of the rigid body
     */
    public setRestitution(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.Restitution) / Constants.A32BytesPerElement] = value;
    }

    /**
     * Get linear sleeping threshold of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The linear sleeping threshold of the rigid body
     */
    public getLinearSleepingThreshold(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.LinearSleepingThreshold) / Constants.A32BytesPerElement];
    }

    /**
     * Set linear sleeping threshold of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The linear sleeping threshold of the rigid body
     */
    public setLinearSleepingThreshold(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.LinearSleepingThreshold) / Constants.A32BytesPerElement] = value;
    }

    /**
     * Get angular sleeping threshold of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The angular sleeping threshold of the rigid body
     */
    public getAngularSleepingThreshold(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.AngularSleepingThreshold) / Constants.A32BytesPerElement];
    }

    /**
     * Set angular sleeping threshold of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The angular sleeping threshold of the rigid body
     */
    public setAngularSleepingThreshold(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._float32Ptr.array[(offset + RigidBodyConstructionInfoOffsets.AngularSleepingThreshold) / Constants.A32BytesPerElement] = value;
    }

    /**
     * Get collision group of the rigid body at index n
     * 
     * collision group is stored as 16-bit unsigned integer
     * @param n The index of the rigid body
     * @return The collision group of the rigid body
     */
    public getCollisionGroup(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._uint16Ptr.array[(offset + RigidBodyConstructionInfoOffsets.CollisionGroup) / Constants.A16BytesPerElement];
    }

    /**
     * Set collision group of the rigid body at index n
     * 
     * collision group is stored as 16-bit unsigned integer
     * @param n The index of the rigid body
     * @param value The collision group of the rigid body
     */
    public setCollisionGroup(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._uint16Ptr.array[(offset + RigidBodyConstructionInfoOffsets.CollisionGroup) / Constants.A16BytesPerElement] = value;
    }

    /**
     * Get collision mask of the rigid body at index n
     * 
     * collision mask is stored as 16-bit unsigned integer
     * @param n The index of the rigid body
     * @return The collision mask of the rigid body
     */
    public getCollisionMask(n: number): number {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return this._uint16Ptr.array[(offset + RigidBodyConstructionInfoOffsets.CollisionMask) / Constants.A16BytesPerElement];
    }

    /**
     * Set collision mask of the rigid body at index n
     * 
     * collision mask is stored as 16-bit unsigned integer
     * @param n The index of the rigid body
     * @param value The collision mask of the rigid body
     */
    public setCollisionMask(n: number, value: number): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._uint16Ptr.array[(offset + RigidBodyConstructionInfoOffsets.CollisionMask) / Constants.A16BytesPerElement] = value;
    }

    /**
     * Get additional damping of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The additional damping of the rigid body
     */
    public getAdditionalDamping(n: number): boolean {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return !!this._uint8Ptr.array[(offset + RigidBodyConstructionInfoOffsets.AdditionalDamping) / Constants.A8BytesPerElement];
    }

    /**
     * Set additional damping of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The additional damping of the rigid body
     */
    public setAdditionalDamping(n: number, value: boolean): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._uint8Ptr.array[(offset + RigidBodyConstructionInfoOffsets.AdditionalDamping) / Constants.A8BytesPerElement] = +value;
    }

    /**
     * Get no contact response of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The no contact response of the rigid body
     */
    public getNoContactResponse(n: number): boolean {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return !!this._uint8Ptr.array[(offset + RigidBodyConstructionInfoOffsets.NoContactResponse) / Constants.A8BytesPerElement];
    }

    /**
     * Set no contact response of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The no contact response of the rigid body
     */
    public setNoContactResponse(n: number, value: boolean): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._uint8Ptr.array[(offset + RigidBodyConstructionInfoOffsets.NoContactResponse) / Constants.A8BytesPerElement] = +value;
    }

    /**
     * Get disable deactivation of the rigid body at index n
     * @param n The index of the rigid body
     * @returns The disable deactivation of the rigid body
     */
    public getDisableDeactivation(n: number): boolean {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        return !!this._uint8Ptr.array[(offset + RigidBodyConstructionInfoOffsets.DisableDeactivation) / Constants.A8BytesPerElement];
    }

    /**
     * Set disable deactivation of the rigid body at index n
     * @param n The index of the rigid body
     * @param value The disable deactivation of the rigid body
     */
    public setDisableDeactivation(n: number, value: boolean): void {
        this._nullCheck();
        const offset = n * Constants.RigidBodyConstructionInfoSize;
        this._uint8Ptr.array[(offset + RigidBodyConstructionInfoOffsets.DisableDeactivation) / Constants.A8BytesPerElement] = +value;
    }
}
