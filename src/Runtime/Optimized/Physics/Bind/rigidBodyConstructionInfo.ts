import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { IWasmTypedArray } from "@/Runtime/Optimized/Misc/IWasmTypedArray";

import type { BulletWasmInstance } from "./bulletWasmInstance";
import { Constants, RigidBodyConstructionInfoOffsets } from "./constants";
import { ConstructionInfoDataMask } from "./constructionInfoDataMask";
import { MotionType } from "./motionType";
import type { PhysicsShape } from "./physicsShape";

class RigidBodyConstructionInfoInner {
    private readonly _wasmInstance: WeakRef<BulletWasmInstance>;
    private _ptr: number;
    private _shapeReference: Nullable<PhysicsShape>;

    public constructor(wasmInstance: WeakRef<BulletWasmInstance>, ptr: number) {
        this._wasmInstance = wasmInstance;
        this._ptr = ptr;
        this._shapeReference = null;
    }

    public dispose(): void {
        if (this._ptr === 0) {
            return;
        }

        this._wasmInstance.deref()?.deallocateBuffer(this._ptr, Constants.RigidBodyConstructionInfoSize);
        this._ptr = 0;
        if (this._shapeReference) {
            this._shapeReference.removeReference();
        }
        this._shapeReference = null;
    }

    public get ptr(): number {
        return this._ptr;
    }

    public get shape(): Nullable<PhysicsShape> {
        return this._shapeReference;
    }

    public set shape(value: Nullable<PhysicsShape>) {
        if (this._shapeReference) {
            this._shapeReference.removeReference();
        }

        this._shapeReference = value;

        if (this._shapeReference) {
            this._shapeReference.addReference();
        }
    }
}

function rigidBodyConstructionInfoFinalizer(inner: RigidBodyConstructionInfoInner): void {
    inner.dispose();
}

const rigidBodyConstructionInfoRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<RigidBodyConstructionInfoInner>>();

/**
 * RigidBodyConstructionInfo is used to create a rigid body in the physics engine
 *
 * it contains all the information needed to create a rigid body, such as the shape, mass, inertia, damping, etc.
 */
export class RigidBodyConstructionInfo {
    private readonly _wasmInstance: BulletWasmInstance;

    private readonly _uint32Ptr: IWasmTypedArray<Uint32Array>;
    private readonly _float32Ptr: IWasmTypedArray<Float32Array>;
    private readonly _uint8Ptr: IWasmTypedArray<Uint8Array>;
    private readonly _uint16Ptr: IWasmTypedArray<Uint16Array>;

    private readonly _inner: RigidBodyConstructionInfoInner;

    /**
     * Creates a new RigidBodyConstructionInfo
     * @param wasmInstance The BulletWasmInstance to use
     */
    public constructor(wasmInstance: BulletWasmInstance) {
        this._wasmInstance = wasmInstance;

        // Allocate buffer
        const ptr = wasmInstance.allocateBuffer(Constants.RigidBodyConstructionInfoSize);
        this._uint32Ptr = wasmInstance.createTypedArray(Uint32Array, ptr, Constants.RigidBodyConstructionInfoSize / Constants.A32BytesPerElement);
        this._float32Ptr = wasmInstance.createTypedArray(Float32Array, ptr, Constants.RigidBodyConstructionInfoSize / Constants.A32BytesPerElement);
        this._uint8Ptr = wasmInstance.createTypedArray(Uint8Array, ptr, Constants.RigidBodyConstructionInfoSize / Constants.A8BytesPerElement);
        this._uint16Ptr = wasmInstance.createTypedArray(Uint16Array, ptr, Constants.RigidBodyConstructionInfoSize / Constants.A16BytesPerElement);

        this._inner = new RigidBodyConstructionInfoInner(new WeakRef(wasmInstance), ptr);

        // Initialize to default values
        const uint32Ptr = this._uint32Ptr.array;
        const float32Ptr = this._float32Ptr.array;
        const uint8Ptr = this._uint8Ptr.array;
        const uint16Ptr = this._uint16Ptr.array;

        // shape
        uint32Ptr[RigidBodyConstructionInfoOffsets.Shape / Constants.A32BytesPerElement] = 0;

        // initial_transform
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 0] = 1;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 1] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 2] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 3] = 0;

        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 4] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 5] = 1;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 6] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 7] = 0;

        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 8] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 9] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 10] = 1;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 11] = 0;

        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 12] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 13] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 14] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 15] = 1;

        // dataMask
        uint16Ptr[RigidBodyConstructionInfoOffsets.DataMask / Constants.A16BytesPerElement] = 0x0000;

        // motionType
        uint8Ptr[RigidBodyConstructionInfoOffsets.MotionType / Constants.A8BytesPerElement] = MotionType.Dynamic;

        // mass
        float32Ptr[RigidBodyConstructionInfoOffsets.Mass / Constants.A32BytesPerElement] = 1.0;

        // localInertia
        float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 0] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 1] = 0;
        float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 2] = 0;

        // linearDamping
        float32Ptr[RigidBodyConstructionInfoOffsets.LinearDamping / Constants.A32BytesPerElement] = 0;

        // angularDamping
        float32Ptr[RigidBodyConstructionInfoOffsets.AngularDamping / Constants.A32BytesPerElement] = 0;

        // friction
        float32Ptr[RigidBodyConstructionInfoOffsets.Friction / Constants.A32BytesPerElement] = 0.5;

        // restitution
        float32Ptr[RigidBodyConstructionInfoOffsets.Restitution / Constants.A32BytesPerElement] = 0.0;

        // linearSleepingThreshold
        float32Ptr[RigidBodyConstructionInfoOffsets.LinearSleepingThreshold / Constants.A32BytesPerElement] = 0.0;

        // angularSleepingThreshold
        float32Ptr[RigidBodyConstructionInfoOffsets.AngularSleepingThreshold / Constants.A32BytesPerElement] = 1.0;

        // collisionGroup
        uint16Ptr[RigidBodyConstructionInfoOffsets.CollisionGroup / Constants.A16BytesPerElement] = 1 << 0;

        // collisionMask
        uint16Ptr[RigidBodyConstructionInfoOffsets.CollisionMask / Constants.A16BytesPerElement] = 0xFFFF;

        // additionalDamping
        uint8Ptr[RigidBodyConstructionInfoOffsets.AdditionalDamping / Constants.A8BytesPerElement] = +false;

        // noContactResponse
        uint8Ptr[RigidBodyConstructionInfoOffsets.NoContactResponse / Constants.A8BytesPerElement] = +false;

        // disableDeactivation
        uint8Ptr[RigidBodyConstructionInfoOffsets.DisableDeactivation / Constants.A8BytesPerElement] = +false;


        // finalization registry
        let registry = rigidBodyConstructionInfoRegistryMap.get(wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(rigidBodyConstructionInfoFinalizer);
            rigidBodyConstructionInfoRegistryMap.set(wasmInstance, registry);
        }

        registry.register(this, this._inner, this);
    }

    /**
     * Disposes the RigidBodyConstructionInfo
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = rigidBodyConstructionInfoRegistryMap.get(this._wasmInstance);
        registry?.unregister(this);
    }

    /**
     * @internal
     */
    public get ptr(): number {
        return this._inner.ptr;
    }

    private _nullCheck(): void {
        if (this._inner.ptr === 0) {
            throw new Error("Cannot access disposed RigidBodyConstructionInfo");
        }
    }

    /**
     * The shape of the rigid body
     */
    public get shape(): Nullable<PhysicsShape> {
        this._nullCheck();
        return this._inner.shape;
    }

    public set shape(value: Nullable<PhysicsShape>) {
        this._nullCheck();
        this._inner.shape = value;
        this._uint32Ptr.array[RigidBodyConstructionInfoOffsets.Shape / Constants.A32BytesPerElement] = value ? value.ptr : 0;
    }

    /**
     * Gets the initial transform of the rigid body
     * @param result The matrix to store the result
     * @returns The initial transform of the rigid body
     */
    public getInitialTransformToRef(result: Matrix): Matrix {
        this._nullCheck();
        const float32Ptr = this._float32Ptr.array;

        result.set(
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 0],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 1],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 2],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 3],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 4],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 5],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 6],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 7],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 8],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 9],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 10],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 11],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 12],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 13],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 14],
            float32Ptr[RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement + 15]
        );

        return result;
    }

    /**
     * Sets the initial transform of the rigid body
     * @param value The initial transform of the rigid body
     */
    public setInitialTransform(value: DeepImmutable<Matrix>): void {
        this._nullCheck();
        const float32Ptr = this._float32Ptr.array;

        value.copyToArray(float32Ptr, RigidBodyConstructionInfoOffsets.InitialTransform / Constants.A32BytesPerElement);
    }

    /**
     * The motion type of the rigid body
     */
    public get motionType(): MotionType {
        this._nullCheck();
        return this._uint8Ptr.array[RigidBodyConstructionInfoOffsets.MotionType / Constants.A8BytesPerElement];
    }

    public set motionType(value: MotionType) {
        this._nullCheck();
        this._uint8Ptr.array[RigidBodyConstructionInfoOffsets.MotionType / Constants.A8BytesPerElement] = value;
    }

    /**
     * The mass of the rigid body
     */
    public get mass(): number {
        this._nullCheck();
        return this._float32Ptr.array[RigidBodyConstructionInfoOffsets.Mass / Constants.A32BytesPerElement];
    }

    public set mass(value: number) {
        this._nullCheck();
        this._float32Ptr.array[RigidBodyConstructionInfoOffsets.Mass / Constants.A32BytesPerElement] = value;
    }

    /**
     * The local inertia of the rigid body
     *
     * If the local inertia is not set, it will be calculated from the shape
     */
    public get localInertia(): Nullable<Vector3> {
        this._nullCheck();
        const maskValue = this._uint16Ptr.array[RigidBodyConstructionInfoOffsets.DataMask / Constants.A16BytesPerElement];
        if ((maskValue & ConstructionInfoDataMask.LocalInertia) === 0) {
            return null;
        }

        const float32Ptr = this._float32Ptr.array;
        const x = float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 0];
        const y = float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 1];
        const z = float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 2];

        return new Vector3(x, y, z);
    }

    public set localInertia(value: Nullable<DeepImmutable<Vector3>>) {
        this._nullCheck();
        if (value === null) {
            this._uint16Ptr.array[RigidBodyConstructionInfoOffsets.DataMask / Constants.A16BytesPerElement] &= ~ConstructionInfoDataMask.LocalInertia;
            return;
        }

        this._uint16Ptr.array[RigidBodyConstructionInfoOffsets.DataMask / Constants.A16BytesPerElement] |= ConstructionInfoDataMask.LocalInertia;

        const float32Ptr = this._float32Ptr.array;
        float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 0] = value.x;
        float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 1] = value.y;
        float32Ptr[RigidBodyConstructionInfoOffsets.LocalInertia / Constants.A32BytesPerElement + 2] = value.z;
    }

    /**
     * The linear damping of the rigid body
     */
    public get linearDamping(): number {
        this._nullCheck();
        return this._float32Ptr.array[RigidBodyConstructionInfoOffsets.LinearDamping / Constants.A32BytesPerElement];
    }

    public set linearDamping(value: number) {
        this._nullCheck();
        this._float32Ptr.array[RigidBodyConstructionInfoOffsets.LinearDamping / Constants.A32BytesPerElement] = value;
    }

    /**
     * The angular damping of the rigid body
     */
    public get angularDamping(): number {
        this._nullCheck();
        return this._float32Ptr.array[RigidBodyConstructionInfoOffsets.AngularDamping / Constants.A32BytesPerElement];
    }

    public set angularDamping(value: number) {
        this._nullCheck();
        this._float32Ptr.array[RigidBodyConstructionInfoOffsets.AngularDamping / Constants.A32BytesPerElement] = value;
    }

    /**
     * The friction of the rigid body
     */
    public get friction(): number {
        this._nullCheck();
        return this._float32Ptr.array[RigidBodyConstructionInfoOffsets.Friction / Constants.A32BytesPerElement];
    }

    public set friction(value: number) {
        this._nullCheck();
        this._float32Ptr.array[RigidBodyConstructionInfoOffsets.Friction / Constants.A32BytesPerElement] = value;
    }

    /**
     * The restitution of the rigid body
     */
    public get restitution(): number {
        this._nullCheck();
        return this._float32Ptr.array[RigidBodyConstructionInfoOffsets.Restitution / Constants.A32BytesPerElement];
    }

    public set restitution(value: number) {
        this._nullCheck();
        this._float32Ptr.array[RigidBodyConstructionInfoOffsets.Restitution / Constants.A32BytesPerElement] = value;
    }

    /**
     * The linear sleeping threshold of the rigid body
     */
    public get linearSleepingThreshold(): number {
        this._nullCheck();
        return this._float32Ptr.array[RigidBodyConstructionInfoOffsets.LinearSleepingThreshold / Constants.A32BytesPerElement];
    }

    public set linearSleepingThreshold(value: number) {
        this._nullCheck();
        this._float32Ptr.array[RigidBodyConstructionInfoOffsets.LinearSleepingThreshold / Constants.A32BytesPerElement] = value;
    }

    /**
     * The angular sleeping threshold of the rigid body
     */
    public get angularSleepingThreshold(): number {
        this._nullCheck();
        return this._float32Ptr.array[RigidBodyConstructionInfoOffsets.AngularSleepingThreshold / Constants.A32BytesPerElement];
    }

    public set angularSleepingThreshold(value: number) {
        this._nullCheck();
        this._float32Ptr.array[RigidBodyConstructionInfoOffsets.AngularSleepingThreshold / Constants.A32BytesPerElement] = value;
    }

    /**
     * The collision group of the rigid body
     *
     * collision group is stored as 16-bit unsigned integer
     */
    public get collisionGroup(): number {
        this._nullCheck();
        return this._uint16Ptr.array[RigidBodyConstructionInfoOffsets.CollisionGroup / Constants.A16BytesPerElement];
    }

    public set collisionGroup(value: number) {
        this._nullCheck();
        this._uint16Ptr.array[RigidBodyConstructionInfoOffsets.CollisionGroup / Constants.A16BytesPerElement] = value;
    }

    /**
     * The collision mask of the rigid body
     *
     * collision mask is stored as 16-bit unsigned integer
     */
    public get collisionMask(): number {
        this._nullCheck();
        return this._uint16Ptr.array[RigidBodyConstructionInfoOffsets.CollisionMask / Constants.A16BytesPerElement];
    }

    public set collisionMask(value: number) {
        this._nullCheck();
        this._uint16Ptr.array[RigidBodyConstructionInfoOffsets.CollisionMask / Constants.A16BytesPerElement] = value;
    }

    /**
     * The additional damping of the rigid body
     */
    public get additionalDamping(): boolean {
        this._nullCheck();
        return !!this._uint8Ptr.array[RigidBodyConstructionInfoOffsets.AdditionalDamping / Constants.A8BytesPerElement];
    }

    public set additionalDamping(value: boolean) {
        this._nullCheck();
        this._uint8Ptr.array[RigidBodyConstructionInfoOffsets.AdditionalDamping / Constants.A8BytesPerElement] = +value;
    }


    /**
     * The no contact response of the rigid body
     */
    public get noContactResponse(): boolean {
        this._nullCheck();
        return !!this._uint8Ptr.array[RigidBodyConstructionInfoOffsets.NoContactResponse / Constants.A8BytesPerElement];
    }

    public set noContactResponse(value: boolean) {
        this._nullCheck();
        this._uint8Ptr.array[RigidBodyConstructionInfoOffsets.NoContactResponse / Constants.A8BytesPerElement] = +value;
    }

    /**
     * The disable deactivation of the rigid body
     */
    public get disableDeactivation(): boolean {
        this._nullCheck();
        return !!this._uint8Ptr.array[RigidBodyConstructionInfoOffsets.DisableDeactivation / Constants.A8BytesPerElement];
    }

    public set disableDeactivation(value: boolean) {
        this._nullCheck();
        this._uint8Ptr.array[RigidBodyConstructionInfoOffsets.DisableDeactivation / Constants.A8BytesPerElement] = +value;
    }
}
