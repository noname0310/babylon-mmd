import type { DeepImmutable, Scene} from "@babylonjs/core";
import { Quaternion, Vector3 } from "@babylonjs/core";
import { Camera, Matrix } from "@babylonjs/core";

import type { MmdCameraAnimationTrack } from "@/loader/animation/MmdAnimationTrack";

import { MmdRuntimeCameraAnimationTrack } from "./animation/MmdRuntimeAnimation";

export class MmdCamera extends Camera {
    public ignoreParentScaling = false;

    public rotation = new Vector3();
    public distance = 0;

    private readonly _animations: MmdRuntimeCameraAnimationTrack[];
    private readonly _animationIndexMap: Map<string, number>;

    private _currentAnimation: MmdRuntimeCameraAnimationTrack | null;

    public constructor(name: string, position: Vector3, scene?: Scene, setActiveOnSceneIfNoneActive = true) {
        super(name, position, scene, setActiveOnSceneIfNoneActive);

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

    private static readonly _Scale: DeepImmutable<Vector3> = new Vector3(1, 1, 1);
    private static readonly _CenterMatrix = new Matrix();
    private static readonly _CenterQuaternion = new Quaternion();
    private static readonly _DistanceMatrix = new Matrix();
    private static readonly _FinalMatrix = new Matrix();
    private static readonly _FinalPosition = new Vector3();

    public override _getViewMatrix(): Matrix {
        // compute center local matrix
        const centerMatrix = Matrix.ComposeToRef(
            MmdCamera._Scale,
            Quaternion.RotationYawPitchRollToRef(this.rotation.y, this.rotation.x, this.rotation.z, MmdCamera._CenterQuaternion),
            this.position,
            MmdCamera._CenterMatrix
        );

        // compute distance local matrix
        const distanceMatrix = Matrix.IdentityToRef(MmdCamera._DistanceMatrix).setTranslationFromFloats(0, 0, this.distance);

        // compute final local matrix
        const finalMatrix = distanceMatrix.multiplyToRef(centerMatrix, MmdCamera._FinalMatrix);

        if (this.ignoreParentScaling) {
            if (this.parent) {
                const parentWorldMatrix = this.parent.getWorldMatrix();
                Vector3.TransformCoordinatesToRef(
                    finalMatrix.getTranslationToRef(MmdCamera._FinalPosition),
                    parentWorldMatrix,
                    MmdCamera._FinalPosition
                );
            } else {
                //
            }
        }

        return Matrix.Identity();
    }
}
