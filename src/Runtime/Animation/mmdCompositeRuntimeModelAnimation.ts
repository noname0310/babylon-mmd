import type { Nullable } from "@babylonjs/core/types";

import type { ILogger } from "../ILogger";
import type { MmdModel } from "../mmdModel";
import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation, IMmdRuntimeModelAnimationWithBindingInfo } from "./IMmdRuntimeAnimation";
import type { MmdAnimationSpan } from "./mmdCompositeAnimation";
import { MmdCompositeAnimation } from "./mmdCompositeAnimation";

/**
 * Mmd composite runtime model animation
 *
 * An object with mmd composite animation and model binding information
 */
export class MmdCompositeRuntimeModelAnimation implements IMmdRuntimeModelAnimation {
    /**
     * The animation data
     */
    public animation: MmdCompositeAnimation;

    private readonly _runtimeAnimations: Nullable<IMmdRuntimeModelAnimationWithBindingInfo>[];
    private _onSpanAdded: Nullable<(span: MmdAnimationSpan) => void>;
    private _onSpanRemoved: Nullable<(removeIndex: number) => void>;

    private constructor(
        animation: MmdCompositeAnimation,
        runtimeAnimations: Nullable<IMmdRuntimeModelAnimationWithBindingInfo>[],
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
     * Induce material recompile
     *
     * This method must run once before the animation runs
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     * @param logger logger
     */
    public induceMaterialRecompile(logger?: ILogger): void {
        const runtimeAnimations = this._runtimeAnimations;
        for (let i = 0; i < runtimeAnimations.length; ++i) {
            runtimeAnimations[i]?.induceMaterialRecompile(logger);
        }
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
     * Bind animation to model and prepare material for morph animation
     * @param animation Animation to bind
     * @param model Bind target
     * @param retargetingMap Model bone name to animation bone name map
     * @param logger Logger
     * @return MmdCompositeRuntimeModelAnimation instance
     */
    public static Create(animation: MmdCompositeAnimation, model: MmdModel, retargetingMap?: { [key: string]: string }, logger?: ILogger): MmdCompositeRuntimeModelAnimation {
        const runtimeAnimations: Nullable<IMmdRuntimeModelAnimationWithBindingInfo>[] = new Array(animation.spans.length).fill(null);
        const spans = animation.spans;
        for (let i = 0; i < spans.length; ++i) {
            const animation = spans[i].animation;
            if ((animation as IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>).createRuntimeModelAnimation !== undefined) {
                const runtimeAnimation = (animation as IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>).createRuntimeModelAnimation(model, retargetingMap, logger);
                runtimeAnimations[i] = runtimeAnimation;
            } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation === undefined) {
                throw new Error(`animation ${animation.name} is not bindable. are you missing import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation" or "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationGroup"?`);
            }
        }

        const onSpanAdded = (span: MmdAnimationSpan): void => {
            const animation = span.animation;
            if ((animation as IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>).createRuntimeModelAnimation !== undefined) {
                const runtimeAnimation = (animation as IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>).createRuntimeModelAnimation(model, retargetingMap, logger);
                runtimeAnimations.push(runtimeAnimation);
            } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation === undefined) {
                throw new Error(`animation ${animation.name} is not bindable. are you missing import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation" or "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationGroup"?`);
            } else {
                runtimeAnimations.push(null);
            }
        };

        const onSpanRemoved = (removeIndex: number): void => {
            runtimeAnimations.splice(removeIndex, 1);
        };

        return new MmdCompositeRuntimeModelAnimation(animation, runtimeAnimations, onSpanAdded, onSpanRemoved);
    }
}

declare module "./mmdCompositeAnimation" {
    export interface MmdCompositeAnimation extends IMmdBindableModelAnimation<MmdCompositeRuntimeModelAnimation> { }
}

/**
 * Create runtime camera animation
 * @param camera bind target
 * @returns MmdRuntimeCameraAnimation instance
 */
MmdCompositeAnimation.prototype.createRuntimeModelAnimation = function(
    model: MmdModel,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdCompositeRuntimeModelAnimation {
    return MmdCompositeRuntimeModelAnimation.Create(this, model, retargetingMap, logger);
};
