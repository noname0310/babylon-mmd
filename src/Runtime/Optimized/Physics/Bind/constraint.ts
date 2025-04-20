import type { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "./bulletWasmInstance";
import { Constants } from "./constants";
import type { IPhysicsRuntime } from "./Impl/IPhysicsRuntime";
import type { RigidBody } from "./rigidBody";
import type { RigidBodyBundle } from "./rigidBodyBundle";

class ConstraintInner {
    private readonly _wasmInstance: WeakRef<BulletWasmInstance>;
    private _ptr: number;
    private _bodyReference: Nullable<readonly [RigidBody, RigidBody] | RigidBodyBundle>;
    private _referenceCount: number;

    public constructor(wasmInstance: WeakRef<BulletWasmInstance>, ptr: number, bodyReference: readonly [RigidBody, RigidBody] | RigidBodyBundle) {
        this._wasmInstance = wasmInstance;
        this._ptr = ptr;
        this._bodyReference = bodyReference;
        if (Array.isArray(bodyReference)) {
            (bodyReference[0] as RigidBody).addReference();
            (bodyReference[1] as RigidBody).addReference();
        } else {
            (bodyReference as RigidBodyBundle).addReference();
        }
        this._referenceCount = 0;
    }

    public dispose(): void {
        if (this._referenceCount > 0) {
            throw new Error("Cannot dispose constraint while it still has references");
        }

        if (this._ptr === 0) {
            return;
        }

        // this operation is thread-safe because the constraint is not belong to any physics world
        this._wasmInstance.deref()?.destroyConstraint(this._ptr);

        this._ptr = 0;
        if (Array.isArray(this._bodyReference)) {
            this._bodyReference[0].removeReference();
            this._bodyReference[1].removeReference();
        } else {
            (this._bodyReference as RigidBodyBundle).removeReference();
        }
        this._bodyReference = null;
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

    public get hasReferences(): boolean {
        return 0 < this._referenceCount;
    }
}

function constraintFinalizer(inner: ConstraintInner): void {
    inner.dispose();
}

const constraintRegistryMap = new WeakMap<BulletWasmInstance, FinalizationRegistry<ConstraintInner>>();

/**
 * Base class for all bullet physics constraints
 */
export abstract class Constraint {
    public readonly runtime: IPhysicsRuntime;
    protected readonly _inner: ConstraintInner;

    private _worldReference: Nullable<object>;

    protected constructor(runtime: IPhysicsRuntime, ptr: number, bodyReference: readonly [RigidBody, RigidBody] | RigidBodyBundle) {
        if (Array.isArray(bodyReference)) {
            if (bodyReference[0].runtime !== runtime || bodyReference[1].runtime !== runtime) {
                throw new Error("Cannot create constraint between bodies from different runtimes");
            }
        } else {
            if ((bodyReference as RigidBodyBundle).runtime !== runtime) {
                throw new Error("Cannot create constraint between body and bundle from different runtimes");
            }
        }

        this.runtime = runtime;
        this._inner = new ConstraintInner(new WeakRef(runtime.wasmInstance), ptr, bodyReference);
        this._worldReference = null;

        let registry = constraintRegistryMap.get(runtime.wasmInstance);
        if (registry === undefined) {
            registry = new FinalizationRegistry(constraintFinalizer);
            constraintRegistryMap.set(runtime.wasmInstance, registry);
        }

        registry.register(this, this._inner, this);
    }

    /**
     * Disposes the constraint and releases the resources associated with it
     */
    public dispose(): void {
        if (this._inner.ptr === 0) {
            return;
        }

        this._inner.dispose();

        const registry = constraintRegistryMap.get(this.runtime.wasmInstance);
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

    /**
     * @internal
     */
    public setWorldReference(worldReference: Nullable<object>): void {
        if (this._worldReference !== null && worldReference !== null) {
            throw new Error("Cannot add constraint to multiple worlds");
        }
        if (this._worldReference === worldReference) {
            return;
        }
        this._worldReference = worldReference;
        if (worldReference !== null) {
            this._inner.addReference();
        } else {
            this._inner.removeReference();
        }
    }
}

const matrixBufferSize = 16 * Constants.A32BytesPerElement;

export const enum ConstraintParams {
    ConstraintERP = 1,
    ConstraintStopERP = 2,
    ConstraintCFM = 3,
    ConstraintStopCFM = 4,
}

abstract class Generic6DofConstraintBase extends Constraint {
    /**
     * Sets the linear lower limit of the constraint
     *
     * If the constraint is added to a physics world, this operation will wait for the world evaluation to finish
     * @param limit linear lower limit
     */
    public setLinearLowerLimit(limit: DeepImmutable<Vector3>): void {
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.constraintSetLinearLowerLimit(this._inner.ptr, limit.x, limit.y, limit.z);
    }

    /**
     * Sets the linear upper limit of the constraint
     * @param limit linear upper limit
     */
    public setLinearUpperLimit(limit: DeepImmutable<Vector3>): void {
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.constraintSetLinearUpperLimit(this._inner.ptr, limit.x, limit.y, limit.z);
    }

    /**
     * Sets the angular lower limit of the constraint
     * @param limit angular lower limit
     */
    public setAngularLowerLimit(limit: DeepImmutable<Vector3>): void {
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.constraintSetAngularLowerLimit(this._inner.ptr, limit.x, limit.y, limit.z);
    }

    /**
     * Sets the angular upper limit of the constraint
     * @param limit angular upper limit
     */
    public setAngularUpperLimit(limit: DeepImmutable<Vector3>): void {
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.constraintSetAngularUpperLimit(this._inner.ptr, limit.x, limit.y, limit.z);
    }

    /**
     * Sets the parameter of the constraint
     *
     * axis is
     * - 0 for linear x
     * - 1 for linear y
     * - 2 for linear z
     * - 3 for angular x
     * - 4 for angular y
     * - 5 for angular z
     *
     * out of range axis will be ignored
     *
     * @param num parameter number
     * @param value parameter value
     * @param axis parameter axis
     */
    public setParam(num: ConstraintParams, value: number, axis: number): void {
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.constraintSetParam(this._inner.ptr, num, value, axis);
    }
}

/**
 * Generic6DofConstraint is a constraint that allows for 6 degrees of freedom (3 linear and 3 angular) between two rigid bodies
 *
 * It can be used to create a variety of constraints, such as a hinge, slider, or ball-and-socket joint
 */
export class Generic6DofConstraint extends Generic6DofConstraintBase {
    /**
     * Creates a new Generic6DofConstraint
     * @param runtime physics runtime
     * @param bodyA rigid body A
     * @param bodyB rigid body B
     * @param frameA local frame A
     * @param frameB local frame B
     * @param useLinearReferenceFrameA if true, the linear reference frame is set to body A, otherwise it is set to body B
     */
    public constructor(
        runtime: IPhysicsRuntime,
        bodyA: RigidBody,
        bodyB: RigidBody,
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    );

    /**
     * Creates a new Generic6DofConstraint
     * @param runtime physics runtime
     * @param bodyBundle rigid body bundle
     * @param bodyIndices indices of the rigid bodies in the bundle
     * @param frameA local frame A
     * @param frameB local frame B
     * @param useLinearReferenceFrameA if true, the linear reference frame is set to body A, otherwise it is set to body B
     */
    public constructor(
        runtime: IPhysicsRuntime,
        bodyBundle: RigidBodyBundle,
        bodyIndices: readonly [number, number],
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    );

    public constructor(
        runtime: IPhysicsRuntime,
        bodyAOrBundle: RigidBody | RigidBodyBundle,
        bodyBOrIndices: RigidBody | readonly [number, number],
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    ) {
        const wasmInstance = runtime.wasmInstance;
        const frameABufferPtr = wasmInstance.allocateBuffer(matrixBufferSize);
        const frameABuffer = wasmInstance.createTypedArray(Float32Array, frameABufferPtr, matrixBufferSize / Constants.A32BytesPerElement);
        frameA.copyToArray(frameABuffer.array);

        const frameBBufferPtr = wasmInstance.allocateBuffer(matrixBufferSize);
        const frameBBuffer = wasmInstance.createTypedArray(Float32Array, frameBBufferPtr, matrixBufferSize / Constants.A32BytesPerElement);
        frameB.copyToArray(frameBBuffer.array);

        const isBundleParam = Array.isArray(bodyBOrIndices);

        const ptr = isBundleParam
            ? wasmInstance.createGeneric6DofConstraintFromBundle(
                bodyAOrBundle.ptr,
                bodyBOrIndices[0],
                bodyBOrIndices[1],
                frameABufferPtr,
                frameBBufferPtr,
                useLinearReferenceFrameA
            )
            : wasmInstance.createGeneric6DofConstraint(
                bodyAOrBundle.ptr,
                (bodyBOrIndices as RigidBody).ptr,
                frameABufferPtr,
                frameBBufferPtr,
                useLinearReferenceFrameA
            );

        wasmInstance.deallocateBuffer(frameABufferPtr, matrixBufferSize);
        wasmInstance.deallocateBuffer(frameBBufferPtr, matrixBufferSize);

        const bodyReference = isBundleParam
            ? (bodyAOrBundle as RigidBodyBundle)
            : [bodyAOrBundle as RigidBody, bodyBOrIndices as RigidBody] as const;

        super(runtime, ptr, bodyReference);
    }
}

abstract class Generic6DofSpringConstraintBase extends Generic6DofConstraintBase {
    /**
     * Enables or disables the spring for the specified index
     * @param index index of the spring
     * @param onOff true to enable the spring, false to disable it
     */
    public enableSpring(index: number, onOff: boolean): void {
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.constraintEnableSpring(this._inner.ptr, index, onOff);
    }

    /**
     * Sets the spring stiffness for the specified index
     * @param index index of the spring
     * @param stiffness spring stiffness
     */
    public setStiffness(index: number, stiffness: number): void {
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.constraintSetStiffness(this._inner.ptr, index, stiffness);
    }

    /**
     * Sets the spring damping for the specified index
     * @param index index of the spring
     * @param damping spring damping
     */
    public setDamping(index: number, damping: number): void {
        if (this._inner.hasReferences) {
            this.runtime.lock.wait();
        }
        this.runtime.wasmInstance.constraintSetDamping(this._inner.ptr, index, damping);
    }
}

/**
 * Generic6DofSpringConstraint is a constraint that allows for 6 degrees of freedom (3 linear and 3 angular) between two rigid bodies
 *
 * It can be used to create a variety of constraints, such as a hinge, slider, or ball-and-socket joint
 *
 * This constraint also supports springs, which can be used to create a spring-like effect between the two bodies
 */
export class Generic6DofSpringConstraint extends Generic6DofSpringConstraintBase {
    /**
     * Creates a new Generic6DofSpringConstraint
     * @param runtime physics runtime
     * @param bodyA rigid body A
     * @param bodyB rigid body B
     * @param frameA local frame A
     * @param frameB local frame B
     * @param useLinearReferenceFrameA if true, the linear reference frame is set to body A, otherwise it is set to body B
     */
    public constructor(
        runtime: IPhysicsRuntime,
        bodyA: RigidBody,
        bodyB: RigidBody,
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    );

    /**
     * Creates a new Generic6DofSpringConstraint
     * @param runtime physics runtime
     * @param bodyBundle rigid body bundle
     * @param bodyIndices indices of the rigid bodies in the bundle
     * @param frameA local frame A
     * @param frameB local frame B
     * @param useLinearReferenceFrameA if true, the linear reference frame is set to body A, otherwise it is set to body B
     */
    public constructor(
        runtime: IPhysicsRuntime,
        bodyBundle: RigidBodyBundle,
        bodyIndices: readonly [number, number],
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    );

    public constructor(
        runtime: IPhysicsRuntime,
        bodyAOrBundle: RigidBody | RigidBodyBundle,
        bodyBOrIndices: RigidBody | readonly [number, number],
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    ) {
        const wasmInstance = runtime.wasmInstance;
        const frameABufferPtr = wasmInstance.allocateBuffer(matrixBufferSize);
        const frameABuffer = wasmInstance.createTypedArray(Float32Array, frameABufferPtr, matrixBufferSize / Constants.A32BytesPerElement);
        frameA.copyToArray(frameABuffer.array);

        const frameBBufferPtr = wasmInstance.allocateBuffer(matrixBufferSize);
        const frameBBuffer = wasmInstance.createTypedArray(Float32Array, frameBBufferPtr, matrixBufferSize / Constants.A32BytesPerElement);
        frameB.copyToArray(frameBBuffer.array);

        const isBundleParam = Array.isArray(bodyBOrIndices);

        const ptr = isBundleParam
            ? wasmInstance.createGeneric6DofSpringConstraintFromBundle(
                bodyAOrBundle.ptr,
                bodyBOrIndices[0],
                bodyBOrIndices[1],
                frameABufferPtr,
                frameBBufferPtr,
                useLinearReferenceFrameA
            )
            : wasmInstance.createGeneric6DofSpringConstraint(
                bodyAOrBundle.ptr,
                (bodyBOrIndices as RigidBody).ptr,
                frameABufferPtr,
                frameBBufferPtr,
                useLinearReferenceFrameA
            );

        wasmInstance.deallocateBuffer(frameABufferPtr, matrixBufferSize);
        wasmInstance.deallocateBuffer(frameBBufferPtr, matrixBufferSize);

        const bodyReference = isBundleParam
            ? (bodyAOrBundle as RigidBodyBundle)
            : [bodyAOrBundle as RigidBody, bodyBOrIndices as RigidBody] as const;

        super(runtime, ptr, bodyReference);
    }
}

/**
 * MmdGeneric6DofSpringConstraint is a constraint that allows for 6 degrees of freedom (3 linear and 3 angular) between two rigid bodies
 *
 * It can be used to create a variety of constraints, such as a hinge, slider, or ball-and-socket joint
 *
 * This constraint also supports springs, which can be used to create a spring-like effect between the two bodies
 *
 * This constraint is modified to reproduces the behavior of the MMD constraint
 */
export class MmdGeneric6DofSpringConstraint extends Generic6DofSpringConstraintBase {
    /**
     * Creates a new MmdGeneric6DofSpringConstraint
     * @param runtime physics runtime
     * @param bodyA rigid body A
     * @param bodyB rigid body B
     * @param frameA local frame A
     * @param frameB local frame B
     * @param useLinearReferenceFrameA if true, the linear reference frame is set to body A, otherwise it is set to body B
     */
    public constructor(
        runtime: IPhysicsRuntime,
        bodyA: RigidBody,
        bodyB: RigidBody,
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    );

    /**
     * Creates a new MmdGeneric6DofSpringConstraint
     * @param runtime physics runtime
     * @param bodyBundle rigid body bundle
     * @param bodyIndices indices of the rigid bodies in the bundle
     * @param frameA local frame A
     * @param frameB local frame B
     * @param useLinearReferenceFrameA if true, the linear reference frame is set to body A, otherwise it is set to body B
     */
    public constructor(
        runtime: IPhysicsRuntime,
        bodyBundle: RigidBodyBundle,
        bodyIndices: readonly [number, number],
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    );

    public constructor(
        runtime: IPhysicsRuntime,
        bodyAOrBundle: RigidBody | RigidBodyBundle,
        bodyBOrIndices: RigidBody | readonly [number, number],
        frameA: Matrix,
        frameB: Matrix,
        useLinearReferenceFrameA: boolean
    ) {
        const wasmInstance = runtime.wasmInstance;
        const frameABufferPtr = wasmInstance.allocateBuffer(matrixBufferSize);
        const frameABuffer = wasmInstance.createTypedArray(Float32Array, frameABufferPtr, matrixBufferSize / Constants.A32BytesPerElement);
        frameA.copyToArray(frameABuffer.array);

        const frameBBufferPtr = wasmInstance.allocateBuffer(matrixBufferSize);
        const frameBBuffer = wasmInstance.createTypedArray(Float32Array, frameBBufferPtr, matrixBufferSize / Constants.A32BytesPerElement);
        frameB.copyToArray(frameBBuffer.array);

        const isBundleParam = Array.isArray(bodyBOrIndices);

        const ptr = isBundleParam
            ? wasmInstance.createMmdGeneric6DofSpringConstraintFromBundle(
                bodyAOrBundle.ptr,
                bodyBOrIndices[0],
                bodyBOrIndices[1],
                frameABufferPtr,
                frameBBufferPtr,
                useLinearReferenceFrameA
            )
            : wasmInstance.createMmdGeneric6DofSpringConstraint(
                bodyAOrBundle.ptr,
                (bodyBOrIndices as RigidBody).ptr,
                frameABufferPtr,
                frameBBufferPtr,
                useLinearReferenceFrameA
            );

        wasmInstance.deallocateBuffer(frameABufferPtr, matrixBufferSize);
        wasmInstance.deallocateBuffer(frameBBufferPtr, matrixBufferSize);

        const bodyReference = isBundleParam
            ? (bodyAOrBundle as RigidBodyBundle)
            : [bodyAOrBundle as RigidBody, bodyBOrIndices as RigidBody] as const;

        super(runtime, ptr, bodyReference);
    }
}
