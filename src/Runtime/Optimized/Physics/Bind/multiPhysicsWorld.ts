import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "./bulletWasmInstance";
import type { Constraint } from "./constraint";
import type { IPhysicsRuntime } from "./Impl/IPhysicsRuntime";
import type { RigidBody } from "./rigidBody";
import type { RigidBodyBundle } from "./rigidBodyBundle";

class MultiPhysicsWorldInner {
    private readonly _runtime: WeakRef<IPhysicsRuntime>;
    private _ptr: number;

    private readonly _rigidBodyReferences: Map<RigidBody, number>; // [RigidBody, worldId]
    private readonly _rigidBodyBundleReferences: Map<RigidBodyBundle, number>; // [RigidBodyBundle, worldId]

    private readonly _rigidBodyGlobalReferences: Set<RigidBody>;
    private readonly _rigidBodyBundleGlobalReferences: Set<RigidBodyBundle>;

    private readonly _rigidBodyShadowReferences: Map<number, Set<RigidBody>>; // [worldId, Set<RigidBody>]
    private readonly _rigidBodyBundleShadowReferences: Map<number, Set<RigidBodyBundle>>; // [worldId, Set<RigidBodyBundle>]

    private readonly _constraintReferences: Set<Constraint>;

    private _referenceCount: number;

    public constructor(runtime: WeakRef<IPhysicsRuntime>, ptr: number) {
        this._runtime = runtime;
        this._ptr = ptr;

        this._rigidBodyReferences = new Map<RigidBody, number>();
        this._rigidBodyBundleReferences = new Map<RigidBodyBundle, number>();

        this._rigidBodyGlobalReferences = new Set<RigidBody>();
        this._rigidBodyBundleGlobalReferences = new Set<RigidBodyBundle>();

        this._rigidBodyShadowReferences = new Map<number, Set<RigidBody>>();
        this._rigidBodyBundleShadowReferences = new Map<number, Set<RigidBodyBundle>>();

        this._constraintReferences = new Set<Constraint>();

        this._referenceCount = 0;
    }

    public dispose(fromPointer: boolean): void {
        if (this._referenceCount > 0) {
            throw new Error("Cannot dispose physics world while it still has references");
        }

        if (this._ptr === 0) {
            return;
        }

        if (!fromPointer) {
            const runtime = this._runtime.deref();
            if (runtime !== undefined) {
                runtime.lock.wait();
                runtime.wasmInstance.destroyMultiPhysicsWorld(this._ptr);
            }
        }
        this._ptr = 0;

        for (const [rigidBody, _] of this._rigidBodyReferences) {
            rigidBody.setWorldReference(null);
        }
        this._rigidBodyReferences.clear();

        for (const [rigidBodyBundle, _] of this._rigidBodyBundleReferences) {
            rigidBodyBundle.setWorldReference(null);
        }
        this._rigidBodyBundleReferences.clear();

        for (const rigidBody of this._rigidBodyGlobalReferences) {
            rigidBody.removeReference();
        }
        this._rigidBodyGlobalReferences.clear();

        for (const rigidBodyBundle of this._rigidBodyBundleGlobalReferences) {
            rigidBodyBundle.removeReference();
        }
        this._rigidBodyBundleGlobalReferences.clear();

        for (const shadowReferences of this._rigidBodyShadowReferences.values()) {
            for (const rigidBody of shadowReferences) {
                rigidBody.removeReference();
            }
        }
        this._rigidBodyShadowReferences.clear();

        for (const shadowReferences of this._rigidBodyBundleShadowReferences.values()) {
            for (const rigidBodyBundle of shadowReferences) {
                rigidBodyBundle.removeReference();
            }
        }
        this._rigidBodyBundleShadowReferences.clear();

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

    public addRigidBodyReference(rigidBody: RigidBody, worldId: number): boolean {
        if (this._rigidBodyGlobalReferences.has(rigidBody)) {
            throw new Error("Rigid body is already added to the world as a global reference");
        }

        const shadowReferences = this._rigidBodyShadowReferences.get(worldId);
        if (shadowReferences !== undefined && shadowReferences.has(rigidBody)) {
            throw new Error("Rigid body is already added to the world as a shadow reference");
        }

        if (this._rigidBodyReferences.has(rigidBody)) {
            return false;
        }

        rigidBody.setWorldReference(this);
        this._rigidBodyReferences.set(rigidBody, worldId);
        return true;
    }

    public removeRigidBodyReference(rigidBody: RigidBody): boolean {
        if (this._rigidBodyReferences.delete(rigidBody)) {
            rigidBody.setWorldReference(null);
            return true;
        }
        return false;
    }

    public addRigidBodyBundleReference(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        if (this._rigidBodyBundleGlobalReferences.has(rigidBodyBundle)) {
            throw new Error("Rigid body bundle is already added to the world as a global reference");
        }

        const shadowReferences = this._rigidBodyBundleShadowReferences.get(worldId);
        if (shadowReferences !== undefined && shadowReferences.has(rigidBodyBundle)) {
            throw new Error("Rigid body bundle is already added to the world as a shadow reference");
        }

        if (this._rigidBodyBundleReferences.has(rigidBodyBundle)) {
            return false;
        }

        rigidBodyBundle.setWorldReference(this);
        this._rigidBodyBundleReferences.set(rigidBodyBundle, worldId);
        return true;
    }

    public removeRigidBodyBundleReference(rigidBodyBundle: RigidBodyBundle): boolean {
        if (this._rigidBodyBundleReferences.delete(rigidBodyBundle)) {
            rigidBodyBundle.setWorldReference(null);
            return true;
        }
        return false;
    }

    public addRigidBodyGlobalReference(rigidBody: RigidBody): boolean {
        if (rigidBody.getWorldReference() !== null) {
            throw new Error("Rigid body is already added to the world as a strong reference");
        }

        // we are not handling the case where the rigid body is added as a shadow reference
        // wasm side should handle this case

        if (this._rigidBodyGlobalReferences.has(rigidBody)) {
            return false;
        }

        rigidBody.addReference();
        this._rigidBodyGlobalReferences.add(rigidBody);
        return true;
    }

    public removeRigidBodyGlobalReference(rigidBody: RigidBody): boolean {
        if (this._rigidBodyGlobalReferences.delete(rigidBody)) {
            rigidBody.removeReference();
            return true;
        }
        return false;
    }

    public addRigidBodyBundleGlobalReference(rigidBodyBundle: RigidBodyBundle): boolean {
        if (rigidBodyBundle.getWorldReference() !== null) {
            throw new Error("Rigid body bundle is already added to the world as a strong reference");
        }

        // we are not handling the case where the rigid body bundle is added as a shadow reference
        // wasm side should handle this case

        if (this._rigidBodyBundleGlobalReferences.has(rigidBodyBundle)) {
            return false;
        }

        rigidBodyBundle.addReference();
        this._rigidBodyBundleGlobalReferences.add(rigidBodyBundle);
        return true;
    }

    public removeRigidBodyBundleGlobalReference(rigidBodyBundle: RigidBodyBundle): boolean {
        if (this._rigidBodyBundleGlobalReferences.delete(rigidBodyBundle)) {
            rigidBodyBundle.removeReference();
            return true;
        }
        return false;
    }

    public addRigidBodyShadowReference(rigidBody: RigidBody, worldId: number): boolean {
        const currentWorldId = this._rigidBodyReferences.get(rigidBody);
        if (currentWorldId !== undefined && currentWorldId === worldId) {
            return false;
        }

        if (this._rigidBodyGlobalReferences.has(rigidBody)) {
            throw new Error("Rigid body is already added to the world as a global reference");
        }

        let shadowReferences = this._rigidBodyShadowReferences.get(worldId);
        if (shadowReferences === undefined) {
            shadowReferences = new Set<RigidBody>();
            this._rigidBodyShadowReferences.set(worldId, shadowReferences);
        }
        if (shadowReferences.has(rigidBody)) {
            return false;
        }

        rigidBody.addReference();
        shadowReferences.add(rigidBody);
        return true;
    }

    public removeRigidBodyShadowReference(rigidBody: RigidBody, worldId: number): boolean {
        const shadowReferences = this._rigidBodyShadowReferences.get(worldId);
        if (shadowReferences === undefined || !shadowReferences.delete(rigidBody)) {
            return false;
        }
        if (shadowReferences.size === 0) {
            this._rigidBodyShadowReferences.delete(worldId);
        }

        rigidBody.removeReference();
        return true;
    }

    public addRigidBodyBundleShadowReference(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        const currentWorldId = this._rigidBodyBundleReferences.get(rigidBodyBundle);
        if (currentWorldId !== undefined && currentWorldId === worldId) {
            return false;
        }

        if (this._rigidBodyBundleGlobalReferences.has(rigidBodyBundle)) {
            throw new Error("Rigid body bundle is already added to the world as a global reference");
        }

        let shadowReferences = this._rigidBodyBundleShadowReferences.get(worldId);
        if (shadowReferences === undefined) {
            shadowReferences = new Set<RigidBodyBundle>();
            this._rigidBodyBundleShadowReferences.set(worldId, shadowReferences);
        }
        if (shadowReferences.has(rigidBodyBundle)) {
            return false;
        }

        rigidBodyBundle.addReference();
        shadowReferences.add(rigidBodyBundle);
        return true;
    }

    public removeRigidBodyBundleShadowReference(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        const shadowReferences = this._rigidBodyBundleShadowReferences.get(worldId);
        if (shadowReferences === undefined || !shadowReferences.delete(rigidBodyBundle)) {
            return false;
        }
        if (shadowReferences.size === 0) {
            this._rigidBodyBundleShadowReferences.delete(worldId);
        }

        rigidBodyBundle.removeReference();
        return true;
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

function multiPhysicsWorldFinalizer(inner: MultiPhysicsWorldInner): void {
    inner.dispose(false);
}

const multiPhysicsWorldRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<MultiPhysicsWorldInner>>();

/**
 * MultiPhysicsWorld handles multiple physics worlds and allows to add rigid bodies and constraints to them
 *
 * It supports multi-threading by introducing a rigid body shadow concept
 *
 * Rigid body shadow is a copy of the rigid body that can be added to a different world
 *
 * Internally, it just creates a new rigid body with Kinematic motion type and synchronizes the position and rotation with the original rigid body
 */
export class MultiPhysicsWorld {
    private readonly _runtime: IPhysicsRuntime;

    private readonly _inner: MultiPhysicsWorldInner;
    private readonly _fromPointer: boolean;

    /**
     * Creates a new MultiPhysicsWorld instance
     * @param runtime The physics runtime that this world belongs to
     * @param allowDynamicShadow Whether to allow dynamic shadow
     */
    public constructor(runtime: IPhysicsRuntime, allowDynamicShadow: boolean);

    /**
     * Creates a MultiPhysicsWorld instance from an existing pointer
     * @param runtime The physics runtime that this world belongs to
     * @param ptr The pointer to the existing MultiPhysicsWorld instance
     * @internal
     */
    public constructor(runtime: IPhysicsRuntime, ptr: number);

    public constructor(runtime: IPhysicsRuntime, allowDynamicShadowOrPtr: boolean | number) {
        this._runtime = runtime;

        if (typeof allowDynamicShadowOrPtr === "boolean") {
            const ptr = runtime.wasmInstance.createMultiPhysicsWorld(allowDynamicShadowOrPtr);

            this._inner = new MultiPhysicsWorldInner(new WeakRef(runtime), ptr);

            let registry = multiPhysicsWorldRegistryMap.get(runtime.wasmInstance);
            if (registry === undefined) {
                registry = new FinalizationRegistry(multiPhysicsWorldFinalizer);
                multiPhysicsWorldRegistryMap.set(runtime.wasmInstance, registry);
            }

            registry.register(this, this._inner, this);
            this._fromPointer = false;
        } else {
            this._inner = new MultiPhysicsWorldInner(new WeakRef(runtime), allowDynamicShadowOrPtr);
            // we should not finalize the world if it is created from an existing pointer
            this._fromPointer = true;
        }
    }

    /**
     * Disposes the physics world
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose(this._fromPointer);

        if (!this._fromPointer) {
            const registry = multiPhysicsWorldRegistryMap.get(this._runtime.wasmInstance);
            registry?.unregister(this);
        }
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
     * Sets the gravity vector of the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param gravity The gravity vector
     */
    public setGravity(gravity: DeepImmutable<Vector3>): void {
        this._nullCheck();
        this._runtime.lock.wait();
        this._runtime.wasmInstance.multiPhysicsWorldSetGravity(this._inner.ptr, gravity.x, gravity.y, gravity.z);
    }

    /**
     * Steps the physics simulation
     * @param timeStep The time step to use for the simulation
     * @param maxSubSteps The maximum number of substeps to use for the simulation
     * @param fixedTimeStep The fixed time step to use for the simulation
     */
    public stepSimulation(timeStep: number, maxSubSteps: number, fixedTimeStep: number): void {
        if (this._fromPointer) {
            throw new Error("Cannot call stepSimulation on a world created from a pointer");
        }

        this._nullCheck();
        this._runtime.lock.wait();
        this._runtime.wasmInstance.multiPhysicsWorldStepSimulation(this._inner.ptr, timeStep, maxSubSteps, fixedTimeStep);
    }

    /**
     * Adds a rigid body to the physics world
     *
     * If the world is not existing, it will be created
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBody The rigid body to add
     * @param worldId The ID of the world to add the rigid body to
     * @returns True if the rigid body was added successfully, false otherwise
     */
    public addRigidBody(rigidBody: RigidBody, worldId: number): boolean {
        if (rigidBody.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body from a different runtime");
        }
        this._nullCheck();
        if (this._inner.addRigidBodyReference(rigidBody, worldId)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldAddRigidBody(this._inner.ptr, worldId, rigidBody.ptr);
            return true;
        }
        return false;
    }

    /**
     * Removes a rigid body from the physics world
     *
     * If there are no more rigid bodies in the world, the world will be destroyed automatically
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBody The rigid body to remove
     * @param worldId The ID of the world to remove the rigid body from
     * @returns True if the rigid body was removed successfully, false otherwise
     */
    public removeRigidBody(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyReference(rigidBody)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBody(this._inner.ptr, worldId, rigidBody.ptr);
            return true;
        }
        return false;
    }

    /**
     * Adds a rigid body bundle to the physics world
     *
     * If the world is not existing, it will be created
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBodyBundle The rigid body bundle to add
     * @param worldId The ID of the world to add the rigid body bundle to
     * @returns True if the rigid body bundle was added successfully, false otherwise
     */
    public addRigidBodyBundle(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        if (rigidBodyBundle.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body bundle from a different runtime");
        }
        this._nullCheck();
        if (this._inner.addRigidBodyBundleReference(rigidBodyBundle, worldId)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldAddRigidBodyBundle(this._inner.ptr, worldId, rigidBodyBundle.ptr);
            return true;
        }
        return false;
    }

    /**
     * Removes a rigid body bundle from the physics world
     *
     * If there are no more rigid body bundles in the world, the world will be destroyed automatically
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBodyBundle The rigid body bundle to remove
     * @param worldId The ID of the world to remove the rigid body bundle from
     * @returns True if the rigid body bundle was removed successfully, false otherwise
     */
    public removeRigidBodyBundle(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyBundleReference(rigidBodyBundle)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBodyBundle(this._inner.ptr, worldId, rigidBodyBundle.ptr);
            return true;
        }
        return false;
    }

    /**
     * Adds a rigid body to all worlds
     *
     * rigid body physics mode must be Static or Kinematic
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBody The rigid body to add
     * @returns True if the rigid body was added successfully, false otherwise
     */
    public addRigidBodyToGlobal(rigidBody: RigidBody): boolean {
        if (rigidBody.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body from a different runtime");
        }
        if (rigidBody.isDynamic) {
            throw new Error("Cannot add dynamic rigid body to global");
        }
        this._nullCheck();
        if (this._inner.addRigidBodyGlobalReference(rigidBody)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldAddRigidBodyToGlobal(this._inner.ptr, rigidBody.ptr);
            return true;
        }
        return false;
    }

    /**
     * Removes a rigid body from all worlds
     *
     * This method does not remove the rigid body that is added with `MultiPhysicsWorld.addRigidBody`
     *
     * Only the rigid body that is added with `MultiPhysicsWorld.addRigidBodyToGlobal` will be removed
     *
     * If there are no more rigid bodies in the world, the world will be destroyed automatically
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBody The rigid body to remove
     * @returns True if the rigid body was removed successfully, false otherwise
     */
    public removeRigidBodyFromGlobal(rigidBody: RigidBody): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyGlobalReference(rigidBody)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBodyFromGlobal(this._inner.ptr, rigidBody.ptr);
            return true;
        }
        return false;
    }

    /**
     * Adds a rigid body bundle to all worlds
     *
     * rigid body bundle physics mode must be Static or Kinematic
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBodyBundle The rigid body bundle to add
     * @returns True if the rigid body bundle was added successfully, false otherwise
     */
    public addRigidBodyBundleToGlobal(rigidBodyBundle: RigidBodyBundle): boolean {
        if (rigidBodyBundle.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body bundle from a different runtime");
        }
        if (rigidBodyBundle.isContainsDynamic) {
            throw new Error("Cannot add dynamic rigid body bundle to global");
        }
        this._nullCheck();
        if (this._inner.addRigidBodyBundleGlobalReference(rigidBodyBundle)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldAddRigidBodyBundleToGlobal(this._inner.ptr, rigidBodyBundle.ptr);
            return true;
        }
        return false;
    }

    /**
     * Removes a rigid body bundle from all worlds
     *
     * This method does not remove the rigid body bundle that is added with `MultiPhysicsWorld.addRigidBodyBundle`
     *
     * Only the rigid body bundle that is added with `MultiPhysicsWorld.addRigidBodyBundleToGlobal` will be removed
     *
     * If there are no more rigid body bundles in the world, the world will be destroyed automatically
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBodyBundle The rigid body bundle to remove
     * @returns True if the rigid body bundle was removed successfully, false otherwise
     */
    public removeRigidBodyBundleFromGlobal(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyBundleGlobalReference(rigidBodyBundle)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBodyBundleFromGlobal(this._inner.ptr, rigidBodyBundle.ptr);
            return true;
        }
        return false;
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
     * When RigidBody with dynamic physics mode is added to the world as shadow,
     * the rigid body will be added to the world as kinematic
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBody The rigid body to add
     * @param worldId The ID of the world to add the rigid body as shadow
     * @returns True if the rigid body shadow was added successfully, false otherwise
     */
    public addRigidBodyShadow(rigidBody: RigidBody, worldId: number): boolean {
        if (rigidBody.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body from a different runtime");
        }
        this._nullCheck();
        if (this._inner.addRigidBodyShadowReference(rigidBody, worldId)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldAddRigidBodyShadow(this._inner.ptr, worldId, rigidBody.ptr);
            rigidBody.addShadowReference();
            return true;
        }
        return false;
    }

    /**
     * Removes a rigid body shadow from the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBody The rigid body to remove
     * @param worldId The ID of the world to remove the rigid body shadow from
     * @returns True if the rigid body shadow was removed successfully, false otherwise
     */
    public removeRigidBodyShadow(rigidBody: RigidBody, worldId: number): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyShadowReference(rigidBody, worldId)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBodyShadow(this._inner.ptr, worldId, rigidBody.ptr);
            rigidBody.removeShadowReference();
            return true;
        }
        return false;
    }

    /**
     * Adds a rigid body bundle shadow to the physics world
     *
     * In case of Dynamic physics mode, Rigid body bundle firstly needs to be added to the other world
     *
     * The worldId must be not equal to the worldId of the rigid body bundle
     *
     * Rigid body bundle shadow allows the rigid body bundle to be added to multiple worlds
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBodyBundle The rigid body bundle to add
     * @param worldId The ID of the world to add the rigid body bundle as shadow
     * @returns True if the rigid body shadow was added successfully, false otherwise
     */
    public addRigidBodyBundleShadow(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        if (rigidBodyBundle.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body bundle from a different runtime");
        }
        this._nullCheck();
        if (this._inner.addRigidBodyBundleShadowReference(rigidBodyBundle, worldId)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldAddRigidBodyBundleShadow(this._inner.ptr, worldId, rigidBodyBundle.ptr);
            rigidBodyBundle.addShadowReference();
            return true;
        }
        return false;
    }

    /**
     * Removes a rigid body bundle shadow from the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param rigidBodyBundle The rigid body bundle to remove
     * @param worldId The ID of the world to remove the rigid body bundle shadow from
     * @returns True if the rigid body bundle shadow was removed successfully, false otherwise
     */
    public removeRigidBodyBundleShadow(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyBundleShadowReference(rigidBodyBundle, worldId)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBodyBundleShadow(this._inner.ptr, worldId, rigidBodyBundle.ptr);
            rigidBodyBundle.removeShadowReference();
            return true;
        }
        return false;
    }

    /**
     * Adds a constraint to the physics world
     *
     * Constraint worldId must be equal to the worldId of the connected rigid bodies
     *
     * This operation performs waiting for the lock before executing
     * @param constraint The constraint to add
     * @param worldId The ID of the world to add the constraint to
     * @param disableCollisionsBetweenLinkedBodies Whether to disable collisions between the linked bodies
     * @returns True if the constraint was added successfully, false otherwise
     */
    public addConstraint(constraint: Constraint, worldId: number, disableCollisionsBetweenLinkedBodies: boolean): boolean {
        if (constraint.runtime !== this._runtime) {
            throw new Error("Cannot add constraint from a different runtime");
        }
        this._nullCheck();
        if (this._inner.addConstraintReference(constraint)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldAddConstraint(this._inner.ptr, worldId, constraint.ptr, disableCollisionsBetweenLinkedBodies);
            return true;
        }
        return false;
    }

    /**
     * Removes a constraint from the physics world
     *
     * This operation performs waiting for the lock before executing
     * @param constraint The constraint to remove
     * @param worldId The ID of the world to remove the constraint from
     * @returns True if the constraint was removed successfully, false otherwise
     */
    public removeConstraint(constraint: Constraint, worldId: number): boolean {
        this._nullCheck();
        if (this._inner.removeConstraintReference(constraint)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveConstraint(this._inner.ptr, worldId, constraint.ptr);
            return true;
        }
        return false;
    }
}
