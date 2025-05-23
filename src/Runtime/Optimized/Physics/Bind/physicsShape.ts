import type { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { IBulletWasmInstance } from "./bulletWasmInstance";
import type { IPhysicsRuntime } from "./Impl/IPhysicsRuntime";

class PhysicsShapeInner {
    private readonly _wasmInstance: WeakRef<IBulletWasmInstance>;
    private _ptr: number;
    private _referenceCount: number;

    public constructor(wasmInstance: WeakRef<IBulletWasmInstance>, ptr: number) {
        this._wasmInstance = wasmInstance;
        this._ptr = ptr;
        this._referenceCount = 0;
    }

    public dispose(): void {
        if (this._referenceCount > 0) {
            throw new Error("Cannot dispose shape while it still has references");
        }

        if (this._ptr === 0) {
            return;
        }

        // this operation is thread-safe because the physics shape is not belong to any physics world
        this._wasmInstance.deref()?.destroyShape(this._ptr);

        this._ptr = 0;
    }

    public get ptr(): number {
        return this._ptr;
    }

    public addReference(): void {
        this._referenceCount += 1;
    }

    public removeReference(): void {
        this._referenceCount -= 1;
    }
}

function PhysicsShapeFinalizer(inner: PhysicsShapeInner): void {
    inner.dispose();
}

const PhysicsShapeRegistryMap = new WeakMap<IBulletWasmInstance, FinalizationRegistry<PhysicsShapeInner>>();

/**
 * Base class for all bullet physics shapes
 */
export abstract class PhysicsShape {
    public readonly runtime: IPhysicsRuntime;

    protected readonly _inner: PhysicsShapeInner;

    protected constructor(runtime: IPhysicsRuntime, ptr: number) {
        this.runtime = runtime;
        this._inner = new PhysicsShapeInner(new WeakRef(runtime.wasmInstance), ptr);

        let registry = PhysicsShapeRegistryMap.get(runtime.wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(PhysicsShapeFinalizer);
            PhysicsShapeRegistryMap.set(runtime.wasmInstance, registry);
        }

        registry.register(this, this._inner, this);
    }

    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = PhysicsShapeRegistryMap.get(this.runtime.wasmInstance);
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
}

/**
 * Box shape
 */
export class PhysicsBoxShape extends PhysicsShape {
    /**
     * Creates a new box shape
     * @param runtime physics runtime
     * @param size half extents of the box shape
     */
    public constructor(runtime: IPhysicsRuntime, size: Vector3) {
        const ptr = runtime.wasmInstance.createBoxShape(size.x, size.y, size.z);
        super(runtime, ptr);
    }
}

/**
 * Sphere shape
 */
export class PhysicsSphereShape extends PhysicsShape {
    /**
     * Creates a new sphere shape
     * @param runtime physics runtime
     * @param radius radius of the sphere shape
     */
    public constructor(runtime: IPhysicsRuntime, radius: number) {
        const ptr = runtime.wasmInstance.createSphereShape(radius);
        super(runtime, ptr);
    }
}

/**
 * Cylinder shape
 */
export class PhysicsCapsuleShape extends PhysicsShape {
    /**
     * Creates a new capsule shape
     * @param runtime physics runtime
     * @param radius radius of the capsule shape
     * @param height height of the capsule shape
     */
    public constructor(runtime: IPhysicsRuntime, radius: number, height: number) {
        const ptr = runtime.wasmInstance.createCapsuleShape(radius, height);
        super(runtime, ptr);
    }
}

/**
 * Static plane shape
 */
export class PhysicsStaticPlaneShape extends PhysicsShape {
    /**
     * Creates a new static plane shape
     * @param runtime physics runtime
     * @param normal normal of the plane shape
     * @param planeConstant constant of the plane shape
     */
    public constructor(runtime: IPhysicsRuntime, normal: Vector3, planeConstant: number) {
        const ptr = runtime.wasmInstance.createStaticPlaneShape(normal.x, normal.y, normal.z, planeConstant);
        super(runtime, ptr);
    }
}
