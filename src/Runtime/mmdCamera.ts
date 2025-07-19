import { Camera } from "@babylonjs/core/Cameras/camera";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { serialize, serializeAsVector3 } from "@babylonjs/core/Misc/decorators";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Node } from "@babylonjs/core/node";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdBindableCameraAnimation } from "./Animation/IMmdBindableAnimation";
import type { IMmdRuntimeCameraAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { MmdCompositeRuntimeCameraAnimation } from "./Animation/mmdCompositeRuntimeCameraAnimation";
import type { MmdRuntimeCameraAnimation } from "./Animation/mmdRuntimeCameraAnimation";
import type { MmdRuntimeCameraAnimationContainer } from "./Animation/mmdRuntimeCameraAnimationContainer";
import type { IMmdCamera } from "./IMmdCamera";
import type { MmdRuntimeAnimationHandle } from "./mmdRuntimeAnimationHandle";
import { CreateMmdRuntimeAnimationHandle } from "./mmdRuntimeAnimationHandle";

Node.AddNodeConstructor("MmdCamera", (name, scene) => {
    return (): MmdCamera => new MmdCamera(name, undefined, scene);
});

type RuntimeCameraAnimation = MmdRuntimeCameraAnimation | MmdRuntimeCameraAnimationContainer | MmdCompositeRuntimeCameraAnimation | IMmdRuntimeCameraAnimation;

/**
 * MMD camera
 *
 * The MMD camera is a type of Arc Rotate Camera that determines the transform of the camera by the center position, rotation(yaw pitch roll), and distance parameters
 */
export class MmdCamera extends Camera implements IMmdCamera {
    /**
     * Gets or sets a boolean indicating that the scaling of the parent hierarchy will not be taken in account by the camera
     */
    public ignoreParentScaling = false;

    /**
     * Define the current rotation of the camera
     */
    @serializeAsVector3()
    public rotation = new Vector3();

    /**
     * Define the current distance of the camera from its target (default: -45)
     */
    @serialize()
    public distance = -45;

    private readonly _viewMatrix = Matrix.Zero();
    private readonly _tmpUpVector = Vector3.Zero();
    private readonly _tmpTargetVector = Vector3.Zero();

    /**
     * Observable triggered when the current animation is changed
     *
     * Value is 30fps frame time duration of the animation
     */
    public readonly onAnimationDurationChangedObservable: Observable<number>;
    private readonly _animationHandleMap: Map<MmdRuntimeAnimationHandle, RuntimeCameraAnimation>;

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

        this.onAnimationDurationChangedObservable = new Observable<number>();
        this._animationHandleMap = new Map();

        this._currentAnimation = null;
    }

    /**
     * Bind the animation to the camera and return a handle to the runtime animation
     * @param animation  MMD animation or MMD camera animation group to add
     * @returns A handle to the runtime animation
     */
    public createRuntimeAnimation(animation: IMmdBindableCameraAnimation): MmdRuntimeAnimationHandle {
        let runtimeAnimation: RuntimeCameraAnimation;
        if ((animation as IMmdBindableCameraAnimation).createRuntimeCameraAnimation) {
            runtimeAnimation = animation.createRuntimeCameraAnimation(this);
        } else {
            throw new Error("animation is not MmdAnimation or MmdCameraAnimationContainer or MmdCompositeAnimation. are you missing import \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation\" or \"babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimationContainer\" or \"babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeCameraAnimation\"?");
        }

        const handle = CreateMmdRuntimeAnimationHandle();
        this._animationHandleMap.set(handle, runtimeAnimation);
        return handle;
    }

    /**
     * Destroy a runtime animation by its handle
     * * @param handle The handle of the runtime animation to destroy
     * @returns True if the animation was destroyed, false if it was not found
     */
    public destroyRuntimeAnimation(handle: MmdRuntimeAnimationHandle): boolean {
        const animation = this._animationHandleMap.get(handle);
        if (animation === undefined) return false;

        if (this._currentAnimation === animation) {
            this._currentAnimation = null;
            if (animation.animation.endFrame !== 0) {
                this.onAnimationDurationChangedObservable.notifyObservers(0);
            }
        }

        this._animationHandleMap.delete(handle);
        (animation as IMmdRuntimeCameraAnimation).dispose?.();
        return true;
    }

    /**
     * Set the current animation of the camera
     *
     * If handle is null, the current animation will be cleared
     *
     * @param handle The handle of the animation to set as current
     * @returns True if the animation was set, false if it was not found
     */
    public setRuntimeAnimation(handle: Nullable<MmdRuntimeAnimationHandle>): boolean {
        if (handle === null) {
            if (this._currentAnimation !== null) {
                const endFrame = this._currentAnimation.animation.endFrame;
                this._currentAnimation = null;
                if (endFrame !== 0) {
                    this.onAnimationDurationChangedObservable.notifyObservers(0);
                }
            }
            return true;
        }

        const animation = this._animationHandleMap.get(handle);
        if (animation === undefined) {
            throw new Error(`Animation with handle ${handle} not found`);
        }

        const oldAnimationEndFrame = this._currentAnimation?.animation.endFrame ?? 0;
        this._currentAnimation = animation;
        if (oldAnimationEndFrame !== animation.animation.endFrame) {
            this.onAnimationDurationChangedObservable.notifyObservers(animation.animation.endFrame);
        }
        return true;
    }

    /**
     * Get the runtime animation map of the camera
     */
    public get runtimeAnimations(): ReadonlyMap<MmdRuntimeAnimationHandle, RuntimeCameraAnimation> {
        return this._animationHandleMap;
    }

    /**
     * Get the current animation of the camera
     */
    public get currentAnimation(): Nullable<RuntimeCameraAnimation> {
        return this._currentAnimation;
    }

    /**
     * Duration of the animation in 30fps frame time
     */
    public get animationFrameTimeDuration(): number {
        if (this._currentAnimation === null) {
            return 0;
        }
        return this._currentAnimation.animation.endFrame;
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
    private static readonly _TargetVector = new Vector3();

    /** @internal */
    public override _getViewMatrix(): Matrix {
        const rotationMatrix = Matrix.RotationYawPitchRollToRef(
            -this.rotation.y, -this.rotation.x, -this.rotation.z,
            MmdCamera._RotationMatrix
        );
        const cameraEyePosition = this.position.addToRef(
            Vector3.TransformCoordinatesFromFloatsToRef(0, 0, this.distance, rotationMatrix, MmdCamera._CameraEyePosition),
            MmdCamera._CameraEyePosition
        );
        const targetVector = Vector3.TransformNormalFromFloatsToRef(0, 0, 1, rotationMatrix, MmdCamera._TargetVector)
            .addInPlace(cameraEyePosition);
        const upVector = Vector3.TransformNormalFromFloatsToRef(0, 1, 0, rotationMatrix, MmdCamera._UpVector);

        if (this.ignoreParentScaling) {
            if (this.parent) {
                const parentWorldMatrix = this.parent.getWorldMatrix();
                Vector3.TransformCoordinatesToRef(cameraEyePosition, parentWorldMatrix, this._globalPosition);
                Vector3.TransformCoordinatesToRef(targetVector, parentWorldMatrix, this._tmpTargetVector);
                Vector3.TransformNormalToRef(upVector, parentWorldMatrix, this._tmpUpVector);
                this._markSyncedWithParent();
            } else {
                this._globalPosition.copyFrom(cameraEyePosition);
                this._tmpTargetVector.copyFrom(targetVector);
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
            Matrix.LookAtRHToRef(cameraEyePosition, targetVector, upVector, this._viewMatrix);
        } else {
            Matrix.LookAtLHToRef(cameraEyePosition, targetVector, upVector, this._viewMatrix);
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
