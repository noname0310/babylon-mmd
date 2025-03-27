import type { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { BulletWasmInstance } from "./bulletWasmInstance";
import type { Constraint } from "./constraint";
import type { IRuntime } from "./Impl/IRuntime";
import type { RigidBody } from "./rigidBody";
import type { RigidBodyBundle } from "./rigidBodyBundle";

class MultiPhysicsWorldInner {
    private readonly _runtime: WeakRef<IRuntime>;
    private _ptr: number;

    private readonly _rigidBodyReferences: Map<RigidBody, number>; // [RigidBody, worldId]
    private readonly _rigidBodyBundleReferences: Map<RigidBodyBundle, number>; // [RigidBodyBundle, worldId]

    private readonly _rigidBodyGlobalReferences: Set<RigidBody>;
    private readonly _rigidBodyBundleGlobalReferences: Set<RigidBodyBundle>;

    private readonly _rigidBodyShadowReferences: Map<number, Set<RigidBody>>; // [worldId, Set<RigidBody>]
    private readonly _rigidBodyBundleShadowReferences: Map<number, Set<RigidBodyBundle>>; // [worldId, Set<RigidBodyBundle>]

    private readonly _constraintReferences: Set<Constraint>;

    private _referenceCount: number;

    public constructor(runtime: WeakRef<IRuntime>, ptr: number) {
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
            runtime.wasmInstance.destroyMultiPhysicsWorld(this._ptr);
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
    inner.dispose();
}

const multiPhysicsWorldRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<MultiPhysicsWorldInner>>();

export class MultiPhysicsWorld {
    private readonly _runtime: IRuntime;

    private readonly _inner: MultiPhysicsWorldInner;

    public constructor(runtime: IRuntime, allowDynamicShadow: boolean) {
        this._runtime = runtime;

        const ptr = runtime.wasmInstance.createMultiPhysicsWorld(allowDynamicShadow);

        this._inner = new MultiPhysicsWorldInner(new WeakRef(runtime), ptr);

        let registry = multiPhysicsWorldRegistryMap.get(runtime.wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(multiPhysicsWorldFinalizer);
            multiPhysicsWorldRegistryMap.set(runtime.wasmInstance, registry);
        }

        registry.register(this, this._inner, this);
    }

    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = multiPhysicsWorldRegistryMap.get(this._runtime.wasmInstance);
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

    public setGravity(gravity: Vector3): void {
        this._nullCheck();
        this._runtime.lock.wait();
        this._runtime.wasmInstance.multiPhysicsWorldSetGravity(this._inner.ptr, gravity.x, gravity.y, gravity.z);
    }

    public stepSimulation(timeStep: number, maxSubSteps: number, fixedTimeStep: number): void {
        this._nullCheck();
        this._runtime.lock.wait();
        this._runtime.wasmInstance.multiPhysicsWorldStepSimulation(this._inner.ptr, timeStep, maxSubSteps, fixedTimeStep);
    }

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

    public removeRigidBody(rigidBody: RigidBody, worldId: number): boolean {
        if (rigidBody.hasShadows) {
            throw new Error("Cannot remove rigid body that has shadows");
        }
        this._nullCheck();
        if (this._inner.removeRigidBodyReference(rigidBody)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBody(this._inner.ptr, worldId, rigidBody.ptr);
            return true;
        }
        return false;
    }

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

    public removeRigidBodyBundle(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        if (rigidBodyBundle.hasShadows) {
            throw new Error("Cannot remove rigid body bundle that has shadows");
        }
        this._nullCheck();
        if (this._inner.removeRigidBodyBundleReference(rigidBodyBundle)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBodyBundle(this._inner.ptr, worldId, rigidBodyBundle.ptr);
            return true;
        }
        return false;
    }

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

    public removeRigidBodyFromGlobal(rigidBody: RigidBody): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyGlobalReference(rigidBody)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBodyFromGlobal(this._inner.ptr, rigidBody.ptr);
            return true;
        }
        return false;
    }

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

    public removeRigidBodyBundleFromGlobal(rigidBodyBundle: RigidBodyBundle): boolean {
        this._nullCheck();
        if (this._inner.removeRigidBodyBundleGlobalReference(rigidBodyBundle)) {
            this._runtime.lock.wait();
            this._runtime.wasmInstance.multiPhysicsWorldRemoveRigidBodyBundleFromGlobal(this._inner.ptr, rigidBodyBundle.ptr);
            return true;
        }
        return false;
    }

    public addRigidBodyShadow(rigidBody: RigidBody, worldId: number): boolean {
        if (rigidBody.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body from a different runtime");
        }
        if (rigidBody.isDynamic && rigidBody.getWorldReference() === null) {
            throw new Error("You must add dynamic rigid body first to the world before adding it as a shadow");
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

    public addRigidBodyBundleShadow(rigidBodyBundle: RigidBodyBundle, worldId: number): boolean {
        if (rigidBodyBundle.runtime !== this._runtime) {
            throw new Error("Cannot add rigid body bundle from a different runtime");
        }
        if (rigidBodyBundle.isContainsDynamic && rigidBodyBundle.getWorldReference() === null) {
            throw new Error("You must add dynamic rigid body bundle first to the world before adding it as a shadow");
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
