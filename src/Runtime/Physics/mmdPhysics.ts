import "@babylonjs/core/Physics/v2/physicsEngineComponent";

import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsActivationControl, PhysicsConstraintAxis, PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import type { Physics6DoFLimit, PhysicsConstraint } from "@babylonjs/core/Physics/v2/physicsConstraint";
import { Physics6DoFConstraint } from "@babylonjs/core/Physics/v2/physicsConstraint";
import type { PhysicsShape } from "@babylonjs/core/Physics/v2/physicsShape";
import { PhysicsShapeBox, PhysicsShapeCapsule, PhysicsShapeSphere } from "@babylonjs/core/Physics/v2/physicsShape";
import type { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { Scene } from "@babylonjs/core/scene";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ILogger } from "../ILogger";
import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import type { IMmdPhysics, IMmdPhysicsModel } from "./IMmdPhysics";

class MmdPhysicsTransformNode extends TransformNode {
    public readonly linkedBone: Nullable<IMmdRuntimeBone>;
    public physicsMode: PmxObject.RigidBody.PhysicsMode;
    public readonly bodyOffsetMatrix: Matrix;
    public readonly bodyOffsetInverseMatrix: Matrix;

    public constructor(
        name: string,
        scene: Scene,
        linkedBone: Nullable<IMmdRuntimeBone>,
        physicsMode: PmxObject.RigidBody.PhysicsMode,
        isPure?: boolean
    ) {
        super(name, scene, isPure);

        this.linkedBone = linkedBone;
        this.physicsMode = physicsMode;
        this.bodyOffsetMatrix = Matrix.Identity();
        this.bodyOffsetInverseMatrix = Matrix.Identity();
    }

    private static readonly _WorldMatrix = new Matrix();

    public computeBodyOffsetMatrix(parentWorldMatrixInverse: DeepImmutable<Matrix>): void {
        const worldMatrix = Matrix.ComposeToRef(
            this.scaling,
            this.rotationQuaternion!,
            this.position,
            MmdPhysicsTransformNode._WorldMatrix
        );

        worldMatrix.multiplyToRef(parentWorldMatrixInverse, this.bodyOffsetMatrix);
        this.bodyOffsetMatrix.invertToRef(this.bodyOffsetInverseMatrix);
    }
}

class MmdPhysicsBody extends PhysicsBody {
    public readonly linkedBone: IMmdRuntimeBone;

    public constructor(
        transformNode: MmdPhysicsTransformNode,
        motionType: PhysicsMotionType,
        startAsleep: boolean,
        linkedBone: IMmdRuntimeBone,
        scene: Scene
    ) {
        super(transformNode, motionType, startAsleep, scene);

        this.linkedBone = linkedBone;
    }
}

/**
 * MMD physics model is container of the physics resources of the MMD model
 */
export class MmdPhysicsModel implements IMmdPhysicsModel {
    private readonly _mmdPhysics: MmdPhysics;

    private readonly _nodes: Nullable<MmdPhysicsTransformNode>[];
    private readonly _bodies: Nullable<PhysicsBody>[];
    private readonly _constraints: Nullable<PhysicsConstraint>[];

    /**
     * Create a new MMD physics model
     * @param mmdPhysics MMD physics
     * @param nodes MMD physics transform nodes
     * @param bodies Physics bodies
     * @param constraints Physics constraints
     */
    public constructor(
        mmdPhysics: MmdPhysics,
        nodes: Nullable<MmdPhysicsTransformNode>[],
        bodies: Nullable<PhysicsBody>[],
        constraints: Nullable<PhysicsConstraint>[]
    ) {
        this._mmdPhysics = mmdPhysics;

        this._nodes = nodes;
        this._bodies = bodies;
        this._constraints = constraints;
    }

    /**
     * Dispose the physics resources
     */
    public dispose(): void {
        const constraints = this._constraints;
        for (let i = 0; i < constraints.length; ++i) {
            constraints[i]?.dispose();
        }
        constraints.length = 0;

        const bodies = this._bodies;
        for (let i = 0; i < bodies.length; ++i) {
            const body = bodies[i];
            if (body === null) continue;

            body.shape?.dispose();
            body.dispose();
        }
        bodies.length = 0;

        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i]?.dispose();
        }
        nodes.length = 0;
    }

    private static readonly _NodeWorldMatrix = new Matrix();
    private static readonly _ZeroVector: DeepImmutable<Vector3> = Vector3.Zero();

    /**
     * Reset the rigid body positions and velocities
     */
    public initialize(): void {
        const mmdPhysics = this._mmdPhysics;
        const nodes = this._nodes;

        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            if (node === null) continue;
            if (node.linkedBone === null) continue;

            const nodeWorldMatrix = node.linkedBone.getWorldMatrixToRef(MmdPhysicsModel._NodeWorldMatrix);
            node.bodyOffsetMatrix.multiplyToRef(nodeWorldMatrix, nodeWorldMatrix);
            nodeWorldMatrix.decompose(
                node.scaling,
                node.rotationQuaternion!,
                node.position
            );

            const body = node.physicsBody!;
            body.setAngularVelocity(MmdPhysicsModel._ZeroVector);
            body.setLinearVelocity(MmdPhysicsModel._ZeroVector);

            mmdPhysics._enablePreStepOnce(body);
        }
    }

    private static readonly _NodeWorldPosition = new Vector3();
    private static readonly _NodeWorldRotation = new Quaternion();

    /**
     * Set the rigid bodies transform to the bones transform
     */
    public syncBodies(): void {
        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            if (node === null) continue;
            if (node.linkedBone === null) continue;

            switch (node.physicsMode) {
            case PmxObject.RigidBody.PhysicsMode.FollowBone:
                {
                    const nodeWorldMatrix = node.linkedBone.getWorldMatrixToRef(MmdPhysicsModel._NodeWorldMatrix);
                    node.bodyOffsetMatrix.multiplyToRef(nodeWorldMatrix, nodeWorldMatrix);
                    nodeWorldMatrix.decompose(
                        node.scaling,
                        node.rotationQuaternion!,
                        node.position
                    );

                    node.computeWorldMatrix(true).decompose(
                        undefined,
                        MmdPhysicsModel._NodeWorldRotation,
                        MmdPhysicsModel._NodeWorldPosition
                    );

                    node.physicsBody!.setTargetTransform(
                        MmdPhysicsModel._NodeWorldPosition,
                        MmdPhysicsModel._NodeWorldRotation
                    );
                }
                break;

            case PmxObject.RigidBody.PhysicsMode.Physics:
            case PmxObject.RigidBody.PhysicsMode.PhysicsWithBone:
                break;

            default:
                throw new Error(`Unknown physics mode: ${node.physicsMode}`);
            }
        }
    }

    private static readonly _BoneWorldPosition = new Vector3();

    /**
     * Set the bones transform to the rigid bodies transform
     */
    public syncBones(): void {
        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            if (node === null) continue;
            if (node.linkedBone === null) continue;

            switch (node.physicsMode) {
            case PmxObject.RigidBody.PhysicsMode.FollowBone:
                break;
            case PmxObject.RigidBody.PhysicsMode.Physics:
                {
                    node.bodyOffsetInverseMatrix.multiplyToArray(
                        Matrix.ComposeToRef(
                            node.scaling,
                            node.rotationQuaternion!,
                            node.position,
                            MmdPhysicsModel._NodeWorldMatrix
                        ),
                        node.linkedBone.worldMatrix,
                        0
                    );
                }
                break;

            case PmxObject.RigidBody.PhysicsMode.PhysicsWithBone:
                {
                    node.linkedBone.getWorldTranslationToRef(MmdPhysicsModel._BoneWorldPosition);
                    node.bodyOffsetInverseMatrix.multiplyToArray(
                        Matrix.ComposeToRef(
                            node.scaling,
                            node.rotationQuaternion!,
                            MmdPhysicsModel._ZeroVector,
                            MmdPhysicsModel._NodeWorldMatrix
                        ),
                        node.linkedBone.worldMatrix,
                        0
                    );
                    node.linkedBone.setWorldTranslationFromRef(MmdPhysicsModel._BoneWorldPosition);
                }
                break;

            default:
                throw new Error(`Unknown physics mode: ${node.physicsMode}`);
            }
        }
    }
}

/**
 * Use the v2 physics engine to build the physics model of the MMD model
 *
 * If you do not want to use a physics engine, you can reduce the bundling size by not import this class
 */
export class MmdPhysics implements IMmdPhysics {
    /**
     * Set a threshold in radian to clamp the constraint's angular limit to 0 (default: 5 * Math.PI / 180)
     *
     * If your model's constraints have an odd bend, try increasing the value appropriately.
     *
     * A value of 5 * Math.PI / 180  to 30 * Math.PI / 180 is expected to work well.
     */
    public angularLimitClampThreshold: number;

    private readonly _scene: Scene;

    private readonly _enablePreStepOnces: PhysicsBody[] = [];

    /**
     * Create a new MMD physics
     *
     * Scene must have a physics engine enabled
     * @param scene The scene to build the physics model
     */
    public constructor(scene: Scene) {
        this.angularLimitClampThreshold = 5 * Math.PI / 180;

        this._scene = scene;
    }

    // ref: https://forum.babylonjs.com/t/convert-bullet-physics-damping-values-correctly-for-havok/43264/3
    private _convertParameter(parameter: number): number {
        const timeStep = 1 / 60;
        return (1 - (1 - parameter) ** timeStep) / timeStep;
    }

    // it seems havok 6dof constraint does not work well with small angular limits
    // TODO: investigate why
    private _clampAngularLimit(limit: number): number {
        return Math.abs(limit) < this.angularLimitClampThreshold
            ? 0
            : limit;
    }

    /**
     * Build the physics model of the MMD model
     * @param rootMesh Root mesh of the MMD model
     * @param bones MMD runtime bones
     * @param rigidBodies rigid bodies information
     * @param joints joints information
     * @param logger Logger
     * @returns MMD physics model
     * @throws If the havok physics engine is not enabled
     */
    public buildPhysics(
        rootMesh: Mesh,
        bones: readonly IMmdRuntimeBone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        logger: ILogger
    ): MmdPhysicsModel {
        const scene = this._scene;
        const physicsPlugin = scene.getPhysicsEngine()?.getPhysicsPlugin() as HavokPlugin | null | undefined;
        if (!physicsPlugin) {
            throw new Error("Physics engine is not enabled");
        }
        if (physicsPlugin.name !== "HavokPlugin") {
            throw new Error("Physics plugin is not HavokPlugin");
        }

        let scalingFactor: number;
        {
            rootMesh.computeWorldMatrix(true);
            const worldMatrix = rootMesh.getWorldMatrix();
            const worldScale = new Vector3();
            worldMatrix.decompose(worldScale);
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

        const nodes: Nullable<MmdPhysicsTransformNode>[] = new Array(rigidBodies.length);
        const bodies: Nullable<MmdPhysicsBody | PhysicsBody>[] = new Array(rigidBodies.length);
        const constraints: Nullable<PhysicsConstraint>[] = new Array(joints.length);

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
                shape = new PhysicsShapeSphere(new Vector3(), rigidBody.shapeSize[0] * scalingFactor, scene);
                if (rigidBody.shapeSize[0] === 0) isZeroVolume = true;
                break;

            case PmxObject.RigidBody.ShapeType.Box:
                shape = new PhysicsShapeBox(new Vector3(), new Quaternion(),
                    new Vector3(
                        rigidBody.shapeSize[0] * 2 * scalingFactor,
                        rigidBody.shapeSize[1] * 2 * scalingFactor,
                        rigidBody.shapeSize[2] * 2 * scalingFactor
                    ), scene
                );
                if (rigidBody.shapeSize[0] === 0 || rigidBody.shapeSize[1] === 0 || rigidBody.shapeSize[2] === 0) isZeroVolume = true;
                break;

            case PmxObject.RigidBody.ShapeType.Capsule:
                shape = new PhysicsShapeCapsule(
                    new Vector3(0, rigidBody.shapeSize[1] / 2 * scalingFactor, 0),
                    new Vector3(0, -rigidBody.shapeSize[1] / 2 * scalingFactor, 0),
                    rigidBody.shapeSize[0] * scalingFactor,
                    scene
                );
                if (rigidBody.shapeSize[0] === 0 || rigidBody.shapeSize[1] === 0) isZeroVolume = true;
                break;

            default:
                logger.warn(`Unknown rigid body shape type: ${rigidBody.shapeType}`);

                nodes[i] = null;
                bodies[i] = null;
                continue;
            }
            shape.material = {
                friction: rigidBody.friction,
                restitution: rigidBody.repulsion
            };
            shape.filterCollideMask = isZeroVolume ? 0 : rigidBody.collisionMask;
            shape.filterMembershipMask = 1 << rigidBody.collisionGroup;

            const node = new MmdPhysicsTransformNode(rigidBody.name, scene, bone ?? null, rigidBody.physicsMode);

            const shapePosition = rigidBody.shapePosition;
            node.position.copyFromFloats(
                shapePosition[0],
                shapePosition[1],
                shapePosition[2]
            );

            const shapeRotation = rigidBody.shapeRotation;
            node.rotationQuaternion = Quaternion.FromEulerAngles(
                shapeRotation[0],
                shapeRotation[1],
                shapeRotation[2]
            );

            if (bone !== undefined) {
                node.computeBodyOffsetMatrix(bone.linkedBone.getAbsoluteInverseBindMatrix());
            }
            node.setParent(rootMesh);

            const motionType = rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone
                ? PhysicsMotionType.ANIMATED
                : PhysicsMotionType.DYNAMIC;

            const body = bone !== undefined
                ? new MmdPhysicsBody(node, motionType, false, bone, scene)
                : new PhysicsBody(node, motionType, false, scene);
            physicsPlugin.setActivationControl(body, PhysicsActivationControl.ALWAYS_ACTIVE);
            body.shape = shape;
            body.setMassProperties({ mass: rigidBody.mass });

            body.setLinearDamping(this._convertParameter(rigidBody.linearDamping));
            body.setAngularDamping(this._convertParameter(rigidBody.angularDamping));
            body.computeMassProperties();

            nodes[i] = node;
            bodies[i] = body;
        }

        const one: DeepImmutable<Vector3> = Vector3.One();
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

            const bodyA = bodies[joint.rigidbodyIndexA];
            const bodyB = bodies[joint.rigidbodyIndexB];

            if (bodyA === null || bodyB === null) {
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

            // TODO: not sure that convert also applies to joints
            const damping = this._convertParameter(1);

            const limits: Physics6DoFLimit[] = [
                {
                    axis: PhysicsConstraintAxis.LINEAR_X,
                    minLimit: joint.positionMin[0],
                    maxLimit: joint.positionMax[0],
                    stiffness: this._convertParameter(joint.springPosition[0]),
                    damping: damping
                },
                {
                    axis: PhysicsConstraintAxis.LINEAR_Y,
                    minLimit: joint.positionMin[1],
                    maxLimit: joint.positionMax[1],
                    stiffness: this._convertParameter(joint.springPosition[1]),
                    damping: damping
                },
                {
                    axis: PhysicsConstraintAxis.LINEAR_Z,
                    minLimit: joint.positionMin[2],
                    maxLimit: joint.positionMax[2],
                    stiffness: this._convertParameter(joint.springPosition[2]),
                    damping: damping
                },
                {
                    axis: PhysicsConstraintAxis.ANGULAR_X,
                    minLimit: this._clampAngularLimit(joint.rotationMin[0]),
                    maxLimit: this._clampAngularLimit(joint.rotationMax[0]),
                    stiffness: this._convertParameter(joint.springRotation[0]),
                    damping: damping
                },
                {
                    axis: PhysicsConstraintAxis.ANGULAR_Y,
                    minLimit: this._clampAngularLimit(joint.rotationMin[1]),
                    maxLimit: this._clampAngularLimit(joint.rotationMax[1]),
                    stiffness: this._convertParameter(joint.springRotation[1]),
                    damping: damping
                },
                {
                    axis: PhysicsConstraintAxis.ANGULAR_Z,
                    minLimit: this._clampAngularLimit(joint.rotationMin[2]),
                    maxLimit: this._clampAngularLimit(joint.rotationMax[2]),
                    stiffness: this._convertParameter(joint.springRotation[2]),
                    damping: damping
                }
            ];
            for (let j = 0; j < 3; ++j) {
                const limit = limits[j];
                if (limit.stiffness === 0) {
                    limit.stiffness = undefined;
                    limit.damping = undefined;
                }
            }

            const constraint = new Physics6DoFConstraint(
                {
                    pivotA: jointFinalTransformA.getTranslation(),
                    pivotB: jointFinalTransformB.getTranslation(),

                    axisA: new Vector3(
                        jointFinalTransformA.m[0],
                        jointFinalTransformA.m[1],
                        jointFinalTransformA.m[2]
                    ).negateInPlace(),
                    axisB: new Vector3(
                        jointFinalTransformB.m[0],
                        jointFinalTransformB.m[1],
                        jointFinalTransformB.m[2]
                    ).negateInPlace(),
                    perpAxisA: new Vector3(
                        jointFinalTransformA.m[4],
                        jointFinalTransformA.m[5],
                        jointFinalTransformA.m[6]
                    ),
                    perpAxisB: new Vector3(
                        jointFinalTransformB.m[4],
                        jointFinalTransformB.m[5],
                        jointFinalTransformB.m[6]
                    ),
                    collision: true
                },
                limits,
                scene
            );

            bodyA.addConstraint(bodyB, constraint);

            constraints[i] = constraint;

            // adjust the physics mode of the rigid bodies
            // ref: https://web.archive.org/web/20140815111315/www20.atpages.jp/katwat/wp/?p=4135
            const nodeA = nodes[joint.rigidbodyIndexA]!;
            const nodeB = nodes[joint.rigidbodyIndexB]!;

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

        return new MmdPhysicsModel(this, nodes, bodies, constraints);
    }

    private readonly _onAfterPhysics = (): void => {
        const enablePreStepOnces = this._enablePreStepOnces;
        for (let i = 0; i < enablePreStepOnces.length; ++i) {
            enablePreStepOnces[i].disablePreStep = true;
        }
        enablePreStepOnces.length = 0;
    };

    /** @internal */
    public _enablePreStepOnce(body: PhysicsBody): void {
        if (!body.disablePreStep) return;

        if (this._enablePreStepOnces.length === 0) {
            this._scene.onAfterPhysicsObservable.addOnce(this._onAfterPhysics);
        }

        this._enablePreStepOnces.push(body);
        body.disablePreStep = false;
    }
}
