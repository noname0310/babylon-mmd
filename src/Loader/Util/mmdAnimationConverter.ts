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
    public static SmartRetargetHumanoidAnimationGroup(
        humanoidBoneMap: MmdHumanoidBoneMap,
        animationGroup: AnimationGroup,
        originalRestPose: AnimationGroup,
        target: Skeleton,
        logger?: ILogger
    ): void {
        const mmdHumanoidMapper = new MmdHumanoidMapper(humanoidBoneMap);

        const boneMap = new Map<string, Bone>();
        {
            const bones = target.bones;
            for (let i = 0; i < bones.length; i++) {
                const bone = bones[i];
                boneMap.set(bone.name, bone);
            }
        }

        MmdAnimationConverter._RetargetHumanoidAnimationGroupInternal(mmdHumanoidMapper, animationGroup, boneMap, logger);

        originalRestPose = originalRestPose.clone(originalRestPose.name + "_retargeted");
        MmdAnimationConverter._RetargetHumanoidAnimationGroupInternal(mmdHumanoidMapper, originalRestPose, boneMap, logger);

        if (!animationGroup.isAdditive) {
            AnimationTools.ConvertToAdditiveAnimationGroup(animationGroup, originalRestPose, logger);
        }

        const targetRestPose = AnimationTools.CreateRestPoseAnimationGroup(target);
        AnimationTools.ChangeAnimationGroupRestPose(animationGroup, originalRestPose, targetRestPose, logger);

        originalRestPose.dispose();
    }

    private static _RetargetHumanoidAnimationGroupInternal(
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

    /**
     * Retarget animation group to mmd model
     * @param humanoidBoneMap humanoid bone map
     * @param animationGroup animation group to retarget
     * @param target target model
     * @param logger logger
     */
    public static RetargetHumanoidAnimationGroup(
        humanoidBoneMap: MmdHumanoidBoneMap,
        animationGroup: AnimationGroup,
        target: Skeleton,
        logger?: ILogger
    ): void {
        const mmdHumanoidMapper = new MmdHumanoidMapper(humanoidBoneMap);

        const boneMap = new Map<string, Bone>();
        {
            const bones = target.bones;
            for (let i = 0; i < bones.length; i++) {
                const bone = bones[i];
                boneMap.set(bone.name, bone);
            }
        }

        MmdAnimationConverter._RetargetHumanoidAnimationGroupInternal(mmdHumanoidMapper, animationGroup, boneMap, logger);
    }
}
