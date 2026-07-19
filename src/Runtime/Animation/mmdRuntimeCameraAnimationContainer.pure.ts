import type { _IAnimationState } from "@babylonjs/core/Animations/animation.pure";

import { MmdCameraAnimationContainer } from "@/Loader/Animation/mmdCameraAnimationContainer";

import type { IMmdCamera } from "../IMmdCamera";
import { CreateAnimationState } from "./Common/createAnimationState";
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

let _Registered = false;
/**
 * Register side effects for MmdRuntimeCameraAnimationContainer
 * Safe to call multiple times; only the first call has an effect.
 */
export function RegisterMmdRuntimeCameraAnimationContainer(): void {
    if (_Registered) {
        return;
    }
    _Registered = true;

    MmdCameraAnimationContainer.prototype.createRuntimeCameraAnimation = function(camera: IMmdCamera): MmdRuntimeCameraAnimationContainer {
        return MmdRuntimeCameraAnimationContainer.Create(this, camera);
    };
}
