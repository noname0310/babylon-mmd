import type { Scene } from "@babylonjs/core";
import { Camera, Matrix, Vector3 } from "@babylonjs/core";

import type { MmdAnimation } from "@/loader/animation/MmdAnimation";

import { MmdRuntimeCameraAnimation } from "./animation/MmdRuntimeAnimation";

export class MmdCamera extends Camera {
    public ignoreParentScaling = false;

    public rotation = new Vector3();
    // mmd default distance
    public distance = -45;

    private readonly _viewMatrix = Matrix.Zero();
    private readonly _tmpUpVector = Vector3.Zero();
    private readonly _tmpTargetVector = Vector3.Zero();

    private readonly _animations: MmdRuntimeCameraAnimation[];
    private readonly _animationIndexMap: Map<string, number>;

    private _currentAnimation: MmdRuntimeCameraAnimation | null;

    public constructor(name: string, position: Vector3 = new Vector3(0, 10, 0), scene?: Scene, setActiveOnSceneIfNoneActive = true) {
        super(name, position, scene, setActiveOnSceneIfNoneActive);

        // mmd default fov
        this.fov = 30 * (Math.PI / 180);

        this._animations = [];
        this._animationIndexMap = new Map();

        this._currentAnimation = null;
    }

    public addAnimation(animation: MmdAnimation): void {
        const runtimeAnimation = MmdRuntimeCameraAnimation.Create(animation, this);
        this._animationIndexMap.set(animation.name, this._animations.length);
        this._animations.push(runtimeAnimation);
    }

    public removeAnimation(index: number): void {
        const animation = this._animations[index];
        if (this._currentAnimation === animation) this._currentAnimation = null;

        this._animationIndexMap.delete(animation.animation.name);
        this._animations.splice(index, 1);
    }

    public setAnimation(name: string | null): void {
        if (name === null) {
            this._currentAnimation = null;
            return;
        }

        const index = this._animationIndexMap.get(name);
        if (index === undefined) {
            throw new Error(`Animation ${name} is not found`);
        }

        this._currentAnimation = this._animations[index];
    }

    public get runtimeAnimations(): readonly MmdRuntimeCameraAnimation[] {
        return this._animations;
    }

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
