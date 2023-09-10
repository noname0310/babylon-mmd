import { Animation } from "@babylonjs/core/Animations/animation";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import type { Size } from "@babylonjs/core/Maths/math.size";
import type { Matrix} from "@babylonjs/core/Maths/math.vector";
import { Quaternion, type Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { ILogger } from "../Parser/ILogger";

/**
 * Animation utility functions
 */
export class AnimationTools {
    private constructor() { /* block constructor */ }

    /**
     * Convert non-additive animation to additive animation
     * @param animation non-additive animation
     * @param restPose rest pose animation
     */
    public static ConvertToAdditiveAnimation(animation: Animation, restPose: Animation, logger?: ILogger): void {
        if (animation.dataType !== restPose.dataType) {
            logger?.warn("Animation data type is not same as rest pose");
            return;
        }

        const restPoseKeys = restPose.getKeys();
        if (restPoseKeys.length === 0) {
            logger?.warn("Rest pose animation has no keys");
            return;
        }

        const restPoseValue = restPoseKeys[0].value;
        const keys = animation.getKeys();

        switch (animation.dataType) {
        // Float
        case Animation.ANIMATIONTYPE_FLOAT: {
            for (let i = 0; i < keys.length; i++) {
                keys[i].value -= restPoseValue;
            }
            break;
        }

        // Quaternion
        case Animation.ANIMATIONTYPE_QUATERNION: {
            const restPoseValueInversed = (restPoseValue as Quaternion).clone().invertInPlace();
            for (let i = 0; i < keys.length; i++) {
                restPoseValueInversed.multiplyToRef(keys[i].value, keys[i].value);
            }
            break;
        }

        // Vector3 / Vector2
        case Animation.ANIMATIONTYPE_VECTOR3:
        case Animation.ANIMATIONTYPE_VECTOR2: {
            for (let i = 0; i < keys.length; i++) {
                (restPoseValue as Vector3).subtractToRef(keys[i].value as Vector3, keys[i].value as Vector3);
            }
            break;
        }

        // Size
        case Animation.ANIMATIONTYPE_SIZE: {
            for (let i = 0; i < keys.length; i++) {
                keys[i].value = (keys[i].value as Size).subtract(restPoseValue);
            }
            break;
        }

        // Color3 / Color4
        case Animation.ANIMATIONTYPE_COLOR3:
        case Animation.ANIMATIONTYPE_COLOR4: {
            for (let i = 0; i < keys.length; i++) {
                (keys[i].value as Color3 | Color4).subtractToRef(restPoseValue, keys[i].value);
            }
            break;
        }

        // Matrix
        case Animation.ANIMATIONTYPE_MATRIX: {
            const restPoseValueInversed = (restPoseValue as Matrix).clone().invert();
            for (let i = 0; i < keys.length; i++) {
                (keys[i].value as Matrix).multiplyToRef(restPoseValueInversed, keys[i].value);
            }
            break;
        }
        }
    }

    /**
     * Convert non-additive animation group to additive animation group
     * @param animationGroup non-additive animation group
     * @param restPoseGroup rest pose animation group
     */
    public static ConvertToAdditiveAnimationGroup(animationGroup: AnimationGroup, restPoseGroup: AnimationGroup, logger?: ILogger): void {
        if (animationGroup.isAdditive) {
            logger?.warn("Animation group is already additive");
            return;
        }

        const restPoseTargetedAnimations = restPoseGroup.targetedAnimations;
        const restPoseTargetMap = new Map<any, Animation[]>();
        for (let i = 0; i < restPoseTargetedAnimations.length; i++) {
            let animations = restPoseTargetMap.get(restPoseTargetedAnimations[i].target);
            if (animations === undefined) {
                animations = [];
                restPoseTargetMap.set(restPoseTargetedAnimations[i].target, animations);
            }
            animations.push(restPoseTargetedAnimations[i].animation);
        }

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            const animation = targetedAnimations[i].animation;
            const restPoses = restPoseTargetMap.get(targetedAnimations[i].target);
            if (restPoses !== undefined) {
                const lastTargetProperty = animation.targetPropertyPath[animation.targetPropertyPath.length - 1];

                let isConverted = false;
                for (let j = 0; j < restPoses.length; j++) {
                    const restPose = restPoses[j];
                    const lastRestPoseTargetProperty = restPose.targetPropertyPath[restPose.targetPropertyPath.length - 1];
                    if (lastTargetProperty === lastRestPoseTargetProperty) {
                        AnimationTools.ConvertToAdditiveAnimation(animation, restPose);
                        isConverted = true;
                        break;
                    }
                }

                if (!isConverted) {
                    logger?.warn(`Failed to find rest pose for ${animation.name}`);
                }
            } else {
                logger?.warn(`Failed to find rest pose for ${animation.name}`);
            }
        }

        animationGroup.isAdditive = true;
    }

    /**
     * Change animation rest pose
     * @param animation target animation
     * @param originalRestPose original rest pose animation
     * @param newRestPose new rest pose animation
     */
    public static ChangeAnimationRestPose(animation: Animation, originalRestPose: Animation, newRestPose: Animation, logger?: ILogger): void {
        if (animation.dataType !== originalRestPose.dataType || animation.dataType !== newRestPose.dataType) {
            logger?.warn("Animation data type is not same as rest pose");
            return;
        }

        const originalRestPoseKeys = originalRestPose.getKeys();
        const newRestPoseKeys = newRestPose.getKeys();
        if (originalRestPoseKeys.length === 0 || newRestPoseKeys.length === 0) {
            logger?.warn("Rest pose animation has no keys");
            return;
        }

        const originalRestPoseValue = originalRestPoseKeys[0].value;
        const newRestPoseValue = newRestPoseKeys[0].value;
        const keys = animation.getKeys();

        switch (animation.dataType) {
        // Float
        case Animation.ANIMATIONTYPE_FLOAT: {
            for (let i = 0; i < keys.length; i++) {
                keys[i].value = (keys[i].value as number) - originalRestPoseValue + newRestPoseValue;
            }
            break;
        }

        // Quaternion
        case Animation.ANIMATIONTYPE_QUATERNION: {
            const originalRestPoseValueInversed = (originalRestPoseValue as Quaternion).clone().invertInPlace();
            for (let i = 0; i < keys.length; i++) {
                originalRestPoseValueInversed
                    .multiplyToRef(keys[i].value, (keys[i].value as Quaternion))
                    .multiplyInPlace(newRestPoseValue as Quaternion);
            }
            break;
        }

        // Vector3 / Vector2
        case Animation.ANIMATIONTYPE_VECTOR3:
        case Animation.ANIMATIONTYPE_VECTOR2: {
            for (let i = 0; i < keys.length; i++) {
                (keys[i].value as Vector3 | Vector2)
                    .subtractInPlace(originalRestPoseValue)
                    .addInPlace(newRestPoseValue);
            }
            break;
        }

        // Size
        case Animation.ANIMATIONTYPE_SIZE: {
            for (let i = 0; i < keys.length; i++) {
                keys[i].value = (keys[i].value as Size)
                    .subtract(originalRestPoseValue)
                    .add(newRestPoseValue);
            }
            break;
        }

        // Color3 / Color4
        case Animation.ANIMATIONTYPE_COLOR3:
        case Animation.ANIMATIONTYPE_COLOR4: {
            for (let i = 0; i < keys.length; i++) {
                keys[i].value = (keys[i].value as Color3 | Color4)
                    .subtractToRef(originalRestPoseValue, keys[i].value)
                    .add(newRestPoseValue);
            }
            break;
        }

        // Matrix
        case Animation.ANIMATIONTYPE_MATRIX: {
            const originalRestPoseValueInversed = (originalRestPoseValue as Matrix).clone().invert();
            for (let i = 0; i < keys.length; i++) {
                (keys[i].value as Matrix)
                    .multiplyToRef(originalRestPoseValueInversed, (keys[i].value as Matrix))
                    .multiplyToRef(newRestPoseValue as Matrix, (keys[i].value as Matrix));
            }
            break;
        }
        }
    }

    /**
     * Change animation group rest pose
     * @param animationGroup target animation group
     * @param originalRestPoseGroup original rest pose animation group
     * @param newRestPoseGroup new rest pose animation group
     */
    public static ChangeAnimationGroupRestPose(animationGroup: AnimationGroup, originalRestPoseGroup: AnimationGroup, newRestPoseGroup: AnimationGroup, logger?: ILogger): void {
        const targetedAnimations = animationGroup.targetedAnimations;
        const originalRestPoseTargetedAnimations = originalRestPoseGroup.targetedAnimations;
        const newRestPoseTargetedAnimations = newRestPoseGroup.targetedAnimations;

        const originalRestPoseTargetMap = new Map<any, Animation[]>();
        for (let i = 0; i < originalRestPoseTargetedAnimations.length; i++) {
            let animations = originalRestPoseTargetMap.get(originalRestPoseTargetedAnimations[i].target);
            if (animations === undefined) {
                animations = [];
                originalRestPoseTargetMap.set(originalRestPoseTargetedAnimations[i].target, animations);
            }
            animations.push(originalRestPoseTargetedAnimations[i].animation);
        }

        const newRestPoseTargetMap = new Map<any, Animation[]>();
        for (let i = 0; i < newRestPoseTargetedAnimations.length; i++) {
            let animations = newRestPoseTargetMap.get(newRestPoseTargetedAnimations[i].target);
            if (animations === undefined) {
                animations = [];
                newRestPoseTargetMap.set(newRestPoseTargetedAnimations[i].target, animations);
            }
            animations.push(newRestPoseTargetedAnimations[i].animation);
        }

        for (let i = 0; i < targetedAnimations.length; i++) {
            const animation = targetedAnimations[i].animation;
            const originalRestPoses = originalRestPoseTargetMap.get(targetedAnimations[i].target);
            const newRestPoses = newRestPoseTargetMap.get(targetedAnimations[i].target);

            const lastTargetProperty = animation.targetPropertyPath[animation.targetPropertyPath.length - 1];
            if (originalRestPoses !== undefined && newRestPoses !== undefined) {
                let originalRestPose: Animation | undefined = undefined;
                for (let j = 0; j < originalRestPoses.length; j++) {
                    const restPose = originalRestPoses[j];
                    const lastRestPoseTargetProperty = restPose.targetPropertyPath[restPose.targetPropertyPath.length - 1];
                    if (lastTargetProperty === lastRestPoseTargetProperty) {
                        originalRestPose = restPose;
                        break;
                    }
                }

                let newRestPose: Animation | undefined = undefined;
                for (let j = 0; j < newRestPoses.length; j++) {
                    const restPose = newRestPoses[j];
                    const lastRestPoseTargetProperty = restPose.targetPropertyPath[restPose.targetPropertyPath.length - 1];
                    if (lastTargetProperty === lastRestPoseTargetProperty) {
                        newRestPose = restPose;
                        break;
                    }
                }

                if (originalRestPose !== undefined && newRestPose !== undefined) {
                    AnimationTools.ChangeAnimationRestPose(animation, originalRestPose, newRestPose);
                } else {
                    logger?.warn(`Failed to find rest pose for asdf ${animation.name}`);
                }
            } else {
                logger?.warn(`Failed to find rest pose for dfgh ${animation.name}`);
            }
        }
    }

    /**
     * Create rest pose animation group from skeleton
     */
    public static CreateRestPoseAnimationGroup(skeleton: Skeleton): AnimationGroup {
        const animationGroup = new AnimationGroup("RestPose", skeleton.getScene());

        const bones = skeleton.bones;
        for (let i = 0; i < bones.length; i++) {
            const bone = bones[i];

            const matrixAnimation = new Animation("rest_bone_matrix_" + bone.name, "_matrix", 1, Animation.ANIMATIONTYPE_MATRIX, Animation.ANIMATIONLOOPMODE_CONSTANT);
            matrixAnimation.setKeys([{
                frame: 0,
                value: bone.getRestMatrix().clone()
            }]);
            animationGroup.addTargetedAnimation(matrixAnimation, bone);

            const positionAnimation = new Animation("rest_bone_position_" + bone.name, "position", 1, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
            positionAnimation.setKeys([{
                frame: 0,
                value: bone.getRestMatrix().getTranslationToRef(new Vector3())
            }]);
            animationGroup.addTargetedAnimation(positionAnimation, bone);

            const rotationAnimation = new Animation("rest_bone_rotation_" + bone.name, "rotationQuaternion", 1, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT);
            rotationAnimation.setKeys([{
                frame: 0,
                value: Quaternion.FromRotationMatrixToRef(bone.getRestMatrix(), new Quaternion())
            }]);
            animationGroup.addTargetedAnimation(rotationAnimation, bone);
        }

        return animationGroup;
    }
}
