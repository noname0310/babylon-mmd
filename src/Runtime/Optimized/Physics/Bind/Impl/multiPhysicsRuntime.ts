import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "../bulletWasmInstance";
import type { Constraint } from "../constraint";
import { WasmSpinlock } from "@/Runtime/Optimized/Misc/wasmSpinlock";
import { MultiPhysicsWorld } from "../multiPhysicsWorld";
import type { RigidBody } from "../rigidBody";
import type { RigidBodyBundle } from "../rigidBodyBundle";
import { BufferedRigidBodyBundleImpl } from "./Buffered/bufferedRigidBodyBundleImpl";
import { BufferedRigidBodyImpl } from "./Buffered/bufferedRigidBodyImpl";
import { ImmediateRigidBodyBundleImpl } from "./Immediate/immediateRigidBodyBundleImpl";
import { ImmediateRigidBodyImpl } from "./Immediate/immediateRigidBodyImpl";
import type { IRigidBodyBundleImpl } from "./IRigidBodyBundleImpl";
import type { IRigidBodyImpl } from "./IRigidBodyImpl";
import type { IRuntime } from "./IRuntime";
import { PhysicsRuntimeEvaluationType } from "./physicsRuntimeEvaluationType";

export interface MultiPhysicsRuntimeCreationOptions {
    allowDynamicShadow?: boolean;
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

export class MultiPhysicsRuntime implements IRuntime {
    /**
     * in this observable callback scope, ensure that the physics world is not being evaluated
     */
    public readonly onSyncObservable: Observable<void>;
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

    public useDeltaForWorldStep: boolean;
    public timeStep: number;
    public maxSubSteps: number;
    public fixedTimeStep: number;

    private readonly _rigidBodyList: RigidBody[];
    private readonly _rigidBodyBundleList: RigidBodyBundle[];

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

        this._rigidBodyList = [];
        this._rigidBodyBundleList = [];
    }

    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();
        this._physicsWorld.dispose();

        const registry = multiPhysicsRuntimeRegistryMap.get(this.wasmInstance);
        registry?.unregister(this);
    }

    public get ptr(): number {
        return this._inner.ptr;
    }

    private _nullCheck(): void {
        if (this._inner.ptr === 0) {
            throw new Error("Cannot access disposed physics runtime");
        }
    }

    public createRigidBodyImpl(): IRigidBodyImpl {
        if (this._evaluationType === PhysicsRuntimeEvaluationType.Immediate) {
            return new ImmediateRigidBodyImpl();
        } else {
            return new BufferedRigidBodyImpl();
        }
    }

    public createRigidBodyBundleImpl(bundle: RigidBodyBundle): IRigidBodyBundleImpl {
        if (this._evaluationType === PhysicsRuntimeEvaluationType.Immediate) {
            return new ImmediateRigidBodyBundleImpl(bundle.count);
        } else {
            return new BufferedRigidBodyBundleImpl(bundle.count);
        }
    }

    public register(scene: Scene): void {
        if (this._afterAnimationsBinded !== null) return;
        this._nullCheck();

        this._afterAnimationsBinded = (): void => {
            this.afterAnimations(scene.getEngine().getDeltaTime());
        };
        this._scene = scene;
        scene.onAfterAnimationsObservable.add(this._afterAnimationsBinded);
    }

    public unregister(): void {
        if (this._afterAnimationsBinded === null) return;

        this._scene!.onAfterAnimationsObservable.removeCallback(this._afterAnimationsBinded);
        this._afterAnimationsBinded = null;
        this._scene = null;
    }

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

                const rigidBodyList = this._rigidBodyList;
                for (let i = 0; i < rigidBodyList.length; ++i) {
                    rigidBodyList[i].updateBufferedMotionState(true);
                }
                const rigidBodyBundleList = this._rigidBodyBundleList;
                for (let i = 0; i < rigidBodyBundleList.length; ++i) {
                    rigidBodyBundleList[i].updateBufferedMotionStates(true);
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

                rigidBodyBundle.impl = new ImmediateRigidBodyBundleImpl(rigidBodyBundleList[i].count);
            }
        }
    }

    private readonly _gravity: Vector3 = new Vector3(0, -10, 0);

    public getGravityToRef(result: Vector3): void {
        result.copyFrom(this._gravity);
    }

    public setGravity(gravity: Vector3): void {
        this._nullCheck();
        this._gravity.copyFrom(gravity);
        this._physicsWorld.setGravity(gravity);
    }

    public addRigidBody(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBody(rigidBody, worldId);
        if (result) {
            this._rigidBodyList.push(rigidBody);
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

    public removeRigidBody(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBody(rigidBody, worldId);
        if (result) {
            const index = this._rigidBodyList.indexOf(rigidBody);
            if (index !== -1) {
                this._rigidBodyList.splice(index, 1);
            }
            rigidBody.updateBufferedMotionState(false);
        }
        return result;
    }

    public addRigidBodyBundle(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBodyBundle(rigidBodyBundle, worldId);
        if (result) {
            this._rigidBodyBundleList.push(rigidBodyBundle);
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

    public removeRigidBodyBundle(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyBundle(rigidBodyBundle, worldId);
        if (result) {
            const index = this._rigidBodyBundleList.indexOf(rigidBodyBundle);
            if (index !== -1) {
                this._rigidBodyBundleList.splice(index, 1);
            }
            rigidBodyBundle.updateBufferedMotionStates(false);
        }
        return result;
    }

    public addRigidBodyToGlobal(rigidBody: RigidBody): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBodyToGlobal(rigidBody);
        if (result) {
            this._rigidBodyList.push(rigidBody);
        }
        return result;
    }

    public removeRigidBodyFromGlobal(rigidBody: RigidBody): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyFromGlobal(rigidBody);
        if (result) {
            const index = this._rigidBodyList.indexOf(rigidBody);
            if (index !== -1) {
                this._rigidBodyList.splice(index, 1);
            }
        }
        return result;
    }

    public addRigidBodyBundleToGlobal(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        const result = this._physicsWorld.addRigidBodyBundleToGlobal(rigidBodyBundle);
        if (result) {
            this._rigidBodyBundleList.push(rigidBodyBundle);
        }
        return result;
    }

    public removeRigidBodyBundleFromGlobal(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyBundleFromGlobal(rigidBodyBundle);
        if (result) {
            const index = this._rigidBodyBundleList.indexOf(rigidBodyBundle);
            if (index !== -1) {
                this._rigidBodyBundleList.splice(index, 1);
            }
        }
        return result;
    }

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
            this._rigidBodyList.push(rigidBody);
            this._dynamicShadowCount += 1;
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

    public removeRigidBodyShadow(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyShadow(rigidBody, worldId);
        if (result) {
            const index = this._rigidBodyList.indexOf(rigidBody);
            if (index !== -1) {
                this._rigidBodyList.splice(index, 1);
            }
            this._dynamicShadowCount -= 1;
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

            const rigidBodyList = this._rigidBodyList;
            for (let i = 0; i < rigidBodyList.length; ++i) {
                rigidBodyList[i].updateBufferedMotionState(true);
            }
            const rigidBodyBundleList = this._rigidBodyBundleList;
            for (let i = 0; i < rigidBodyBundleList.length; ++i) {
                rigidBodyBundleList[i].updateBufferedMotionStates(true);
            }
        }

        return result;
    }

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
            this._rigidBodyBundleList.push(rigidBodyBundle);
            this._dynamicShadowCount += 1;
        } else {
            if (/* !this._preserveBackBuffer && */ this._dynamicShadowCount === 0 && backBufferUpdated) {
                this.wasmInstance.multiPhysicsWorldUseMotionStateBuffer(this._physicsWorld.ptr, false);
                this._usingWasmBackBuffer = false;
            }
        }

        return result;
    }

    public removeRigidBodyBundleShadow(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();
        const result = this._physicsWorld.removeRigidBodyBundleShadow(rigidBodyBundle, worldId);
        if (result) {
            const index = this._rigidBodyBundleList.indexOf(rigidBodyBundle);
            if (index !== -1) {
                this._rigidBodyBundleList.splice(index, 1);
            }
            this._dynamicShadowCount -= 1;
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

            const rigidBodyList = this._rigidBodyList;
            for (let i = 0; i < rigidBodyList.length; ++i) {
                rigidBodyList[i].updateBufferedMotionState(true);
            }
            const rigidBodyBundleList = this._rigidBodyBundleList;
            for (let i = 0; i < rigidBodyBundleList.length; ++i) {
                rigidBodyBundleList[i].updateBufferedMotionStates(true);
            }
        }

        return result;
    }

    public get rigidBodyList(): readonly RigidBody[] {
        return this._rigidBodyList;
    }

    public addConstraint(constraint: Constraint, worldId: number, disableCollisionsBetweenLinkedBodies: boolean): boolean {
        this._nullCheck();
        return this._physicsWorld.addConstraint(constraint, worldId, disableCollisionsBetweenLinkedBodies);
    }

    public removeConstraint(constraint: Constraint, worldId: number): boolean {
        this._nullCheck();
        return this._physicsWorld.removeConstraint(constraint, worldId);
    }
}
