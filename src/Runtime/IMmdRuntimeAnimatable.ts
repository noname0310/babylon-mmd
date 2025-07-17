import type { Observable } from "@babylonjs/core/Misc/observable";

/**
 * Interface for animatable objects in MMD runtime
 */
export interface IMmdRuntimeAnimatable {
    /**
     * Observable triggered when the animation duration is changed
     */
    readonly onAnimationDurationChangedObservable?: Observable<number>;

    /**
     * Animate the object with the given frame time
     * @param frameTime The 30fps frame time
     */
    animate(frameTime: number): void;

    /**
     * Duration of the animation in 30fps frame time
     */
    get animationFrameTimeDuration(): number;
}
