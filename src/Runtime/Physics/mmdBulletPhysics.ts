import { Nullable } from "@babylonjs/core/types";
import { RigidBodyBundle } from "../Optimized/Physics/Bind/rigidBodyBundle";
import { IMmdPhysics, IMmdPhysicsModel } from "./IMmdPhysics";
import { IMmdRuntimeBone } from "../IMmdRuntimeBone";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import { PmxObject } from "@/Loader/Parser/pmxObject";
import { IPhysicsRuntime } from "../Optimized/Physics/Bind/Impl/IPhysicsRuntime";
import { RigidBodyConstructionInfoList } from "../Optimized/Physics/Bind/rigidBodyConstructionInfoList";
import { ILogger } from "../ILogger";

interface MmdRigidBodyData {
    readonly linkedBone: Nullable<IMmdRuntimeBone>;
    readonly physicsMode: PmxObject.RigidBody.PhysicsMode;
    readonly bodyOffsetMatrix: Matrix;
    readonly bodyOffsetMatrixInverse: Matrix;
}

class MmdRigidBodyBundle extends RigidBodyBundle {
    public readonly rigidBodyData: MmdRigidBodyData[];
    public constructor(
        runtime: IPhysicsRuntime,
        info: RigidBodyConstructionInfoList,
        data: MmdRigidBodyData[]
    ) {
        super(runtime, info);
        this.rigidBodyData = data;
    }

    public computeBodyOffsetMatrix(index: number): Matrix {
    }
}

/**
 * MMD bullet physics model is container of the bullet physics resources of the MMD model
 */
export class MmdBulletPhysicsModel implements IMmdPhysicsModel {
    private readonly _bundle: RigidBodyBundle;

    /**
     * Dispose the physics resources
     */
    public dispose(): void {
    }

    /**
     * Reset the rigid body positions and velocities
     */
    public initialize(): void {
    }

    /**
     * Set the rigid bodies transform to the bones transform
     */
    public syncBodies(): void {
    }
    
    /**
     * Set the bones transform to the rigid bodies transform
     */
    public syncBones(): void {
    }
}

/**
 * Use the bullet physics engine to build the physics model of the MMD model
 *
 * If you do not want to use a physics engine, you can reduce the bundling size by not import this class
 */
export class MmdBulletPhysics implements IMmdPhysics {
    /**
     * Build the physics model of the MMD model
     * @param rootMesh Root mesh of the MMD model
     * @param bones MMD runtime bones
     * @param rigidBodies rigid bodies information
     * @param joints joints information
     * @param logger Logger
     * @returns MMD physics model
     * @throws If the physics model cannot be built
     */
    public buildPhysics(
        rootMesh: Mesh,
        bones: readonly IMmdRuntimeBone[],
        rigidBodies: PmxObject["rigidBodies"],
        joints: PmxObject["joints"],
        logger: ILogger
    ): IMmdPhysicsModel {
        
    }
}
