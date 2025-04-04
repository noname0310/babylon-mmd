import type { IWasmSpinLock } from "@/Runtime/Optimized/Misc/IWasmSpinLock";

import type { BulletWasmInstance } from "../bulletWasmInstance";
import type { RigidBodyBundle } from "../rigidBodyBundle";
import type { IRigidBodyBundleImpl } from "./IRigidBodyBundleImpl";
import type { IRigidBodyImpl } from "./IRigidBodyImpl";

/**
 * Represents the runtime for the physics engine
 */
export interface IPhysicsRuntime {
    /**
     * The Bullet WASM instance
     */
    readonly wasmInstance: BulletWasmInstance;

    /**
     * Spinlock for the runtime to synchronize access to the state
     */
    readonly lock: IWasmSpinLock;

    /** @internal */
    createRigidBodyImpl(): IRigidBodyImpl;

    /** @internal */
    createRigidBodyBundleImpl(bundle: RigidBodyBundle): IRigidBodyBundleImpl;
}
