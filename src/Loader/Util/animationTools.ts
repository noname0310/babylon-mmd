import { Animation } from "@babylonjs/core/Animations/animation";
import type { TargetedAnimation } from "@babylonjs/core/Animations/animationGroup";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import type { ILogger } from "../Parser/ILogger";
import type { MmdHumanoidMapper } from "./mmdHumanoidMapper";

/**
 * Animation utility functions
 */
export class AnimationTools {
    private constructor() { /* block constructor */ }

    private static _ConvertToAdditiveAnimationInternal(animation: Animation, bone: Bone, logger?: ILogger): void {
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
            for (let i = 0; i < keys.length; i++) {
                restPoseValueInversed.multiplyToRef(keys[i].value, keys[i].value);
            }
            break;
        }

        // Vector3
        case Animation.ANIMATIONTYPE_VECTOR3: {
            for (let i = 0; i < keys.length; i++) {
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
     */
    public static ConvertToAdditiveAnimation(animationGroup: AnimationGroup, skeleton: Skeleton, logger?: ILogger): void {
        if (animationGroup.isAdditive) {
            logger?.warn("Animation group is already additive");
            return;
        }

        const linkedTransformNodeMap = new Map<TransformNode, Bone>();
        {
            const bones = skeleton.bones;
            for (let i = 0; i < bones.length; i++) {
                const bone = bones[i];
                const linkedTransformNode = bone.getTransformNode();
                if (linkedTransformNode !== null) {
                    linkedTransformNodeMap.set(linkedTransformNode, bone);
                }
            }
        }

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            const animation = targetedAnimations[i].animation;

            const target = targetedAnimations[i].target;
            const bone = linkedTransformNodeMap.get(target); // if target is linked transform node, get linked bone
            if (bone === undefined) {
                targetedAnimations[i].target; // target is bone
            }

            if (bone !== undefined) {
                AnimationTools._ConvertToAdditiveAnimationInternal(animation, bone);
            } else {
                logger?.warn(`Failed to find rest pose for ${animation.name}`);
            }
        }

        animationGroup.isAdditive = true;
    }

    private static _ChangeAnimationRestPoseInternal(animation: Animation, originalSkeleton: Skeleton, targetSkeleton: Skeleton, logger?: ILogger): void {
        originalSkeleton;
        targetSkeleton;

        const keys = animation.getKeys();
        keys;

        // TODO: for change rest pose, we need to
        //
        // for quaternion:
        // 1. evaluate each keyframe for get world animated rotation (use animation and originalRestPose)
        // 2. calculate local rotation from world rotation (use newRestPose)
        // 3. apply local transform to keyframe
        //
        // - worldRotation -> localRotation -> localRotationOffset
        //
        //
        // for vector3:
        // 1. evaluate each keyframe for get world animated rotation (use animation and originalRestPose)
        // 2. calculate world position offset from animation and rotate it by world animated rotation
        // 3. calculate retargeted local position offset from newRestPose
        //
        // - originalLocalPositionOffset -> worldPositionOffset -> newLocalPositionOffset

        switch (animation.dataType) {
        // Quaternion
        case Animation.ANIMATIONTYPE_QUATERNION: {
            // const originalRestPoseValueInversed = (originalRestPoseValue as Quaternion).clone().invertInPlace();
            // for (let i = 0; i < keys.length; i++) {
            //     keys[i].value.multiplyToRef(
            //         originalRestPoseValueInversed.multiply(newRestPoseValue as Quaternion),
            //         keys[i].value
            //     );
            // }
            break;
        }

        // Vector3
        case Animation.ANIMATIONTYPE_VECTOR3: {
            // for (let i = 0; i < keys.length; i++) {
            //     (keys[i].value as Vector3);
            //     // .subtractInPlace(originalRestPoseValue)
            //     // .addInPlace(newRestPoseValue);
            // }
            break;
        }

        default: {
            logger?.warn("Animation data type is not supported");
            break;
        }
        }
    }

    /**
     * Change animation group rest pose
     *
     * animation group must be flattened
     * @param animationGroup target animation group
     * @param originalSkeleton original skeleton
     * @param targetSkeleton target skeleton
     * @param mmdHumanoidMapper map for original skeleton to target skeleton
     * @param logger logger
     */
    public static ChangeAnimationRestPose(
        animationGroup: AnimationGroup,
        originalSkeleton: Skeleton,
        targetSkeleton: Skeleton,
        mmdHumanoidMapper: MmdHumanoidMapper,
        logger?: ILogger
    ): void {
        originalSkeleton;
        mmdHumanoidMapper;
        AnimationTools._ChangeAnimationRestPoseInternal;
        // TODO: build virtual skeleton for evaluate animation

        const linkedTransformNodeMap = new Map<TransformNode, Bone>();
        {
            const bones = targetSkeleton.bones;
            for (let i = 0; i < bones.length; i++) {
                const bone = bones[i];
                const linkedTransformNode = bone.getTransformNode();
                if (linkedTransformNode !== null) {
                    linkedTransformNodeMap.set(linkedTransformNode, bone);
                }
            }
        }

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            const animation = targetedAnimations[i].animation;

            const target = targetedAnimations[i].target;
            let bone = linkedTransformNodeMap.get(target); // if target is linked transform node, get linked bone
            if (bone === undefined) {
                bone = target as Bone; // target is bone
            }

            if (bone !== undefined) {
                // ...
            } else {
                logger?.warn(`Failed to find rest pose for ${animation.name}`);
            }
        }
    }

    /**
     * Get final target from target and target property path
     * @param target animation target
     * @param targetPropertyPath animation target property path
     * @returns final target
     */
    public static GetFinalTarget(target: any, targetPropertyPath: string[]): any {
        if (targetPropertyPath.length > 1) {
            let property = target[targetPropertyPath[0]];

            for (let index = 1; index < targetPropertyPath.length - 1; index++) {
                property = property[targetPropertyPath[index]];
            }

            return property;
        } else {
            return target;
        }
    }

    /**
     * Flatten animation target
     * @param targetedAnimation targeted animation
     */
    public static FlattenAnimationTarget(targetedAnimation: TargetedAnimation): void {
        const target = targetedAnimation.target;
        const targetPropertyPath = targetedAnimation.animation.targetPropertyPath;

        const finalTarget = AnimationTools.GetFinalTarget(target, targetPropertyPath);

        targetedAnimation.target = finalTarget;
        targetPropertyPath[0] = targetedAnimation.animation.targetPropertyPath[targetedAnimation.animation.targetPropertyPath.length - 1];
        targetPropertyPath.length = 1;
        targetedAnimation.animation.targetProperty = targetedAnimation.animation.targetPropertyPath[0];
    }

    /**
     * Deep copy animation data
     * @param animation animation to copy
     * @returns copied animation
     */
    public static DeepCopyAnimation(animation: Animation): Animation {
        const newAnimation = new Animation(animation.name, animation.targetProperty, animation.framePerSecond, animation.dataType, animation.loopMode);

        newAnimation.enableBlending = animation.enableBlending;
        newAnimation.blendingSpeed = animation.blendingSpeed;

        const keys = animation.getKeys();
        if (keys !== undefined) {
            const newKeys = new Array(keys.length);
            for (let i = 0; i < keys.length; i++) {
                const newKey = newKeys[i] = { ...keys[i] };

                if (newKey.value.clone !== undefined) {
                    newKey.value = newKey.value.clone();
                }

                if (newKey.inTangent !== undefined && newKey.inTangent.clone !== undefined) {
                    newKey.inTangent = newKey.inTangent.clone();
                }

                if (newKey.outTangent !== undefined && newKey.outTangent.clone !== undefined) {
                    newKey.outTangent = newKey.outTangent.clone();
                }
            }
            newAnimation.setKeys(newKeys);
        }

        if ((newAnimation as any)._ranges) {
            (newAnimation as any)._ranges = {};
            for (const name in (this as any)._ranges) {
                const range = (this as any)._ranges[name];
                if (!range) {
                    continue;
                }
                (newAnimation as any)._ranges[name] = range.clone();
            }
        }

        return newAnimation;
    }

    /**
     * Deep copy animation group data
     * @param animationGroup animation group to copy
     * @param newName defines the name of the new group
     * @returns copied animation group
     */
    public static DeepCopyAnimationGroup(animationGroup: AnimationGroup, newName: string): AnimationGroup {
        const newGroup = new AnimationGroup(newName || this.name, (animationGroup as any)._scene);

        for (const targetAnimation of animationGroup.targetedAnimations) {
            newGroup.addTargetedAnimation(
                AnimationTools.DeepCopyAnimation(targetAnimation.animation),
                targetAnimation.target
            );
        }

        return newGroup;
    }
}
