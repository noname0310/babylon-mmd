import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";

import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PhysicsImpostor, type PhysicsImpostorParameters } from "@babylonjs/core/Physics/v1/physicsImpostor";
import type { Scene } from "@babylonjs/core/scene";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ILogger } from "../ILogger";
import type { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import type { IMmdPhysics, IMmdPhysicsModel } from "./IMmdPhysics";
import type { MmdAmmoJSPlugin } from "./mmdAmmoJSPlugin";

class MmdPhysicsMesh extends AbstractMesh {
    public readonly linkedBone: IMmdRuntimeBone;
    public physicsMode: PmxObject.RigidBody.PhysicsMode;
    public readonly bodyOffsetMatrix: Matrix;
    public readonly bodyOffsetInverseMatrix: Matrix;

    public constructor(
        name: string,
        scene: Scene,
        linkedBone: IMmdRuntimeBone,
        physicsMode: PmxObject.RigidBody.PhysicsMode
    ) {
        super(name, scene);

        this.linkedBone = linkedBone;
        this.physicsMode = physicsMode;
        this.bodyOffsetMatrix = Matrix.Identity();
        this.bodyOffsetInverseMatrix = Matrix.Identity();
    }

    private static readonly _ParentWorldMatrixInverse = new Matrix();
    private static readonly _WorldMatrix = new Matrix();

    public computeBodyOffsetMatrix(): void {
        const parentWorldMatrixInverse = this.linkedBone.getWorldMatrixToRef(
            MmdPhysicsMesh._ParentWorldMatrixInverse
        ).invert();

        const worldMatrix = Matrix.ComposeToRef(
            this.scaling,
            this.rotationQuaternion!,
            this.position,
            MmdPhysicsMesh._WorldMatrix
        );

        worldMatrix.multiplyToRef(parentWorldMatrixInverse, this.bodyOffsetMatrix);
        this.bodyOffsetMatrix.invertToRef(this.bodyOffsetInverseMatrix);
    }
}

interface AmmoPhysicsImpostorParameters extends PhysicsImpostorParameters {
    group: number;
    mask: number;
}

class NonMeshPhysicsImpostor extends PhysicsImpostor {
    private static _ObjectExtent: Vector3;
    private readonly _objectExtent: Vector3;

    private constructor(
        object: MmdPhysicsMesh,
        type: number,
        options: AmmoPhysicsImpostorParameters,
        objectExtent: Vector3,
        scene: Scene
    ) {
        super(object, type, options, scene);
        this._objectExtent = objectExtent;
    }

    public static Create(
        object: MmdPhysicsMesh,
        type: number,
        options: AmmoPhysicsImpostorParameters,
        objectExtent: Vector3,
        scene: Scene
    ): NonMeshPhysicsImpostor {
        NonMeshPhysicsImpostor._ObjectExtent = objectExtent;
        return new NonMeshPhysicsImpostor(object, type, options, objectExtent, scene);
    }

    public override getObjectExtents(): Vector3 {
        return this._objectExtent ?? NonMeshPhysicsImpostor._ObjectExtent;
    }

    public override getObjectCenter(): Vector3 {
        return this.object.position;
    }
}

/**
 * MMD ammo physics model is container of the ammo.js physics resources of the MMD model
 */
export class MmdAmmoPhysicsModel implements IMmdPhysicsModel {
    private readonly _mmdPhysics: MmdAmmoPhysics;

    private readonly _nodes: readonly Nullable<MmdPhysicsMesh>[];
    private readonly _impostors: readonly Nullable<PhysicsImpostor>[];

    /**
     * Create a new MMD ammo.js physics model
     * @param mmdPhysics MMD ammo physics
     * @param nodes MMD physics transform nodes
     * @param impostors Physics impostors
     */
    public constructor(
        mmdPhysics: MmdAmmoPhysics,
        nodes: readonly Nullable<MmdPhysicsMesh>[],
        impostors: readonly Nullable<PhysicsImpostor>[]
    ) {
        this._mmdPhysics = mmdPhysics;

        this._nodes = nodes;
        this._impostors = impostors;
    }

    /**
     * Dispose the physics resources
     */
    public dispose(): void {
        const impostors = this._impostors;
        for (let i = 0; i < impostors.length; ++i) {
            const impostor = impostors[i];
            if (impostor === null) continue;
            impostor.dispose();
        }

        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            nodes[i]?.dispose(false, true);
        }
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

            const nodeWorldMatrix = node.linkedBone.getWorldMatrixToRef(MmdAmmoPhysicsModel._NodeWorldMatrix);
            node.bodyOffsetMatrix.multiplyToRef(nodeWorldMatrix, nodeWorldMatrix);
            nodeWorldMatrix.decompose(
                node.scaling,
                node.rotationQuaternion!,
                node.position
            );

            const impostor = node.physicsImpostor!;
            impostor.setAngularVelocity(MmdAmmoPhysicsModel._ZeroVector);
            impostor.setLinearVelocity(MmdAmmoPhysicsModel._ZeroVector);

            mmdPhysics._enablePreStepOnce(impostor);
        }
    }

    /**
     * Set the rigid bodies transform to the bones transform
     */
    public syncBodies(): void {
        const nodes = this._nodes;
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            if (node === null) continue;

            switch (node.physicsMode) {
            case PmxObject.RigidBody.PhysicsMode.FollowBone:
                {
                    const nodeWorldMatrix = node.linkedBone.getWorldMatrixToRef(MmdAmmoPhysicsModel._NodeWorldMatrix);
                    node.bodyOffsetMatrix.multiplyToRef(nodeWorldMatrix, nodeWorldMatrix);
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

    /**
     * Set the bones transform to the rigid bodies transform
     */
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
                    node.bodyOffsetInverseMatrix.multiplyToArray(
                        Matrix.ComposeToRef(
                            node.scaling,
                            node.rotationQuaternion!,
                            node.position,
                            MmdAmmoPhysicsModel._NodeWorldMatrix
                        ),
                        node.linkedBone.worldMatrix,
                        0
                    );

                    const childBones = node.linkedBone.childBones;
                    for (let j = 0; j < childBones.length; ++j) {
                        childBones[j].updateWorldMatrix();
                    }
                }
                break;

            case PmxObject.RigidBody.PhysicsMode.PhysicsWithBone:
                {
                    node.linkedBone.getWorldTranslationToRef(MmdAmmoPhysicsModel._BoneWorldPosition);
                    node.bodyOffsetInverseMatrix.multiplyToArray(
                        Matrix.ComposeToRef(
                            node.scaling,
                            node.rotationQuaternion!,
                            MmdAmmoPhysicsModel._ZeroVector,
                            MmdAmmoPhysicsModel._NodeWorldMatrix
                        ),
                        node.linkedBone.worldMatrix,
                        0
                    );
                    node.linkedBone.setWorldTranslationFromRef(MmdAmmoPhysicsModel._BoneWorldPosition);

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

/**
 * Use the v1 physics engine to build the physics model of the MMD model
 *
 * If you do not want to use a physics engine, you can reduce the bundling size by not import this class
 */
export class MmdAmmoPhysics implements IMmdPhysics {
    private readonly _scene: Scene;

    private readonly _enablePreStepOnces: PhysicsImpostor[] = [];

    /**
     * Create a new MMD ammo.js physics engine
     *
     * Scene must have a physics engine enabled
     * @param scene The scene to build the physics model
     */
    public constructor(scene: Scene) {
        this._scene = scene;
    }

    /**
     * Build the physics model of the MMD model
     * @param rootMesh Root mesh of the MMD model
     * @param bones MMD runtime bones
     * @param rigidBodies rigid bodies information
     * @param joints joints information
     * @param logger Logger
     * @returns MMD physics model
     * @throws If the ammo physics engine is not enabled
     */
    public buildPhysics(
        rootMesh: Mesh,
        bones: readonly IMmdRuntimeBone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        logger: ILogger
    ): IMmdPhysicsModel {
        const scene = this._scene;
        const physicsPlugin = scene.getPhysicsEngine()?.getPhysicsPlugin() as MmdAmmoJSPlugin | null | undefined;
        if (!physicsPlugin) {
            throw new Error("Physics engine is not enabled");
        }
        if (physicsPlugin.name !== "MmdAmmoJSPlugin") {
            throw new Error("Physics engine is not MMDAmmoJSPlugin");
        }

        let scalingFactor: number;
        {
            rootMesh.computeWorldMatrix(true);
            const worldMatrix = rootMesh.getWorldMatrix();
            const worldScale = new Vector3();
            worldMatrix.decompose(worldScale);
            if (Math.abs(worldScale.x - worldScale.y) < 0.0001 && Math.abs(worldScale.y - worldScale.z) < 0.0001) {
                if (Math.abs(worldScale.x - 1) < 0.0001 && Math.abs(worldScale.y - 1) < 0.0001 && Math.abs(worldScale.z - 1) < 0.0001) {
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

        const nodes: Nullable<MmdPhysicsMesh>[] = new Array(rigidBodies.length);
        const impostors: Nullable<PhysicsImpostor>[] = new Array(rigidBodies.length);

        for (let i = 0; i < rigidBodies.length; ++i) {
            const rigidBody = rigidBodies[i];

            if (rigidBody.boneIndex < 0 || bones.length <= rigidBody.boneIndex) {
                logger.warn(`Bone index out of range failed to create rigid body: ${rigidBody.name}`);

                nodes[i] = null;
                impostors[i] = null;
                continue;
            }
            const bone = bones[rigidBody.boneIndex];

            let impostorType: number;
            const extent = new Vector3();
            switch (rigidBody.shapeType) {
            case PmxObject.RigidBody.ShapeType.Sphere: {
                impostorType = PhysicsImpostor.SphereImpostor;
                const radius = rigidBody.shapeSize[0] * 2 * scalingFactor;
                extent.set(radius, radius, radius);
                break;
            }
            case PmxObject.RigidBody.ShapeType.Box: {
                impostorType = PhysicsImpostor.BoxImpostor;
                const shapeSize = rigidBody.shapeSize;
                extent.set(
                    shapeSize[0] * 2 * scalingFactor,
                    shapeSize[1] * 2 * scalingFactor,
                    shapeSize[2] * 2 * scalingFactor
                );
                break;
            }
            case PmxObject.RigidBody.ShapeType.Capsule: {
                impostorType = PhysicsImpostor.CylinderImpostor;
                const shapeSize = rigidBody.shapeSize;
                extent.x = shapeSize[0] * 2 * scalingFactor;
                extent.y = shapeSize[1] * scalingFactor + extent.x;
                break;
            }
            default:
                logger.warn(`Unknown rigid body shape type: ${rigidBody.shapeType}`);
                nodes[i] = null;
                impostors[i] = null;
                continue;
            }

            const node = new MmdPhysicsMesh(rigidBody.name, scene, bone, rigidBody.physicsMode);

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
            node.setParent(rootMesh);

            const mass = rigidBody.physicsMode === PmxObject.RigidBody.PhysicsMode.FollowBone
                ? 0
                : rigidBody.mass * scalingFactor;
            // if mass is 0, the object will be constructed as a kinematic object by babylon.js physics plugin

            const impostor = node.physicsImpostor = NonMeshPhysicsImpostor.Create(node, impostorType, {
                mass: mass,
                friction: rigidBody.friction,
                restitution: rigidBody.repulsion,
                ignoreParent: true,
                disableBidirectionalTransformation: rigidBody.physicsMode !== PmxObject.RigidBody.PhysicsMode.FollowBone,
                group: 1 << rigidBody.collisionGroup,
                mask: rigidBody.collisionMask
            }, extent, scene);

            // eslint-disable-next-line @typescript-eslint/consistent-type-imports
            const body = impostor.physicsBody as import("ammojs-typed").default.btRigidBody;
            body.setDamping(rigidBody.linearDamping, rigidBody.angularDamping);
            body.setSleepingThresholds(0.0, 0.0);

            const bodyPtr = physicsPlugin.bjsAMMO.getPointer(body);
            const heap32 = physicsPlugin.bjsAMMO.HEAP32 as Uint32Array;
            // ptr + 113 = m_additionalDamping (bool but 4 bytes aligned)
            heap32[bodyPtr / 4 + 113] = 0xFFFFFFFF; // enable additional damping

            nodes[i] = node;
            impostors[i] = impostor;
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
                continue;
            }

            if (joint.rigidbodyIndexB < 0 || rigidBodies.length <= joint.rigidbodyIndexB) {
                logger.warn(`Rigid body index out of range failed to create joint: ${joint.name}`);
                continue;
            }

            const bodyA = impostors[joint.rigidbodyIndexA];
            const bodyB = impostors[joint.rigidbodyIndexB];

            if (bodyA === null || bodyB === null) {
                logger.warn(`Rigid body not found failed to create joint: ${joint.name}`);
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

            // build joint

            // adjust the physics mode of the rigid bodies
            // ref: https://web.archive.org/web/20140815111315/www20.atpages.jp/katwat/wp/?p=4135
            const nodeA = nodes[joint.rigidbodyIndexA]!;
            const nodeB = nodes[joint.rigidbodyIndexB]!;

            if (nodeA.physicsMode !== PmxObject.RigidBody.PhysicsMode.FollowBone &&
                nodeB.physicsMode === PmxObject.RigidBody.PhysicsMode.PhysicsWithBone) { // case: A is parent of B
                if (bones[bodyInfoB.boneIndex].parentBone === bones[bodyInfoA.boneIndex]) {
                    nodeB.physicsMode = PmxObject.RigidBody.PhysicsMode.Physics;
                }
            } else if (nodeB.physicsMode !== PmxObject.RigidBody.PhysicsMode.FollowBone &&
                nodeA.physicsMode === PmxObject.RigidBody.PhysicsMode.PhysicsWithBone) { // case: B is parent of A
                if (bones[bodyInfoA.boneIndex].parentBone === bones[bodyInfoB.boneIndex]) {
                    nodeA.physicsMode = PmxObject.RigidBody.PhysicsMode.Physics;
                }
            }
        }

        return new MmdAmmoPhysicsModel(this, nodes, impostors);
    }

    private readonly _onAfterPhysics = (): void => {
        const enablePreStepOnces = this._enablePreStepOnces;
        for (let i = 0; i < enablePreStepOnces.length; ++i) {
            ((enablePreStepOnces[i] as any)._options as AmmoPhysicsImpostorParameters).disableBidirectionalTransformation = true;
        }
        enablePreStepOnces.length = 0;
    };

    /** @internal */
    public _enablePreStepOnce(impostor: PhysicsImpostor): void {
        if (!((impostor as any)._options as AmmoPhysicsImpostorParameters).disableBidirectionalTransformation) {
            return;
        }

        if (this._enablePreStepOnces.length === 0) {
            this._scene.onAfterPhysicsObservable.addOnce(this._onAfterPhysics);
        }

        this._enablePreStepOnces.push(impostor);
        ((impostor as any)._options as AmmoPhysicsImpostorParameters).disableBidirectionalTransformation = false;
    }
}
