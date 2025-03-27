import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { IRuntime } from "../Impl/IRuntime";
import type { MotionType } from "../motionType";
import { RigidBody } from "../rigidBody";
import type { PluginConstructionInfo } from "./pluginConstructionInfo";
import type { IPluginShape } from "./pluginShape";

export class PluginBody extends RigidBody {
    public readonly worldId: number;
    public readonly motionType: MotionType;
    public readonly localTransform: Nullable<DeepImmutable<Matrix>>;
    public readonly localTransformInverse: Nullable<DeepImmutable<Matrix>>;

    public constructor(runtime: IRuntime, info: PluginConstructionInfo) {
        const shape = info.shape as unknown as Nullable<IPluginShape>;
        let localTransform: Nullable<DeepImmutable<Matrix>> = null;
        if (shape !== null) {
            localTransform = shape.localTransform;
            info.collisionGroup = shape.collisionGroup;
            info.collisionMask = shape.collisionMask;
            const material = shape.material;
            if (material) {
                info.friction = material.friction;
                info.restitution = material.restitution;
            }
        }
        super(runtime, info);
        this.worldId = info.worldId;
        this.motionType = info.motionType;
        this.localTransform = localTransform;
        this.localTransformInverse = localTransform?.invert() ?? null;
    }
}
