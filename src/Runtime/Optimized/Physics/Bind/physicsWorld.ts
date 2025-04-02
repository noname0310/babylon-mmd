import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "./bulletWasmInstance";
import type { Constraint } from "./constraint";
import type { IPhysicsRuntime } from "./Impl/IPhysicsRuntime";
import type { RigidBody } from "./rigidBody";
import type { RigidBodyBundle } from "./rigidBodyBundle";

class PhysicsWorldInner {
    private readonly _runtime: WeakRef<IPhysicsRuntime>;
    private _ptr: number;

    private readonly _rigidBodyReferences: Set<RigidBody>;
    private readonly _rigidBodyBundleReferences: Set<RigidBodyBundle>;
    private readonly _constraintReferences: Set<Constraint>;

    private _referenceCount: number;

    public constructor(runtime: WeakRef<IPhysicsRuntime>, ptr: number) {
        this._runtime = runtime;
        this._ptr = ptr;

        this._rigidBodyReferences = new Set<RigidBody>();
        this._rigidBodyBundleReferences = new Set<RigidBodyBundle>();
        this._constraintReferences = new Set<Constraint>();

        this._referenceCount = 0;
    }

    public dispose(): void {
        if (this._referenceCount > 0) {
            throw new Error("Cannot dispose physics world while it still has references");
        }

        if (this._ptr === 0) {
            return;
        }

        const runtime = this._runtime.deref();
        if (runtime !== undefined) {
            runtime.lock.wait();
            runtime.wasmInstance.destroyPhysicsWorld(this._ptr);
        }
        this._ptr = 0;

        for (const rigidBody of this._rigidBodyReferences) {
            rigidBody.setWorldReference(null);
        }
        this._rigidBodyReferences.clear();

        for (const rigidBodyBundle of this._rigidBodyBundleReferences) {
            rigidBodyBundle.setWorldReference(null);
        }
        this._rigidBodyBundleReferences.clear();

        for (const constraint of this._constraintReferences) {
            constraint.setWorldReference(null);
        }
        this._constraintReferences.clear();
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

    public addRigidBodyReference(rigidBody: RigidBody): boolean {
        if (this._rigidBodyReferences.has(rigidBody)) {
            return false;
        }

        rigidBody.setWorldReference(this);
        this._rigidBodyReferences.add(rigidBody);
        return true;
    }

    public removeRigidBodyReference(rigidBody: RigidBody): boolean {
        if (this._rigidBodyReferences.delete(rigidBody)) {
            rigidBody.setWorldReference(null);
            return true;
        }
        return false;
    }

    public addRigidBodyBundleReference(rigidBodyBundle: RigidBodyBundle): boolean {
        if (this._rigidBodyBundleReferences.has(rigidBodyBundle)) {
            return false;
        }

        rigidBodyBundle.setWorldReference(this);
        this._rigidBodyBundleReferences.add(rigidBodyBundle);
        return true;
    }

    public removeRigidBodyBundleReference(rigidBodyBundle: RigidBodyBundle): boolean {
        if (this._rigidBodyBundleReferences.delete(rigidBodyBundle)) {
            rigidBodyBundle.setWorldReference(null);
            return true;
        }
        return false;
    }

    public addConstraintReference(constraint: Constraint): boolean {
        if (this._constraintReferences.has(constraint)) {
            return false;
        }

        constraint.setWorldReference(this);
        this._constraintReferences.add(constraint);
        return true;
    }

    public removeConstraintReference(constraint: Constraint): boolean {
        if (this._constraintReferences.delete(constraint)) {
            constraint.setWorldReference(null);
            return true;
        }
        return false;
    }
}

function physicsWorldFinalizer(inner: PhysicsWorldInner): void {
    inner.dispose();
}

const physicsWorldRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<PhysicsWorldInner>>();

/**
 * PhysicsWorld handles the simulation of physics in the Bullet engine
 *
 * It is responsible for managing the simulation step, gravity, and the rigid bodies and constraints in the world
 */
export class PhysicsWorld {
    private readonly _runtime: IPhysicsRuntime;

    private readonly _inner: PhysicsWorldInner;

    /**
     * Creates a new physics world
     * @param runtime The physics runtime that this world belongs to
     */
    public constructor(runtime: IPhysicsRuntime) {
        this._runtime = runtime;

        const ptr = runtime.wasmInstance.createPhysicsWorld();

        this._inner = new PhysicsWorldInner(new WeakRef(runtime), ptr);

        let registry = physicsWorldRegistryMap.get(runtime.wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(physicsWorldFinalizer);
            physicsWorldRegistryMap.set(runtime.wasmInstance, registry);
        }

        registry.register(this, this._inner, this);
    }

    /**
     * Disposes the physics world
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = physicsWorldRegistryMap.get(this._runtime.wasmInstance);
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

    private _nullCheck(): void {
        if (this._inner.ptr === 0) {
            throw new Error("Cannot access disposed physics world");
        }
    }

    /**
     * Sets the gravity of the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param gravity The gravity vector to set
     */
    public setGravity(gravity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        this._runtime.lock.wait();
        this._runtime.wasmInstance.physicsWorldSetGravity(this._inner.ptr, gravity.x, gravity.y, gravity.z);
    }

    /**
     * Steps the simulation of the physics world
     * @param timeStep The time step to use for the simulation
     * @param maxSubSteps The maximum number of substeps to use for the simulation
     * @param fixedTimeStep The fixed time step to use for the simulation
     */
    public stepSimulation(timeStep: number, maxSubSteps: number, fixedTimeStep: number): void {
        this._nullCheck();
        this._runtime.lock.wait();
        this._runtime.wasmInstance.physicsWorldStepSimulation(this._inner.ptr, timeStep, maxSubSteps, fixedTimeStep);
    }

    /**
     * Adds a rigid body to the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBody The rigid body to add
     * @returns True if the rigid body was added successfully, false otherwise
     */
    public addRigidBody(rigidBody: RigidBody): boolean {
        if (rigidBody.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body from different runtime");
        }
        this._nullCheck();
        if (this._inner.addRigidBodyReference(rigidBody)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.physicsWorldAddRigidBody(this._inner.ptr, rigidBody.ptr);
            return true;
        }
        return false;
    }

    /**
     * Removes a rigid body from the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBody The rigid body to remove
     * @returns True if the rigid body was removed successfully, false otherwise
     */
    public removeRigidBody(rigidBody: RigidBody): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyReference(rigidBody)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.physicsWorldRemoveRigidBody(this._inner.ptr, rigidBody.ptr);
            return true;
        }
        return false;
    }

    /**
     * Adds a rigid body bundle to the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBodyBundle The rigid body bundle to add
     * @returns True if the rigid body bundle was added successfully, false otherwise
     */
    public addRigidBodyBundle(rigidBodyBundle: RigidBodyBundle): boolean {
        if (rigidBodyBundle.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body bundle from different runtime");
        }
        this._nullCheck();
        if (this._inner.addRigidBodyBundleReference(rigidBodyBundle)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.physicsWorldAddRigidBodyBundle(this._inner.ptr, rigidBodyBundle.ptr);
            return true;
        }
        return false;
    }

    /**
     * Removes a rigid body bundle from the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBodyBundle The rigid body bundle to remove
     * @returns True if the rigid body bundle was removed successfully, false otherwise
     */
    public removeRigidBodyBundle(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyBundleReference(rigidBodyBundle)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.physicsWorldRemoveRigidBodyBundle(this._inner.ptr, rigidBodyBundle.ptr);
            return true;
        }
        return false;
    }

    /**
     * Adds a constraint to the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param constraint The constraint to add
     * @param disableCollisionsBetweenLinkedBodies Whether to disable collisions between linked bodies
     * @returns True if the constraint was added successfully, false otherwise
     */
    public addConstraint(constraint: Constraint, disableCollisionsBetweenLinkedBodies: boolean): boolean {
        if (constraint.runtime !== this._runtime) {
            throw new Error("Cannot add constraint from different runtime");
        }
        this._nullCheck();
        if (this._inner.addConstraintReference(constraint)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.physicsWorldAddConstraint(this._inner.ptr, constraint.ptr, disableCollisionsBetweenLinkedBodies);
            return true;
        }
        return false;
    }

    /**
     * Removes a constraint from the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param constraint The constraint to remove
     * @returns True if the constraint was removed successfully, false otherwise
     */
    public removeConstraint(constraint: Constraint): boolean {
        this._nullCheck();
        if (this._inner.removeConstraintReference(constraint)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.physicsWorldRemoveConstraint(this._inner.ptr, constraint.ptr);
            return true;
        }
        return false;
    }
}
