import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import { WasmSpinlock } from "@/Runtime/Optimized/Misc/wasmSpinlock";

import type { BulletWasmInstance } from "../bulletWasmInstance";
import type { Constraint } from "../constraint";
import { MultiPhysicsWorld } from "../multiPhysicsWorld";
import type { RigidBody } from "../rigidBody";
import type { RigidBodyBundle } from "../rigidBodyBundle";
import { BufferedRigidBodyBundleImpl } from "./Buffered/bufferedRigidBodyBundleImpl";
import { BufferedRigidBodyImpl } from "./Buffered/bufferedRigidBodyImpl";
import { ImmediateRigidBodyBundleImpl } from "./Immediate/immediateRigidBodyBundleImpl";
import { ImmediateRigidBodyImpl } from "./Immediate/immediateRigidBodyImpl";
import type { IPhysicsRuntime } from "./IPhysicsRuntime";
import type { IRigidBodyBundleImpl } from "./IRigidBodyBundleImpl";
import type { IRigidBodyImpl } from "./IRigidBodyImpl";
import { PhysicsRuntimeEvaluationType } from "./physicsRuntimeEvaluationType";

/**
 * Options for creating a MultiPhysicsRuntime
 */
export interface MultiPhysicsRuntimeCreationOptions {
    /**
     * Whether to allow dynamic rigid body shadows (default: false)
     *
     * If disabled, rigid body shadow creation will be allowed only if the rigid body physics mode is set to Static or Kinematic
     */
    allowDynamicShadow?: boolean;

    /**
     * Whether to preserve the back buffer for the motion state (default: false)
     */
    preserveBackBuffer?: boolean;
}

class MultiPhysicsRuntimeInner {
    private readonly _lock: WasmSpinlock;
    private readonly _wasmInstance: WeakRef<BulletWasmInstance>;
    private _ptr: number;
    private _worldReference: Nullable<MultiPhysicsWorld>;

    public constructor(lock: WasmSpinlock, wasmInstance: WeakRef<BulletWasmInstance>, ptr: number, worldReference: MultiPhysicsWorld) {
        this._lock = lock;
        this._wasmInstance = wasmInstance;
        this._ptr = ptr;
        this._worldReference = worldReference;
        worldReference.addReference();
    }

    public dispose(): void {
        if (this._ptr === 0) {
            return;
        }

        this._lock.wait(); // ensure that the runtime is not evaluating the world
        this._wasmInstance.deref()?.destroyMultiPhysicsRuntime(this._ptr);

        this._ptr = 0;
        this._worldReference!.removeReference();
        this._worldReference = null;
    }

    public get ptr(): number {
        return this._ptr;
    }
}

function multiPhysicsRuntimeFinalizer(runtime: MultiPhysicsRuntimeInner): void {
    runtime.dispose();
}

const multiPhysicsRuntimeRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<MultiPhysicsRuntimeInner>>();

/**
 * MultiPhysicsRuntime handles the multiple physics simulations and provides an interface for managing rigid bodies and constraints
 *
 * It is responsible for evaluating the physics world and synchronizing the state of rigid bodies
 */
export class MultiPhysicsRuntime implements IPhysicsRuntime {
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
     * @internal
     */
    public readonly wasmInstance: BulletWasmInstance;

    /**
     * Spinlock for the physics runtime to synchronize access to the physics world state
     * @internal
     */
    public readonly lock: WasmSpinlock;

    private readonly _inner: MultiPhysicsRuntimeInner;

    private readonly _physicsWorld: MultiPhysicsWorld;

    private _scene: Nullable<Scene>;
    private _afterAnimationsBinded: Nullable<() => void>;

    private _evaluationType: PhysicsRuntimeEvaluationType;
    private _usingWasmBackBuffer: boolean;
    private _rigidBodyUsingBackBuffer: boolean;
    private readonly _preserveBackBuffer: boolean;
    private _dynamicShadowCount: number;

    /**
     * Whether to use delta time for world step (default: true)
     *
     * If true, the delta time will be calculated based on the scene's delta time
     * If false, the `MultiPhysicsRuntime.timeStep` property will be used as the fixed time step
     */
    public useDeltaForWorldStep: boolean;

    /**
     * The time step for the physics simulation (default: 1/60)
     *
     * This value is used when `useDeltaForWorldStep` is set to false
     */
    public timeStep: number;

    /**
     * The maximum number of substeps for the physics simulation (default: 10)
     *
     * This value is used to control the maximum number of substeps taken in a single frame
     */
    public maxSubSteps: number;

    /**
     * The fixed time step for the physics simulation (default: 1/60)
     */
    public fixedTimeStep: number;

    private readonly _rigidBodyMap: Map<RigidBody, number>;
    private readonly _rigidBodyBundleMap: Map<RigidBodyBundle, number>;

    /**
     * Creates a new physics runtime
     * @param wasmInstance The Bullet WASM instance
     * @param options The creation options
     */
    public constructor(wasmInstance: BulletWasmInstance, options: MultiPhysicsRuntimeCreationOptions = {}) {
        const {
            allowDynamicShadow = false,
            preserveBackBuffer = false
        } = options;

        this.onSyncObservable = new Observable<void>();
        this.onTickObservable = new Observable<void>();

        this.wasmInstance = wasmInstance;

        const physicsWorld = new MultiPhysicsWorld(this, allowDynamicShadow);
        const ptr = wasmInstance.createMultiPhysicsRuntime(physicsWorld.ptr);

        const lockPtr = wasmInstance.multiPhysicsRuntimeGetLockStatePtr(ptr);
        this.lock = new WasmSpinlock(wasmInstance.createTypedArray(Uint8Array, lockPtr, 1));

        if (preserveBackBuffer) {
            wasmInstance.multiPhysicsWorldUseMotionStateBuffer(physicsWorld.ptr, true);
        }

        this._inner = new MultiPhysicsRuntimeInner(this.lock, new WeakRef(wasmInstance), ptr, physicsWorld);
        this._physicsWorld = physicsWorld;

        let registry = multiPhysicsRuntimeRegistryMap.get(wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(multiPhysicsRuntimeFinalizer);
            multiPhysicsRuntimeRegistryMap.set(wasmInstance, registry);
        }

        registry.register(this, this._inner, this);

        this._scene = null;
        this._afterAnimationsBinded = null;

        this._evaluationType = PhysicsRuntimeEvaluationType.Immediate;
        this._usingWasmBackBuffer = preserveBackBuffer;
        this._rigidBodyUsingBackBuffer = false;
        this._preserveBackBuffer = preserveBackBuffer;
        this._dynamicShadowCount = 0;

        this.useDeltaForWorldStep = true;
        this.timeStep = 1 / 60;
        this.maxSubSteps = 10;
        this.fixedTimeStep = 1 / 60;

        this._rigidBodyMap = new Map<RigidBody, number>();
        this._rigidBodyBundleMap = new Map<RigidBodyBundle, number>();
    }

    /**
     * Disposes the physics runtime
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();
        this._physicsWorld.dispose();

        const registry = multiPhysicsRuntimeRegistryMap.get(this.wasmInstance);
        registry?.unregister(this);
    }

    /** @internal */
    public get ptr(): number {
        return this._inner.ptr;
    }

    private _nullCheck(): void {
        if (this._inner.ptr === 0) {
            throw new Error("Cannot access disposed physics runtime");
        }
    }

    /** @internal */
    public createRigidBodyImpl(): IRigidBodyImpl {
        if (this._evaluationType === PhysicsRuntimeEvaluationType.Immediate) {
            return new ImmediateRigidBodyImpl();
        } else {
            return new BufferedRigidBodyImpl();
        }
    }

    /** @internal */
    public createRigidBodyBundleImpl(bundle: RigidBodyBundle): IRigidBodyBundleImpl {
        if (this._evaluationType === PhysicsRuntimeEvaluationType.Immediate) {
            return new ImmediateRigidBodyBundleImpl(bundle.count);
        } else {
            return new BufferedRigidBodyBundleImpl(bundle.count);
        }
    }

    /**
     * Registers the physics runtime with the given scene
     *
     * This method binds the `afterAnimations` method to the scene's `onAfterAnimationsObservable` event
     *
     * You can manually call `afterAnimations` if you want to control the timing of the physics simulation
     * @param scene The scene to register with
     */
    public register(scene: Scene): void {
        if (this._afterAnimationsBinded !== null) return;
        this._nullCheck();

        this._afterAnimationsBinded = (): void => {
            this.afterAnimations(scene.getEngine().getDeltaTime());
        };
        this._scene = scene;
        scene.onAfterAnimationsObservable.add(this._afterAnimationsBinded);
    }

    /**
     * Unregisters the physics runtime from the scene
     */
    public unregister(): void {
        if (this._afterAnimationsBinded === null) return;

        this._scene!.onAfterAnimationsObservable.removeCallback(this._afterAnimationsBinded);
        this._afterAnimationsBinded = null;
        this._scene = null;
    }

    /**
     * Steps the physics simulation and synchronizes the state of rigid bodies
     *
     * In most cases, you do not need to call this method manually,
     * Instead, you can use the `register` method to bind it to the scene's `onAfterAnimationsObservable` event
     * @param deltaTime The time delta in milliseconds
     */
    public afterAnimations(deltaTime: number): void {
        if (this._inner.ptr === 0) {
            this.unregister();
            return;
        }

        // compute delta time
        if (this.useDeltaForWorldStep) {
            const scene = this._scene;
            if (scene !== null) {
                deltaTime = scene.useConstantAnimationDeltaTime
                    ? 16
                    : Math.max(Scene.MinDeltaTime, Math.min(deltaTime, Scene.MaxDeltaTime));
            } else {
                deltaTime = Math.max(Scene.MinDeltaTime, Math.min(deltaTime, Scene.MaxDeltaTime));
            }
            deltaTime /= 1000;
        } else {
            deltaTime = this.timeStep;
        }

        if (this._evaluationType === PhysicsRuntimeEvaluationType.Buffered) {
            if (this.wasmInstance.multiPhysicsRuntimeBufferedStepSimulation === undefined) { // single thread environment fallback
                this._physicsWorld.stepSimulation(deltaTime, this.maxSubSteps, this.fixedTimeStep);
            }

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
            this.wasmInstance.multiPhysicsRuntimeBufferedStepSimulation?.(this._inner.ptr, deltaTime, this.maxSubSteps, this.fixedTimeStep);
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

            this._physicsWorld.stepSimulation(deltaTime, this.maxSubSteps, this.fixedTimeStep);
            this.onSyncObservable.notifyObservers();
        }

        this.onTickObservable.notifyObservers();
    }

    /**
     * Animation evaluation type
     */
    public get evaluationType(): PhysicsRuntimeEvaluationType {
        return this._evaluationType;
    }

    public set evaluationType(value: PhysicsRuntimeEvaluationType) {
        if (this._evaluationType === value) return;

        if (value === PhysicsRuntimeEvaluationType.Buffered) {
            this._evaluationType = value;
        } else {
            this._evaluationType = value;
        }

        if (value === PhysicsRuntimeEvaluationType.Buffered) {
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
    }

    private readonly _gravity: Vector3 = new Vector3(0, -10, 0);

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
            if (isBufferedImpl !== (this._evaluationType === PhysicsRuntimeEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBody.needToCommit) {
                    this.lock.wait();
                    rigidBody.commitToWasm();
                }
                rigidBody.impl = this._evaluationType === PhysicsRuntimeEvaluationType.Buffered
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
            if (isBufferedImpl !== (this._evaluationType === PhysicsRuntimeEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBodyBundle.needToCommit) {
                    this.lock.wait();
                    rigidBodyBundle.commitToWasm();
                }
                rigidBodyBundle.impl = this._evaluationType === PhysicsRuntimeEvaluationType.Buffered
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
            if (isBufferedImpl !== (this._evaluationType === PhysicsRuntimeEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBody.needToCommit) {
                    this.lock.wait();
                    rigidBody.commitToWasm();
                }
                rigidBody.impl = this._evaluationType === PhysicsRuntimeEvaluationType.Buffered
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
            if (isBufferedImpl !== (this._evaluationType === PhysicsRuntimeEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBodyBundle.needToCommit) {
                    this.lock.wait();
                    rigidBodyBundle.commitToWasm();
                }
                rigidBodyBundle.impl = this._evaluationType === PhysicsRuntimeEvaluationType.Buffered
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
            if (isBufferedImpl !== (this._evaluationType === PhysicsRuntimeEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBody.needToCommit) {
                    this.lock.wait();
                    rigidBody.commitToWasm();
                }
                rigidBody.impl = this._evaluationType === PhysicsRuntimeEvaluationType.Buffered
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
            this._evaluationType !== PhysicsRuntimeEvaluationType.Buffered // if the evaluation type is buffered, we should not desync it
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
            if (isBufferedImpl !== (this._evaluationType === PhysicsRuntimeEvaluationType.Buffered)) {
                if (isBufferedImpl && rigidBodyBundle.needToCommit) {
                    this.lock.wait();
                    rigidBodyBundle.commitToWasm();
                }
                rigidBodyBundle.impl = this._evaluationType === PhysicsRuntimeEvaluationType.Buffered
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
            this._evaluationType !== PhysicsRuntimeEvaluationType.Buffered // if the evaluation type is buffered, we should not desync it
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
