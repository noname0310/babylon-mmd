import type { BulletWasmInstance } from "../bulletWasmInstance";
import type { IWasmSpinLock } from "@/Runtime/Optimized/Misc/IWasmSpinLock";
import type { RigidBodyBundle } from "../rigidBodyBundle";
import { ImmediateRigidBodyBundleImpl } from "./Immediate/immediateRigidBodyBundleImpl";
import { ImmediateRigidBodyImpl } from "./Immediate/immediateRigidBodyImpl";
import type { IRuntime } from "./IRuntime";

class NullSpinlock implements IWasmSpinLock {
    public wait(): void { }
}

export class NullPhysicsRuntime implements IRuntime {
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

    public createRigidBodyImpl(): ImmediateRigidBodyImpl {
        return new ImmediateRigidBodyImpl();
    }

    public createRigidBodyBundleImpl(bundle: RigidBodyBundle): ImmediateRigidBodyBundleImpl {
        return new ImmediateRigidBodyBundleImpl(bundle.count);
    }
}
