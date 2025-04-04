import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { DeepImmutable } from "@babylonjs/core/types";

import type { IWasmSpinLock } from "../Misc/IWasmSpinLock";
import type { MmdWasmRuntime} from "../mmdWasmRuntime";
import { MmdWasmRuntimeAnimationEvaluationType } from "../mmdWasmRuntime";
import type { BulletWasmInstance } from "./Bind/bulletWasmInstance";
import type { Constraint } from "./Bind/constraint";
import { BufferedRigidBodyBundleImpl } from "./Bind/Impl/Buffered/bufferedRigidBodyBundleImpl";
import { BufferedRigidBodyImpl } from "./Bind/Impl/Buffered/bufferedRigidBodyImpl";
import { ImmediateRigidBodyBundleImpl } from "./Bind/Impl/Immediate/immediateRigidBodyBundleImpl";
import { ImmediateRigidBodyImpl } from "./Bind/Impl/Immediate/immediateRigidBodyImpl";
import type { IPhysicsRuntime } from "./Bind/Impl/IPhysicsRuntime";
import type { IRigidBodyBundleImpl } from "./Bind/Impl/IRigidBodyBundleImpl";
import type { IRigidBodyImpl } from "./Bind/Impl/IRigidBodyImpl";
import { MultiPhysicsWorld } from "./Bind/multiPhysicsWorld";
import type { RigidBody } from "./Bind/rigidBody";
import type { RigidBodyBundle } from "./Bind/rigidBodyBundle";

/**
 * Options for creating a MmdWasmPhysicsRuntimeImpl
 */
export interface MmdWasmPhysicsRuntimeImplCreationOptions {
    /**
     * Whether to preserve the back buffer for the motion state (default: false)
     */
    preserveBackBuffer?: boolean;
}

/**
 * For access full physics world feature, you need to pass this object to the `MmdWasmPhysicsRuntime.getWorld` method
 */
export class MmdWasmPhysicsRuntimeImpl implements IPhysicsRuntime {
    /**
     * Observable that is triggered when the physics world is synchronized
     * in this observable callback scope, ensure that the physics world is not being evaluated
     */
    public readonly onSyncObservable: Observable<void>;

    /**
     * Observable that is triggered on each physics tick
     * in this observable callback scope, physics may be evaluating on the worker thread when evaluation type is Buffered
     */
    public readonly onTickObservable: Observable<void>;

    /**
     * The Bullet WASM instance
     */
    public readonly wasmInstance: BulletWasmInstance;

    /**
     * Spinlock for the runtime to synchronize access to the state
     *
     */
    public readonly lock: IWasmSpinLock;

    private readonly _physicsWorld: MultiPhysicsWorld;

    private readonly _runtime: MmdWasmRuntime;
    private readonly _gravity: Vector3;

    private _usingWasmBackBuffer: boolean;
    private _rigidBodyUsingBackBuffer: boolean;
    private readonly _preserveBackBuffer: boolean;
    private _dynamicShadowCount: number;

    private readonly _rigidBodyMap: Map<RigidBody, number>;
    private readonly _rigidBodyBundleMap: Map<RigidBodyBundle, number>;

    /**
     * @internal
     * Create a new instance of the MmdWasmPhysicsRuntimeImpl class
     * @param runtime The MmdWasmRuntime instance
     * @param initialGravity The initial gravity vector
     * @param options The options for creating the impl object
     */
    public constructor(runtime: MmdWasmRuntime, initialGravity: DeepImmutable<Vector3>, options: MmdWasmPhysicsRuntimeImplCreationOptions = {}) {
        const {
            preserveBackBuffer = false
        } = options;

        this.onSyncObservable = new Observable<void>();
        this.onTickObservable = new Observable<void>();

        this.wasmInstance = runtime.wasmInstance;

        const physicsWorld = new MultiPhysicsWorld(this, runtime.wasmInternal.getMultiPhysicsWorld());

        this.lock = runtime.lock;

        if (preserveBackBuffer) {
            this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(physicsWorld.ptr, true);
        }

        this._physicsWorld = physicsWorld;

        this._runtime = runtime;
        this._gravity = initialGravity.clone();


        this._usingWasmBackBuffer = preserveBackBuffer;
        this._rigidBodyUsingBackBuffer = false;
        this._preserveBackBuffer = preserveBackBuffer;
        this._dynamicShadowCount = 0;

        this._rigidBodyMap = new Map<RigidBody, number>();
        this._rigidBodyBundleMap = new Map<RigidBodyBundle, number>();
    }

    public dispose(): void {
        if (this._physicsWorld.ptr === 0) {
            return;
        }

        this._physicsWorld.dispose();

        this.onSyncObservable.clear();
        this.onTickObservable.clear();
    }

    private _nullCheck(): void {
        if (this._physicsWorld.ptr === 0) {
            throw new Error("Cannot access disposed physics runtime");
        }
    }

    /** @internal */
    public createRigidBodyImpl(): IRigidBodyImpl {
        if (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Immediate) {
            return new ImmediateRigidBodyImpl();
        } else {
            return new BufferedRigidBodyImpl();
        }
    }

    /** @internal */
    public createRigidBodyBundleImpl(bundle: RigidBodyBundle): IRigidBodyBundleImpl {
        if (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Immediate) {
            return new ImmediateRigidBodyBundleImpl(bundle.count);
        } else {
            return new BufferedRigidBodyBundleImpl(bundle.count);
        }
    }

    /** @internal */
    public beforeStep(): void {
        if (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered) {
            // single thread environment fallback must be done before code execution

            this.lock.wait(); // ensure that the runtime is not evaluating the world

            // desync buffer
            if (!this._preserveBackBuffer && !this._usingWasmBackBuffer) {
                this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, true);
                this._usingWasmBackBuffer = true;
            }

            if (this._rigidBodyUsingBackBuffer === false) {
                this._rigidBodyUsingBackBuffer = true;

                for (const rigidBody of this._rigidBodyMap.keys()) {
                    rigidBody.updateBufferedMotionState(false);
                }
                for (const rigidBodyBundle of this._rigidBodyBundleMap.keys()) {
                    rigidBodyBundle.updateBufferedMotionStates(false);
                }
            }

            // commit changes
            {
                for (const rigidBody of this._rigidBodyMap.keys()) {
                    rigidBody.commitToWasm();
                }
                for (const rigidBodyBundle of this._rigidBodyBundleMap.keys()) {
                    rigidBodyBundle.commitToWasm();
                }
            }

            this.onSyncObservable.notifyObservers();

            // evaluate the world in the worker thread
        } else {
            if (this._preserveBackBuffer) {
                this.lock.wait(); // ensure that the runtime is not evaluating animations
            }

            // sync buffer
            if (!this._preserveBackBuffer && this._usingWasmBackBuffer && this._dynamicShadowCount === 0) {
                this.lock.wait(); // ensure that the runtime is not evaluating animations

                this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, false);
                this._usingWasmBackBuffer = false;
            }

            if (this._rigidBodyUsingBackBuffer === true) {
                this.lock.wait(); // ensure that the runtime is not evaluating animations
                this._rigidBodyUsingBackBuffer = false;

                for (const rigidBody of this._rigidBodyMap.keys()) {
                    rigidBody.updateBufferedMotionState(true);
                }
                for (const rigidBodyBundle of this._rigidBodyBundleMap.keys()) {
                    rigidBodyBundle.updateBufferedMotionStates(true);
                }
            }

            // evaluate the world in the main thread
        }
    }

    /** @internal */
    public afterStep(): void {
        if (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered) {
            // do nothing
        } else {
            this.onSyncObservable.notifyObservers();
        }
        this.onTickObservable.notifyObservers();
    }

    public onEvaluationTypeChanged(evaluationType: MmdWasmRuntimeAnimationEvaluationType): void {
        if (evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered) {
            for (const rigidBody of this._rigidBodyMap.keys()) {
                rigidBody.impl = new BufferedRigidBodyImpl();
            }
            for (const rigidBodyBundle of this._rigidBodyBundleMap.keys()) {
                rigidBodyBundle.impl = new BufferedRigidBodyBundleImpl(rigidBodyBundle.count);
            }
        } else {
            for (const rigidBody of this._rigidBodyMap.keys()) {
                // commit changes
                if (rigidBody.needToCommit) {
                    this.lock.wait();
                    rigidBody.commitToWasm();
                }

                rigidBody.impl = new ImmediateRigidBodyImpl();
            }
            for (const rigidBodyBundle of this._rigidBodyBundleMap.keys()) {
                // commit changes
                if (rigidBodyBundle.needToCommit) {
                    this.lock.wait();
                    rigidBodyBundle.commitToWasm();
                }

                rigidBodyBundle.impl = new ImmediateRigidBodyBundleImpl(rigidBodyBundle.count);
            }
        }
    };

    /**
     * Gets the gravity vector of the physics world (default: (0, -10, 0))
     * @returns The gravity vector
     */
    public getGravityToRef(result: Vector3): Vector3 {
        return result.copyFrom(this._gravity);
    }

    /**
     * Sets the gravity vector of the physics world
     *
     * If the runtime evaluation type is Buffered, the gravity will be set after waiting for the lock
     * @param gravity The gravity vector
     */
    public setGravity(gravity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        this._gravity.copyFrom(gravity);
        this._physicsWorld.setGravity(gravity);
    }

    /**
     * Adds a rigid body to the physics world
     *
     * If the world is not existing, it will be created
     *
     * If the runtime evaluation type is Buffered, the rigid body will be added after waiting for the lock
     * @param rigidBody The rigid body to add
     * @param worldId The ID of the world to add the rigid body to
     * @returns True if the rigid body was added successfully, false otherwise
     */
    public addRigidBody(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBody(rigidBody, worldId);
        if (result) {
            let referenceCount = this._rigidBodyMap.get(rigidBody);
            if (referenceCount === undefined) {
                referenceCount = 0;
            }
            this._rigidBodyMap.set(rigidBody, referenceCount + 1);

            if (this._rigidBodyUsingBackBuffer) {
                rigidBody.updateBufferedMotionState(false);
            }

            const isBufferedImpl = rigidBody.impl instanceof BufferedRigidBodyImpl;
            if (isBufferedImpl !== (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBody.needToCommit) {
                    this.lock.wait();
                    rigidBody.commitToWasm();
                }
                rigidBody.impl = this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered
                    ? new BufferedRigidBodyImpl()
                    : new ImmediateRigidBodyImpl();
            }
        }
        return result;
    }

    /**
     * Removes a rigid body from the physics world
     *
     * If there are no more rigid bodies in the world, the world will be destroyed automatically
     *
     * If the runtime evaluation type is Buffered, the rigid body will be removed after waiting for the lock
     * @param rigidBody The rigid body to remove
     * @param worldId The ID of the world to remove the rigid body from
     * @returns True if the rigid body was removed successfully, false otherwise
     */
    public removeRigidBody(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBody(rigidBody, worldId);
        if (result) {
            const referenceCount = this._rigidBodyMap.get(rigidBody);
            if (referenceCount !== undefined) {
                if (referenceCount === 1) {
                    this._rigidBodyMap.delete(rigidBody);
                } else {
                    this._rigidBodyMap.set(rigidBody, referenceCount - 1);
                }
            }

            rigidBody.updateBufferedMotionState(false);
        }
        return result;
    }

    /**
     * Adds a rigid body bundle to the physics world
     *
     * If the world is not existing, it will be created
     *
     * If the runtime evaluation type is Buffered, the rigid body bundle will be added after waiting for the lock
     * @param rigidBodyBundle The rigid body bundle to add
     * @param worldId The ID of the world to add the rigid body bundle to
     * @returns True if the rigid body bundle was added successfully, false otherwise
     */
    public addRigidBodyBundle(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBodyBundle(rigidBodyBundle, worldId);
        if (result) {
            let referenceCount = this._rigidBodyBundleMap.get(rigidBodyBundle);
            if (referenceCount === undefined) {
                referenceCount = 0;
            }
            this._rigidBodyBundleMap.set(rigidBodyBundle, referenceCount + 1);

            if (this._rigidBodyUsingBackBuffer) {
                rigidBodyBundle.updateBufferedMotionStates(false);
            }

            const isBufferedImpl = rigidBodyBundle.impl instanceof BufferedRigidBodyBundleImpl;
            if (isBufferedImpl !== (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBodyBundle.needToCommit) {
                    this.lock.wait();
                    rigidBodyBundle.commitToWasm();
                }
                rigidBodyBundle.impl = this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered
                    ? new BufferedRigidBodyBundleImpl(rigidBodyBundle.count)
                    : new ImmediateRigidBodyBundleImpl(rigidBodyBundle.count);
            }
        }
        return result;
    }

    /**
     * Removes a rigid body bundle from the physics world
     *
     * If there are no more rigid body bundles in the world, the world will be destroyed automatically
     *
     * If the runtime evaluation type is Buffered, the rigid body bundle will be removed after waiting for the lock
     * @param rigidBodyBundle The rigid body bundle to remove
     * @param worldId The ID of the world to remove the rigid body bundle from
     * @returns True if the rigid body bundle was removed successfully, false otherwise
     */
    public removeRigidBodyBundle(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyBundle(rigidBodyBundle, worldId);
        if (result) {
            const referenceCount = this._rigidBodyBundleMap.get(rigidBodyBundle);
            if (referenceCount !== undefined) {
                if (referenceCount === 1) {
                    this._rigidBodyBundleMap.delete(rigidBodyBundle);
                } else {
                    this._rigidBodyBundleMap.set(rigidBodyBundle, referenceCount - 1);
                }
            }

            rigidBodyBundle.updateBufferedMotionStates(false);
        }
        return result;
    }

    /**
     * Adds a rigid body to all worlds
     *
     * rigid body physics mode must be Static or Kinematic
     *
     * If the runtime evaluation type is Buffered, the rigid body will be added after waiting for the lock
     * @param rigidBody The rigid body to add
     * @returns True if the rigid body was added successfully, false otherwise
     */
    public addRigidBodyToGlobal(rigidBody: RigidBody): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBodyToGlobal(rigidBody);
        if (result) {
            let referenceCount = this._rigidBodyMap.get(rigidBody);
            if (referenceCount === undefined) {
                referenceCount = 0;
            }
            this._rigidBodyMap.set(rigidBody, referenceCount + 1);

            if (this._rigidBodyUsingBackBuffer) {
                rigidBody.updateBufferedMotionState(false);
            }

            const isBufferedImpl = rigidBody.impl instanceof BufferedRigidBodyImpl;
            if (isBufferedImpl !== (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBody.needToCommit) {
                    this.lock.wait();
                    rigidBody.commitToWasm();
                }
                rigidBody.impl = this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered
                    ? new BufferedRigidBodyImpl()
                    : new ImmediateRigidBodyImpl();
            }
        }
        return result;
    }

    /**
     * Removes a rigid body from all worlds
     *
     * This method does not remove the rigid body that is added with `MultiPhysicsRuntime.addRigidBody`
     *
     * Only the rigid body that is added with `MultiPhysicsRuntime.addRigidBodyToGlobal` will be removed
     *
     * If there are no more rigid bodies in the world, the world will be destroyed automatically
     *
     * If the runtime evaluation type is Buffered, the rigid body will be removed after waiting for the lock
     * @param rigidBody The rigid body to remove
     * @returns True if the rigid body was removed successfully, false otherwise
     */
    public removeRigidBodyFromGlobal(rigidBody: RigidBody): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyFromGlobal(rigidBody);
        if (result) {
            const referenceCount = this._rigidBodyMap.get(rigidBody);
            if (referenceCount !== undefined) {
                if (referenceCount === 1) {
                    this._rigidBodyMap.delete(rigidBody);
                } else {
                    this._rigidBodyMap.set(rigidBody, referenceCount - 1);
                }
            }

            rigidBody.updateBufferedMotionState(false);
        }
        return result;
    }

    /**
     * Adds a rigid body bundle to all worlds
     *
     * rigid body bundle physics mode must be Static or Kinematic
     *
     * If the runtime evaluation type is Buffered, the rigid body bundle will be added after waiting for the lock
     * @param rigidBodyBundle The rigid body bundle to add
     * @returns True if the rigid body bundle was added successfully, false otherwise
     */
    public addRigidBodyBundleToGlobal(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBodyBundleToGlobal(rigidBodyBundle);
        if (result) {
            let referenceCount = this._rigidBodyBundleMap.get(rigidBodyBundle);
            if (referenceCount === undefined) {
                referenceCount = 0;
            }
            this._rigidBodyBundleMap.set(rigidBodyBundle, referenceCount + 1);

            if (this._rigidBodyUsingBackBuffer) {
                rigidBodyBundle.updateBufferedMotionStates(false);
            }

            const isBufferedImpl = rigidBodyBundle.impl instanceof BufferedRigidBodyBundleImpl;
            if (isBufferedImpl !== (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBodyBundle.needToCommit) {
                    this.lock.wait();
                    rigidBodyBundle.commitToWasm();
                }
                rigidBodyBundle.impl = this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered
                    ? new BufferedRigidBodyBundleImpl(rigidBodyBundle.count)
                    : new ImmediateRigidBodyBundleImpl(rigidBodyBundle.count);
            }
        }
        return result;
    }

    /**
     * Removes a rigid body bundle from all worlds
     *
     * This method does not remove the rigid body bundle that is added with `MultiPhysicsRuntime.addRigidBodyBundle`
     *
     * Only the rigid body bundle that is added with `MultiPhysicsRuntime.addRigidBodyBundleToGlobal` will be removed
     *
     * If there are no more rigid body bundles in the world, the world will be destroyed automatically
     *
     * If the runtime evaluation type is Buffered, the rigid body bundle will be removed after waiting for the lock
     * @param rigidBodyBundle The rigid body bundle to remove
     * @returns True if the rigid body bundle was removed successfully, false otherwise
     */
    public removeRigidBodyBundleFromGlobal(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyBundleFromGlobal(rigidBodyBundle);
        if (result) {
            const referenceCount = this._rigidBodyBundleMap.get(rigidBodyBundle);
            if (referenceCount !== undefined) {
                if (referenceCount === 1) {
                    this._rigidBodyBundleMap.delete(rigidBodyBundle);
                } else {
                    this._rigidBodyBundleMap.set(rigidBodyBundle, referenceCount - 1);
                }
            }

            rigidBodyBundle.updateBufferedMotionStates(false);
        }
        return result;
    }

    /**
     * Adds a rigid body shadow to the physics world
     *
     * In case of Dynamic physics mode, Rigid body firstly needs to be added to the other world
     *
     * The worldId must be not equal to the worldId of the rigid body
     *
     * Rigid body shadow allows the rigid body to be added to multiple worlds
     *
     * If the runtime evaluation type is Buffered, the rigid body shadow will be added after waiting for the lock
     * @param rigidBody The rigid body to add
     * @param worldId The ID of the world to add the rigid body as shadow
     * @returns True if the rigid body shadow was added successfully, false otherwise
     */
    public addRigidBodyShadow(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();

        let backBufferUpdated = false;

        if (!this._usingWasmBackBuffer) {
            this.lock.wait(); // ensure that the runtime is not evaluating animations
            this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, true);
            this._usingWasmBackBuffer = true;
            backBufferUpdated = true;
        }
        const result = this._physicsWorld.addRigidBodyShadow(rigidBody, worldId);
        if (result) {
            let referenceCount = this._rigidBodyMap.get(rigidBody);
            if (referenceCount === undefined) {
                referenceCount = 0;
            }
            this._rigidBodyMap.set(rigidBody, referenceCount + 1);

            this._dynamicShadowCount += 1;

            if (this._rigidBodyUsingBackBuffer) {
                rigidBody.updateBufferedMotionState(false);
            }

            const isBufferedImpl = rigidBody.impl instanceof BufferedRigidBodyImpl;
            if (isBufferedImpl !== (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBody.needToCommit) {
                    this.lock.wait();
                    rigidBody.commitToWasm();
                }
                rigidBody.impl = this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered
                    ? new BufferedRigidBodyImpl()
                    : new ImmediateRigidBodyImpl();
            }
        } else {
            if (/* !this._preserveBackBuffer && */ this._dynamicShadowCount === 0 && backBufferUpdated) {
                this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, false);
                this._usingWasmBackBuffer = false;
            }
        }

        // we don't need updateBufferedMotionState immediately
        // because the buffered motion state has same value with the immediate motion state in the time of adding shadow

        return result;
    }

    /**
     * Removes a rigid body shadow from the physics world
     *
     * If the runtime evaluation type is Buffered, the rigid body shadow will be removed after waiting for the lock
     * @param rigidBody The rigid body to remove
     * @param worldId The ID of the world to remove the rigid body shadow from
     * @returns True if the rigid body shadow was removed successfully, false otherwise
     */
    public removeRigidBodyShadow(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyShadow(rigidBody, worldId);
        if (result) {
            const referenceCount = this._rigidBodyMap.get(rigidBody);
            if (referenceCount !== undefined) {
                if (referenceCount === 1) {
                    this._rigidBodyMap.delete(rigidBody);
                } else {
                    this._rigidBodyMap.set(rigidBody, referenceCount - 1);
                }
            }

            this._dynamicShadowCount -= 1;

            rigidBody.updateBufferedMotionState(false);
        }

        let backBufferUpdated = false;

        if (
            !this._preserveBackBuffer && // if back buffer is preserved, we should not desync it
            this._dynamicShadowCount === 0 &&
            this._usingWasmBackBuffer &&
            this._runtime.evaluationType !== MmdWasmRuntimeAnimationEvaluationType.Buffered // if the evaluation type is buffered, we should not desync it
        ) {
            this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, false);
            this._usingWasmBackBuffer = false;
            backBufferUpdated = true;
        }

        if (backBufferUpdated && this._rigidBodyUsingBackBuffer) {
            this._rigidBodyUsingBackBuffer = false;

            for (const rigidBody of this._rigidBodyMap.keys()) {
                rigidBody.updateBufferedMotionState(true);
            }
            for (const rigidBodyBundle of this._rigidBodyBundleMap.keys()) {
                rigidBodyBundle.updateBufferedMotionStates(true);
            }
        }

        return result;
    }

    /**
     * Adds a rigid body bundle shadow to the physics world
     *
     * In case of Dynamic physics mode, Rigid body bundle firstly needs to be added to the other world
     *
     * and the worldId must be not equal to the worldId of the rigid body bundle
     *
     * Rigid body bundle shadow allows the rigid body bundle to be added to multiple worlds
     *
     * If the runtime evaluation type is Buffered, the rigid body bundle shadow will be added after waiting for the lock
     * @param rigidBodyBundle The rigid body bundle to add
     * @param worldId The ID of the world to add the rigid body bundle as shadow
     * @returns True if the rigid body bundle shadow was added successfully, false otherwise
     */
    public addRigidBodyBundleShadow(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();

        let backBufferUpdated = false;

        if (!this._usingWasmBackBuffer) {
            this.lock.wait(); // ensure that the runtime is not evaluating animations
            this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, true);
            this._usingWasmBackBuffer = true;
            backBufferUpdated = true;
        }
        const result = this._physicsWorld.addRigidBodyBundleShadow(rigidBodyBundle, worldId);
        if (result) {
            let referenceCount = this._rigidBodyBundleMap.get(rigidBodyBundle);
            if (referenceCount === undefined) {
                referenceCount = 0;
            }
            this._rigidBodyBundleMap.set(rigidBodyBundle, referenceCount + 1);

            this._dynamicShadowCount += 1;

            if (this._rigidBodyUsingBackBuffer) {
                rigidBodyBundle.updateBufferedMotionStates(false);
            }

            const isBufferedImpl = rigidBodyBundle.impl instanceof BufferedRigidBodyBundleImpl;
            if (isBufferedImpl !== (this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBodyBundle.needToCommit) {
                    this.lock.wait();
                    rigidBodyBundle.commitToWasm();
                }
                rigidBodyBundle.impl = this._runtime.evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered
                    ? new BufferedRigidBodyBundleImpl(rigidBodyBundle.count)
                    : new ImmediateRigidBodyBundleImpl(rigidBodyBundle.count);
            }
        } else {
            if (/* !this._preserveBackBuffer && */ this._dynamicShadowCount === 0 && backBufferUpdated) {
                this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, false);
                this._usingWasmBackBuffer = false;
            }
        }

        return result;
    }

    /**
     * Removes a rigid body bundle shadow from the physics world
     *
     * If the runtime evaluation type is Buffered, the rigid body bundle shadow will be removed after waiting for the lock
     * @param rigidBodyBundle The rigid body bundle to remove
     * @param worldId The ID of the world to remove the rigid body bundle shadow from
     * @returns True if the rigid body bundle shadow was removed successfully, false otherwise
     */
    public removeRigidBodyBundleShadow(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyBundleShadow(rigidBodyBundle, worldId);
        if (result) {
            const referenceCount = this._rigidBodyBundleMap.get(rigidBodyBundle);
            if (referenceCount !== undefined) {
                if (referenceCount === 1) {
                    this._rigidBodyBundleMap.delete(rigidBodyBundle);
                } else {
                    this._rigidBodyBundleMap.set(rigidBodyBundle, referenceCount - 1);
                }
            }

            this._dynamicShadowCount -= 1;

            rigidBodyBundle.updateBufferedMotionStates(false);
        }

        let backBufferUpdated = false;

        if (
            !this._preserveBackBuffer && // if back buffer is preserved, we should not desync it
            this._dynamicShadowCount === 0 &&
            this._usingWasmBackBuffer &&
            this._runtime.evaluationType !== MmdWasmRuntimeAnimationEvaluationType.Buffered // if the evaluation type is buffered, we should not desync it
        ) {
            this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, false);
            this._usingWasmBackBuffer = false;
            backBufferUpdated = true;
        }

        if (backBufferUpdated && this._rigidBodyUsingBackBuffer) {
            this._rigidBodyUsingBackBuffer = false;

            for (const rigidBody of this._rigidBodyMap.keys()) {
                rigidBody.updateBufferedMotionState(true);
            }
            for (const rigidBodyBundle of this._rigidBodyBundleMap.keys()) {
                rigidBodyBundle.updateBufferedMotionStates(true);
            }
        }

        return result;
    }

    /**
     * Gets the rigid body reference count map
     */
    public get rigidBodyReferenceCountMap(): ReadonlyMap<RigidBody, number> {
        return this._rigidBodyMap;
    }

    /**
     * Gets the rigid body bundle reference count map
     */
    public get rigidBodyBundleReferenceCountMap(): ReadonlyMap<RigidBodyBundle, number> {
        return this._rigidBodyBundleMap;
    }

    /**
     * Adds a constraint to the physics world
     *
     * Constraint worldId must be equal to the worldId of the connected rigid bodies
     *
     * If the runtime evaluation type is Buffered, the constraint will be added after waiting for the lock
     * @param constraint The constraint to add
     * @param worldId The ID of the world to add the constraint to
     * @param disableCollisionsBetweenLinkedBodies Whether to disable collisions between the linked bodies
     * @returns True if the constraint was added successfully, false otherwise
     */
    public addConstraint(constraint: Constraint, worldId: number, disableCollisionsBetweenLinkedBodies: boolean): boolean {
        this._nullCheck();
        return this._physicsWorld.addConstraint(constraint, worldId, disableCollisionsBetweenLinkedBodies);
    }

    /**
     * Removes a constraint from the physics world
     *
     * If the runtime evaluation type is Buffered, the constraint will be removed after waiting for the lock
     * @param constraint The constraint to remove
     * @param worldId The ID of the world to remove the constraint from
     * @returns True if the constraint was removed successfully, false otherwise
     */
    public removeConstraint(constraint: Constraint, worldId: number): boolean {
        this._nullCheck();
        return this._physicsWorld.removeConstraint(constraint, worldId);
    }
}
