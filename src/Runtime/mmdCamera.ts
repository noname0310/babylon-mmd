import { Camera } from "@babylonjs/core/Cameras/camera";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdBindableCameraAnimation } from "./Animation/IMmdBindableAnimation";
import type { IMmdRuntimeCameraAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { MmdRuntimeCameraAnimation } from "./Animation/mmdRuntimeCameraAnimation";
import type { MmdRuntimeCameraAnimationGroup } from "./Animation/mmdRuntimeCameraAnimationGroup";

type RuntimeCameraAnimation = MmdRuntimeCameraAnimation | MmdRuntimeCameraAnimationGroup | IMmdRuntimeCameraAnimation;

/**
 * MMD camera
 *
 * The MMD camera is a type of Arc Rotate Camera that determines the transform of the camera by the center position, rotation(yaw pitch roll), and distance parameters
 */
export class MmdCamera extends Camera {
    /**
     * Gets or sets a boolean indicating that the scaling of the parent hierarchy will not be taken in account by the camera
     */
    public ignoreParentScaling = false;

    /**
     * Define the current rotation of the camera
     */
    public rotation = new Vector3();

    /**
     * Define the current distance of the camera from its target (default: -45)
     */
    public distance = -45;

    private readonly _viewMatrix = Matrix.Zero();
    private readonly _tmpUpVector = Vector3.Zero();
    private readonly _tmpTargetVector = Vector3.Zero();

    /**
     * Observable triggered when the current animation is changed
     */
    public readonly onCurrentAnimationChangedObservable: Observable<Nullable<RuntimeCameraAnimation>>;
    private readonly _animations: RuntimeCameraAnimation[];
    private readonly _animationIndexMap: Map<string, number>;

    private _currentAnimation: Nullable<RuntimeCameraAnimation>;

    /**
     * Creates a new MMD camera
     * @param name Defines the name of the camera in the scene
     * @param position Defines the position of the camera
     * @param scene Defines the scene the camera belongs too
     * @param setActiveOnSceneIfNoneActive Defines if the camera should be set as active after creation if no other camera have been defined in the scene
     */
    public constructor(name: string, position: Vector3 = new Vector3(0, 10, 0), scene?: Scene, setActiveOnSceneIfNoneActive = true) {
        super(name, position, scene, setActiveOnSceneIfNoneActive);

        // mmd default fov
        this.fov = 30 * (Math.PI / 180);

        this.onCurrentAnimationChangedObservable = new Observable<Nullable<RuntimeCameraAnimation>>();
        this._animations = [];
        this._animationIndexMap = new Map();

        this._currentAnimation = null;
    }

    /**
     * Add an animation to the camera
     * @param animation  MMD animation or MMD camera animation group to add
     */
    public addAnimation(animation: IMmdBindableCameraAnimation): void {
        let runtimeAnimation: RuntimeCameraAnimation;
        if ((animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation) {
            runtimeAnimation = animation.createRuntimeCameraAnimation(this);
        } else {
            throw new Error("animation is not MmdAnimation or MmdCameraAnimationGroup. are you missing import \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimationGroup\"?");
        }
        this._animationIndexMap.set(animation.name, this._animations.length);
        this._animations.push(runtimeAnimation);
    }

    /**
     * Remove an animation from the camera
     *
     * If index is out of range, this method does nothing
     * @param index The index of the animation to remove
     */
    public removeAnimation(index: number): void {
        const animation = this._animations[index];
        if (this._currentAnimation === animation) this._currentAnimation = null;

        this._animationIndexMap.delete(animation.animation.name);
        this._animations.splice(index, 1);
    }

    /**
     * Set the current animation of the camera
     *
     * If name is null, the current animation is set to null
     * @param name The name of the animation to set
     * @throws {Error} if the animation is not found
     */
    public setAnimation(name: Nullable<string>): void {
        if (name === null) {
            if (this._currentAnimation !== null) {
                this._currentAnimation = null;
                this.onCurrentAnimationChangedObservable.notifyObservers(null);
            }
            return;
        }

        const index = this._animationIndexMap.get(name);
        if (index === undefined) {
            throw new Error(`Animation ${name} is not found`);
        }

        this._currentAnimation = this._animations[index];
        this.onCurrentAnimationChangedObservable.notifyObservers(this._currentAnimation);
    }

    /**
     * Get the animations of the camera
     */
    public get runtimeAnimations(): readonly RuntimeCameraAnimation[] {
        return this._animations;
    }

    /**
     * Get the current animation of the camera
     */
    public get currentAnimation(): Nullable<RuntimeCameraAnimation> {
        return this._currentAnimation;
    }

    /**
     * Animate the camera
     * @param frameTime The 30fps frame time
     */
    public animate(frameTime: number): void {
        if (this._currentAnimation === null) return;

        this._currentAnimation.animate(frameTime);
    }

    private _storedPosition: Vector3 = null!;
    private _storedRotation: Vector3 = null!;
    private _storedDistance = 0;

    /**
     * Store current camera state of the camera (fov, position, rotation, etc..)
     * @returns the camera
     */
    public override storeState(): Camera {
        this._storedPosition = this.position.clone();
        this._storedRotation = this.rotation.clone();
        this._storedDistance = this.distance;

        return super.storeState();
    }

    /**
     * Restored camera state. You must call storeState() first
     * @returns whether it was successful or not
     * @internal
     */
    public override _restoreStateValues(): boolean {
        if (!super._restoreStateValues()) {
            return false;
        }

        this.position = this._storedPosition.clone();
        this.rotation = this._storedRotation.clone();

        this.distance = this._storedDistance;

        return true;
    }

    /** @internal */
    public override _initCache(): void {
        super._initCache();
        this._cache.rotation = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        this._cache.distance = Number.MAX_VALUE;
    }

    /**
     * @internal
     */
    public override _updateCache(ignoreParentClass?: boolean): void {
        if (!ignoreParentClass) {
            super._updateCache();
        }

        this._cache.rotation.copyFrom(this.rotation);
        this._cache.distance = this.distance;
    }

    // Synchronized
    /** @internal */
    public override _isSynchronizedViewMatrix(): boolean {
        if (!super._isSynchronizedViewMatrix()) {
            return false;
        }

        return (
            this._cache.rotation.equals(this.rotation) &&
            this._cache.distance === this.distance
        );
    }

    private static readonly _RotationMatrix = new Matrix();
    private static readonly _CameraEyePosition = new Vector3();
    private static readonly _UpVector = new Vector3();

    /** @internal */
    public override _getViewMatrix(): Matrix {
        const target = this.position;

        const rotationMatrix = Matrix.RotationYawPitchRollToRef(
            -this.rotation.y, -this.rotation.x, -this.rotation.z,
            MmdCamera._RotationMatrix
        );
        const cameraEyePosition = target.addToRef(
            Vector3.TransformCoordinatesFromFloatsToRef(0, 0, this.distance, rotationMatrix, MmdCamera._CameraEyePosition),
            MmdCamera._CameraEyePosition
        );
        const upVector = Vector3.TransformNormalFromFloatsToRef(0, 1, 0, rotationMatrix, MmdCamera._UpVector);

        if (this.ignoreParentScaling) {
            if (this.parent) {
                const parentWorldMatrix = this.parent.getWorldMatrix();
                Vector3.TransformCoordinatesToRef(cameraEyePosition, parentWorldMatrix, this._globalPosition);
                Vector3.TransformCoordinatesToRef(target, parentWorldMatrix, this._tmpTargetVector);
                Vector3.TransformNormalToRef(upVector, parentWorldMatrix, this._tmpUpVector);
                this._markSyncedWithParent();
            } else {
                this._globalPosition.copyFrom(cameraEyePosition);
                this._tmpTargetVector.copyFrom(target);
                this._tmpUpVector.copyFrom(upVector);
            }

            if (this.getScene().useRightHandedSystem) {
                Matrix.LookAtRHToRef(this._globalPosition, this._tmpTargetVector, this._tmpUpVector, this._viewMatrix);
            } else {
                Matrix.LookAtLHToRef(this._globalPosition, this._tmpTargetVector, this._tmpUpVector, this._viewMatrix);
            }
            return this._viewMatrix;
        }

        if (this.getScene().useRightHandedSystem) {
            Matrix.LookAtRHToRef(cameraEyePosition, target, upVector, this._viewMatrix);
        } else {
            Matrix.LookAtLHToRef(cameraEyePosition, target, upVector, this._viewMatrix);
        }

        if (this.parent) {
            const parentWorldMatrix = this.parent.getWorldMatrix();
            this._viewMatrix.invert();
            this._viewMatrix.multiplyToRef(parentWorldMatrix, this._viewMatrix);
            this._viewMatrix.getTranslationToRef(this._globalPosition);
            this._viewMatrix.invert();
            this._markSyncedWithParent();
        } else {
            this._globalPosition.copyFrom(cameraEyePosition);
        }

        return this._viewMatrix;
    }

    /**
     * Gets the current object class name.
     * @returns the class name
     */
    public override getClassName(): string {
        return "MmdCamera";
    }
}
