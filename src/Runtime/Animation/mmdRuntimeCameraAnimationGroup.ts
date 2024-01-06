import type { _IAnimationState } from "@babylonjs/core/Animations/animation";

import { MmdCameraAnimationGroup } from "@/Loader/Animation/mmdCameraAnimationGroup";

import type { MmdCamera } from "../mmdCamera";
import { createAnimationState } from "./Common/createAnimationState";
import type { IMmdBindableCameraAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeCameraAnimation } from "./IMmdRuntimeAnimation";

/**
 * Mmd runtime camera animation that use animation container of babylon.js
 *
 * An object with mmd animation group and camera binding information
 */
export class MmdRuntimeCameraAnimationGroup implements IMmdRuntimeCameraAnimation {
    /**
     * The animation data
     */
    public readonly animation: MmdCameraAnimationGroup;

    private readonly _positionAnimationState: _IAnimationState;
    private readonly _rotationAnimationState: _IAnimationState;
    private readonly _distanceAnimationState: _IAnimationState;
    private readonly _fovAnimationState: _IAnimationState;

    private readonly _camera: MmdCamera;

    private constructor(
        animation: MmdCameraAnimationGroup,
        camera: MmdCamera
    ) {
        this.animation = animation;

        this._positionAnimationState = createAnimationState();
        this._rotationAnimationState = createAnimationState();
        this._distanceAnimationState = createAnimationState();
        this._fovAnimationState = createAnimationState();

        this._camera = camera;
    }

    /**
     * Update animation
     * @param frameTime Frame time in 30fps
     */
    public animate(frameTime: number): void {
        const animation = this.animation;
        const camera = this._camera;
        camera.position.copyFrom(animation.positionAnimation._interpolate(frameTime, this._positionAnimationState));
        camera.rotation.copyFrom(animation.rotationAnimation._interpolate(frameTime, this._rotationAnimationState));
        camera.distance = animation.distanceAnimation._interpolate(frameTime, this._distanceAnimationState);
        camera.fov = animation.fovAnimation._interpolate(frameTime, this._fovAnimationState);
    }

    /**
     * Bind animation to camera
     * @param animation Animation to bind
     * @param camera Bind target
     * @returns MmdRuntimeCameraAnimationGroup instance
     */
    public static Create(animation: MmdCameraAnimationGroup, camera: MmdCamera): MmdRuntimeCameraAnimationGroup {
        return new MmdRuntimeCameraAnimationGroup(animation, camera);
    }
}

declare module "../../Loader/Animation/mmdCameraAnimationGroup" {
    export interface MmdCameraAnimationGroup extends IMmdBindableCameraAnimation<MmdRuntimeCameraAnimationGroup> { }
}

/**
 * Create runtime camera animation
 * @param camera Bind target
 * @returns MmdRuntimeCameraAnimationGroup instance
 */
MmdCameraAnimationGroup.prototype.createRuntimeCameraAnimation = function(camera: MmdCamera): MmdRuntimeCameraAnimationGroup {
    return MmdRuntimeCameraAnimationGroup.Create(this, camera);
};
