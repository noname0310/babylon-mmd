import "@babylonjs/core/Physics/v2/physicsEngineComponent";

import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ILogger } from "../../ILogger";
import type { IMmdRuntimeBone } from "../../IMmdRuntimeBone";
import type { MmdModelPhysicsCreationOptions } from "../../mmdRuntime";
import type { IMmdPhysics, IMmdPhysicsModel } from "../../Physics/IMmdPhysics";
import type { Constraint } from "./Bind/constraint";
import { ConstraintParams, Generic6DofSpringConstraint, MmdGeneric6DofSpringConstraint } from "./Bind/constraint";
import type { IPhysicsRuntime } from "./Bind/Impl/IPhysicsRuntime";
import type { MultiPhysicsRuntime } from "./Bind/Impl/multiPhysicsRuntime";
import { MotionType } from "./Bind/motionType";
import type { PhysicsShape } from "./Bind/physicsShape";
import { PhysicsBoxShape, PhysicsCapsuleShape, PhysicsSphereShape } from "./Bind/physicsShape";
import type { BulletPlugin } from "./Bind/Plugin/bulletPlugin";
import { RigidBodyBundle } from "./Bind/rigidBodyBundle";
import { RigidBodyConstructionInfoList } from "./Bind/rigidBodyConstructionInfoList";

class MmdRigidBodyData {
    public readonly linkedBone: Nullable<IMmdRuntimeBone>;
    public physicsMode: PmxObject.RigidBody.PhysicsMode;
    public readonly bodyOffsetMatrix: Matrix;
    public readonly bodyOffsetMatrixInverse: Matrix;

    public constructor(
        linkedBone: Nullable<IMmdRuntimeBone>,
        physicsMode: PmxObject.RigidBody.PhysicsMode
    ) {
        this.linkedBone = linkedBone;
        this.physicsMode = physicsMode;
        this.bodyOffsetMatrix = Matrix.Identity();
        this.bodyOffsetMatrixInverse = Matrix.Identity();
    }
    public computeBodyOffsetMatrix(worldMatrix: DeepImmutable<Matrix>, parentWorldMatrixInverse: DeepImmutable<Matrix>): void {
        worldMatrix.multiplyToRef(parentWorldMatrixInverse, this.bodyOffsetMatrix);
        this.bodyOffsetMatrix.invertToRef(this.bodyOffsetMatrixInverse);
    }
}

class MmdRigidBodyBundle extends RigidBodyBundle {
    public readonly rigidBodyData: MmdRigidBodyData[];
    public constructor(
        runtime: IPhysicsRuntime,
        info: RigidBodyConstructionInfoList,
        data: MmdRigidBodyData[],
        count: number
    ) {
        super(runtime, info, count);
        this.rigidBodyData = data;
    }
}

/**
 * MMD bullet physics model is container of the bullet physics resources of the MMD model
 */
export class MmdBulletPhysicsModel implements IMmdPhysicsModel {
    private readonly _physicsRuntime: MultiPhysicsRuntime;
    private readonly _worldId: number;
    private readonly _kinematicSharedWorldIds: readonly number[];
    private readonly _rigidBodyIndexMap: Int32Array;
    private _bundle: Nullable<MmdRigidBodyBundle>;
    private readonly _constraints: Nullable<Constraint>[];

    /**
     * Create a new MMD bullet physics model
     * @param physicsRuntime The physics runtime
     * @param worldId The world id
     * @param kinematicSharedWorldIds The kinematic shared world ids
     * @param rigidBodyIndexMap The rigid body index map
     * @param bundle Rigid body bundle
     * @param constraints Physics constraints
     */
    public constructor(
        physicsRuntime: MultiPhysicsRuntime,
        worldId: number,
        kinematicSharedWorldIds: readonly number[],
        rigidBodyIndexMap: Int32Array,
        bundle: MmdRigidBodyBundle,
        constraints: Nullable<Constraint>[]
    ) {
        this._physicsRuntime = physicsRuntime;
        this._worldId = worldId;
        this._kinematicSharedWorldIds = kinematicSharedWorldIds;
        this._rigidBodyIndexMap = rigidBodyIndexMap;
        this._bundle = bundle;
        this._constraints = constraints;

        physicsRuntime.addRigidBodyBundle(bundle, worldId);
        for (let i = 0; i < kinematicSharedWorldIds.length; ++i) {
            const kinematicWorldId = kinematicSharedWorldIds[i];
            if (kinematicWorldId !== worldId) {
                physicsRuntime.addRigidBodyBundleShadow(bundle, kinematicWorldId);
            }
        }

        for (let i = 0; i < constraints.length; ++i) {
            const constraint = constraints[i];
            if (constraint === null) continue;
            physicsRuntime.addConstraint(constraint, worldId, false);
        }
    }

    /**
     * Dispose the physics resources
     */
    public dispose(): void {
        const physicsRuntime = this._physicsRuntime;
        const worldId = this._worldId;
        const kinematicSharedWorldIds = this._kinematicSharedWorldIds;

        const constraints = this._constraints;
        for (let i = 0; i < constraints.length; ++i) {
            const constraint = constraints[i];
            if (constraint === null) continue;
            physicsRuntime.removeConstraint(constraint, worldId);
            constraint.dispose();
        }
        constraints.length = 0;

        const bundle = this._bundle;
        if (bundle !== null) {
            for (let i = 0; i < kinematicSharedWorldIds.length; ++i) {
                const kinematicWorldId = kinematicSharedWorldIds[i];
                if (kinematicWorldId !== worldId) {
                    physicsRuntime.removeRigidBodyBundleShadow(bundle, kinematicWorldId);
                }
            }
            physicsRuntime.removeRigidBodyBundle(bundle, worldId);

            for (let i = 0; i < bundle.count; ++i) {
                const shape = bundle.getShape(i);
                shape.dispose();
            }
            bundle.dispose();
            this._bundle = null;
        }
    }

    private static readonly _BodyWorldMatrix = new Matrix();
    // private static readonly _ZeroVector: DeepImmutable<Vector3> = Vector3.Zero();

    /**
     * Reset the rigid body positions and velocities
     */
    public initialize(): void {
        const rigidBodyIndexMap = this._rigidBodyIndexMap;
        const bundle = this._bundle;
        if (bundle === null) return;

        for (let i = 0; i < rigidBodyIndexMap.length; ++i) {
            const index = rigidBodyIndexMap[i];
            if (index === -1) continue;

            const data = bundle.rigidBodyData[index];
            if (data.linkedBone === null) continue;

            const bodyWorldMatrix = data.linkedBone.getWorldMatrixToRef(MmdBulletPhysicsModel._BodyWorldMatrix);
            data.bodyOffsetMatrix.multiplyToRef(bodyWorldMatrix, bodyWorldMatrix);
            bundle.setTransformMatrix(index, bodyWorldMatrix);

            // bundle.setAngularVelocity(index, MmdBulletPhysicsModel._ZeroVector);
            // bundle.setLinearVelocity(index, MmdBulletPhysicsModel._ZeroVector);
        }
    }

    /**
     * Set the rigid bodies transform to the bones transform
     */
    public syncBodies(): void {
        const rigidBodyIndexMap = this._rigidBodyIndexMap;
        const bundle = this._bundle;
        if (bundle === null) return;

        for (let i = 0; i < rigidBodyIndexMap.length; ++i) {
            const index = rigidBodyIndexMap[i];
            if (index === -1) continue;

            const data = bundle.rigidBodyData[index];
            if (data.linkedBone === null) continue;

            switch (data.physicsMode) {
            case PmxObject.RigidBody.PhysicsMode.FollowBone:
                {
                    const bodyWorldMatrix = data.linkedBone.getWorldMatrixToRef(MmdBulletPhysicsModel._BodyWorldMatrix);
                    data.bodyOffsetMatrix.multiplyToRef(bodyWorldMatrix, bodyWorldMatrix);
                    bundle.setTransformMatrix(index, bodyWorldMatrix);
                }
                break;

            case PmxObject.RigidBody.PhysicsMode.Physics:
            case PmxObject.RigidBody.PhysicsMode.PhysicsWithBone:
                break;

            default:
                throw new Error(`Unknown physics mode: ${data.physicsMode}`);
            }
        }
    }

    private static readonly _BoneWorldPosition = new Vector3();

    /**
     * Set the bones transform to the rigid bodies transform
     */
    public syncBones(): void {
        const rigidBodyIndexMap = this._rigidBodyIndexMap;
        const bundle = this._bundle;
        if (bundle === null) return;

        for (let i = 0; i < rigidBodyIndexMap.length; ++i) {
            const index = rigidBodyIndexMap[i];
            if (index === -1) continue;

            const data = bundle.rigidBodyData[index];
            if (data.linkedBone === null) continue;

            switch (data.physicsMode) {
            case PmxObject.RigidBody.PhysicsMode.FollowBone:
                break;
            case PmxObject.RigidBody.PhysicsMode.Physics:
                {
                    data.bodyOffsetMatrixInverse.multiplyToArray(
                        bundle.getTransformMatrixToRef(index, MmdBulletPhysicsModel._BodyWorldMatrix),
                        data.linkedBone.worldMatrix,
                        0
                    );
                }
                break;

            case PmxObject.RigidBody.PhysicsMode.PhysicsWithBone:
                {
                    data.linkedBone.getWorldTranslationToRef(MmdBulletPhysicsModel._BoneWorldPosition);
                    data.bodyOffsetMatrixInverse.multiplyToArray(
                        bundle.getTransformMatrixToRef(index, MmdBulletPhysicsModel._BodyWorldMatrix),
                        data.linkedBone.worldMatrix,
                        0
                    );
                    data.linkedBone.setWorldTranslation(MmdBulletPhysicsModel._BoneWorldPosition);
                }
                break;

            default:
                throw new Error(`Unknown physics mode: ${data.physicsMode}`);
            }
        }
    }
}

/**
 * Use the bullet physics engine to build the physics model of the MMD model
 *
 * If you do not want to use a physics engine, you can reduce the bundling size by not import this class
 */
export class MmdBulletPhysics implements IMmdPhysics {
    /**
     * The world id of the physics model
     *
     * when you not specify the world id, the physics model will be created in new world
     */
    public nextWorldId: number;

    private readonly _sceneOrRuntime: Scene | MultiPhysicsRuntime;

    /**
     * Create a new MMD bullet physics
     *
     * Scene must have a physics engine enabled
     * @param sceneOrRuntime The scene or the physics runtime to build the physics model
     */
    public constructor(sceneOrRuntime: Scene | MultiPhysicsRuntime) {
        this.nextWorldId = 0;

        this._sceneOrRuntime = sceneOrRuntime;
    }

    /**
     * Build the physics model of the MMD model
     * @param rootMesh Root mesh of the MMD model
     * @param bones MMD runtime bones
     * @param rigidBodies rigid bodies information
     * @param joints joints information
     * @param logger Logger
     * @param physicsOptions Optional physics options
     * @returns MMD physics model
     * @throws If the physics model cannot be built
     */
    public buildPhysics(
        rootMesh: Mesh,
        bones: readonly IMmdRuntimeBone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        logger: ILogger,
        physicsOptions: Nullable<MmdModelPhysicsCreationOptions>
    ): IMmdPhysicsModel {
        let validatedWorldId = physicsOptions?.worldId;
        if (validatedWorldId !== undefined) {
            if (validatedWorldId < 0 || 0xFFFFFFFF < validatedWorldId) {
                logger.warn(`WorldId ${validatedWorldId} is out of range`);
                validatedWorldId = this.nextWorldId;
                this.nextWorldId += 1;
            }
        } else {
            validatedWorldId = this.nextWorldId;
            this.nextWorldId += 1;
        }
        const validatedKinematicSharedWorldIds = [];
        if (physicsOptions !== null && physicsOptions.kinematicSharedWorldIds !== undefined) {
            const kinematicSharedWorldIds = new Set(physicsOptions.kinematicSharedWorldIds);
            for (const kinematicWorldId of kinematicSharedWorldIds) {
                if (kinematicWorldId === validatedWorldId) {
                    logger.warn(`Kinematic shared worldId ${kinematicWorldId} is same as worldId`);
                } else if (kinematicWorldId < 0 || 0xFFFFFFFF < kinematicWorldId) {
                    logger.warn(`Kinematic shared worldId ${kinematicWorldId} is out of range`);
                } else {
                    validatedKinematicSharedWorldIds.push(kinematicWorldId);
                }
            }
        }
        const forceDisableOffsetForConstraintFrame = physicsOptions?.forceDisableOffsetForConstraintFrame ?? false;

        const scene = (this._sceneOrRuntime as Scene).getPhysicsEngine
            ? (this._sceneOrRuntime as Scene)
            : undefined;

        const physicsPlugin = scene?.getPhysicsEngine()?.getPhysicsPlugin();
        if (scene !== undefined) {
            if (!physicsPlugin) {
                throw new Error("Physics engine is not enabled");
            }
            if (physicsPlugin.name !== "BulletPlugin") {
                throw new Error("Physics engine is not BulletPlugin");
            }
        }
        const physicsRuntime = physicsPlugin
            ? (physicsPlugin as BulletPlugin).world
            : (this._sceneOrRuntime as MultiPhysicsRuntime);

        let scalingFactor: number;
        rootMesh.computeWorldMatrix(true);
        const worldMatrix = rootMesh.getWorldMatrix();
        const worldRotation = new Quaternion();
        {
            const worldScale = new Vector3();
            worldMatrix.decompose(worldScale, worldRotation);
            if (Math.abs(worldScale.x - worldScale.y) < 0.0001 && Math.abs(worldScale.y - worldScale.z) < 0.0001) {
                if (Math.abs(worldScale.x - 1.0) < 0.0001) {
                    scalingFactor = 1;
                } else {
                    scalingFactor = worldScale.x;
                    logger.warn("Root node scaling is not 1, simulation may differ from the original");
                }
            } else {
                scalingFactor = Math.max(worldScale.x, worldScale.y, worldScale.z);
                logger.warn("Root node scaling is not uniform, physics may not work correctly");
            }
        }

        const rigidBodyIndexMap = new Int32Array(rigidBodies.length).fill(-1);

        const rbInfoList = new RigidBodyConstructionInfoList(physicsRuntime.wasmInstance, rigidBodies.length);
        const rbDataList: MmdRigidBodyData[] = [];

        const boneNameMap = new Map<string, IMmdRuntimeBone>();
        for (let i = 0; i < bones.length; ++i) {
            const bone = bones[i];
            boneNameMap.set(bone.name, bone);
        }
        const resolveRigidBodyBone = (rigidBody: PmxObject.RigidBody): IMmdRuntimeBone | undefined => {
            if (rigidBody.boneIndex < 0 || bones.length <= rigidBody.boneIndex) {
                return boneNameMap.get(rigidBody.name);
            }
            return bones[rigidBody.boneIndex];
        };

        const initialTransformMatrix = new Matrix();
        const initialPosition = new Vector3();
        const initialRotation = new Quaternion();
        const one: DeepImmutable<Vector3> = Vector3.One();
        for (let i = 0; i < rigidBodies.length; ++i) {
            const rigidBody = rigidBodies[i];

            const bone = resolveRigidBodyBone(rigidBody);
            if (bone === undefined) {
                logger.warn(`Bone index out of range create unmapped rigid body: ${rigidBody.name}`);
            }

            let shape: PhysicsShape;
            let isZeroVolume = false;
            switch (rigidBody.shapeType) {
            case PmxObject.RigidBody.ShapeType.Sphere:
                shape = new PhysicsSphereShape(physicsRuntime, rigidBody.shapeSize[0] * scalingFactor);
                if (rigidBody.shapeSize[0] === 0) isZeroVolume = true;
                break;

            case PmxObject.RigidBody.ShapeType.Box:
                shape = new PhysicsBoxShape(
                    physicsRuntime,
                    new Vector3(
                        rigidBody.shapeSize[0] * scalingFactor,
                        rigidBody.shapeSize[1] * scalingFactor,
                        rigidBody.shapeSize[2] * scalingFactor
                    )
                );
                if (rigidBody.shapeSize[0] === 0 || rigidBody.shapeSize[1] === 0 || rigidBody.shapeSize[2] === 0) isZeroVolume = true;
                break;

            case PmxObject.RigidBody.ShapeType.Capsule:
                shape = new PhysicsCapsuleShape(
                    physicsRuntime,
                    rigidBody.shapeSize[0] * scalingFactor,
                    rigidBody.shapeSize[1] * scalingFactor
                );
                if (rigidBody.shapeSize[0] === 0 || rigidBody.shapeSize[1] === 0) isZeroVolume = true;
                break;

            default:
                logger.warn(`Unknown rigid body shape type: ${rigidBody.shapeType}`);
                continue;
            }

            const index = rbDataList.length;
            rbInfoList.setShape(index, shape);

            const shapePosition = rigidBody.shapePosition;
            initialPosition.copyFromFloats(
                shapePosition[0] * scalingFactor,
                shapePosition[1] * scalingFactor,
                shapePosition[2] * scalingFactor
            );
            const shapeRotation = rigidBody.shapeRotation;
            Quaternion.FromEulerAnglesToRef(
                shapeRotation[0],
                shapeRotation[1],
                shapeRotation[2],
                initialRotation
            );
            Matrix.ComposeToRef(
                one,
                initialRotation,
                initialPosition,
                initialTransformMatrix
            );

            const rbData = new MmdRigidBodyData(
                bone ?? null,
                rigidBody.physicsMode
            );

            if (bone !== undefined) {
                rbData.computeBodyOffsetMatrix(
                    initialTransformMatrix,
                    bone.linkedBone.getAbsoluteInverseBindMatrix()
                );
            }

            // then convert the body transform to world space
            Vector3.TransformCoordinatesToRef(initialPosition, worldMatrix, initialPosition);
            worldRotation.multiplyToRef(initialRotation, initialRotation);

            Matrix.ComposeToRef(
                one,
                initialRotation,
                initialPosition,
                initialTransformMatrix
            );
            rbInfoList.setInitialTransform(
                index,
                initialTransformMatrix
            );

            const motionType = rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone
                ? MotionType.Kinematic
                : MotionType.Dynamic;
            rbInfoList.setMotionType(index, motionType);

            rbInfoList.setMass(index, rigidBody.mass);
            rbInfoList.setLinearDamping(index, rigidBody.linearDamping);
            rbInfoList.setAngularDamping(index, rigidBody.angularDamping);
            rbInfoList.setFriction(index, rigidBody.friction);
            rbInfoList.setRestitution(index, rigidBody.repulsion);
            rbInfoList.setCollisionGroup(index, 1 << rigidBody.collisionGroup);
            rbInfoList.setCollisionMask(index, rigidBody.collisionMask);
            rbInfoList.setAdditionalDamping(index, true);
            rbInfoList.setNoContactResponse(index, isZeroVolume);
            rbInfoList.setDisableDeactivation(index, true);

            rigidBodyIndexMap[i] = rbDataList.length;
            rbDataList.push(rbData);
        }

        const bundle = new MmdRigidBodyBundle(physicsRuntime, rbInfoList, rbDataList, rbDataList.length);

        const constraints: Nullable<Constraint>[] = new Array(joints.length);

        const jointRotation = new Quaternion();
        const jointPosition = new Vector3();
        const jointTransform = new Matrix();

        const rigidBodyRotation = new Quaternion();
        const rigidBodyPosition = new Vector3();
        const rigidBodyAInverse = new Matrix();
        const rigidBodyBInverse = new Matrix();

        const jointFinalTransformA = new Matrix();
        const jointFinalTransformB = new Matrix();

        for (let i = 0; i < joints.length; ++i) {
            const joint = joints[i];

            if (joint.rigidbodyIndexA < 0 || rigidBodies.length <= joint.rigidbodyIndexA) {
                logger.warn(`Rigid body index out of range failed to create joint: ${joint.name}`);

                constraints[i] = null;
                continue;
            }

            if (joint.rigidbodyIndexB < 0 || rigidBodies.length <= joint.rigidbodyIndexB) {
                logger.warn(`Rigid body index out of range failed to create joint: ${joint.name}`);

                constraints[i] = null;
                continue;
            }

            const bodyAIndex = rigidBodyIndexMap[joint.rigidbodyIndexA] ?? -1;
            const bodyBIndex = rigidBodyIndexMap[joint.rigidbodyIndexB] ?? -1;

            if (bodyAIndex === -1 || bodyBIndex === -1) {
                logger.warn(`Rigid body not found failed to create joint: ${joint.name}`);

                constraints[i] = null;
                continue;
            }

            Matrix.ComposeToRef(
                one,
                Quaternion.FromEulerAnglesToRef(
                    joint.rotation[0],
                    joint.rotation[1],
                    joint.rotation[2],
                    jointRotation
                ),
                jointPosition.copyFromFloats(
                    joint.position[0] * scalingFactor,
                    joint.position[1] * scalingFactor,
                    joint.position[2] * scalingFactor
                ),
                jointTransform
            );

            const bodyInfoA = rigidBodies[joint.rigidbodyIndexA];
            const bodyInfoB = rigidBodies[joint.rigidbodyIndexB];

            {
                const shapeRotation = bodyInfoA.shapeRotation;
                const shapePosition = bodyInfoA.shapePosition;

                Matrix.ComposeToRef(
                    one,
                    Quaternion.FromEulerAnglesToRef(
                        shapeRotation[0],
                        shapeRotation[1],
                        shapeRotation[2],
                        rigidBodyRotation
                    ),
                    rigidBodyPosition.copyFromFloats(
                        shapePosition[0] * scalingFactor,
                        shapePosition[1] * scalingFactor,
                        shapePosition[2] * scalingFactor
                    ),
                    rigidBodyAInverse
                ).invert();
            }

            {
                const shapeRotation = bodyInfoB.shapeRotation;
                const shapePosition = bodyInfoB.shapePosition;

                Matrix.ComposeToRef(
                    one,
                    Quaternion.FromEulerAnglesToRef(
                        shapeRotation[0],
                        shapeRotation[1],
                        shapeRotation[2],
                        rigidBodyRotation
                    ),
                    rigidBodyPosition.copyFromFloats(
                        shapePosition[0] * scalingFactor,
                        shapePosition[1] * scalingFactor,
                        shapePosition[2] * scalingFactor
                    ),
                    rigidBodyBInverse
                ).invert();
            }

            jointTransform.multiplyToRef(rigidBodyAInverse, jointFinalTransformA);
            jointTransform.multiplyToRef(rigidBodyBInverse, jointFinalTransformB);

            const constraintCtor = forceDisableOffsetForConstraintFrame
                ? MmdGeneric6DofSpringConstraint
                : Generic6DofSpringConstraint;
            const constraint = new constraintCtor(
                physicsRuntime,
                bundle,
                [bodyAIndex, bodyBIndex],
                jointFinalTransformA,
                jointFinalTransformB,
                true
            );
            for (let i = 0; i < 6; ++i) {
                constraint.setParam(ConstraintParams.ConstraintStopERP, 0.475, i);
            }

            const limitVector = new Vector3();

            limitVector.fromArray(joint.positionMin);
            constraint.setLinearLowerLimit(limitVector);

            limitVector.fromArray(joint.positionMax);
            constraint.setLinearUpperLimit(limitVector);

            limitVector.fromArray(joint.rotationMin);
            constraint.setAngularLowerLimit(limitVector);

            limitVector.fromArray(joint.rotationMax);
            constraint.setAngularUpperLimit(limitVector);

            if (joint.springPosition[0] !== 0) {
                constraint.setStiffness(0, joint.springPosition[0]);
                constraint.enableSpring(0, true);
            } else {
                constraint.enableSpring(0, false);
            }

            if (joint.springPosition[1] !== 0) {
                constraint.setStiffness(1, joint.springPosition[1]);
                constraint.enableSpring(1, true);
            } else {
                constraint.enableSpring(1, false);
            }

            if (joint.springPosition[2] !== 0) {
                constraint.setStiffness(2, joint.springPosition[2]);
                constraint.enableSpring(2, true);
            } else {
                constraint.enableSpring(2, false);
            }

            constraint.setStiffness(3, joint.springRotation[0]);
            constraint.enableSpring(3, true);
            constraint.setStiffness(4, joint.springRotation[1]);
            constraint.enableSpring(4, true);
            constraint.setStiffness(5, joint.springRotation[2]);
            constraint.enableSpring(5, true);

            constraints[i] = constraint;

            // adjust the physics mode of the rigid bodies
            // ref: https://web.archive.org/web/20140815111315/www20.atpages.jp/katwat/wp/?p=4135
            const nodeA = bundle.rigidBodyData[bodyAIndex];
            const nodeB = bundle.rigidBodyData[bodyBIndex];

            if (nodeA.physicsMode !== PmxObject.RigidBody.PhysicsMode.FollowBone &&
                nodeB.physicsMode === PmxObject.RigidBody.PhysicsMode.PhysicsWithBone
            ) { // case: A is parent of B
                const runtimeBoneB = resolveRigidBodyBone(bodyInfoB);
                if (runtimeBoneB !== undefined) {
                    if (runtimeBoneB.parentBone === resolveRigidBodyBone(bodyInfoA)) {
                        nodeB.physicsMode = PmxObject.RigidBody.PhysicsMode.Physics;
                    }
                }
            } else if (nodeB.physicsMode !== PmxObject.RigidBody.PhysicsMode.FollowBone &&
                nodeA.physicsMode === PmxObject.RigidBody.PhysicsMode.PhysicsWithBone
            ) { // case: B is parent of A
                const runtimeBoneA = resolveRigidBodyBone(bodyInfoA);
                if (runtimeBoneA !== undefined) {
                    if (runtimeBoneA.parentBone === resolveRigidBodyBone(bodyInfoB)) {
                        nodeA.physicsMode = PmxObject.RigidBody.PhysicsMode.Physics;
                    }
                }
            }
        }

        return new MmdBulletPhysicsModel(
            physicsRuntime,
            validatedWorldId,
            validatedKinematicSharedWorldIds,
            rigidBodyIndexMap,
            bundle,
            constraints
        );
    }
}
