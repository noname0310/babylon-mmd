import type { _IAnimationState } from "@babylonjs/core/Animations/animation.pure";
import { Animation } from "@babylonjs/core/Animations/animation.pure";

/**
 * Creates a new animation state
 * @returns A new animation state
 */
export function CreateAnimationState(): _IAnimationState {
    return {
        key: 0,
        repeatCount: 0,
        loopMode: Animation.ANIMATIONLOOPMODE_CONSTANT
    };
}
