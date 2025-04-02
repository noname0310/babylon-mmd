import type { IWasmSpinLock } from "@/Runtime/Optimized/Misc/IWasmSpinLock";

import type { BulletWasmInstance } from "../bulletWasmInstance";
import type { RigidBodyBundle } from "../rigidBodyBundle";
import { ImmediateRigidBodyBundleImpl } from "./Immediate/immediateRigidBodyBundleImpl";
import { ImmediateRigidBodyImpl } from "./Immediate/immediateRigidBodyImpl";
import type { IPhysicsRuntime } from "./IPhysicsRuntime";

class NullSpinlock implements IWasmSpinLock {
    public wait(): void { }
}

/**
 * Empty implementation of the physics runtime
 * for use PhysicsWorld/MultiPhysicsWorld directly without any additional runtime
 */
export class NullPhysicsRuntime implements IPhysicsRuntime {
    /**
     * @internal
     */
    public readonly wasmInstance: BulletWasmInstance;

    /**
     * Spinlock for the physics runtime to synchronize access to the physics world state
     * @internal
     */
    public readonly lock: NullSpinlock;

    /**
     * Creates a new physics runtime
     * @param wasmInstance The Bullet WASM instance
     */
    public constructor(wasmInstance: BulletWasmInstance) {
        this.wasmInstance = wasmInstance;
        this.lock = new NullSpinlock();
    }

    /** @internal */
    public createRigidBodyImpl(): ImmediateRigidBodyImpl {
        return new ImmediateRigidBodyImpl();
    }

    /** @internal */
    public createRigidBodyBundleImpl(bundle: RigidBodyBundle): ImmediateRigidBodyBundleImpl {
        return new ImmediateRigidBodyBundleImpl(bundle.count);
    }
}
