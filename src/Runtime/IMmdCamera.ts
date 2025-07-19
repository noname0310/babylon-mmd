import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Observable } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdBindableCameraAnimation } from "./Animation/IMmdBindableAnimation";
import type { IMmdRuntimeCameraAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { MmdCompositeRuntimeCameraAnimation } from "./Animation/mmdCompositeRuntimeCameraAnimation";
import type { MmdRuntimeCameraAnimation } from "./Animation/mmdRuntimeCameraAnimation";
import type { MmdRuntimeCameraAnimationContainer } from "./Animation/mmdRuntimeCameraAnimationContainer";
import type { IMmdRuntimeAnimatable } from "./IMmdRuntimeAnimatable";
import type { MmdRuntimeAnimationHandle } from "./mmdRuntimeAnimationHandle";

type RuntimeCameraAnimation = MmdRuntimeCameraAnimation | MmdRuntimeCameraAnimationContainer | MmdCompositeRuntimeCameraAnimation | IMmdRuntimeCameraAnimation;

/**
 * Interface for MMD camera
 *
 * You can implement this interface to create your own MMD camera implementation
 */
export interface IMmdCamera extends IMmdRuntimeAnimatable {
    /**
     * Observable triggered when the animation duration is changed
     *
     * Value is 30fps frame time duration of the animation
     */
    readonly onAnimationDurationChangedObservable: Observable<number>;

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
     * Bind the animation to the camera and return a handle to the runtime animation
     * @param animation  MMD animation or MMD camera animation group to add
     * @returns A handle to the runtime animation
     */
    createRuntimeAnimation(animation: IMmdBindableCameraAnimation): MmdRuntimeAnimationHandle;

    /**
     * Destroy a runtime animation by its handle
     * @param handle The handle of the runtime animation to destroy
     * @returns True if the animation was destroyed, false if it was not found
     */
    destroyRuntimeAnimation(handle: MmdRuntimeAnimationHandle): boolean;

    /**
     * Set the current animation of the camera
     *
     * If handle is null, the current animation will be cleared
     *
     * @param handle The handle of the animation to set as current
     * @returns True if the animation was set, false if it was not found
     */
    setRuntimeAnimation(handle: Nullable<MmdRuntimeAnimationHandle>): boolean;

    /**
     * Get the runtime animation map of the camera
     */
    get runtimeAnimations(): ReadonlyMap<MmdRuntimeAnimationHandle, RuntimeCameraAnimation>;

    /**
     * Get the current animation of the camera
     */
    get currentAnimation(): Nullable<RuntimeCameraAnimation>;

    /**
     * Animate the camera
     * @param frameTime The 30fps frame time
     */
    animate(frameTime: number): void;

    /**
     * Get the scene that the camera belongs to
     */
    getScene(): Nullable<Scene>;
}
