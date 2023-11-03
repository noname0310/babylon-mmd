import { Observable } from "@babylonjs/core/Misc/observable";

import type { IMmdAnimation } from "@/Loader/Animation/IMmdAnimation";

import type { IMmdBindableCameraAnimation, IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimationWithBindingInfo } from "./IMmdRuntimeAnimation";

type IMmdBindableAnimation = IMmdBindableCameraAnimation | IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>;

/**
 * Represents a slice of an MMD animation
 */
export class MmdAnimationSpan {
    /**
     * The animation that this span uses
     */
    public readonly animation: IMmdBindableAnimation;

    /**
     * Start frame of the span (default: animation.startFrame)
     *
     * You can slice the desired range by the difference from the starting point of the original animation
     */
    public startFrame: number;

    /**
     * End frame of the span (default: animation.endFrame)
     *
     * You can slice the desired range by the difference from the starting point of the original animation
     */
    public endFrame: number;

    /**
     * Offset of the span (default: 0)
     *
     * Determines at what point in the `MmdCompositeAnimation` the span will be played
     */
    public offset: number;

    /**
     * Animation weight (default: 1)
     *
     * Internally, it is normalized and treated as a value between 0 and 1 on evaluation
     */
    public weight: number;

    /**
     * Create a new span
     * @param animation Bindable animation, which typically means `MmdAnimation`
     * @param startFrame Start frame of the span (default: animation.startFrame)
     * @param endFrame End frame of the span (default: animation.endFrame)
     * @param offset Offset of the span (default: 0)
     * @param weight Animation weight (default: 1)
     */
    public constructor(animation: IMmdBindableAnimation, startFrame?: number, endFrame?: number, offset?: number, weight?: number) {
        this.animation = animation;
        this.startFrame = startFrame ?? animation.startFrame;
        this.endFrame = endFrame ?? animation.endFrame;
        this.offset = offset ?? 0;
        this.weight = weight ?? 1;
    }

    /**
     * Name of the animation
     */
    public get name(): string {
        return this.animation.name;
    }

    public isInSpan(frameTime: number): boolean {
        return this.startFrame + this.offset <= frameTime && frameTime <= this.endFrame + this.offset;
    }

    public getFrameTime(frameTime: number): number {
        return frameTime - this.startFrame - this.offset;
    }
}

/**
 * Combine multiple animations into a single animation
 *
 * Good for uses like QTE sequences where animation blending is determined at runtime
 */
export class MmdCompositeAnimation implements IMmdAnimation {
    /**
     * Observable that is triggered when a span is added
     */
    public readonly onSpanAddedObservable: Observable<MmdAnimationSpan>;

    /**
     * Observable that is triggered when a span is removed
     */
    public readonly onSpanRemovedObservable: Observable<number>;

    /**
     * Animation name for identification
     */
    public readonly name: string;

    private _startFrame: number;
    private _endFrame: number;

    private readonly _spans: MmdAnimationSpan[];

    /**
     * Create a new composite animation
     * @param name Animation name
     */
    public constructor(name: string) {
        this.onSpanAddedObservable = new Observable();
        this.onSpanRemovedObservable = new Observable();

        this.name = name;
        this._startFrame = 0;
        this._endFrame = 0;

        this._spans = [];
    }

    /**
     * Add a span to the animation
     *
     * animation will be pushed to the end of the `spans` array
     * @param span Span to add
     */
    public addSpan(span: MmdAnimationSpan): void {
        this._startFrame = this._spans.length === 0
            ? span.startFrame + span.offset
            : Math.min(this.startFrame, span.startFrame + span.offset);
        this._endFrame = Math.max(this.endFrame, span.endFrame + span.offset);

        this._spans.push(span);
        this.onSpanAddedObservable.notifyObservers(span);
    }

    /**
     * Remove a span from the animation
     *
     * If the span does not exist, do nothing
     * @param span Span to remove
     */
    public removeSpan(span: MmdAnimationSpan): void {
        const spans = this._spans;

        const index = spans.indexOf(span);
        this.removeSpanFromIndex(index);
    }

    /**
     * Remove a span from the animation
     *
     * If index is out of range, do nothing
     * @param index Index of the span to remove
     */
    public removeSpanFromIndex(index: number): void {
        const spans = this._spans;
        if (index < 0 || spans.length <= index) return;
        spans.splice(index, 1);

        if (spans.length === 0) {
            this._startFrame = 0;
            this._endFrame = 0;
        } else {
            let startFrame = spans[0].startFrame + spans[0].offset;
            let endFrame = spans[0].endFrame + spans[0].offset;

            for (let i = 1; i < spans.length; i++) {
                const span = spans[i];
                startFrame = Math.min(startFrame, span.startFrame + span.offset);
                endFrame = Math.max(endFrame, span.endFrame + span.offset);
            }

            this._startFrame = startFrame;
            this._endFrame = endFrame;
        }
        this.onSpanRemovedObservable.notifyObservers(index);
    }

    /**
     * The start frame of this animation
     */
    public get startFrame(): number {
        return this._startFrame;
    }

    /**
     * The end frame of this animation
     */
    public get endFrame(): number {
        return this._endFrame;
    }

    /**
     * The spans of this animation
     */
    public get spans(): readonly MmdAnimationSpan[] {
        return this._spans;
    }
}
