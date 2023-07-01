import type { Bone, PhysicsBody, PhysicsConstraint, Scene } from "@babylonjs/core";
import { TransformNode } from "@babylonjs/core";

import type { PmxObject } from "@/loader/parser/PmxObject";

import type { ILogger } from "./ILogger";

export class MmdPhysicsModel {
    private readonly _bones: Bone[];
    private readonly _nodes: TransformNode[];
    private readonly _bodies: PhysicsBody[];

    private readonly _constraints: PhysicsConstraint[];

    public constructor(
        bones: Bone[],
        nodes: TransformNode[],
        bodies: PhysicsBody[],
        constraints: PhysicsConstraint[]
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
            bodies[i].dispose();
        }

        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i].dispose();
        }

        this._bones;
    }
}

export class MmdPhysics {
    private readonly _scene: Scene;

    public constructor(scene: Scene) {
        this._scene = scene;
    }

    public buildPhysics(
        bones: Bone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        logger: ILogger
    ): MmdPhysicsModel {
        const nodes: TransformNode[] = [];
        const bodies: PhysicsBody[] = [];
        const constraints: PhysicsConstraint[] = [];

        for (let i = 0; i < rigidBodies.length; ++i) {
            const rigidBody = rigidBodies[i];

            const node = new TransformNode(rigidBody.name, this._scene);
            node;
            joints;
            logger;
        }

        return new MmdPhysicsModel(bones, nodes, bodies, constraints);
    }
}
