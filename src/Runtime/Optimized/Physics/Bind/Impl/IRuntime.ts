import type { BulletWasmInstance } from "../bulletWasmInstance";
import type { IWasmSpinLock } from "@/Runtime/Optimized/Misc/IWasmSpinLock";
import type { RigidBodyBundle } from "../rigidBodyBundle";
import type { IRigidBodyBundleImpl } from "./IRigidBodyBundleImpl";
import type { IRigidBodyImpl } from "./IRigidBodyImpl";

/**
 * Represents the runtime for the physics engine
 */
export interface IRuntime {
    /**
     * The Bullet WASM instance
     */
    readonly wasmInstance: BulletWasmInstance;

    /**
     * Spinlock for the runtime to synchronize access to the state
     *
     */
    readonly lock: IWasmSpinLock;

    createRigidBodyImpl(): IRigidBodyImpl;

    createRigidBodyBundleImpl(bundle: RigidBodyBundle): IRigidBodyBundleImpl;
}
