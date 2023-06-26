import type { Scene} from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import { Camera, Matrix } from "@babylonjs/core";

import type { MmdCameraAnimationTrack } from "@/loader/animation/MmdAnimationTrack";

import { MmdRuntimeCameraAnimationTrack } from "./animation/MmdRuntimeAnimation";

export class MmdCamera extends Camera {
    public ignoreParentScaling = false;

    public rotation = new Vector3();
    // mmd default distance
    public distance = -45;

    private readonly _viewMatrix = Matrix.Zero();
    private readonly _tmpUpVector = Vector3.Zero();
    private readonly _tmpTargetVector = Vector3.Zero();

    private readonly _animations: MmdRuntimeCameraAnimationTrack[];
    private readonly _animationIndexMap: Map<string, number>;

    private _currentAnimation: MmdRuntimeCameraAnimationTrack | null;

    public constructor(name: string, position: Vector3 = new Vector3(0, 10, 0), scene?: Scene, setActiveOnSceneIfNoneActive = true) {
        super(name, position, scene, setActiveOnSceneIfNoneActive);

        // mmd default fov
        this.fov = 30 * (Math.PI / 180);

        this._animations = [];
        this._animationIndexMap = new Map();

        this._currentAnimation = null;
    }

    public addAnimation(animation: MmdCameraAnimationTrack): void {
        const runtimeAnimation = MmdRuntimeCameraAnimationTrack.Create(animation, this);
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
        if (index === undefined) this._currentAnimation = null;
        else this._currentAnimation = this._animations[index];
    }

    public get runtimeAnimations(): readonly MmdRuntimeCameraAnimationTrack[] {
        return this._animations;
    }

    public animate(frameTime: number): void {
        if (this._currentAnimation === null) return;

        this._currentAnimation.animate(frameTime);
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
}
