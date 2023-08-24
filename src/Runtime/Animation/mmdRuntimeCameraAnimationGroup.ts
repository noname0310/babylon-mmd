import { MmdCameraAnimationGroup } from "@/Loader/Animation/mmdCameraAnimationGroup";

import type { MmdCamera } from "../mmdCamera";
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

    private readonly _camera: MmdCamera;

    private constructor(
        animation: MmdCameraAnimationGroup,
        camera: MmdCamera
    ) {
        this.animation = animation;
        this._camera = camera;
    }

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    public animate(frameTime: number): void {
        const animation = this.animation;
        const camera = this._camera;
        camera.position.copyFrom(animation.positionAnimation.evaluate(frameTime));
        camera.rotation.copyFrom(animation.rotationAnimation.evaluate(frameTime));
        camera.distance = animation.distanceAnimation.evaluate(frameTime);
        camera.fov = animation.fovAnimation.evaluate(frameTime);
    }

    /**
     * bind animation to camera
     * @param animation animation to bind
     * @param camera bind target
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
 * @param camera bind target
 * @returns MmdRuntimeCameraAnimationGroup instance
 */
MmdCameraAnimationGroup.prototype.createRuntimeCameraAnimation = function(camera: MmdCamera): MmdRuntimeCameraAnimationGroup {
    return MmdRuntimeCameraAnimationGroup.Create(this, camera);
};
