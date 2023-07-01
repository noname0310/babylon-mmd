import type { PhysicsConstraint, Scene } from "@babylonjs/core";
import { Matrix, PhysicsBody, PhysicsMotionType, TransformNode } from "@babylonjs/core";

import { PmxObject } from "@/loader/parser/PmxObject";

import type { ILogger } from "./ILogger";
import type { MmdRuntimeBone } from "./MmdRuntimeBone";

class MmdPhysicsTransformNode extends TransformNode {
    public boneLocalMatrix: Matrix;

    public constructor(name: string, scene: Scene, isPure?: boolean) {
        super(name, scene, isPure);

        this.boneLocalMatrix = Matrix.Identity();
    }

    public computeBoneLocalMatrix(bone: MmdRuntimeBone): void {
        const worldMatrix = this.getWorldMatrix();
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
        bones: readonly MmdRuntimeBone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        logger: ILogger
    ): MmdPhysicsModel {
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

            const node = new MmdPhysicsTransformNode(rigidBody.name, this._scene);

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

            nodes.push(node);

            const motionType = rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone
                ? PhysicsMotionType.ANIMATED
                : PhysicsMotionType.DYNAMIC;

            const body = new PhysicsBody(
                node,
                motionType,
                false,
                this._scene
            );

            body.setMassProperties({
                mass: rigidBody.mass
                /**
                 * The principal moments of inertia of this object
                 * for a unit mass. This determines how easy it is
                 * for the body to rotate. A value of zero on any
                 * axis will be used as infinite interia about that
                 * axis.
                 *
                 * If not provided, the physics engine will compute
                 * an appropriate value.
                 */
                // inertia?: Vector3;
                /**
                 * The rotation rotating from inertia major axis space
                 * to parent space (i.e., the rotation which, when
                 * applied to the 3x3 inertia tensor causes the inertia
                 * tensor to become a diagonal matrix). This determines
                 * how the values of inertia are aligned with the parent
                 * object.
                 *
                 * If not provided, the physics engine will compute
                 * an appropriate value.
                 */
                // inertiaOrientation?: Quaternion;
            });


        }

        joints;

        return new MmdPhysicsModel(bones, nodes, bodies, constraints);
    }
}
