import type { DeepImmutable, Mesh, PhysicsConstraint, PhysicsShape, Scene } from "@babylonjs/core";
import { Physics6DoFConstraint, PhysicsConstraintAxis } from "@babylonjs/core";
import { Matrix, PhysicsBody, PhysicsMotionType, PhysicsShapeBox, PhysicsShapeCapsule, PhysicsShapeSphere, Quaternion, TransformNode, Vector3 } from "@babylonjs/core";

import { PmxObject } from "@/loader/parser/PmxObject";

import type { ILogger } from "./ILogger";
import type { MmdRuntimeBone } from "./MmdRuntimeBone";

class MmdPhysicsTransformNode extends TransformNode {
    public boneLocalMatrix: Matrix;

    public constructor(name: string, scene: Scene, isPure?: boolean) {
        super(name, scene, isPure);

        this.boneLocalMatrix = Matrix.Identity();
    }

    private static readonly _WorldMatrix = Matrix.Identity();

    public computeBoneLocalMatrix(bone: MmdRuntimeBone): void {
        const worldMatrix = Matrix.ComposeToRef(
            this.scaling,
            Quaternion.RotationYawPitchRoll(
                this.rotation.y,
                this.rotation.x,
                this.rotation.z
            ),
            this.position,
            MmdPhysicsTransformNode._WorldMatrix
        );
        const parentWorldMatrix = bone.worldMatrix;

        parentWorldMatrix.invertToRef(this.boneLocalMatrix);
        this.boneLocalMatrix.multiplyToRef(worldMatrix, this.boneLocalMatrix);
    }
}

export class MmdPhysicsModel {
    private readonly _bones: readonly MmdRuntimeBone[];
    private readonly _nodes: readonly MmdPhysicsTransformNode[];
    private readonly _bodies: readonly (PhysicsBody | null)[];

    private readonly _constraints: readonly (PhysicsConstraint | null)[];

    public constructor(
        bones: readonly MmdRuntimeBone[],
        nodes: readonly MmdPhysicsTransformNode[],
        bodies: readonly (PhysicsBody | null)[],
        constraints: readonly (PhysicsConstraint | null)[]
    ) {
        this._bones = bones;
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
            bodies[i]?.dispose();
        }

        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i].dispose();
        }

        this._bones;
    }

    public initialize(): void {
        //
    }
}

export class MmdPhysics {
    private readonly _scene: Scene;

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

        const nodes: MmdPhysicsTransformNode[] = [];
        const bodies: (PhysicsBody | null)[] = [];
        const constraints: (PhysicsConstraint | null)[] = [];

        for (let i = 0; i < rigidBodies.length; ++i) {
            const rigidBody = rigidBodies[i];

            if (rigidBody.boneIndex < 0 || bones.length <= rigidBody.boneIndex) {
                logger.warn(`Bone index out of range failed to create rigid body: ${rigidBody.name}`);
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
                        rigidBody.shapeSize[0],
                        rigidBody.shapeSize[1],
                        rigidBody.shapeSize[2]
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
                continue;
            }
            shape.material = {
                friction: rigidBody.friction,
                restitution: rigidBody.repulsion
            };

            const node = new MmdPhysicsTransformNode(rigidBody.name, scene);

            const shapePosition = rigidBody.shapePosition;
            node.position.copyFromFloats(
                shapePosition[0],
                shapePosition[1],
                shapePosition[2]
            );

            const shapeRotation = rigidBody.shapeRotation;
            node.rotation.copyFromFloats(
                shapeRotation[0],
                shapeRotation[1],
                shapeRotation[2]
            );

            node.computeBoneLocalMatrix(bone);
            node.setParent(mesh);

            nodes.push(node);

            const motionType = rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone
                ? PhysicsMotionType.ANIMATED
                : PhysicsMotionType.DYNAMIC;

            const body = new PhysicsBody(node, motionType, false, scene);
            body.shape = shape;
            body.setMassProperties({ mass: rigidBody.mass });
            body.setLinearDamping(rigidBody.linearDamping);
            body.setAngularDamping(rigidBody.angularDamping);

            bodies.push(body);
        }

        const jointPosition = new Vector3();
        const jointRotation = new Quaternion();
        const oneScale: DeepImmutable<Vector3> = new Vector3(1, 1, 1);
        const jointTransform = new Matrix();

        const rigidBodyPosition = new Vector3();
        const rigidBodyRotation = new Quaternion();
        const rigidBodyAInverse = new Matrix();
        const rigidBodyBInverse = new Matrix();

        const jointFinalTransformA = new Matrix();
        const jointFinalTransformB = new Matrix();

        for (let i = 0; i < joints.length; ++i) {
            const joint = joints[i];

            if (joint.rigidbodyIndexA < 0 || rigidBodies.length <= joint.rigidbodyIndexA) {
                logger.warn(`Rigid body index out of range failed to create joint: ${joint.name}`);
                continue;
            }

            if (joint.rigidbodyIndexB < 0 || rigidBodies.length <= joint.rigidbodyIndexB) {
                logger.warn(`Rigid body index out of range failed to create joint: ${joint.name}`);
                continue;
            }

            const bodyA = bodies[joint.rigidbodyIndexA];
            const bodyB = bodies[joint.rigidbodyIndexB];

            if (bodyA === null || bodyB === null) {
                logger.warn(`Rigid body not found failed to create joint: ${joint.name}`);
                continue;
            }

            Matrix.ComposeToRef(
                oneScale,
                Quaternion.RotationYawPitchRollToRef(
                    joint.rotation[1],
                    joint.rotation[0],
                    joint.rotation[2],
                    jointRotation
                ),
                jointPosition.copyFromFloats(
                    joint.position[0],
                    joint.position[1],
                    joint.position[2]
                ),
                jointTransform
            );

            const bodyInfoA = rigidBodies[joint.rigidbodyIndexA];
            const bodyInfoB = rigidBodies[joint.rigidbodyIndexB];

            {
                const shapePosition = bodyInfoA.shapePosition;
                const shapeRotation = bodyInfoA.shapeRotation;
                Matrix.ComposeToRef(
                    oneScale,
                    Quaternion.RotationYawPitchRollToRef(
                        shapeRotation[1],
                        shapeRotation[0],
                        shapeRotation[2],
                        rigidBodyRotation
                    ),
                    rigidBodyPosition.copyFromFloats(
                        shapePosition[0],
                        shapePosition[1],
                        shapePosition[2]
                    ),
                    rigidBodyAInverse
                );
                rigidBodyAInverse.invert();
            }

            {
                const shapePosition = bodyInfoB.shapePosition;
                const shapeRotation = bodyInfoB.shapeRotation;
                Matrix.ComposeToRef(
                    oneScale,
                    Quaternion.RotationYawPitchRollToRef(
                        shapeRotation[1],
                        shapeRotation[0],
                        shapeRotation[2],
                        rigidBodyRotation
                    ),
                    rigidBodyPosition.copyFromFloats(
                        shapePosition[0],
                        shapePosition[1],
                        shapePosition[2]
                    ),
                    rigidBodyBInverse
                );
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

        return new MmdPhysicsModel(bones, nodes, bodies, constraints);
    }
}
