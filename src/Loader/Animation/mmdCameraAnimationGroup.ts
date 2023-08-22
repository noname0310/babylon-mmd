import { Animation } from "@babylonjs/core/Animations/animation";

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

    private _createPositionAnimation(mmdAnimationTrack: MmdCameraAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "position", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);

        return animation;
    }

    private _createRotationAnimation(mmdAnimationTrack: MmdCameraAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "rotation", 30, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CYCLE);

        return animation;
    }

    private _createDistanceAnimation(mmdAnimationTrack: MmdCameraAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "distance", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);

        return animation;
    }

    private _createFovAnimation(mmdAnimationTrack: MmdCameraAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "fov", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);

        return animation;
    }
}
