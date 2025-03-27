import type { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { BulletWasmInstance } from "./bulletWasmInstance";
import type { IRuntime } from "./Impl/IRuntime";

class PhysicsShapeInner {
    private readonly _wasmInstance: WeakRef<BulletWasmInstance>;
    private _ptr: number;
    private _referenceCount: number;

    public constructor(wasmInstance: WeakRef<BulletWasmInstance>, ptr: number) {
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

function physicsShapeFinalizer(inner: PhysicsShapeInner): void {
    inner.dispose();
}

const physicsShapeRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<PhysicsShapeInner>>();

export abstract class PhysicsShape {
    public readonly runtime: IRuntime;

    protected readonly _inner: PhysicsShapeInner;

    protected constructor(runtime: IRuntime, ptr: number) {
        this.runtime = runtime;
        this._inner = new PhysicsShapeInner(new WeakRef(runtime.wasmInstance), ptr);

        let registry = physicsShapeRegistryMap.get(runtime.wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(physicsShapeFinalizer);
            physicsShapeRegistryMap.set(runtime.wasmInstance, registry);
        }

        registry.register(this, this._inner, this);
    }

    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = physicsShapeRegistryMap.get(this.runtime.wasmInstance);
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

export class PhysicsBoxShape extends PhysicsShape {
    public constructor(runtime: IRuntime, size: Vector3) {
        const ptr = runtime.wasmInstance.createBoxShape(size.x, size.y, size.z);
        super(runtime, ptr);
    }
}

export class PhysicsSphereShape extends PhysicsShape {
    public constructor(runtime: IRuntime, radius: number) {
        const ptr = runtime.wasmInstance.createSphereShape(radius);
        super(runtime, ptr);
    }
}

export class PhysicsCapsuleShape extends PhysicsShape {
    public constructor(runtime: IRuntime, radius: number, height: number) {
        const ptr = runtime.wasmInstance.createCapsuleShape(radius, height);
        super(runtime, ptr);
    }
}

export class PhysicsStaticPlaneShape extends PhysicsShape {
    public constructor(runtime: IRuntime, normal: Vector3, planeConstant: number) {
        const ptr = runtime.wasmInstance.createStaticPlaneShape(normal.x, normal.y, normal.z, planeConstant);
        super(runtime, ptr);
    }
}
