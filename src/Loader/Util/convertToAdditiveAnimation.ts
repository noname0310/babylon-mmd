import { Animation } from "@babylonjs/core/Animations/animation";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import type { ILogger } from "../Parser/ILogger";

function ConvertToAdditiveAnimationInternal(animation: Animation, bone: Bone, logger?: ILogger): void {
    const target = bone as { [key: string]: any };

    if (target[animation.targetProperty] === undefined) {
        logger?.warn(`Wrong target property ${animation.targetProperty} for ${animation.name} ${bone.name}`);
        return;
    }

    const restPose =
        animation.targetProperty === "rotationQuaternion" ? Quaternion.FromRotationMatrix(bone.getRestMatrix()) :
            animation.targetProperty === "position" ? bone.getRestMatrix().getTranslation()
                : undefined;

    if (restPose === undefined) {
        logger?.warn(`Failed to get rest pose for ${animation.name} ${animation.targetProperty}`);
        return;
    }

    const keys = animation.getKeys();

    switch (animation.dataType) {
    // Quaternion
    case Animation.ANIMATIONTYPE_QUATERNION: {
        const restPoseValueInversed = (restPose as Quaternion).clone().invertInPlace();
        for (let i = 0; i < keys.length; ++i) {
            restPoseValueInversed.multiplyToRef(keys[i].value, keys[i].value);
        }
        break;
    }

    // Vector3
    case Animation.ANIMATIONTYPE_VECTOR3: {
        for (let i = 0; i < keys.length; ++i) {
            (keys[i].value as Vector3).subtractInPlace(restPose as Vector3);
        }
        break;
    }

    default: {
        logger?.warn("Animation data type is not supported");
        break;
    }
    }
}

/**
 * Convert non-additive animation group to additive animation group
 *
 * animation group must be flattened
 * @param animationGroup non-additive animation group
 * @param skeleton target skeleton
 * @param logger logger
 */
export function ConvertToAdditiveAnimation(animationGroup: AnimationGroup, skeleton: Skeleton, logger?: ILogger): void {
    if (animationGroup.isAdditive) {
        logger?.warn("Animation group is already additive");
        return;
    }

    const linkedTransformNodeMap = new Map<TransformNode, Bone>();
    {
        const bones = skeleton.bones;
        for (let i = 0; i < bones.length; ++i) {
            const bone = bones[i];
            const linkedTransformNode = bone.getTransformNode();
            if (linkedTransformNode !== null) {
                linkedTransformNodeMap.set(linkedTransformNode, bone);
            }
        }
    }

    const targetedAnimations = animationGroup.targetedAnimations;
    for (let i = 0; i < targetedAnimations.length; ++i) {
        const animation = targetedAnimations[i].animation;

        const target = targetedAnimations[i].target;
        const bone = linkedTransformNodeMap.get(target); // if target is linked transform node, get linked bone
        if (bone === undefined) {
            targetedAnimations[i].target; // target is bone
        }

        if (bone !== undefined) {
            ConvertToAdditiveAnimationInternal(animation, bone);
        } else {
            logger?.warn(`Failed to find rest pose for ${animation.name}`);
        }
    }

    animationGroup.isAdditive = true;
}
