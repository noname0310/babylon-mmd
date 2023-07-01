import type { Mesh, PhysicsConstraint, PhysicsShape, Scene } from "@babylonjs/core";
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

    private readonly _constraints: readonly PhysicsConstraint[];

    public constructor(
        bones: readonly MmdRuntimeBone[],
        nodes: readonly MmdPhysicsTransformNode[],
        bodies: readonly (PhysicsBody | null)[],
        constraints: readonly PhysicsConstraint[]
    ) {
        this._bones = bones;
        this._nodes = nodes;
        this._bodies = bodies;
        this._constraints = constraints;
    }

    public dispose(): void {
        const constraints = this._constraints;
        for (let i = 0; i < constraints.length; ++i) {
            constraints[i].dispose();
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
        const constraints: PhysicsConstraint[] = [];

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

            const node = new MmdPhysicsTransformNode(rigidBody.name, scene);

            const shapePosition = rigidBody.shapePosition;
            node.position.copyFromFloats(
                shapePosition[0],
                shapePosition[1],
                shapePosition[2]
            );

            node.rotation.copyFromFloats(
                rigidBody.shapeRotation[0],
                rigidBody.shapeRotation[1],
                rigidBody.shapeRotation[2]
            );

            node.computeBoneLocalMatrix(bone);
            node.setParent(mesh);

            nodes.push(node);

            const motionType = rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone
                ? PhysicsMotionType.ANIMATED
                : PhysicsMotionType.DYNAMIC;

            const body = new PhysicsBody(node, motionType, false, scene);

            body.setMassProperties({ mass: rigidBody.mass });
            body.shape = shape;
        }

        joints;

        return new MmdPhysicsModel(bones, nodes, bodies, constraints);
    }
}
