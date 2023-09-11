import { Animation } from "@babylonjs/core/Animations/animation";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";

/**
 * Deep copy animation data
 * @param animation animation to copy
 * @returns copied animation
 */
export function deepCopyAnimation(animation: Animation): Animation {
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
        for (const name in (animation as any)._ranges) {
            const range = (animation as any)._ranges[name];
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
export function deepCopyAnimationGroup(animationGroup: AnimationGroup, newName: string): AnimationGroup {
    const newGroup = new AnimationGroup(newName || animationGroup.name, (animationGroup as any)._scene);

    for (const targetAnimation of animationGroup.targetedAnimations) {
        newGroup.addTargetedAnimation(
            deepCopyAnimation(targetAnimation.animation),
            targetAnimation.target
        );
    }

    return newGroup;
}
