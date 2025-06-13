import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Observable } from "@babylonjs/core/Misc/observable";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdBindableCameraAnimation } from "./Animation/IMmdBindableAnimation";
import type { IMmdRuntimeCameraAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { MmdCompositeRuntimeCameraAnimation } from "./Animation/mmdCompositeRuntimeCameraAnimation";
import type { MmdRuntimeCameraAnimation } from "./Animation/mmdRuntimeCameraAnimation";
import type { MmdRuntimeCameraAnimationGroup } from "./Animation/mmdRuntimeCameraAnimationGroup";

type RuntimeCameraAnimation = MmdRuntimeCameraAnimation | MmdRuntimeCameraAnimationGroup | MmdCompositeRuntimeCameraAnimation | IMmdRuntimeCameraAnimation;

/**
 * Interface for MMD camera
 *
 * You can implement this interface to create your own MMD camera implementation
 */
export interface IMmdCamera {
    /**
     * Observable triggered when the current animation is changed
     */
    readonly onCurrentAnimationChangedObservable: Observable<Nullable<RuntimeCameraAnimation>>;

    /**
     * Orbit center position
     *
     * This is the position that the camera orbits around
     */
    position: Vector3;

    /**
     * Rotation of the camera in radians
     *
     * This is the rotation of the camera around the orbit center position
     *
     * The rotation is in radians and is applied in the order of yaw, pitch, roll
     */
    rotation: Vector3;

    /**
     * Distance from the camera to the orbit center position
     */
    distance: number;

    /**
     * Field of view of the camera in radians
     */
    fov: number;

    /**
     * Add an animation to the camera
     * @param animation  MMD animation or MMD camera animation group to add
     */
    addAnimation(animation: IMmdBindableCameraAnimation): void;

    /**
     * Remove an animation from the camera
     *
     * If index is out of range, this method does nothing
     * @param index The index of the animation to remove
     */
    removeAnimation(index: number): void;

    /**
     * Set the current animation of the camera
     *
     * If name is null, the current animation is set to null
     * @param name The name of the animation to set
     * @throws {Error} if the animation is not found
     */
    setAnimation(name: Nullable<string>): void;

    /**
     * Get the animations of the camera
     */
    get runtimeAnimations(): readonly RuntimeCameraAnimation[];

    /**
     * Get the current animation of the camera
     */
    get currentAnimation(): Nullable<RuntimeCameraAnimation>;

    /**
     * Animate the camera
     * @param frameTime The 30fps frame time
     */
    animate(frameTime: number): void;
}
