import type { BoundingBox } from "@babylonjs/core/Culling/boundingBox";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Logger } from "@babylonjs/core/Misc/logger";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { IRaycastQuery, PhysicsRaycastResult } from "@babylonjs/core/Physics/physicsRaycastResult";
import type { PhysicsConstraintAxisLimitMode, PhysicsConstraintMotorType, PhysicsShapeParameters} from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { type ConstrainedBodyPair, type IBasePhysicsCollisionEvent, type IPhysicsCollisionEvent, type IPhysicsEnginePluginV2, type PhysicsConstraintAxis, type PhysicsMassProperties, PhysicsMotionType, PhysicsPrestepType, PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import type { PhysicsConstraint } from "@babylonjs/core/Physics/v2/physicsConstraint";
import { type PhysicsMaterial, PhysicsMaterialCombineMode } from "@babylonjs/core/Physics/v2/physicsMaterial";
import type { PhysicsShape } from "@babylonjs/core/Physics/v2/physicsShape";
import type { Nullable } from "@babylonjs/core/types";

import type { BulletWasmInstance } from "../bulletWasmInstance";
import { MultiPhysicsRuntime } from "../Impl/multiPhysicsRuntime";
import { MotionType } from "../motionType";
import type { PhysicsShape as BulletPhysicsShape } from "../physicsShape";
import { PluginBody } from "./pluginBody";
import { PluginBodyBundle } from "./pluginBodyBundle";
import { PluginConstructionInfo } from "./pluginConstructionInfo";
import { PluginConstructionInfoList } from "./pluginConstructionInfoList";
import type { IPluginShape } from "./pluginShape";
import { PluginBoxShape, PluginCapsuleShape, PluginSphereShape } from "./pluginShape";

export class BulletPluginCommandContext {
    public worldId: number;

    public constructor() {
        this.worldId = 0;
    }
}

/**
 * The Bullet Physics plugin
 */
export class BulletPlugin implements IPhysicsEnginePluginV2 {
    /**
     * Created bullet physics runtime which physics bodies are added to
     */
    public world: MultiPhysicsRuntime;
    /**
     * Name of the plugin
     */
    public name: string = "BulletPlugin";

    /**
     * Observable for collision started and collision continued events
     */
    public onCollisionObservable = new Observable<IPhysicsCollisionEvent>();

    /**
     * Observable for collision ended events
     */
    public onCollisionEndedObservable = new Observable<IBasePhysicsCollisionEvent>();

    /**
     * Observable for trigger entered and trigger exited events
     */
    public onTriggerCollisionObservable = new Observable<IBasePhysicsCollisionEvent>();

    private readonly _initializedBodies: PhysicsBody[] = [];
    private readonly _unInitializedBodies: PhysicsBody[] = [];
    private readonly _shapeMap: Map<BulletPhysicsShape, PhysicsShape> = new Map();
    public readonly commandContext = new BulletPluginCommandContext();

    private static readonly _TempMatrix: Matrix = new Matrix();
    private static readonly _TempMatrix2: Matrix = new Matrix();
    private static readonly _TempMatrix3: Matrix = new Matrix();
    private static readonly _TempVector: Vector3 = new Vector3();
    private static readonly _TempVector2: Vector3 = new Vector3();
    private static readonly _TempQuaternion: Quaternion = new Quaternion();

    public constructor(wasmInstance: BulletWasmInstance) {
        this.world = new MultiPhysicsRuntime(wasmInstance);
    }

    /**
     * Sets the gravity of the physics world.
     *
     * @param gravity - The gravity vector to set.
     *
     */
    public setGravity(gravity: Vector3): void {
        this.world.setGravity(gravity);
    }

    /**
     * Sets the fixed time step for the physics engine.
     *
     * @param timeStep - The fixed time step to use for the physics engine.
     *
     */
    public setTimeStep(timeStep: number): void {
        this.world.timeStep = timeStep;
    }

    /**
     * Gets the fixed time step used by the physics engine.
     *
     * @returns The fixed time step used by the physics engine.
     *
     */
    public getTimeStep(): number {
        return this.world.timeStep;
    }

    /**
     * Executes a single step of the physics engine.
     *
     * @param delta The time delta in seconds since the last step.
     * @param physicsBodies An array of physics bodies to be simulated.
     *
     * This method is useful for simulating the physics engine. It sets the physics body transformation,
     * steps the world, syncs the physics body, and notifies collisions. This allows for the physics engine
     * to accurately simulate the physics bodies in the world.
     */
    public executeStep(delta: number, bodies: PhysicsBody[]): void {
        // initialize any un-initialized bodies before stepping the world
        {
            const unInitializedBodies = this._unInitializedBodies;
            for (let i = 0; i < unInitializedBodies.length; ++i) {
                const body = unInitializedBodies[i];
                const pluginData = body._pluginData;
                if (pluginData) {
                    if (pluginData instanceof PluginConstructionInfo) {
                        const shape = pluginData.shape as unknown as Nullable<IPluginShape>;
                        let transform: Nullable<Matrix> = null;
                        if (shape !== null && shape.localTransform !== null) {
                            transform = pluginData.getInitialTransformToRef(BulletPlugin._TempMatrix);
                            const finalTransform = shape.localTransform.multiplyToRef(transform, BulletPlugin._TempMatrix2);
                            pluginData.setInitialTransform(finalTransform);
                        }
                        const instance = new PluginBody(this.world, pluginData);
                        if (transform !== null) {
                            pluginData.setInitialTransform(transform);
                        }

                        {
                            const commandsOnCreation = pluginData.commandsOnCreation;
                            for (let j = 0; j < commandsOnCreation.length; ++j) {
                                commandsOnCreation[j](instance);
                            }
                            commandsOnCreation.length = 0;
                        }
                        this.world.addRigidBody(instance, pluginData.worldId);
                        this._initializedBodies.push(unInitializedBodies[i]);
                        body._pluginData = instance;
                    } else {
                        throw new Error("Invalid body type.");
                    }
                }
                const pluginDataInstances = body._pluginDataInstances as any;
                if (!Array.isArray(pluginDataInstances)) {
                    if (pluginDataInstances instanceof PluginConstructionInfoList) {
                        const shape = pluginDataInstances.getShape(0) as unknown as Nullable<IPluginShape>;
                        let transforms: Nullable<Matrix[]> = null;
                        if (shape !== null && shape.localTransform !== null) {
                            transforms = [];
                            for (let j = 0; j < pluginDataInstances.count; ++j) {
                                const transform = pluginDataInstances.getInitialTransformToRef(j, new Matrix());
                                transforms.push(transform);
                                const finalTransform = shape.localTransform.multiplyToRef(transform, BulletPlugin._TempMatrix);
                                pluginDataInstances.setInitialTransform(j, finalTransform);
                            }
                        }
                        const instance = new PluginBodyBundle(this.world, pluginDataInstances);
                        if (transforms !== null) {
                            for (let j = 0; j < pluginDataInstances.count; ++j) {
                                pluginDataInstances.setInitialTransform(j, transforms[j]);
                            }
                        }

                        {
                            const commandsOnCreation = pluginDataInstances.commandsOnCreation;
                            for (let j = 0; j < commandsOnCreation.length; ++j) {
                                commandsOnCreation[j](instance);
                            }
                            commandsOnCreation.length = 0;
                        }
                        this.world.addRigidBodyBundle(instance, pluginDataInstances.worldId);
                        this._initializedBodies.push(unInitializedBodies[i]);
                        body._pluginDataInstances = instance as unknown as any[];
                    } else {
                        throw new Error("Invalid body type.");
                    }
                }
            }
            unInitializedBodies.length = 0;
        }

        for (let i = 0; i < bodies.length; ++i) {
            const physicsBody = bodies[i];
            if (physicsBody.disablePreStep) {
                continue;
            }
            this.setPhysicsBodyTransformation(physicsBody, physicsBody.transformNode);
        }

        this.world.afterAnimations(delta * 1000);

        for (let i = 0; i < bodies.length; ++i) {
            const physicsBody = bodies[i];
            if (!physicsBody.disableSync) {
                this.sync(physicsBody);
            }
        }

        // notify collision events
        // notify trigger events
    }

    /**
     * Sets the transformation of the given physics body to the given transform node.
     * @param body The physics body to set the transformation for.
     * @param node The transform node to set the transformation from.
     * Sets the transformation of the given physics body to the given transform node.
     *
     * This function is useful for setting the transformation of a physics body to a
     * transform node, which is necessary for the physics engine to accurately simulate
     * the motion of the body. It also takes into account instances of the transform
     * node, which is necessary for accurate simulation of multiple bodies with the
     * same transformation.
     */
    public setPhysicsBodyTransformation(body: PhysicsBody, node: TransformNode): void {
        if (body.getPrestepType() === PhysicsPrestepType.TELEPORT) {
            const transformNode = body.transformNode;
            // regular
            const pluginData = body._pluginData;
            if (pluginData) {
                if (pluginData instanceof PluginBody) {
                    const shape = pluginData.getShape() as unknown as Nullable<IPluginShape>;
                    if (shape !== null && shape.localTransform !== null) {
                        const transform = this._getTransformInfos(node, BulletPlugin._TempMatrix);
                        const finalTransform = shape.localTransform.multiplyToRef(transform, BulletPlugin._TempMatrix2);
                        pluginData.setTransformMatrix(finalTransform);
                    } else {
                        pluginData.setTransformMatrix(this._getTransformInfos(node, BulletPlugin._TempMatrix));
                    }
                } else if (pluginData instanceof PluginConstructionInfo) {
                    pluginData.setInitialTransform(this._getTransformInfos(node, BulletPlugin._TempMatrix));
                }
            }

            // instances
            const pluginDataInstances = body._pluginDataInstances as any;
            if (!Array.isArray(pluginDataInstances)) {
                const m = transformNode as Mesh;
                const matrixData = m._thinInstanceDataStorage.matrixData;
                if (!matrixData) {
                    return; // TODO: error handling
                }
                if (pluginDataInstances instanceof PluginBodyBundle) {
                    const shape = pluginDataInstances.getShape(0) as unknown as Nullable<IPluginShape>;
                    if (shape !== null && shape.localTransform !== null) {
                        for (let i = 0; i < pluginDataInstances.count; ++i) {
                            const nodeTransform = Matrix.FromArrayToRef(matrixData, i * 16, BulletPlugin._TempMatrix);
                            const finalTransform = shape.localTransform.multiplyToRef(nodeTransform, BulletPlugin._TempMatrix2);
                            pluginDataInstances.setTransformMatrixFromArray(i, finalTransform.m);
                        }
                    } else {
                        pluginDataInstances.setTransformMatricesFromArray(matrixData);
                    }
                } else if (pluginDataInstances instanceof PluginConstructionInfoList) {
                    for (let i = 0; i < pluginDataInstances.count; ++i) {
                        const transform = Matrix.FromArrayToRef(matrixData, i * 16, BulletPlugin._TempMatrix);
                        pluginDataInstances.setInitialTransform(i, transform);
                    }
                }
            }
        } else if (body.getPrestepType() === PhysicsPrestepType.ACTION) {
            this.setTargetTransform(body, node.absolutePosition, node.absoluteRotationQuaternion);
        } else if (body.getPrestepType() === PhysicsPrestepType.DISABLED) {
            Logger.Warn("Prestep type is set to DISABLED. Unable to set physics body transformation.");
        } else {
            Logger.Warn("Invalid prestep type set to physics body.");
        }
    }

    /**
     * Returns the version of the physics engine plugin.
     *
     * @returns The version of the physics engine plugin.
     *
     * This method is useful for determining the version of the physics engine plugin that is currently running.
     */
    public getPluginVersion(): number {
        return 2;
    }

    /**
     * Set the maximum allowed linear and angular velocities
     * @param maxLinearVelocity maximum allowed linear velocity
     * @param maxAngularVelocity maximum allowed angular velocity
     */
    public setVelocityLimits(maxLinearVelocity: number, maxAngularVelocity: number): void {
        maxLinearVelocity;
        maxAngularVelocity;
        // there is no support for setting velocity limits in bullet
        throw new Error("Method not implemented.");
    }

    /**
     * @returns maximum allowed linear velocity
     */
    public getMaxLinearVelocity(): number {
        // there is no support for setting velocity limits in bullet
        throw new Error("Method not implemented.");
    }

    /**
     * @returns maximum allowed angular velocity
     */
    public getMaxAngularVelocity(): number {
        // there is no support for setting velocity limits in bullet
        throw new Error("Method not implemented.");
    }

    private static _MotionTypeToBulletMotionType(motionType: PhysicsMotionType): MotionType {
        switch (motionType) {
        case PhysicsMotionType.DYNAMIC:
            return MotionType.Dynamic;
        case PhysicsMotionType.STATIC:
            return MotionType.Static;
        case PhysicsMotionType.ANIMATED:
            return MotionType.Kinematic;
        default:
            throw new Error("Invalid motion type");
        }
    }

    private static _BulletMotionTypeToMotionType(motionType: MotionType): PhysicsMotionType {
        switch (motionType) {
        case MotionType.Dynamic:
            return PhysicsMotionType.DYNAMIC;
        case MotionType.Static:
            return PhysicsMotionType.STATIC;
        case MotionType.Kinematic:
            return PhysicsMotionType.ANIMATED;
        default:
            throw new Error("Invalid motion type");
        }
    }

    /**
     * Initializes a physics body with the given position and orientation.
     *
     * @param body - The physics body to initialize.
     * @param motionType - The motion type of the body.
     * @param position - The position of the body.
     * @param orientation - The orientation of the body.
     * This code is useful for initializing a physics body with the given position and orientation.
     * It creates a plugin data for the body and adds it to the world. It then converts the position
     * and orientation to a transform and sets the body's transform to the given values.
     */
    public initBody(body: PhysicsBody, motionType: PhysicsMotionType, position: Vector3, orientation: Quaternion): void {
        const info = body._pluginData = new PluginConstructionInfo(this.world.wasmInstance);

        info.motionType = BulletPlugin._MotionTypeToBulletMotionType(motionType);

        const transform = Matrix.FromQuaternionToRef(orientation, BulletPlugin._TempMatrix);
        transform.setTranslation(position);
        info.setInitialTransform(transform);

        this._unInitializedBodies.push(body);
    }

    /**
     * Initializes the body instances for a given physics body and mesh.
     *
     * @param body - The physics body to initialize.
     * @param motionType - How the body will be handled by the engine
     * @param mesh - The mesh to initialize.
     *
     * This code is useful for creating a physics body from a mesh. It creates a
     * body instance for each instance of the mesh and adds it to the world. It also
     * sets the position of the body instance to the position of the mesh instance.
     * This allows for the physics engine to accurately simulate the mesh in the
     * world.
     */
    public initBodyInstances(body: PhysicsBody, motionType: PhysicsMotionType, mesh: Mesh): void {
        const instancesCount = mesh._thinInstanceDataStorage?.instancesCount ?? 0;
        const matrixData = mesh._thinInstanceDataStorage.matrixData;
        if (!matrixData) {
            return; // TODO: error handling
        }

        const info = new PluginConstructionInfoList(this.world.wasmInstance, instancesCount);
        body._pluginDataInstances = info as unknown as any[];

        const bulletMotionType = BulletPlugin._MotionTypeToBulletMotionType(motionType);

        for (let i = 0; i < instancesCount; ++i) {
            info.setMotionType(i, bulletMotionType);
            const transform = Matrix.FromArrayToRef(matrixData, i * 16, BulletPlugin._TempMatrix);
            info.setInitialTransform(i, transform);
        }

        this._unInitializedBodies.push(body);
    }

    /**
     * Update the internal body instances for a given physics body to match the instances in a mesh.
     * @param body the body that will be updated
     * @param mesh the mesh with reference instances
     */
    public updateBodyInstances(body: PhysicsBody, mesh: Mesh): void {
        const instancesCount = mesh._thinInstanceDataStorage?.instancesCount ?? 0;
        const matrixData = mesh._thinInstanceDataStorage.matrixData;
        if (!matrixData) {
            return; // TODO: error handling
        }
        const pluginInstances = body._pluginDataInstances;
        const pluginInstancesCount = pluginInstances.length;
        const motionType = BulletPlugin._MotionTypeToBulletMotionType(this.getMotionType(body));

        if (instancesCount !== pluginInstancesCount) {
            if (pluginInstances instanceof PluginBodyBundle) {
                this.world.removeRigidBodyBundle(pluginInstances, pluginInstances.info.worldId);
                const oldInfo = pluginInstances.info;
                const newInfo = new PluginConstructionInfoList(this.world.wasmInstance, instancesCount);
                // copy old info to new info
                {
                    const count = Math.min(instancesCount, pluginInstancesCount);
                    for (let i = 0; i < count; ++i) {
                        newInfo.setShape(i, oldInfo.getShape(i));
                        newInfo.setInitialTransform(i, pluginInstances.getTransformMatrixToRef(i, BulletPlugin._TempMatrix));
                        newInfo.setMotionType(i, oldInfo.getMotionType(i));
                        newInfo.setMass(i, oldInfo.getMass(i));
                        newInfo.setLocalInertia(i, oldInfo.getLocalInertiaToRef(i, BulletPlugin._TempVector));
                        newInfo.setLinearDamping(i, oldInfo.getLinearDamping(i));
                        newInfo.setAngularDamping(i, oldInfo.getAngularDamping(i));
                        newInfo.setFriction(i, oldInfo.getFriction(i));
                        newInfo.setRestitution(i, oldInfo.getRestitution(i));
                        newInfo.setLinearSleepingThreshold(i, oldInfo.getLinearSleepingThreshold(i));
                        newInfo.setAngularSleepingThreshold(i, oldInfo.getAngularSleepingThreshold(i));
                        newInfo.setCollisionGroup(i, oldInfo.getCollisionGroup(i));
                        newInfo.setCollisionMask(i, oldInfo.getCollisionMask(i));
                        newInfo.setAdditionalDamping(i, oldInfo.getAdditionalDamping(i));
                        newInfo.setNoContactResponse(i, oldInfo.getNoContactResponse(i));
                        newInfo.setDisableDeactivation(i, oldInfo.getDisableDeactivation(i));
                    }
                }
                // set new info
                for (let i = pluginInstancesCount; i < instancesCount; ++i) {
                    newInfo.setInitialTransform(i, Matrix.FromArrayToRef(matrixData, i * 16, BulletPlugin._TempMatrix));
                    newInfo.setMotionType(i, motionType);
                }

                const shape = newInfo.getShape(0) as unknown as Nullable<IPluginShape>;
                let transforms: Nullable<Matrix[]> = null;
                if (shape !== null && shape.localTransform !== null) {
                    transforms = [];
                    for (let j = 0; j < newInfo.count; ++j) {
                        const transform = newInfo.getInitialTransformToRef(j, new Matrix());
                        transforms.push(transform);
                        const finalTransform = shape.localTransform.multiplyToRef(transform, BulletPlugin._TempMatrix);
                        newInfo.setInitialTransform(j, finalTransform);
                    }
                }
                const newBundle = new PluginBodyBundle(this.world, newInfo);
                if (transforms !== null) {
                    for (let j = 0; j < newInfo.count; ++j) {
                        newInfo.setInitialTransform(j, transforms[j]);
                    }
                }

                this.world.addRigidBodyBundle(newBundle, newInfo.worldId);
                body._pluginDataInstances = newBundle as unknown as any[];
            }
        }
    }

    /**
     * Removes a body from the world. To dispose of a body, it is necessary to remove it from the world first.
     *
     * @param body - The body to remove.
     */
    public removeBody(body: PhysicsBody): void {
        let isInitialized = false;

        const pluginData = body._pluginData;
        if (pluginData instanceof PluginBody) {
            isInitialized = true;
            this.world.removeRigidBody(pluginData, pluginData.worldId);
        }

        const pluginDataInstances = body._pluginDataInstances;
        if (pluginDataInstances instanceof PluginBodyBundle) {
            isInitialized = true;
            this.world.removeRigidBodyBundle(pluginDataInstances, pluginDataInstances.info.worldId);
        }

        if (isInitialized) {
            const index = this._initializedBodies.indexOf(body);
            if (index !== -1) {
                this._initializedBodies.splice(index, 1);
            }
        } else {
            const index = this._unInitializedBodies.indexOf(body);
            if (index !== -1) {
                this._unInitializedBodies.splice(index, 1);
            }
        }
    }

    /**
     * Synchronizes the transform of a physics body with its transform node.
     * @param body - The physics body to synchronize.
     *
     * This function is useful for keeping the physics body's transform in sync with its transform node.
     * This is important for ensuring that the physics body is accurately represented in the physics engine.
     */
    public sync(body: PhysicsBody): void {
        this.syncTransform(body, body.transformNode);
    }

    /**
     * Synchronizes the transform of a physics body with the transform of its
     * corresponding transform node.
     *
     * @param body - The physics body to synchronize.
     * @param transformNode - The destination Transform Node.
     *
     * This code is useful for synchronizing the position and orientation of a
     * physics body with the position and orientation of its corresponding
     * transform node. This is important for ensuring that the physics body and
     * the transform node are in the same position and orientation in the scene.
     * This is necessary for the physics engine to accurately simulate the
     * physical behavior of the body.
     */
    public syncTransform(body: PhysicsBody, transformNode: TransformNode): void {
        const pluginData = body._pluginData;
        if (pluginData instanceof PluginBody) {
            try {
                // regular
                const bodyTransform = pluginData.getTransformMatrixToRef(BulletPlugin._TempMatrix);
                if (pluginData.localTransformInverse) {
                    pluginData.localTransformInverse.multiplyToRef(bodyTransform, bodyTransform);
                }
                const bodyTranslation = BulletPlugin._TempVector;

                bodyTransform.getTranslationToRef(bodyTranslation);
                const bodyOrientation = Quaternion.FromRotationMatrixToRef(bodyTransform, BulletPlugin._TempQuaternion);

                const parent = transformNode.parent as TransformNode;
                // transform position/orientation in parent space
                if (parent && !parent.getWorldMatrix().isIdentity()) {
                    parent.computeWorldMatrix(true);
                    // Save scaling for future use
                    const scaling = BulletPlugin._TempVector2.copyFrom(transformNode.scaling);

                    bodyOrientation.normalize();
                    // reuse of _TempMatrix is safe here because bodyTransform is not used anymore
                    const finalTransform = BulletPlugin._TempMatrix;
                    Matrix.ComposeToRef(transformNode.absoluteScaling, bodyOrientation, bodyTranslation, finalTransform);

                    const parentInverseTransform = BulletPlugin._TempMatrix2;
                    parent.getWorldMatrix().invertToRef(parentInverseTransform);

                    const localTransform = BulletPlugin._TempMatrix3;
                    finalTransform.multiplyToRef(parentInverseTransform, localTransform);
                    localTransform.decomposeToTransformNode(transformNode);
                    transformNode.rotationQuaternion?.normalize();
                    // Keep original scaling. Re-injecting scaling can introduce discontinuity between frames. Basically, it grows or shrinks.
                    transformNode.scaling.copyFrom(scaling);
                } else {
                    transformNode.position.copyFrom(bodyTranslation);
                    if (transformNode.rotationQuaternion) {
                        transformNode.rotationQuaternion.copyFrom(bodyOrientation);
                    } else {
                        bodyOrientation.toEulerAnglesToRef(transformNode.rotation);
                    }
                }
            } catch (e: any) {
                Logger.Error(`Syncing transform failed for node ${transformNode.name}: ${e.message}...`);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (pluginDataInstances instanceof PluginBodyBundle) {
            // instances
            const m = transformNode as Mesh;
            const matrixData = m._thinInstanceDataStorage.matrixData;
            if (!matrixData) {
                return; // TODO: error handling
            }
            if (pluginDataInstances.localTransformInverse) {
                for (let i = 0; i < pluginDataInstances.count; ++i) {
                    const transform = pluginDataInstances.getTransformMatrixToRef(i, BulletPlugin._TempMatrix);
                    pluginDataInstances.localTransformInverse.multiplyToRef(transform, transform);
                    matrixData.set(transform.m, i * 16);
                }
            } else {
                pluginDataInstances.getTransformMatricesToArray(matrixData);
            }
            m.thinInstanceBufferUpdated("matrix");
        }
    }

    /**
     * Sets the shape of a physics body.
     * @param body - The physics body to set the shape for.
     * @param shape - The physics shape to set.
     *
     * This function is used to set the shape of a physics body. It is useful for
     * creating a physics body with a specific shape, such as a box or a sphere,
     * which can then be used to simulate physical interactions in a physics engine.
     * This function is especially useful for meshes with multiple instances, as it
     * will set the shape for each instance of the mesh.
     */
    public setShape(body: PhysicsBody, shape: Nullable<PhysicsShape>): void {
        const shapePluginData = (shape?._pluginData ?? null) as Nullable<BulletPhysicsShape>;

        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.shape = shapePluginData;
            } else if (pluginData instanceof PluginBody) {
                if (shapePluginData === null) {
                    throw new Error("Cannot set shape to null on a body that has already been initialized.");
                }
                pluginData.setShape(shapePluginData);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                for (let i = 0; i < pluginDataInstances.count; ++i) {
                    pluginDataInstances.setShape(i, shapePluginData);
                }
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                if (shapePluginData === null) {
                    throw new Error("Cannot set shape to null on a body that has already been initialized.");
                }
                for (let i = 0; i < pluginDataInstances.count; ++i) {
                    pluginDataInstances.setShape(i, shapePluginData);
                }
            }
        }
    }

    /**
     * Gets the shape of a physics body. This will create a new shape object
     *
     * @param body - The physics body.
     * @returns The shape of the physics body.
     *
     */
    public getShape(body: PhysicsBody): Nullable<PhysicsShape> {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                return pluginData.shape !== null ? this._shapeMap.get(pluginData.shape) ?? null : null;
            } else if (pluginData instanceof PluginBody) {
                return this._shapeMap.get(pluginData.getShape()) ?? null;
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                const shape = pluginDataInstances.getShape(0);
                return shape !== null ? this._shapeMap.get(shape) ?? null : null;
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                const shape = pluginDataInstances.getShape(0);
                return this._shapeMap.get(shape) ?? null;
            }
        }

        throw new Error("Invalid body type.");
    }

    /**
     * Gets the type of a physics shape.
     * @param shape - The physics shape to get the type for.
     * @returns The type of the physics shape.
     *
     */
    public getShapeType(shape: PhysicsShape): PhysicsShapeType {
        return shape.type;
    }

    /**
     * Sets the event mask of a physics body.
     * @param body - The physics body to set the event mask for.
     * @param eventMask - The event mask to set.
     * @param instanceIndex - The index of the instance to set the event mask for
     *
     * This function is useful for setting the event mask of a physics body, which is used to determine which events the body will respond to. This is important for ensuring that the physics engine is able to accurately simulate the behavior of the body in the game world.
     */
    public setEventMask(body: PhysicsBody, eventMask: number, instanceIndex?: number): void {
        body;
        eventMask;
        instanceIndex;
        throw new Error("Method not implemented.");
    }

    /**
     * Retrieves the event mask of a physics body.
     *
     * @param body - The physics body to retrieve the event mask from.
     * @param instanceIndex - The index of the instance to retrieve the event mask from.
     * @returns The event mask of the physics body.
     *
     */
    public getEventMask(body: PhysicsBody, instanceIndex?: number): number {
        body;
        instanceIndex;
        throw new Error("Method not implemented.");
    }

    /**
     * sets the motion type of a physics body.
     * @param body - The physics body to set the motion type for.
     * @param motionType - The motion type to set.
     * @param instanceIndex - The index of the instance to set the motion type for. If undefined, the motion type of all the bodies will be set.
     */
    public setMotionType(body: PhysicsBody, motionType: PhysicsMotionType, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.motionType = BulletPlugin._MotionTypeToBulletMotionType(motionType);
            } else if (pluginData instanceof PluginBody) {
                throw new Error("Cannot set motion type on a body that has already been initialized.");
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setMotionType(i, BulletPlugin._MotionTypeToBulletMotionType(motionType));
                }
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                throw new Error("Cannot set motion type on a body that has already been initialized.");
            }
        }
    }

    /**
     * Gets the motion type of a physics body.
     * @param body - The physics body to get the motion type from.
     * @param instanceIndex - The index of the instance to get the motion type from. If not specified, the motion type of the first instance will be returned.
     * @returns The motion type of the physics body.
     */
    public getMotionType(body: PhysicsBody, instanceIndex?: number): PhysicsMotionType {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                return BulletPlugin._BulletMotionTypeToMotionType(pluginData.motionType);
            } else if (pluginData instanceof PluginBody) {
                return BulletPlugin._BulletMotionTypeToMotionType(pluginData.motionType);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                return BulletPlugin._BulletMotionTypeToMotionType(pluginDataInstances.getMotionType(start));
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                return BulletPlugin._BulletMotionTypeToMotionType(pluginDataInstances.info.getMotionType(start));
            }
        }

        throw new Error("Invalid body type.");
    }

    /**
     * Computes the mass properties of a physics body, from it's shape
     *
     * @param body - The physics body to copmute the mass properties of
     * @param instanceIndex - The index of the instance to compute the mass properties of.
     * @returns The mass properties of the physics body.
     */
    public computeMassProperties(body: PhysicsBody, instanceIndex?: number): PhysicsMassProperties {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                return {
                    mass: pluginData.mass,
                    inertia: pluginData.localInertia ?? undefined
                };
            } else if (pluginData instanceof PluginBody) {
                return {
                    mass: pluginData.getMass(),
                    inertia: pluginData.getLocalInertia()
                };
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                return {
                    mass: pluginDataInstances.getMass(start),
                    inertia: pluginDataInstances.getLocalInertiaToRef(start, new Vector3()) ?? undefined
                };
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                return {
                    mass: pluginDataInstances.getMass(start),
                    inertia: pluginDataInstances.getLocalInertia(start)
                };
            }
        }

        throw new Error("Invalid body type.");
    }

    /**
     * Sets the mass properties of a physics body.
     *
     * @param body - The physics body to set the mass properties of.
     * @param massProps - The mass properties to set.
     * @param instanceIndex - The index of the instance to set the mass properties of. If undefined, the mass properties of all the bodies will be set.
     * This function is useful for setting the mass properties of a physics body,
     * such as its mass, inertia, and center of mass. This is important for
     * accurately simulating the physics of the body in the physics engine.
     *
     */
    public setMassProperties(body: PhysicsBody, massProps: PhysicsMassProperties, instanceIndex?: number): void {
        if (massProps.inertiaOrientation !== undefined) Logger.Warn("Inertia orientation is not supported in bullet.");
        if (massProps.centerOfMass !== undefined) Logger.Warn("Center of mass is not supported in bullet.");

        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                if (massProps.mass !== undefined) pluginData.mass = massProps.mass;
                if (massProps.inertia !== undefined) pluginData.localInertia = massProps.inertia;
            } else if (pluginData instanceof PluginBody) {
                const mass = massProps.mass ?? pluginData.getMass();
                const inertia = massProps.inertia ?? pluginData.getLocalInertia();
                pluginData.setMassProps(mass, inertia);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginData.count;
            if (pluginData instanceof PluginConstructionInfoList) {
                for (let i = start; i < end; ++i) {
                    if (massProps.mass !== undefined) pluginData.setMass(i, massProps.mass);
                    if (massProps.inertia !== undefined) pluginData.setLocalInertia(i, massProps.inertia);
                }
            } else if (pluginData instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginData.setMassProps(i, massProps.mass ?? pluginData.getMass(i), massProps.inertia ?? pluginData.getLocalInertia(i));
                }
            }
        }
    }

    /**
     * Gets the mass properties of a physics body.
     * @param body - The physics body to get the mass properties from.
     * @param instanceIndex - The index of the instance to get the mass properties from. If not specified, the mass properties of the first instance will be returned.
     * @returns The mass properties of the physics body.
     */
    public getMassProperties(body: PhysicsBody, instanceIndex?: number): PhysicsMassProperties {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                return {
                    mass: pluginData.mass,
                    inertia: pluginData.localInertia ?? undefined
                };
            } else if (pluginData instanceof PluginBody) {
                return {
                    mass: pluginData.getMass(),
                    inertia: pluginData.getLocalInertia()
                };
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                return {
                    mass: pluginDataInstances.getMass(start),
                    inertia: pluginDataInstances.getLocalInertiaToRef(start, new Vector3()) ?? undefined
                };
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                return {
                    mass: pluginDataInstances.getMass(start),
                    inertia: pluginDataInstances.getLocalInertia(start)
                };
            }
        }

        throw new Error("Invalid body type.");
    }

    /**
     * Sets the linear damping of the given body.
     * @param body - The body to set the linear damping for.
     * @param damping - The linear damping to set.
     * @param instanceIndex - The index of the instance to set the linear damping for. If not specified, the linear damping of the first instance will be set.
     *
     * This method is useful for controlling the linear damping of a body in a physics engine.
     * Linear damping is a force that opposes the motion of the body, and is proportional to the velocity of the body.
     * This method allows the user to set the linear damping of a body, which can be used to control the motion of the body.
     */
    public setLinearDamping(body: PhysicsBody, damping: number, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.linearDamping = damping;
            } else if (pluginData instanceof PluginBody) {
                pluginData.setDamping(damping, pluginData.getAngularDamping());
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setLinearDamping(i, damping);
                }
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setDamping(i, damping, pluginDataInstances.getAngularDamping(i));
                }
            }
        }
    }

    /**
     * Gets the linear damping of the given body.
     * @param body - The body to get the linear damping from.
     * @param instanceIndex - The index of the instance to get the linear damping from. If not specified, the linear damping of the first instance will be returned.
     * @returns The linear damping of the given body.
     *
     * This method is useful for getting the linear damping of a body in a physics engine.
     * Linear damping is a force that opposes the motion of the body and is proportional to the velocity of the body.
     * It is used to simulate the effects of air resistance and other forms of friction.
     */
    public getLinearDamping(body: PhysicsBody, instanceIndex?: number): number {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                return pluginData.linearDamping;
            } else if (pluginData instanceof PluginBody) {
                return pluginData.getLinearDamping();
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                return pluginDataInstances.getLinearDamping(start);
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                return pluginDataInstances.getLinearDamping(start);
            }
        }

        throw new Error("Invalid body type.");
    }

    /**
     * Gets the angular damping of a physics body.
     * @param body - The physics body to get the angular damping from.
     * @param instanceIndex - The index of the instance to get the angular damping from. If not specified, the angular damping of the first instance will be returned.
     * @returns The angular damping of the body.
     *
     * This function is useful for retrieving the angular damping of a physics body,
     * which is used to control the rotational motion of the body. The angular damping is a value between 0 and 1, where 0 is no damping and 1 is full damping.
     */
    public setAngularDamping(body: PhysicsBody, damping: number, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.angularDamping = damping;
            } else if (pluginData instanceof PluginBody) {
                pluginData.setDamping(pluginData.getLinearDamping(), damping);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setAngularDamping(i, damping);
                }
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setDamping(i, pluginDataInstances.getLinearDamping(i), damping);
                }
            }
        }
    }

    /**
     * Gets the angular damping of a physics body.
     * @param body - The physics body to get the angular damping from.
     * @param instanceIndex - The index of the instance to get the angular damping from. If not specified, the angular damping of the first instance will be returned.
     * @returns The angular damping of the body.
     *
     * This function is useful for retrieving the angular damping of a physics body,
     * which is used to control the rotational motion of the body. The angular damping is a value between 0 and 1, where 0 is no damping and 1 is full damping.
     */
    public getAngularDamping(body: PhysicsBody, instanceIndex?: number): number {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                return pluginData.angularDamping;
            } else if (pluginData instanceof PluginBody) {
                return pluginData.getAngularDamping();
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                return pluginDataInstances.getAngularDamping(start);
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                return pluginDataInstances.getAngularDamping(start);
            }
        }

        throw new Error("Invalid body type.");
    }

    /**
     * Sets the linear velocity of a physics body.
     * @param body - The physics body to set the linear velocity of.
     * @param linVel - The linear velocity to set.
     * @param instanceIndex - The index of the instance to set the linear velocity of. If not specified, the linear velocity of the first instance will be set.
     *
     * This function is useful for setting the linear velocity of a physics body, which is necessary for simulating
     * motion in a physics engine. The linear velocity is the speed and direction of the body's movement.
     */
    public setLinearVelocity(body: PhysicsBody, linVel: Vector3, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.commandsOnCreation.push((body) => {
                    body.setLinearVelocity(linVel);
                });
            } else if (pluginData instanceof PluginBody) {
                pluginData.setLinearVelocity(linVel);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                pluginDataInstances.commandsOnCreation.push((bundle) => {
                    for (let i = start; i < end; ++i) {
                        bundle.setLinearVelocity(i, linVel);
                    }
                });
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setLinearVelocity(i, linVel);
                }
            }
        }
    }

    /**
     * Gets the linear velocity of a physics body and stores it in a given vector.
     * @param body - The physics body to get the linear velocity from.
     * @param linVel - The vector to store the linear velocity in.
     * @param instanceIndex - The index of the instance to get the linear velocity from. If not specified, the linear velocity of the first instance will be returned.
     *
     * This function is useful for retrieving the linear velocity of a physics body,
     * which can be used to determine the speed and direction of the body. This
     * information can be used to simulate realistic physics behavior in a game.
     */
    public getLinearVelocityToRef(body: PhysicsBody, linVel: Vector3, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                linVel.set(0, 0, 0);
            } else if (pluginData instanceof PluginBody) {
                pluginData.getLinearVelocityToRef(linVel);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                linVel.set(0, 0, 0);
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                pluginDataInstances.getLinearVelocityToRef(start, linVel);
            }
        }
    }

    /**
     * Applies an impulse to a physics body at a given location.
     * @param body - The physics body to apply the impulse to.
     * @param impulse - The impulse vector to apply.
     * @param location - The location in world space to apply the impulse.
     * @param instanceIndex - The index of the instance to apply the impulse to. If not specified, the impulse will be applied to all instances.
     *
     * This method is useful for applying an impulse to a physics body at a given location.
     * This can be used to simulate physical forces such as explosions, collisions, and gravity.
     */
    public applyImpulse(body: PhysicsBody, impulse: Vector3, location: Vector3, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.commandsOnCreation.push((body) => {
                    body.applyImpulse(impulse, location);
                });
            } else if (pluginData instanceof PluginBody) {
                pluginData.applyImpulse(impulse, location);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                pluginDataInstances.commandsOnCreation.push((bundle) => {
                    for (let i = start; i < end; ++i) {
                        bundle.applyImpulse(i, impulse, location);
                    }
                });
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.applyImpulse(i, impulse, location);
                }
            }
        }
    }

    /**
     * Applies an angular impulse(torque) to a physics body
     * @param body - The physics body to apply the impulse to.
     * @param angularImpulse - The torque value
     * @param instanceIndex - The index of the instance to apply the impulse to. If not specified, the impulse will be applied to all instances.
     */
    public applyAngularImpulse(body: PhysicsBody, angularImpulse: Vector3, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.commandsOnCreation.push((body) => {
                    body.applyTorque(angularImpulse);
                });
            } else if (pluginData instanceof PluginBody) {
                pluginData.applyTorque(angularImpulse);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                pluginDataInstances.commandsOnCreation.push((bundle) => {
                    for (let i = start; i < end; ++i) {
                        bundle.applyTorque(i, angularImpulse);
                    }
                });
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.applyTorque(i, angularImpulse);
                }
            }
        }
    }

    /**
     * Applies a force to a physics body at a given location.
     * @param body - The physics body to apply the impulse to.
     * @param force - The force vector to apply.
     * @param location - The location in world space to apply the impulse.
     * @param instanceIndex - The index of the instance to apply the force to. If not specified, the force will be applied to all instances.
     *
     * This method is useful for applying a force to a physics body at a given location.
     * This can be used to simulate physical forces such as explosions, collisions, and gravity.
     */
    public applyForce(body: PhysicsBody, force: Vector3, location: Vector3, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.commandsOnCreation.push((body) => {
                    body.applyForce(force, location);
                });
            } else if (pluginData instanceof PluginBody) {
                pluginData.applyForce(force, location);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                pluginDataInstances.commandsOnCreation.push((bundle) => {
                    for (let i = start; i < end; ++i) {
                        bundle.applyForce(i, force, location);
                    }
                });
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.applyForce(i, force, location);
                }
            }
        }
    }

    /**
     * Sets the angular velocity of a physics body.
     *
     * @param body - The physics body to set the angular velocity of.
     * @param angVel - The angular velocity to set.
     * @param instanceIndex - The index of the instance to set the angular velocity of. If not specified, the angular velocity of the first instance will be set.
     *
     * This function is useful for setting the angular velocity of a physics body in a physics engine.
     * This allows for more realistic simulations of physical objects, as they can be given a rotational velocity.
     */
    public setAngularVelocity(body: PhysicsBody, angVel: Vector3, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.commandsOnCreation.push((body) => {
                    body.setAngularVelocity(angVel);
                });
            } else if (pluginData instanceof PluginBody) {
                pluginData.setAngularVelocity(angVel);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                pluginDataInstances.commandsOnCreation.push((bundle) => {
                    for (let i = start; i < end; ++i) {
                        bundle.setAngularVelocity(i, angVel);
                    }
                });
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setAngularVelocity(i, angVel);
                }
            }
        }
    }

    /**
     * Gets the angular velocity of a body.
     * @param body - The body to get the angular velocity from.
     * @param angVel - The vector3 to store the angular velocity.
     * @param instanceIndex - The index of the instance to get the angular velocity from. If not specified, the angular velocity of the first instance will be returned.
     *
     * This method is useful for getting the angular velocity of a body in a physics engine. It
     * takes the body and a vector3 as parameters and stores the angular velocity of the body
     * in the vector3. This is useful for getting the angular velocity of a body in order to
     * calculate the motion of the body in the physics engine.
     */
    public getAngularVelocityToRef(body: PhysicsBody, angVel: Vector3, instanceIndex?: number): void {
        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                angVel.set(0, 0, 0);
            } else if (pluginData instanceof PluginBody) {
                pluginData.getAngularVelocityToRef(angVel);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                angVel.set(0, 0, 0);
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                pluginDataInstances.getAngularVelocityToRef(start, angVel);
            }
        }
    }

    public getBodyGeometry(body: PhysicsBody): {} {
        body;
        throw new Error("Method not implemented.");
    }

    /**
     * Disposes a physics body.
     *
     * @param body - The physics body to dispose.
     *
     * This method is useful for releasing the resources associated with a physics body when it is no longer needed.
     * This is important for avoiding memory leaks in the physics engine.
     */
    public disposeBody(body: PhysicsBody): void {
        if (body._pluginData) {
            body._pluginData.dispose();
            body._pluginData = undefined;
        }
        if (body._pluginDataInstances instanceof PluginBodyBundle || body._pluginDataInstances instanceof PluginConstructionInfoList) {
            body._pluginDataInstances.dispose();
            body._pluginDataInstances = [];
        }
    }

    public setCollisionCallbackEnabled(body: PhysicsBody, enabled: boolean, instanceIndex?: number): void {
        body;
        enabled;
        instanceIndex;
        throw new Error("Method not implemented.");
    }

    public setCollisionEndedCallbackEnabled(body: PhysicsBody, enabled: boolean, instanceIndex?: number): void {
        body;
        enabled;
        instanceIndex;
        throw new Error("Method not implemented.");
    }

    public addConstraint(body: PhysicsBody, childBody: PhysicsBody, constraint: PhysicsConstraint, instanceIndex?: number, childInstanceIndex?: number): void {
        body;
        childBody;
        constraint;
        instanceIndex;
        childInstanceIndex;
        throw new Error("Method not implemented.");
    }

    public getCollisionObservable(body: PhysicsBody, instanceIndex?: number): Observable<IPhysicsCollisionEvent> {
        body;
        instanceIndex;
        throw new Error("Method not implemented.");
    }

    public getCollisionEndedObservable(body: PhysicsBody, instanceIndex?: number): Observable<IBasePhysicsCollisionEvent> {
        body;
        instanceIndex;
        throw new Error("Method not implemented.");
    }

    /**
     * Sets the gravity factor of a body
     * @param body the physics body to set the gravity factor for
     * @param factor the gravity factor
     * @param instanceIndex the index of the instance in an instanced body
     */
    public setGravityFactor(body: PhysicsBody, factor: number, instanceIndex?: number): void {
        body;
        factor;
        instanceIndex;
        // there is no support for gravity factor in bullet
        throw new Error("Method not implemented.");
    }

    /**
     * Get the gravity factor of a body
     * @param body the physics body to get the gravity factor from
     * @param instanceIndex the index of the instance in an instanced body. If not specified, the gravity factor of the first instance will be returned.
     * @returns the gravity factor
     */
    public getGravityFactor(body: PhysicsBody, instanceIndex?: number): number {
        body;
        instanceIndex;
        // there is no support for gravity factor in bullet
        throw new Error("Method not implemented.");
    }

    /**
     * Set the target transformation (position and rotation) of the body, such that the body will set its velocity to reach that target
     * @param body The physics body to set the target transformation for.
     * @param position The target position
     * @param rotation The target rotation
     * @param instanceIndex The index of the instance in an instanced body
     */
    public setTargetTransform(body: PhysicsBody, position: Vector3, rotation: Quaternion, instanceIndex?: number): void {
        const tramsformMatrix = Matrix.FromQuaternionToRef(rotation, BulletPlugin._TempMatrix);
        tramsformMatrix.setTranslation(position);

        const pluginData = body._pluginData;
        if (pluginData) {
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.setInitialTransform(tramsformMatrix);
            } else if (pluginData instanceof PluginBody) {
                pluginData.setDynamicTransformMatrix(tramsformMatrix, true);
            }
        }

        const pluginDataInstances = body._pluginDataInstances as any;
        if (!Array.isArray(pluginDataInstances)) {
            const start = instanceIndex ?? 0;
            const end = instanceIndex !== undefined ? instanceIndex + 1 : pluginDataInstances.length;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setInitialTransform(i, tramsformMatrix);
                }
            } else if (pluginDataInstances instanceof PluginBodyBundle) {
                for (let i = start; i < end; ++i) {
                    pluginDataInstances.setDynamicTransformMatrix(i, tramsformMatrix, true);
                }
            }
        }
    }

    /**
     * Initializes a physics shape with the given type and parameters.
     * @param shape - The physics shape to initialize.
     * @param type - The type of shape to initialize.
     * @param options - The parameters for the shape.
     *
     * This code is useful for initializing a physics shape with the given type and parameters.
     * It allows for the creation of a sphere, box, capsule, container, cylinder, mesh, and heightfield.
     * Depending on the type of shape, different parameters are required.
     * For example, a sphere requires a radius, while a box requires extents and a rotation.
     */
    public initShape(shape: PhysicsShape, type: PhysicsShapeType, options: PhysicsShapeParameters): void {
        let pluginData: Nullable<BulletPhysicsShape> = null;

        switch (type) {
        case PhysicsShapeType.SPHERE:
            pluginData = new PluginSphereShape(this.world, options.center, options.radius);
            break;
        case PhysicsShapeType.BOX:
            pluginData = new PluginBoxShape(this.world, options.center, options.rotation, options.extents);
            break;
        case PhysicsShapeType.CAPSULE:
            pluginData = new PluginCapsuleShape(this.world, options.pointA, options.pointB, options.radius);
            break;
        case PhysicsShapeType.CONTAINER:
            // use btCompoundShape
            throw new Error("Container shape not supported.");
            break;
        case PhysicsShapeType.CYLINDER:
            // use btCylinderShape
            throw new Error("Cylinder shape not supported.");
            break;
        case PhysicsShapeType.CONVEX_HULL:
        case PhysicsShapeType.MESH:
            // use btConvexHullShape
            // use btBvhTriangleMeshShape
            throw new Error("Convex hull and mesh shapes not supported.");
            break;
        case PhysicsShapeType.HEIGHTFIELD:
            throw new Error("Heightfield shape not supported.");
            break;
        default:
            throw new Error("Unsupported Shape Type.");
        }

        shape._pluginData = pluginData;
        this._shapeMap.set(pluginData, shape);
    }

    /**
     * Sets the shape filter membership mask of a body
     * @param shape - The physics body to set the shape filter membership mask for.
     * @param membershipMask - The shape filter membership mask to set.
     */
    public setShapeFilterMembershipMask(shape: PhysicsShape, membershipMask: number): void {
        (shape._pluginData as IPluginShape).collisionGroup = membershipMask;
    }

    /**
     * Gets the shape filter membership mask of a body
     * @param shape - The physics body to get the shape filter membership mask from.
     * @returns The shape filter membership mask of the given body.
     */
    public getShapeFilterMembershipMask(shape: PhysicsShape): number {
        return (shape._pluginData as IPluginShape).collisionGroup;
    }

    /**
     * Sets the shape filter collide mask of a body
     * @param shape - The physics body to set the shape filter collide mask for.
     * @param collideMask - The shape filter collide mask to set.
     */
    public setShapeFilterCollideMask(shape: PhysicsShape, collideMask: number): void {
        (shape._pluginData as IPluginShape).collisionMask = collideMask;
    }

    /**
     * Gets the shape filter collide mask of a body
     * @param shape - The physics body to get the shape filter collide mask from.
     * @returns The shape filter collide mask of the given body.
     */
    public getShapeFilterCollideMask(shape: PhysicsShape): number {
        return (shape._pluginData as IPluginShape).collisionMask;
    }

    /**
     * Sets the material of a physics shape.
     * @param shape - The physics shape to set the material of.
     * @param material - The material to set.
     *
     */
    public setMaterial(shape: PhysicsShape, material: PhysicsMaterial): void {
        const dynamicFriction = material.friction ?? 0.5;
        if (material.staticFriction) {
            Logger.Warn("Static friction is not supported in bullet.");
        }
        const restitution = material.restitution ?? 0.0;
        if (material.frictionCombine && material.frictionCombine !== PhysicsMaterialCombineMode.MULTIPLY) {
            Logger.Warn("Friction combine is fixed to MULTIPLY in bullet.");
        }
        if (material.restitutionCombine && material.restitutionCombine !== PhysicsMaterialCombineMode.MULTIPLY) {
            Logger.Warn("Restitution combine is fixed to MULTIPLY in bullet.");
        }

        (shape._pluginData as IPluginShape).setMaterial(dynamicFriction, restitution);
    }

    /**
     * Gets the material associated with a physics shape.
     * @param shape - The shape to get the material from.
     * @returns The material associated with the shape.
     */
    public getMaterial(shape: PhysicsShape): PhysicsMaterial {
        const pluginData = shape._pluginData as IPluginShape;
        const material = pluginData.material;
        return {
            friction: material?.friction,
            restitution: material?.restitution
        };
    }

    /**
     * Sets the density of a physics shape.
     * @param shape - The physics shape to set the density of.
     * @param density - The density to set.
     *
     */
    public setDensity(shape: PhysicsShape, density: number): void {
        shape;
        density;
        // there is no support for setting density in bullet
        throw new Error("Method not implemented.");
    }

    /**
     * Calculates the density of a given physics shape.
     *
     * @param shape - The physics shape to calculate the density of.
     * @returns The density of the given physics shape.
     *
     */
    public getDensity(shape: PhysicsShape): number {
        shape;
        // there is no support for setting density in bullet
        throw new Error("Method not implemented.");
    }

    /**
     * Gets the transform infos of a given transform node.
     * This code is useful for getting the position and orientation of a given transform node.
     * It first checks if the node has a rotation quaternion, and if not, it creates one from the node's rotation.
     * It then creates an array containing the position and orientation of the node and returns it.
     * @param node - The transform node.
     * @returns An array containing the position and orientation of the node.
     */
    private _getTransformInfos(node: TransformNode, result: Matrix): Matrix {
        if (node.parent) {
            const worldMatrix = node.computeWorldMatrix(true);
            return result.copyFrom(worldMatrix);
        }

        let orientation = BulletPlugin._TempQuaternion;
        if (node.rotationQuaternion) {
            orientation = node.rotationQuaternion;
        } else {
            const r = node.rotation;
            Quaternion.FromEulerAnglesToRef(r.x, r.y, r.z, orientation);
        }
        Matrix.FromQuaternionToRef(orientation, result);
        result.setTranslation(node.position);
        return result;
    }

    public addChild(shape: PhysicsShape, newChild: PhysicsShape, translation?: Vector3, rotation?: Quaternion, scale?: Vector3): void {
        shape;
        newChild;
        translation;
        rotation;
        scale;
        throw new Error("Method not implemented.");
    }

    public removeChild(shape: PhysicsShape, childIndex: number): void {
        shape;
        childIndex;
        throw new Error("Method not implemented.");
    }

    public getNumChildren(shape: PhysicsShape): number {
        shape;
        throw new Error("Method not implemented.");
    }

    public getBoundingBox(shape: PhysicsShape): BoundingBox {
        shape;
        throw new Error("Method not implemented.");
    }

    public getBodyBoundingBox(body: PhysicsBody): BoundingBox {
        body;
        throw new Error("Method not implemented.");
    }

    /**
     * Releases a physics shape from the physics engine.
     *
     * @param shape - The physics shape to be released.
     *
     * This method is useful for releasing a physics shape from the physics engine, freeing up resources and preventing memory leaks.
     */
    public disposeShape(shape: PhysicsShape): void {
        const bulletShape = shape._pluginData as BulletPhysicsShape;
        this._shapeMap.delete(bulletShape);
        bulletShape.dispose();
        shape._pluginData = undefined;
    }

    public setTrigger(shape: PhysicsShape, isTrigger: boolean): void {
        shape;
        isTrigger;
        throw new Error("Method not implemented.");
    }

    public initConstraint(constraint: PhysicsConstraint, body: PhysicsBody, childBody: PhysicsBody): void {
        constraint;
        body;
        childBody;
        throw new Error("Method not implemented.");
    }

    public setEnabled(constraint: PhysicsConstraint, isEnabled: boolean): void {
        constraint;
        isEnabled;
        throw new Error("Method not implemented.");
    }

    public getEnabled(constraint: PhysicsConstraint): boolean {
        constraint;
        throw new Error("Method not implemented.");
    }

    public setCollisionsEnabled(constraint: PhysicsConstraint, isEnabled: boolean): void {
        constraint;
        isEnabled;
        throw new Error("Method not implemented.");
    }

    public getCollisionsEnabled(constraint: PhysicsConstraint): boolean {
        constraint;
        throw new Error("Method not implemented.");
    }

    public setAxisFriction(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis, friction: number): void {
        constraint;
        axis;
        friction;
        throw new Error("Method not implemented.");
    }

    public getAxisFriction(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis): Nullable<number> {
        constraint;
        axis;
        throw new Error("Method not implemented.");
    }

    public setAxisMode(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis, limitMode: PhysicsConstraintAxisLimitMode): void {
        constraint;
        axis;
        limitMode;
        throw new Error("Method not implemented.");
    }

    public getAxisMode(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis): Nullable<PhysicsConstraintAxisLimitMode> {
        constraint;
        axis;
        throw new Error("Method not implemented.");
    }

    public setAxisMinLimit(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis, minLimit: number): void {
        constraint;
        axis;
        minLimit;
        throw new Error("Method not implemented.");
    }

    public getAxisMinLimit(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis): Nullable<number> {
        constraint;
        axis;
        throw new Error("Method not implemented.");
    }

    public setAxisMaxLimit(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis, limit: number): void {
        constraint;
        axis;
        limit;
        throw new Error("Method not implemented.");
    }

    public getAxisMaxLimit(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis): Nullable<number> {
        constraint;
        axis;
        throw new Error("Method not implemented.");
    }

    public setAxisMotorType(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis, motorType: PhysicsConstraintMotorType): void {
        constraint;
        axis;
        motorType;
        throw new Error("Method not implemented.");
    }

    public getAxisMotorType(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis): Nullable<PhysicsConstraintMotorType> {
        constraint;
        axis;
        throw new Error("Method not implemented.");
    }

    public setAxisMotorTarget(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis, target: number): void {
        constraint;
        axis;
        target;
        throw new Error("Method not implemented.");
    }

    public getAxisMotorTarget(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis): Nullable<number> {
        constraint;
        axis;
        throw new Error("Method not implemented.");
    }

    public setAxisMotorMaxForce(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis, maxForce: number): void {
        constraint;
        axis;
        maxForce;
        throw new Error("Method not implemented.");
    }

    public getAxisMotorMaxForce(constraint: PhysicsConstraint, axis: PhysicsConstraintAxis): Nullable<number> {
        constraint;
        axis;
        throw new Error("Method not implemented.");
    }

    public disposeConstraint(constraint: PhysicsConstraint): void {
        constraint;
        throw new Error("Method not implemented.");
    }

    public getBodiesUsingConstraint(constraint: PhysicsConstraint): ConstrainedBodyPair[] {
        constraint;
        throw new Error("Method not implemented.");
    }

    public raycast(from: Vector3, to: Vector3, result: PhysicsRaycastResult, query?: IRaycastQuery): void {
        from;
        to;
        result;
        query;
        throw new Error("Method not implemented.");
    }

    /**
     * Dispose the world and free resources
     */
    public dispose(): void {
        const initializedBodies = this._initializedBodies;
        for (let i = 0; i < initializedBodies.length; ++i) {
            const body = initializedBodies[i];

            const pluginData = body._pluginData;
            if (pluginData instanceof PluginBody) {
                this.world.removeRigidBody(pluginData, pluginData.worldId);
                pluginData.dispose();
                body._pluginData = undefined;
            }

            const pluginDataInstances = body._pluginDataInstances;
            if (pluginDataInstances instanceof PluginBodyBundle) {
                this.world.removeRigidBodyBundle(pluginDataInstances, pluginDataInstances.info.worldId);
                pluginDataInstances.dispose();
                body._pluginDataInstances = [];
            }
        }
        this._initializedBodies.length = 0;

        const unInitializedBodies = this._unInitializedBodies;
        for (let i = 0; i < unInitializedBodies.length; ++i) {
            const body = unInitializedBodies[i];

            const pluginData = body._pluginData;
            if (pluginData instanceof PluginConstructionInfo) {
                pluginData.dispose();
                body._pluginData = undefined;
            }

            const pluginDataInstances = body._pluginDataInstances;
            if (pluginDataInstances instanceof PluginConstructionInfoList) {
                pluginDataInstances.dispose();
                body._pluginDataInstances = [];
            }
        }
        this._unInitializedBodies.length = 0;

        const shapeMap = this._shapeMap;
        for (const [bulletShape, shape] of shapeMap) {
            bulletShape.dispose();
            shape._pluginData = undefined;
        }
        shapeMap.clear();

        this.world.dispose();
    }
}
