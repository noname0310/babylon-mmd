import type { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { IRuntime } from "../Impl/IRuntime";
import { RigidBodyBundle } from "../rigidBodyBundle";
import type { PluginConstructionInfoList } from "./pluginConstructionInfoList";
import type { IPluginShape } from "./pluginShape";

export class PluginBodyBundle extends RigidBodyBundle {
    public readonly info: PluginConstructionInfoList;
    public readonly localTransform: Nullable<DeepImmutable<Matrix>>;
    public readonly localTransformInverse: Nullable<DeepImmutable<Matrix>>;

    public constructor(runtime: IRuntime, info: PluginConstructionInfoList) {
        const shape = info.getShape(0) as unknown as IPluginShape;
        let localTransform: Nullable<DeepImmutable<Matrix>> = null;
        if (shape !== null) {
            localTransform = shape.localTransform;
            for (let i = 0; i < info.count; ++i) {
                info.setCollisionGroup(i, shape.collisionGroup);
                info.setCollisionMask(i, shape.collisionMask);
            }
            const material = shape.material;
            if (material) {
                for (let i = 0; i < info.count; ++i) {
                    info.setFriction(i, material.friction);
                    info.setRestitution(i, material.restitution);
                }
            }
        }
        super(runtime, info);
        this.info = info;
        this.localTransform = localTransform;
        this.localTransformInverse = localTransform?.invert() ?? null;
    }

    public override setDamping(index: number, linearDamping: number, angularDamping: number): void {
        super.setDamping(index, linearDamping, angularDamping);
        this.info.setLinearDamping(index, linearDamping);
        this.info.setAngularDamping(index, angularDamping);
    }

    public override setMassProps(index: number, mass: number, localInertia: DeepImmutable<Vector3>): void {
        super.setMassProps(index, mass, localInertia);
        this.info.setMass(index, mass);
        this.info.setLocalInertia(index, localInertia);
    }

    public get length(): number {
        return this.count;
    }
}
