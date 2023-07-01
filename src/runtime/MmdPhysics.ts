import type { DeepImmutable, Mesh, PhysicsConstraint, PhysicsShape, Scene } from "@babylonjs/core";
import { Physics6DoFConstraint, PhysicsConstraintAxis } from "@babylonjs/core";
import { Matrix, PhysicsBody, PhysicsMotionType, PhysicsShapeBox, PhysicsShapeCapsule, PhysicsShapeSphere, Quaternion, TransformNode, Vector3 } from "@babylonjs/core";

import { PmxObject } from "@/loader/parser/PmxObject";

import type { ILogger } from "./ILogger";
import type { MmdRuntimeBone } from "./MmdRuntimeBone";

class MmdPhysicsTransformNode extends TransformNode {
    public readonly linkedBone: MmdRuntimeBone;
    public readonly physicsMode: PmxObject.RigidBody.PhysicsMode;
    public readonly bodyOffsetMatrix: Matrix;
    public readonly bodyOffsetInverseMatrix: Matrix;

    public constructor(
        name: string,
        scene: Scene,
        linkedBone: MmdRuntimeBone,
        physicsMode: PmxObject.RigidBody.PhysicsMode,
        isPure?: boolean) {
        super(name, scene, isPure);

        this.linkedBone = linkedBone;
        this.physicsMode = physicsMode;
        this.bodyOffsetMatrix = Matrix.Identity();
        this.bodyOffsetInverseMatrix = Matrix.Identity();
    }

    private static readonly _ParentWorldMatrixInverse = new Matrix();
    private static readonly _WorldMatrix = new Matrix();

    public computeBodyOffsetMatrix(): void {
        const parentWorldMatrixInverse = this.linkedBone.worldMatrix.invertToRef(
            MmdPhysicsTransformNode._ParentWorldMatrixInverse
        );

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

export class MmdPhysicsModel {
    private readonly _mmdPhysics: MmdPhysics;

    private readonly _nodes: readonly (MmdPhysicsTransformNode | null)[];
    private readonly _bodies: readonly (PhysicsBody | null)[];
    private readonly _constraints: readonly (PhysicsConstraint | null)[];

    public constructor(
        mmdPhysics: MmdPhysics,
        nodes: readonly (MmdPhysicsTransformNode | null)[],
        bodies: readonly (PhysicsBody | null)[],
        constraints: readonly (PhysicsConstraint | null)[]
    ) {
        this._mmdPhysics = mmdPhysics;

        this._nodes = nodes;
        this._bodies = bodies;
        this._constraints = constraints;
    }

    public dispose(): void {
        const constraints = this._constraints;
        for (let i = 0; i < constraints.length; ++i) {
            constraints[i]?.dispose();
        }

        const bodies = this._bodies;
        for (let i = 0; i < bodies.length; ++i) {
            const body = bodies[i];
            if (body === null) continue;

            body.shape!.dispose();
            body.dispose();
        }

        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i]?.dispose();
        }
    }

    private static readonly _NodeWorldMatrix = new Matrix();
    private static readonly _ZeroVector: DeepImmutable<Vector3> = Vector3.Zero();

    public initialize(): void {
        const mmdPhysics = this._mmdPhysics;
        const nodes = this._nodes;

        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            if (node === null) continue;

            const nodeWorldMatrix = node.bodyOffsetMatrix.multiplyToRef(
                node.linkedBone.worldMatrix,
                MmdPhysicsModel._NodeWorldMatrix
            );
            nodeWorldMatrix.decompose(
                node.scaling,
                node.rotationQuaternion!,
                node.position
            );

            const body = node.physicsBody!;
            body.setAngularVelocity(MmdPhysicsModel._ZeroVector);
            body.setLinearVelocity(MmdPhysicsModel._ZeroVector);

            mmdPhysics.enablePreStepOnce(node.physicsBody!);
        }
    }

    public syncBodies(): void {
        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            if (node === null) continue;

            switch (node.physicsMode) {
            case PmxObject.RigidBody.PhysicsMode.FollowBone:
                {
                    const nodeWorldMatrix = node.bodyOffsetMatrix.multiplyToRef(
                        node.linkedBone.worldMatrix,
                        MmdPhysicsModel._NodeWorldMatrix
                    );
                    nodeWorldMatrix.decompose(
                        node.scaling,
                        node.rotationQuaternion!,
                        node.position
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

    public syncBones(): void {
        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            if (node === null) continue;

            switch (node.physicsMode) {
            case PmxObject.RigidBody.PhysicsMode.FollowBone:
                break;
            case PmxObject.RigidBody.PhysicsMode.Physics:
                {
                    node.bodyOffsetInverseMatrix.multiplyToRef(
                        Matrix.ComposeToRef(
                            node.scaling,
                            node.rotationQuaternion!,
                            node.position,
                            MmdPhysicsModel._NodeWorldMatrix
                        ),
                        node.linkedBone.worldMatrix
                    );

                    const childBones = node.linkedBone.childBones;
                    for (let j = 0; j < childBones.length; ++j) {
                        childBones[j].updateWorldMatrix();
                    }
                }
                break;

            case PmxObject.RigidBody.PhysicsMode.PhysicsWithBone:
                {
                    node.bodyOffsetInverseMatrix.multiplyToRef(
                        Matrix.ComposeToRef(
                            node.scaling,
                            node.rotationQuaternion!,
                            node.linkedBone.worldMatrix.getTranslationToRef(MmdPhysicsModel._BoneWorldPosition),
                            MmdPhysicsModel._NodeWorldMatrix
                        ),
                        node.linkedBone.worldMatrix
                    );

                    const childBones = node.linkedBone.childBones;
                    for (let j = 0; j < childBones.length; ++j) {
                        childBones[j].updateWorldMatrix();
                    }
                }
                break;

            default:
                throw new Error(`Unknown physics mode: ${node.physicsMode}`);
            }
        }
    }
}

export class MmdPhysics {
    private readonly _scene: Scene;

    private readonly _enablePreStepOnces: PhysicsBody[] = [];

    public constructor(scene: Scene) {
        this._scene = scene;
    }

    public buildPhysics(
        mesh: Mesh,
        bones: readonly MmdRuntimeBone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        logger: ILogger
    ): MmdPhysicsModel {
        const scene = this._scene;

        const nodes: (MmdPhysicsTransformNode | null)[] = [];
        const bodies: (PhysicsBody | null)[] = [];
        const constraints: (PhysicsConstraint | null)[] = [];

        for (let i = 0; i < rigidBodies.length; ++i) {
            const rigidBody = rigidBodies[i];

            if (rigidBody.boneIndex < 0 || bones.length <= rigidBody.boneIndex) {
                logger.warn(`Bone index out of range failed to create rigid body: ${rigidBody.name}`);

                nodes.push(null);
                bodies.push(null);
                continue;
            }
            const bone = bones[rigidBody.boneIndex];

            let shape: PhysicsShape;
            switch (rigidBody.shapeType) {
            case PmxObject.RigidBody.ShapeType.Sphere:
                shape = new PhysicsShapeSphere(new Vector3(), rigidBody.shapeSize[0], scene);
                break;

            case PmxObject.RigidBody.ShapeType.Box:
                shape = new PhysicsShapeBox(new Vector3(), new Quaternion(),
                    new Vector3(
                        rigidBody.shapeSize[0] * 2,
                        rigidBody.shapeSize[1] * 2,
                        rigidBody.shapeSize[2] * 2
                    ), scene
                );
                break;

            case PmxObject.RigidBody.ShapeType.Capsule:
                shape = new PhysicsShapeCapsule(
                    new Vector3(0, rigidBody.shapeSize[1] / 2, 0),
                    new Vector3(0, -rigidBody.shapeSize[1] / 2, 0),
                    rigidBody.shapeSize[0],
                    scene
                );
                break;

            default:
                logger.warn(`Unknown rigid body shape type: ${rigidBody.shapeType}`);

                nodes.push(null);
                bodies.push(null);
                continue;
            }
            shape.material = {
                friction: rigidBody.friction,
                restitution: rigidBody.repulsion
            };

            const node = new MmdPhysicsTransformNode(rigidBody.name, scene, bone, rigidBody.physicsMode);

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

            node.computeBodyOffsetMatrix();
            node.setParent(mesh);

            const motionType = rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone
                ? PhysicsMotionType.ANIMATED
                : PhysicsMotionType.DYNAMIC;

            const body = new PhysicsBody(node, motionType, false, scene);
            body.shape = shape;
            body.setMassProperties({ mass: rigidBody.mass });
            body.setLinearDamping(rigidBody.linearDamping);
            body.setAngularDamping(rigidBody.angularDamping);
            if (motionType === PhysicsMotionType.ANIMATED) {
                body.disablePreStep = false;
            }

            nodes.push(node);
            bodies.push(body);
        }

        const jointRotation = new Matrix();
        const jointTransform = new Matrix();

        const rigidBodyRotation = new Matrix();
        const rigidBodyAInverse = new Matrix();
        const rigidBodyBInverse = new Matrix();

        const jointFinalTransformA = new Matrix();
        const jointFinalTransformB = new Matrix();

        for (let i = 0; i < joints.length; ++i) {
            const joint = joints[i];

            if (joint.rigidbodyIndexA < 0 || rigidBodies.length <= joint.rigidbodyIndexA) {
                logger.warn(`Rigid body index out of range failed to create joint: ${joint.name}`);

                constraints.push(null);
                continue;
            }

            if (joint.rigidbodyIndexB < 0 || rigidBodies.length <= joint.rigidbodyIndexB) {
                logger.warn(`Rigid body index out of range failed to create joint: ${joint.name}`);

                constraints.push(null);
                continue;
            }

            const bodyA = bodies[joint.rigidbodyIndexA];
            const bodyB = bodies[joint.rigidbodyIndexB];

            if (bodyA === null || bodyB === null) {
                logger.warn(`Rigid body not found failed to create joint: ${joint.name}`);

                constraints.push(null);
                continue;
            }

            Matrix.IdentityToRef(jointTransform);
            jointTransform.setTranslationFromFloats(
                joint.position[0],
                joint.position[1],
                joint.position[2]
            );
            Matrix.RotationYawPitchRollToRef(
                joint.rotation[1],
                joint.rotation[0],
                joint.rotation[2],
                jointRotation
            );
            jointTransform.multiplyToRef(jointRotation, jointTransform);

            const bodyInfoA = rigidBodies[joint.rigidbodyIndexA];
            const bodyInfoB = rigidBodies[joint.rigidbodyIndexB];

            {
                const shapeRotation = bodyInfoA.shapeRotation;
                const shapePosition = bodyInfoA.shapePosition;

                Matrix.IdentityToRef(rigidBodyAInverse);
                rigidBodyAInverse.setTranslationFromFloats(
                    shapePosition[0],
                    shapePosition[1],
                    shapePosition[2]
                );
                Matrix.RotationYawPitchRollToRef(
                    shapeRotation[1],
                    shapeRotation[0],
                    shapeRotation[2],
                    rigidBodyRotation
                );
                rigidBodyAInverse.multiplyToRef(rigidBodyRotation, rigidBodyAInverse);
                rigidBodyAInverse.invert();
            }

            {
                const shapeRotation = bodyInfoB.shapeRotation;
                const shapePosition = bodyInfoB.shapePosition;

                Matrix.IdentityToRef(rigidBodyBInverse);
                rigidBodyBInverse.setTranslationFromFloats(
                    shapePosition[0],
                    shapePosition[1],
                    shapePosition[2]
                );
                Matrix.RotationYawPitchRollToRef(
                    shapeRotation[1],
                    shapeRotation[0],
                    shapeRotation[2],
                    rigidBodyRotation
                );
                rigidBodyBInverse.multiplyToRef(rigidBodyRotation, rigidBodyBInverse);
                rigidBodyBInverse.invert();
            }

            rigidBodyAInverse.multiplyToRef(jointTransform, jointFinalTransformA);
            rigidBodyBInverse.multiplyToRef(jointTransform, jointFinalTransformB);

            const constraint = new Physics6DoFConstraint(
                {
                    pivotA: jointFinalTransformA.getTranslation(),
                    pivotB: jointFinalTransformB.getTranslation(),
                    axisA: new Vector3(
                        jointFinalTransformA.m[8],
                        jointFinalTransformA.m[9],
                        jointFinalTransformA.m[10]
                    ),
                    axisB: new Vector3(
                        jointFinalTransformB.m[8],
                        jointFinalTransformB.m[9],
                        jointFinalTransformB.m[10]
                    ),
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
                    collision: bodyInfoA.collisionGroup !== bodyInfoB.collisionGroup
                },
                [
                    {
                        axis: PhysicsConstraintAxis.LINEAR_X,
                        minLimit: joint.positionMin[0],
                        maxLimit: joint.positionMax[0]
                    },
                    {
                        axis: PhysicsConstraintAxis.LINEAR_Y,
                        minLimit: joint.positionMin[1],
                        maxLimit: joint.positionMax[1]
                    },
                    {
                        axis: PhysicsConstraintAxis.LINEAR_Z,
                        minLimit: joint.positionMin[2],
                        maxLimit: joint.positionMax[2]
                    },
                    {
                        axis: PhysicsConstraintAxis.ANGULAR_X,
                        minLimit: joint.rotationMin[0],
                        maxLimit: joint.rotationMax[0]
                    },
                    {
                        axis: PhysicsConstraintAxis.ANGULAR_Y,
                        minLimit: joint.rotationMin[1],
                        maxLimit: joint.rotationMax[1]
                    },
                    {
                        axis: PhysicsConstraintAxis.ANGULAR_Z,
                        minLimit: joint.rotationMin[2],
                        maxLimit: joint.rotationMax[2]
                    }
                ],
                scene
            );

            bodyA.addConstraint(bodyB, constraint);

            constraints.push(constraint);
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

    public enablePreStepOnce(body: PhysicsBody): void {
        if (!body.disablePreStep) return;

        if (this._enablePreStepOnces.length === 0) {
            this._scene.onAfterPhysicsObservable.addOnce(this._onAfterPhysics);
        }

        this._enablePreStepOnces.push(body);
        body.disablePreStep = false;
    }
}
