import type { Nullable } from "@babylonjs/core/types";

import type { MmdCamera } from "../mmdCamera";
import type { IMmdBindableCameraAnimation, IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeCameraAnimation } from "./IMmdRuntimeAnimation";
import type { MmdAnimationSpan } from "./mmdCompositeAnimation";
import { MmdCompositeAnimation } from "./mmdCompositeAnimation";

/**
 * Mmd composite runtime camera animation
 *
 * An object with mmd composite animation and camera binding information
 */
export class MmdCompositeRuntimeCameraAnimation implements IMmdRuntimeCameraAnimation {
    /**
     * The animation data
     */
    public readonly animation: MmdCompositeAnimation;

    private readonly _runtimeAnimations: Nullable<IMmdRuntimeCameraAnimation>[];
    private _onSpanAdded: Nullable<(span: MmdAnimationSpan) => void>;
    private _onSpanRemoved: Nullable<(removeIndex: number) => void>;

    public constructor(
        animation: MmdCompositeAnimation,
        runtimeAnimations: Nullable<IMmdRuntimeCameraAnimation>[],
        onSpanAdded: (span: MmdAnimationSpan) => void,
        onSpanRemoved: (removeIndex: number) => void
    ) {
        this.animation = animation;

        this._runtimeAnimations = runtimeAnimations;
        this._onSpanAdded = onSpanAdded;
        this._onSpanRemoved = onSpanRemoved;

        animation.onSpanAddedObservable.add(onSpanAdded);
        animation.onSpanRemovedObservable.add(onSpanRemoved);
    }

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    public animate(frameTime: number): void {
        frameTime;
        this._runtimeAnimations;
        throw new Error("Method not implemented.");
    }

    /**
     * Dispose. remove all event listeners
     */
    public dispose(): void {
        if (this._onSpanAdded !== null) {
            this.animation.onSpanAddedObservable.removeCallback(this._onSpanAdded);
            this.animation.onSpanRemovedObservable.removeCallback(this._onSpanRemoved!);
            this._onSpanAdded = null;
            this._onSpanRemoved = null;
        }
    }

    /**
     * bind animation to camera
     * @param animation animation to bind
     * @param camera bind target
     * @returns MmdCompositeRuntimeCameraAnimation instance
     */
    public static Create(animation: MmdCompositeAnimation, camera: MmdCamera): MmdCompositeRuntimeCameraAnimation {
        const runtimeAnimations: Nullable<IMmdRuntimeCameraAnimation>[] = new Array(animation.spans.length).fill(null);
        const spans = animation.spans;
        for (let i = 0; i < spans.length; ++i) {
            const animation = spans[i].animation;
            if ((animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation !== undefined) {
                const runtimeAnimation = (animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation(camera);
                runtimeAnimations[i] = runtimeAnimation;
            } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation === undefined) {
                throw new Error(`animation ${animation.name} is not bindable. are you missing import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation" or "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimationGroup"?`);
            }
        }

        const onSpanAdded = (span: MmdAnimationSpan): void => {
            const animation = span.animation;
            if ((animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation !== undefined) {
                const runtimeAnimation = (animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation(camera);
                runtimeAnimations.push(runtimeAnimation);
            } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation === undefined) {
                throw new Error(`animation ${animation.name} is not bindable. are you missing import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation" or "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimationGroup"?`);
            } else {
                runtimeAnimations.push(null);
            }
        };

        const onSpanRemoved = (removeIndex: number): void => {
            runtimeAnimations.splice(removeIndex, 1);
        };

        return new MmdCompositeRuntimeCameraAnimation(animation, runtimeAnimations, onSpanAdded, onSpanRemoved);
    }
}

declare module "./mmdCompositeAnimation" {
    export interface MmdCompositeAnimation extends IMmdBindableCameraAnimation<MmdCompositeRuntimeCameraAnimation> { }
}

/**
 * Create runtime camera animation
 * @param camera bind target
 * @returns MmdRuntimeCameraAnimation instance
 */
MmdCompositeAnimation.prototype.createRuntimeCameraAnimation = function(camera: MmdCamera): MmdCompositeRuntimeCameraAnimation {
    return MmdCompositeRuntimeCameraAnimation.Create(this, camera);
};
