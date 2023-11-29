import type { _IAnimationState } from "@babylonjs/core/Animations/animation";
import { Animation } from "@babylonjs/core/Animations/animation";

/**
 * Creates a new animation state
 * @returns A new animation state
 */
export function createAnimationState(): _IAnimationState {
    return {
        key: 0,
        repeatCount: 0,
        loopMode: Animation.ANIMATIONLOOPMODE_CONSTANT
    };
}
