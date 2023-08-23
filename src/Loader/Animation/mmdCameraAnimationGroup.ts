import { Animation } from "@babylonjs/core/Animations/animation";
import type { IAnimationKey } from "@babylonjs/core/Animations/animationKey";
import { AnimationKeyInterpolation } from "@babylonjs/core/Animations/animationKey";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { IMmdAnimation } from "./IMmdAnimation";
import type { MmdAnimation } from "./mmdAnimation";
import type { MmdCameraAnimationTrack } from "./mmdAnimationTrack";

/**
 * A container type that stores mmd camera animations using the `Animation` container in babylon.js
 *
 * It aims to utilize the animation runtime of babylon.js
 */
export class MmdCameraAnimationGroup implements IMmdAnimation {
    /**
     * Animation name for identification
     */
    public readonly name: string;

    /**
     * Position animation track for `MmdCamera.position`
     */
    public readonly positionAnimation: Animation;

    /**
     * Rotation animation track for `MmdCamera.rotation`
     */
    public readonly rotationAnimation: Animation;

    /**
     * Distance animation track for `MmdCamera.distance`
     */
    public readonly distanceAnimation: Animation;

    /**
     * FOV animation track for `MmdCamera.fov`
     */
    public readonly fovAnimation: Animation;

    /**
     * The start frame of this animation
     */
    public readonly startFrame: number;

    /**
     * The end frame of this animation
     */
    public readonly endFrame: number;

    /**
     * Create a unbinded mmd camera animation group
     * @param mmdAnimation The mmd animation data
     */
    public constructor(
        mmdAnimation: MmdAnimation
    ) {
        this.name = mmdAnimation.name;

        this.positionAnimation = this._createPositionAnimation(mmdAnimation.cameraTrack);
        this.rotationAnimation = this._createRotationAnimation(mmdAnimation.cameraTrack);
        this.distanceAnimation = this._createDistanceAnimation(mmdAnimation.cameraTrack);
        this.fovAnimation = this._createFovAnimation(mmdAnimation.cameraTrack);

        this.startFrame = mmdAnimation.startFrame;
        this.endFrame = mmdAnimation.endFrame;
    }

    private _clampTangent(tangent: number): number {
        return Math.max(-Math.PI, Math.min(Math.PI, tangent));
    }

    private _createPositionAnimation(mmdAnimationTrack: MmdCameraAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "position", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);

        const frameNumbers = mmdAnimationTrack.frameNumbers;
        const positions = mmdAnimationTrack.positions;
        const positionInterpolations = mmdAnimationTrack.positionInterpolations;

        const keys = new Array<IAnimationKey>(frameNumbers.length);
        for (let i = 0; i < frameNumbers.length; i++) {
            const frame = frameNumbers[i];
            const hasPreviousFrame = 0 < i;
            const nextFrame = i + 1 < frameNumbers.length ? frameNumbers[i + 1] : Infinity;
            const inFrameDelta = frame - (0 < i ? frameNumbers[i - 1] : -30);
            const outFrameDelta = nextFrame - frame;
            const interpolationKind = outFrameDelta < 1.0001 ? AnimationKeyInterpolation.STEP : AnimationKeyInterpolation.NONE;

            keys[i] = {
                frame: frame,
                value: new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]),
                inTangent: hasPreviousFrame
                    ? new Vector3(
                        this._clampTangent(((1 - positionInterpolations[i * 12 + 3] / 127) * (positions[i * 3] - positions[(i - 1) * 3])) / (1 - positionInterpolations[i * 12 + 1] / 127)) / inFrameDelta,
                        this._clampTangent(((1 - positionInterpolations[i * 12 + 7] / 127) * (positions[i * 3 + 1] - positions[(i - 1) * 3 + 1])) / (1 - positionInterpolations[i * 12 + 5] / 127)) / inFrameDelta,
                        this._clampTangent(((1 - positionInterpolations[i * 12 + 11] / 127) * (positions[i * 3 + 2] - positions[(i - 1) * 3 + 2])) / (1 - positionInterpolations[i * 12 + 9] / 127)) / inFrameDelta
                    )
                    : undefined,
                outTangent: nextFrame < Infinity
                    ? new Vector3(
                        this._clampTangent(((positionInterpolations[(i + 1) * 12 + 2] / 127) * (positions[(i + 1) * 3] - positions[i * 3])) / (positionInterpolations[(i + 1) * 12 + 0] / 127)) / outFrameDelta,
                        this._clampTangent(((positionInterpolations[(i + 1) * 12 + 6] / 127) * (positions[(i + 1) * 3 + 1] - positions[i * 3 + 1])) / (positionInterpolations[(i + 1) * 12 + 4] / 127)) / outFrameDelta,
                        this._clampTangent(((positionInterpolations[(i + 1) * 12 + 10] / 127) * (positions[(i + 1) * 3 + 2] - positions[i * 3 + 2])) / (positionInterpolations[(i + 1) * 12 + 8] / 127)) / outFrameDelta
                    )
                    : undefined,
                interpolation: interpolationKind,
                lockedTangent: false
            };
        }
        animation.setKeys(keys);

        return animation;
    }

    private _createRotationAnimation(mmdAnimationTrack: MmdCameraAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "rotation", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);

        const frameNumbers = mmdAnimationTrack.frameNumbers;
        const rotations = mmdAnimationTrack.rotations;
        const rotationInterpolations = mmdAnimationTrack.rotationInterpolations;

        const keys = new Array<IAnimationKey>(frameNumbers.length);
        for (let i = 0; i < frameNumbers.length; i++) {
            const frame = frameNumbers[i];
            const hasPreviousFrame = 0 < i;
            const nextFrame = i + 1 < frameNumbers.length ? frameNumbers[i + 1] : Infinity;
            const inFrameDelta = frame - (0 < i ? frameNumbers[i - 1] : -30);
            const outFrameDelta = nextFrame - frame;
            const interpolationKind = outFrameDelta < 1.0001 ? AnimationKeyInterpolation.STEP : AnimationKeyInterpolation.NONE;

            keys[i] = {
                frame: frame,
                value: new Vector3(rotations[i * 3], rotations[i * 3 + 1], rotations[i * 3 + 2]),
                inTangent: hasPreviousFrame
                    ? new Vector3(
                        this._clampTangent(((1 - rotationInterpolations[i * 4 + 3] / 127) * (rotations[i * 3] - rotations[(i - 1) * 3])) / (1 - rotationInterpolations[i * 4 + 1] / 127)) / inFrameDelta,
                        this._clampTangent(((1 - rotationInterpolations[i * 4 + 3] / 127) * (rotations[i * 3 + 1] - rotations[(i - 1) * 3 + 1])) / (1 - rotationInterpolations[i * 4 + 1] / 127)) / inFrameDelta,
                        this._clampTangent(((1 - rotationInterpolations[i * 4 + 3] / 127) * (rotations[i * 3 + 2] - rotations[(i - 1) * 3 + 2])) / (1 - rotationInterpolations[i * 4 + 1] / 127)) / inFrameDelta
                    )
                    : undefined,
                outTangent: nextFrame < Infinity
                    ? new Vector3(
                        this._clampTangent((rotationInterpolations[(i + 1) * 4 + 2] / 127 * (rotations[(i + 1) * 3] - rotations[i * 3])) / (rotationInterpolations[(i + 1) * 4 + 0] / 127)) / outFrameDelta,
                        this._clampTangent((rotationInterpolations[(i + 1) * 4 + 2] / 127 * (rotations[(i + 1) * 3 + 1] - rotations[i * 3 + 1])) / (rotationInterpolations[(i + 1) * 4 + 0] / 127)) / outFrameDelta,
                        this._clampTangent((rotationInterpolations[(i + 1) * 4 + 2] / 127 * (rotations[(i + 1) * 3 + 2] - rotations[i * 3 + 2])) / (rotationInterpolations[(i + 1) * 4 + 0] / 127)) / outFrameDelta
                    )
                    : undefined,
                interpolation: interpolationKind,
                lockedTangent: false
            };
        }
        animation.setKeys(keys);

        return animation;
    }

    private _createDistanceAnimation(mmdAnimationTrack: MmdCameraAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "distance", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);

        const frameNumbers = mmdAnimationTrack.frameNumbers;
        const distances = mmdAnimationTrack.distances;
        const distanceInterpolations = mmdAnimationTrack.distanceInterpolations;

        const keys = new Array<IAnimationKey>(frameNumbers.length);
        for (let i = 0; i < frameNumbers.length; i++) {
            const frame = frameNumbers[i];
            const hasPreviousFrame = 0 < i;
            const nextFrame = i + 1 < frameNumbers.length ? frameNumbers[i + 1] : Infinity;
            const inFrameDelta = frame - (0 < i ? frameNumbers[i - 1] : -30);
            const outFrameDelta = nextFrame - frame;
            const interpolationKind = outFrameDelta < 1.0001 ? AnimationKeyInterpolation.STEP : AnimationKeyInterpolation.NONE;

            keys[i] = {
                frame: frame,
                value: distances[i],
                inTangent: hasPreviousFrame
                    ? this._clampTangent(((1 - distanceInterpolations[i * 4 + 3] / 127) * (distances[i] - distances[i - 1])) / (1 - distanceInterpolations[i * 4 + 1] / 127)) / inFrameDelta
                    : undefined,
                outTangent: nextFrame < Infinity
                    ? this._clampTangent((distanceInterpolations[(i + 1) * 4 + 2] / 127 * (distances[i + 1] - distances[i])) / (distanceInterpolations[(i + 1) * 4 + 0] / 127)) / outFrameDelta
                    : undefined,
                interpolation: interpolationKind,
                lockedTangent: false
            };
        }
        animation.setKeys(keys);

        return animation;
    }

    private _createFovAnimation(mmdAnimationTrack: MmdCameraAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "fov", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);

        const frameNumbers = mmdAnimationTrack.frameNumbers;
        const fovs = mmdAnimationTrack.fovs;
        const fovInterpolations = mmdAnimationTrack.fovInterpolations;

        const degToRad = Math.PI / 180;

        const keys = new Array<IAnimationKey>(frameNumbers.length);
        for (let i = 0; i < frameNumbers.length; i++) {
            const frame = frameNumbers[i];
            const hasPreviousFrame = 0 < i;
            const nextFrame = i + 1 < frameNumbers.length ? frameNumbers[i + 1] : Infinity;
            const inFrameDelta = frame - (0 < i ? frameNumbers[i - 1] : -30);
            const outFrameDelta = nextFrame - frame;
            const interpolationKind = outFrameDelta < 1.0001 ? AnimationKeyInterpolation.STEP : AnimationKeyInterpolation.NONE;

            keys[i] = {
                frame: frame,
                value: fovs[i] * degToRad,
                inTangent: hasPreviousFrame
                    ? this._clampTangent(((1 - fovInterpolations[i * 4 + 3] / 127) * (fovs[i] * degToRad - fovs[i - 1] * degToRad)) / (1 - fovInterpolations[i * 4 + 1] / 127)) / inFrameDelta
                    : undefined,
                outTangent: nextFrame < Infinity
                    ? this._clampTangent((fovInterpolations[(i + 1) * 4 + 2] / 127 * (fovs[i + 1] * degToRad - fovs[i] * degToRad)) / (fovInterpolations[(i + 1) * 4 + 0] / 127)) / outFrameDelta
                    : undefined,
                interpolation: interpolationKind,
                lockedTangent: false
            };
        }
        animation.setKeys(keys);

        return animation;
    }
}
