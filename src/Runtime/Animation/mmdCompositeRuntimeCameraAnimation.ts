import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdCamera } from "../IMmdCamera";
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

    private readonly _camera: IMmdCamera;
    private readonly _runtimeAnimations: Nullable<IMmdRuntimeCameraAnimation>[];
    private _onSpanAdded: Nullable<(span: MmdAnimationSpan) => void>;
    private _onSpanRemoved: Nullable<(removeIndex: number) => void>;

    private constructor(
        animation: MmdCompositeAnimation,
        camera: IMmdCamera,
        runtimeAnimations: Nullable<IMmdRuntimeCameraAnimation>[],
        onSpanAdded: (span: MmdAnimationSpan) => void,
        onSpanRemoved: (removeIndex: number) => void
    ) {
        this.animation = animation;

        this._camera = camera;
        this._runtimeAnimations = runtimeAnimations;
        this._onSpanAdded = onSpanAdded;
        this._onSpanRemoved = onSpanRemoved;

        animation.onSpanAddedObservable.add(onSpanAdded);
        animation.onSpanRemovedObservable.add(onSpanRemoved);
    }

    private static readonly _ActiveAnimationSpans: MmdAnimationSpan[] = [];
    private static readonly _ActiveRuntimeAnimations: IMmdRuntimeCameraAnimation[] = [];

    private static readonly _CameraPosition = new Vector3();
    private static readonly _CameraRotation = new Vector3();

    /**
     * Update animation
     * @param frameTime Frame time in 30fps
     */
    public animate(frameTime: number): void {
        frameTime = Math.max(this.animation.startFrame, Math.min(this.animation.endFrame, frameTime));

        const spans = this.animation.spans;
        const runtimeAnimations = this._runtimeAnimations;

        const activeAnimationSpans = MmdCompositeRuntimeCameraAnimation._ActiveAnimationSpans;
        const activeRuntimeAnimations = MmdCompositeRuntimeCameraAnimation._ActiveRuntimeAnimations;

        for (let i = 0; i < spans.length; ++i) {
            const span = spans[i];
            const runtimeAnimation = runtimeAnimations[i];
            if (runtimeAnimation !== null && 0 < span.weight && span.isInSpan(frameTime)) {
                activeAnimationSpans.push(span);
                activeRuntimeAnimations.push(runtimeAnimation);
            }
        }

        let totalWeight = 0;
        for (let i = 0; i < activeAnimationSpans.length; ++i) {
            totalWeight += activeAnimationSpans[i].getEasedWeight(activeAnimationSpans[i].getFrameTime(frameTime));
        }

        const camera = this._camera;

        if (totalWeight === 0) { // avoid divide by zero
            // camera does not have rest pose
            // camera.target.setAll(0);
            // camera.rotation.setAll(0);
            // camera.distance = 0;
            // camera.fov = 0;

            activeAnimationSpans.length = 0;
            activeRuntimeAnimations.length = 0;
            return;
        }

        if (totalWeight === 1 && activeAnimationSpans.length === 1) { // for one animation, just animate it
            const span = activeAnimationSpans[0];
            const runtimeAnimation = activeRuntimeAnimations[0];

            runtimeAnimation.animate(span.getFrameTime(frameTime));
            activeAnimationSpans.length = 0;
            activeRuntimeAnimations.length = 0;
            return;
        }

        const normalizer = totalWeight < 1.0 ? 1.0 : 1.0 / totalWeight;

        const position = MmdCompositeRuntimeCameraAnimation._CameraPosition.setAll(0);
        const rotation = MmdCompositeRuntimeCameraAnimation._CameraRotation.setAll(0);
        let distance = 0;
        let fov = 0;

        for (let i = 0; i < activeAnimationSpans.length; ++i) {
            const span = activeAnimationSpans[i];
            const runtimeAnimation = activeRuntimeAnimations[i];

            const frameTimeInSpan = span.getFrameTime(frameTime);
            runtimeAnimation.animate(frameTimeInSpan);
            const weight = span.getEasedWeight(frameTimeInSpan) * normalizer;

            camera.target.scaleAndAddToRef(weight, position);
            camera.rotation.scaleAndAddToRef(weight, rotation);
            distance += camera.distance * weight;
            fov += camera.fov * weight;
        }

        camera.target.copyFrom(position);
        camera.rotation.copyFrom(rotation);
        camera.distance = distance;
        camera.fov = fov;

        activeAnimationSpans.length = 0;
        activeRuntimeAnimations.length = 0;
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
     * Bind animation to camera
     * @param animation Animation to bind
     * @param camera Bind target
     * @returns MmdCompositeRuntimeCameraAnimation instance
     */
    public static Create(animation: MmdCompositeAnimation, camera: IMmdCamera): MmdCompositeRuntimeCameraAnimation {
        const runtimeAnimations: Nullable<IMmdRuntimeCameraAnimation>[] = new Array(animation.spans.length).fill(null);
        const spans = animation.spans;
        for (let i = 0; i < spans.length; ++i) {
            const animation = spans[i].animation;
            if ((animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation !== undefined) {
                const runtimeAnimation = (animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation(camera);
                runtimeAnimations[i] = runtimeAnimation;
            } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation === undefined) {
                throw new Error(`animation ${animation.name} is not bindable. are you missing import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation" or "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimationContainer"?`);
            }
        }

        const onSpanAdded = (span: MmdAnimationSpan): void => {
            const animation = span.animation;
            if ((animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation !== undefined) {
                const runtimeAnimation = (animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation(camera);
                runtimeAnimations.push(runtimeAnimation);
            } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation === undefined) {
                throw new Error(`animation ${animation.name} is not bindable. are you missing import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation" or "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimationContainer"?`);
            } else {
                runtimeAnimations.push(null);
            }
        };

        const onSpanRemoved = (removeIndex: number): void => {
            runtimeAnimations.splice(removeIndex, 1);
        };

        return new MmdCompositeRuntimeCameraAnimation(animation, camera, runtimeAnimations, onSpanAdded, onSpanRemoved);
    }
}

declare module "./mmdCompositeAnimation" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdCompositeAnimation extends IMmdBindableCameraAnimation<MmdCompositeRuntimeCameraAnimation> { }
}

/**
 * Create runtime camera animation
 * @param camera Bind target
 * @returns MmdRuntimeCameraAnimation instance
 */
MmdCompositeAnimation.prototype.createRuntimeCameraAnimation = function(camera: IMmdCamera): MmdCompositeRuntimeCameraAnimation {
    return MmdCompositeRuntimeCameraAnimation.Create(this, camera);
};
