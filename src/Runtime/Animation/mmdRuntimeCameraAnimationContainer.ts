import type { _IAnimationState } from "@babylonjs/core/Animations/animation";

import { MmdCameraAnimationContainer } from "@/Loader/Animation/mmdCameraAnimationContainer";

import type { IMmdCamera } from "../IMmdCamera";
import { CreateAnimationState } from "./Common/createAnimationState";
import type { IMmdBindableCameraAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeCameraAnimation } from "./IMmdRuntimeAnimation";

/**
 * Mmd runtime camera animation that use animation container of babylon.js
 *
 * An object with mmd animation group and camera binding information
 */
export class MmdRuntimeCameraAnimationContainer implements IMmdRuntimeCameraAnimation {
    /**
     * The animation data
     */
    public readonly animation: MmdCameraAnimationContainer;

    private readonly _positionAnimationState: _IAnimationState;
    private readonly _rotationAnimationState: _IAnimationState;
    private readonly _distanceAnimationState: _IAnimationState;
    private readonly _fovAnimationState: _IAnimationState;

    private readonly _camera: IMmdCamera;

    private constructor(
        animation: MmdCameraAnimationContainer,
        camera: IMmdCamera
    ) {
        this.animation = animation;

        this._positionAnimationState = CreateAnimationState();
        this._rotationAnimationState = CreateAnimationState();
        this._distanceAnimationState = CreateAnimationState();
        this._fovAnimationState = CreateAnimationState();

        this._camera = camera;
    }

    /**
     * Update animation
     * @param frameTime Frame time in 30fps
     */
    public animate(frameTime: number): void {
        const animation = this.animation;
        const camera = this._camera;
        camera.target.copyFrom(animation.positionAnimation._interpolate(frameTime, this._positionAnimationState));
        camera.rotation.copyFrom(animation.rotationAnimation._interpolate(frameTime, this._rotationAnimationState));
        camera.distance = animation.distanceAnimation._interpolate(frameTime, this._distanceAnimationState);
        camera.fov = animation.fovAnimation._interpolate(frameTime, this._fovAnimationState);
    }

    /**
     * Bind animation to camera
     * @param animation Animation to bind
     * @param camera Bind target
     * @returns MmdRuntimeCameraAnimationContainer instance
     */
    public static Create(animation: MmdCameraAnimationContainer, camera: IMmdCamera): MmdRuntimeCameraAnimationContainer {
        return new MmdRuntimeCameraAnimationContainer(animation, camera);
    }
}

declare module "../../Loader/Animation/mmdCameraAnimationContainer" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdCameraAnimationContainer extends IMmdBindableCameraAnimation<MmdRuntimeCameraAnimationContainer> { }
}

/**
 * Create runtime camera animation
 * @param camera Bind target
 * @returns MmdRuntimeCameraAnimationContainer instance
 */
MmdCameraAnimationContainer.prototype.createRuntimeCameraAnimation = function(camera: IMmdCamera): MmdRuntimeCameraAnimationContainer {
    return MmdRuntimeCameraAnimationContainer.Create(this, camera);
};
