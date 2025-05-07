import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import { WasmSpinlock } from "@/Runtime/Optimized/Misc/wasmSpinlock";

import type { IBulletWasmInstance } from "../bulletWasmInstance";
import type { Constraint } from "../constraint";
import { PhysicsWorld } from "../physicsWorld";
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

class PhysicsRuntimeInner {
    private readonly _lock: WasmSpinlock;
    private readonly _wasmInstance: WeakRef<IBulletWasmInstance>;
    private _ptr: number;
    private _worldReference: Nullable<PhysicsWorld>;

    public constructor(lock: WasmSpinlock, wasmInstance: WeakRef<IBulletWasmInstance>, ptr: number, worldReference: PhysicsWorld) {
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
        this._wasmInstance.deref()?.destroyPhysicsRuntime(this._ptr);

        this._ptr = 0;
        this._worldReference!.removeReference();
        this._worldReference = null;
    }

    public get ptr(): number {
        return this._ptr;
    }
}

function PhysicsRuntimeFinalizer(inner: PhysicsRuntimeInner): void {
    inner.dispose();
}

const PhysicsRuntimeRegistryMap = new WeakMap<IBulletWasmInstance, FinalizationRegistry<PhysicsRuntimeInner>>();

/**
 * PhysicsRuntime handles the physics simulation and provides an interface for managing rigid bodies and constraints
 *
 * It is responsible for evaluating the physics world and synchronizing the state of rigid bodies
 */
export class PhysicsRuntime implements IPhysicsRuntime {
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
    public readonly wasmInstance: IBulletWasmInstance;

    /**
     * Spinlock for the physics runtime to synchronize access to the physics world state
     * @internal
     */
    public readonly lock: WasmSpinlock;

    private readonly _inner: PhysicsRuntimeInner;

    private readonly _physicsWorld: PhysicsWorld;

    private _scene: Nullable<Scene>;
    private _afterAnimationsBinded: Nullable<() => void>;

    private _evaluationType: PhysicsRuntimeEvaluationType;
    private _usingWasmBackBuffer: boolean;

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
     * This property is only used when `useDeltaForWorldStep` is false
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

    private readonly _rigidBodyList: RigidBody[];
    private readonly _rigidBodyBundleList: RigidBodyBundle[];

    /**
     * Creates a new physics runtime
     * @param wasmInstance The Bullet WASM instance
     */
    public constructor(wasmInstance: IBulletWasmInstance) {
        this.onSyncObservable = new Observable<void>();
        this.onTickObservable = new Observable<void>();

        this.wasmInstance = wasmInstance;

        const physicsWorld = new PhysicsWorld(this);
        const ptr = wasmInstance.createPhysicsRuntime(physicsWorld.ptr);

        const lockPtr = wasmInstance.physicsRuntimeGetLockStatePtr(ptr);
        this.lock = new WasmSpinlock(wasmInstance.createTypedArray(Uint8Array, lockPtr, 1));

        this._inner = new PhysicsRuntimeInner(this.lock, new WeakRef(wasmInstance), ptr, physicsWorld);
        this._physicsWorld = physicsWorld;

        let registry = PhysicsRuntimeRegistryMap.get(wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(PhysicsRuntimeFinalizer);
            PhysicsRuntimeRegistryMap.set(wasmInstance, registry);
        }

        registry.register(this, this._inner, this);

        this._scene = null;
        this._afterAnimationsBinded = null;

        this._evaluationType = PhysicsRuntimeEvaluationType.Immediate;
        this._usingWasmBackBuffer = false;

        this.useDeltaForWorldStep = true;
        this.timeStep = 1 / 60;
        this.maxSubSteps = 10;
        this.fixedTimeStep = 1 / 60;

        this._rigidBodyList = [];
        this._rigidBodyBundleList = [];
    }

    /**
     * Disposes the physics runtime and releases any associated resources
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();
        this._physicsWorld.dispose();

        const registry = PhysicsRuntimeRegistryMap.get(this.wasmInstance);
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
            if (this.wasmInstance.physicsRuntimeBufferedStepSimulation === undefined) { // single thread environment fallback
                this._physicsWorld.stepSimulation(deltaTime, this.maxSubSteps, this.fixedTimeStep);
            }

            this.lock.wait(); // ensure that the runtime is not evaluating the world

            // desync buffer
            if (this._usingWasmBackBuffer === false) {
                this._usingWasmBackBuffer = true;

                this.wasmInstance.physicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, true);

                const rigidBodyList = this._rigidBodyList;
                for (let i = 0; i < rigidBodyList.length; ++i) {
                    rigidBodyList[i].updateBufferedMotionState(false);
                }
                const rigidBodyBundleList = this._rigidBodyBundleList;
                for (let i = 0; i < rigidBodyBundleList.length; ++i) {
                    rigidBodyBundleList[i].updateBufferedMotionStates(false);
                }
            }

            // commit changes
            {
                const rigidBodyList = this._rigidBodyList;
                for (let i = 0; i < rigidBodyList.length; ++i) {
                    rigidBodyList[i].commitToWasm();
                }
                const rigidBodyBundleList = this._rigidBodyBundleList;
                for (let i = 0; i < rigidBodyBundleList.length; ++i) {
                    rigidBodyBundleList[i].commitToWasm();
                }
            }

            this.onSyncObservable.notifyObservers();
            this.wasmInstance.physicsRuntimeBufferedStepSimulation(this._inner.ptr, deltaTime, this.maxSubSteps, this.fixedTimeStep);
        } else {
            // sync buffer
            if (this._usingWasmBackBuffer === true) {
                this.lock.wait(); // ensure that the runtime is not evaluating animations
                this._usingWasmBackBuffer = false;

                this.wasmInstance.physicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, false);

                const rigidBodyList = this._rigidBodyList;
                for (let i = 0; i < rigidBodyList.length; ++i) {
                    rigidBodyList[i].updateBufferedMotionState(false);
                }
                const rigidBodyBundleList = this._rigidBodyBundleList;
                for (let i = 0; i < rigidBodyBundleList.length; ++i) {
                    rigidBodyBundleList[i].updateBufferedMotionStates(false);
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
            const rigidBodyList = this._rigidBodyList;
            for (let i = 0; i < rigidBodyList.length; ++i) {
                rigidBodyList[i].impl = new BufferedRigidBodyImpl();
            }
            const rigidBodyBundleList = this._rigidBodyBundleList;
            for (let i = 0; i < rigidBodyBundleList.length; ++i) {
                rigidBodyBundleList[i].impl = new BufferedRigidBodyBundleImpl(rigidBodyBundleList[i].count);
            }
        } else {
            const rigidBodyList = this._rigidBodyList;
            for (let i = 0; i < rigidBodyList.length; ++i) {
                const rigidBody = rigidBodyList[i];
                // commit changes
                if (rigidBody.needToCommit) {
                    this.lock.wait();
                    rigidBody.commitToWasm();
                }

                rigidBody.impl = new ImmediateRigidBodyImpl();
            }
            const rigidBodyBundleList = this._rigidBodyBundleList;
            for (let i = 0; i < rigidBodyBundleList.length; ++i) {
                const rigidBodyBundle = rigidBodyBundleList[i];
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
     * Gets the gravity vector of the physics worlds (default: (0, -10, 0))
     * @returns The gravity vector
     */
    public getGravityToRef(result: Vector3): Vector3 {
        return result.copyFrom(this._gravity);
    }

    /**
     * Sets the gravity vector of the physics world
     * @param gravity The new gravity vector
     */
    public setGravity(gravity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        this._gravity.copyFrom(gravity);
        this._physicsWorld.setGravity(gravity);
    }

    /**
     * Adds a rigid body to the physics world
     *
     * If the world evaluation type is Buffered, the rigid body will be added after waiting for the lock
     * @param rigidBody The rigid body to add
     * @returns True if the rigid body was added successfully, false otherwise
     */
    public addRigidBody(rigidBody: RigidBody): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBody(rigidBody);
        if (result) {
            this._rigidBodyList.push(rigidBody);

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
     * If the runtime evaluation type is Buffered, the rigid body will be removed after waiting for the lock
     * @param rigidBody The rigid body to remove
     * @returns True if the rigid body was removed successfully, false otherwise
     */
    public removeRigidBody(rigidBody: RigidBody): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBody(rigidBody);
        if (result) {
            const index = this._rigidBodyList.indexOf(rigidBody);
            if (index !== -1) {
                this._rigidBodyList.splice(index, 1);
            }
        }
        return result;
    }

    /**
     * Adds a rigid body bundle to the physics world
     *
     * If the runtime evaluation type is Buffered, the rigid body bundle will be added after waiting for the lock
     * @param rigidBodyBundle The rigid body bundle to add
     * @returns True if the rigid body bundle was added successfully, false otherwise
     */
    public addRigidBodyBundle(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBodyBundle(rigidBodyBundle);
        if (result) {
            this._rigidBodyBundleList.push(rigidBodyBundle);

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
     * If the runtime evaluation type is Buffered, the rigid body bundle will be removed after waiting for the lock
     * @param rigidBodyBundle The rigid body bundle to remove
     * @returns True if the rigid body bundle was removed successfully, false otherwise
     */
    public removeRigidBodyBundle(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyBundle(rigidBodyBundle);
        if (result) {
            const index = this._rigidBodyBundleList.indexOf(rigidBodyBundle);
            if (index !== -1) {
                this._rigidBodyBundleList.splice(index, 1);
            }
        }
        return result;
    }

    /**
     * Gets the list of rigid bodies in the physics world
     */
    public get rigidBodyList(): readonly RigidBody[] {
        return this._rigidBodyList;
    }

    /**
     * Gets the list of rigid body bundles in the physics world
     */
    public get rigidBodyBundleList(): readonly RigidBodyBundle[] {
        return this._rigidBodyBundleList;
    }


    /**
     * Adds a constraint to the physics world
     *
     * If the runtime evaluation type is Buffered, the constraint will be added after waiting for the lock
     * @param constraint The constraint to add
     * @param disableCollisionsBetweenLinkedBodies Whether to disable collisions between the linked bodies
     * @returns True if the constraint was added successfully, false otherwise
     */
    public addConstraint(constraint: Constraint, disableCollisionsBetweenLinkedBodies: boolean): boolean {
        this._nullCheck();
        return this._physicsWorld.addConstraint(constraint, disableCollisionsBetweenLinkedBodies);
    }

    /**
     * Removes a constraint from the physics world
     *
     * If the runtime evaluation type is Buffered, the constraint will be removed after waiting for the lock
     * @param constraint The constraint to remove
     * @returns True if the constraint was removed successfully, false otherwise
     */
    public removeConstraint(constraint: Constraint): boolean {
        this._nullCheck();
        return this._physicsWorld.removeConstraint(constraint);
    }
}
