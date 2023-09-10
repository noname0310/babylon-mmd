import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";

import type { ILogger } from "../Parser/ILogger";
import { AnimationTools } from "./animationTools";
import type { MmdHumanoidBoneMap} from "./mmdHumanoidMapper";
import { MmdHumanoidMapper } from "./mmdHumanoidMapper";

/**
 * Make animation compatible with mmd model
 */
export class MmdAnimationConverter {
    /**
     * Retarget and adjust animation group to mmd model
     * @param humanoidBoneMap humanoid bone map
     * @param animationGroup animation group to retarget
     * @param originalRestPose original model rest pose
     * @param target target model
     * @param logger logger
     */
    public static RetargetHumanoidAnimation(
        humanoidBoneMap: MmdHumanoidBoneMap,
        animationGroup: AnimationGroup,
        originalSkeleton: Skeleton,
        targetSkeleton: Skeleton,
        logger?: ILogger
    ): void {
        MmdAnimationConverter._RemoveScaleAnimation(animationGroup);

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            AnimationTools.FlattenAnimationTarget(targetedAnimations[i]);
        }

        const mmdHumanoidMapper = new MmdHumanoidMapper(humanoidBoneMap);
        const boneMap = new Map<string, Bone>();
        {
            const bones = targetSkeleton.bones;
            for (let i = 0; i < bones.length; i++) {
                const bone = bones[i];
                boneMap.set(bone.name, bone);
            }
        }

        if (!animationGroup.isAdditive) {
            AnimationTools.ConvertToAdditiveAnimation(animationGroup, originalSkeleton, logger);
        }

        MmdAnimationConverter._RetargetHumanoidAnimationInternal(mmdHumanoidMapper, animationGroup, boneMap, logger);


        AnimationTools.ChangeAnimationRestPose(animationGroup, originalSkeleton, targetSkeleton, mmdHumanoidMapper, logger);
    }

    private static _RetargetHumanoidAnimationInternal(
        mmdHumanoidMapper: MmdHumanoidMapper,
        animationGroup: AnimationGroup,
        boneMap: Map<string, Bone>,
        logger?: ILogger
    ): void {
        const unTargetedAnimationIndices: number[] = [];

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            const targetedAnimation = targetedAnimations[i];

            if (!targetedAnimation.target) {
                unTargetedAnimationIndices.push(i);
                logger?.warn(`Animation target is null. Animation name: ${targetedAnimation.animation.name}`);
                continue;
            }

            const targetName = mmdHumanoidMapper.boneMap[targetedAnimation.target.name];
            if (targetName !== undefined) {
                const bone = boneMap.get(targetName);
                if (bone !== undefined) {
                    targetedAnimation.target = bone;
                    const animation = targetedAnimation.animation;

                    animation.targetProperty = animation.targetPropertyPath[animation.targetPropertyPath.length - 1];
                    animation.targetPropertyPath.length = 1;
                    animation.targetPropertyPath[0] = animation.targetProperty;
                } else {
                    unTargetedAnimationIndices.push(i);
                    logger?.warn(`Bone not found. Bone name: ${targetedAnimation.target.name}`);
                }
            } else {
                unTargetedAnimationIndices.push(i);
                logger?.warn(`Bone not found. Bone name: ${targetedAnimation.target.name}`);
            }
        }

        for (let i = 0, j = 0; i < targetedAnimations.length; i++) {
            if (i === unTargetedAnimationIndices[j]) {
                j += 1; // Skip untargeted animation
                continue;
            }

            targetedAnimations[i - j] = targetedAnimations[i];
        }
        targetedAnimations.length -= unTargetedAnimationIndices.length;
    }

    private static _RemoveScaleAnimation(animationGroup: AnimationGroup): void {
        const scaleAnimationIndices: number[] = [];

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            const targetedAnimation = targetedAnimations[i];

            if (!targetedAnimation.target) continue;

            const targetProperty = targetedAnimation.animation.targetProperty;
            if (targetProperty === "scaling") {
                scaleAnimationIndices.push(i);
            }
        }

        for (let i = 0, j = 0; i < targetedAnimations.length; i++) {
            if (i === scaleAnimationIndices[j]) {
                j += 1; // Skip scale animation
                continue;
            }

            targetedAnimations[i - j] = targetedAnimations[i];
        }
        targetedAnimations.length -= scaleAnimationIndices.length;
    }
}
