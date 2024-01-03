import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import { MmdAnimationBase } from "@/Loader/Animation/mmdAnimationBase";
import type { MmdCameraAnimationTrack } from "@/Loader/Animation/mmdAnimationTrack";

import type { MmdCamera } from "../mmdCamera";
import { BezierInterpolator } from "./bezierInterpolator";
import type { IMmdBindableCameraAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeCameraAnimation } from "./IMmdRuntimeAnimation";
import { MmdRuntimeAnimation } from "./mmdRuntimeAnimation";

/**
 * Mmd runtime camera animation
 *
 * An object with mmd animation and camera binding information
 */
export class MmdRuntimeCameraAnimation extends MmdRuntimeAnimation<MmdCameraAnimationTrack> implements IMmdRuntimeCameraAnimation {
    /**
     * The animation data
     */
    public readonly animation: MmdCameraAnimationTrack;

    private readonly _camera: MmdCamera;

    private constructor(
        animation: MmdAnimationBase,
        camera: MmdCamera
    ) {
        super();

        this.animation = animation.cameraTrack;
        this._camera = camera;
    }

    private static readonly _CameraPositionA = new Vector3();
    private static readonly _CameraPositionB = new Vector3();
    private static readonly _CameraRotationA = new Vector3();
    private static readonly _CameraRotationB = new Vector3();

    private static readonly _DegToRad = Math.PI / 180;

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    public animate(frameTime: number): void {
        const cameraTrack = this.animation;
        if (cameraTrack.frameNumbers.length === 0) return;

        const camera = this._camera;

        const clampedFrameTime = Math.max(cameraTrack.startFrame, Math.min(cameraTrack.endFrame, frameTime));
        const upperBoundIndex = this._upperBoundFrameIndex(clampedFrameTime, cameraTrack);
        const upperBoundIndexMinusOne = upperBoundIndex - 1;

        const frameNumberA = cameraTrack.frameNumbers[upperBoundIndexMinusOne];
        const frameNumberB = cameraTrack.frameNumbers[upperBoundIndex];

        if (frameNumberB === undefined || frameNumberA + 1 === frameNumberB) {
            const positions = cameraTrack.positions;
            camera.position.set(
                positions[upperBoundIndexMinusOne * 3],
                positions[upperBoundIndexMinusOne * 3 + 1],
                positions[upperBoundIndexMinusOne * 3 + 2]
            );

            const rotations = cameraTrack.rotations;
            camera.rotation.set(
                rotations[upperBoundIndexMinusOne * 3],
                rotations[upperBoundIndexMinusOne * 3 + 1],
                rotations[upperBoundIndexMinusOne * 3 + 2]
            );

            camera.distance = cameraTrack.distances[upperBoundIndexMinusOne];
            camera.fov = cameraTrack.fovs[upperBoundIndexMinusOne] * MmdRuntimeCameraAnimation._DegToRad;
        } else {
            const gradient = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

            const positions = cameraTrack.positions;
            const positionInterpolations = cameraTrack.positionInterpolations;

            const positionA = MmdRuntimeCameraAnimation._CameraPositionA.set(
                positions[upperBoundIndexMinusOne * 3],
                positions[upperBoundIndexMinusOne * 3 + 1],
                positions[upperBoundIndexMinusOne * 3 + 2]
            );
            const positionB = MmdRuntimeCameraAnimation._CameraPositionB.set(
                positions[upperBoundIndex * 3],
                positions[upperBoundIndex * 3 + 1],
                positions[upperBoundIndex * 3 + 2]
            );

            const xWeight = BezierInterpolator.Interpolate(
                positionInterpolations[upperBoundIndex * 12] / 127, // x_x1
                positionInterpolations[upperBoundIndex * 12 + 1] / 127, // x_x2
                positionInterpolations[upperBoundIndex * 12 + 2] / 127, // x_y1
                positionInterpolations[upperBoundIndex * 12 + 3] / 127, // x_y2
                gradient
            );
            const yWeight = BezierInterpolator.Interpolate(
                positionInterpolations[upperBoundIndex * 12 + 4] / 127, // y_x1
                positionInterpolations[upperBoundIndex * 12 + 5] / 127, // y_x2
                positionInterpolations[upperBoundIndex * 12 + 6] / 127, // y_y1
                positionInterpolations[upperBoundIndex * 12 + 7] / 127, // y_y2
                gradient
            );
            const zWeight = BezierInterpolator.Interpolate(
                positionInterpolations[upperBoundIndex * 12 + 8] / 127, // z_x1
                positionInterpolations[upperBoundIndex * 12 + 9] / 127, // z_x2
                positionInterpolations[upperBoundIndex * 12 + 10] / 127, // z_y1
                positionInterpolations[upperBoundIndex * 12 + 11] / 127, // z_y2
                gradient
            );

            camera.position.set(
                positionA.x + (positionB.x - positionA.x) * xWeight,
                positionA.y + (positionB.y - positionA.y) * yWeight,
                positionA.z + (positionB.z - positionA.z) * zWeight
            );

            const rotations = cameraTrack.rotations;
            const rotationInterpolations = cameraTrack.rotationInterpolations;

            const rotationA = MmdRuntimeCameraAnimation._CameraRotationA.set(
                rotations[upperBoundIndexMinusOne * 3],
                rotations[upperBoundIndexMinusOne * 3 + 1],
                rotations[upperBoundIndexMinusOne * 3 + 2]
            );
            const rotationB = MmdRuntimeCameraAnimation._CameraRotationB.set(
                rotations[upperBoundIndex * 3],
                rotations[upperBoundIndex * 3 + 1],
                rotations[upperBoundIndex * 3 + 2]
            );

            const rotationWeight = BezierInterpolator.Interpolate(
                rotationInterpolations[upperBoundIndex * 4] / 127, // x1
                rotationInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                rotationInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                rotationInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                gradient
            );
            const oneMinusRotationWeight = 1 - rotationWeight;

            camera.rotation.set(
                rotationA.x * oneMinusRotationWeight + rotationB.x * rotationWeight,
                rotationA.y * oneMinusRotationWeight + rotationB.y * rotationWeight,
                rotationA.z * oneMinusRotationWeight + rotationB.z * rotationWeight
            );

            const distanceA = cameraTrack.distances[upperBoundIndexMinusOne];
            const distanceB = cameraTrack.distances[upperBoundIndex];

            const distanceWeight = BezierInterpolator.Interpolate(
                cameraTrack.distanceInterpolations[upperBoundIndex * 4] / 127, // x1
                cameraTrack.distanceInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                cameraTrack.distanceInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                cameraTrack.distanceInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                gradient
            );

            camera.distance = distanceA + (distanceB - distanceA) * distanceWeight;

            const fovA = cameraTrack.fovs[upperBoundIndexMinusOne];
            const fovB = cameraTrack.fovs[upperBoundIndex];

            const fovWeight = BezierInterpolator.Interpolate(
                cameraTrack.fovInterpolations[upperBoundIndex * 4] / 127, // x1
                cameraTrack.fovInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                cameraTrack.fovInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                cameraTrack.fovInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                gradient
            );

            camera.fov = (fovA + (fovB - fovA) * fovWeight) * MmdRuntimeCameraAnimation._DegToRad;
        }
    }

    /**
     * bind animation to camera
     * @param animation animation to bind
     * @param camera bind target
     * @returns MmdRuntimeCameraAnimation instance
     */
    public static Create(animation: MmdAnimationBase, camera: MmdCamera): MmdRuntimeCameraAnimation {
        return new MmdRuntimeCameraAnimation(animation, camera);
    }
}

declare module "../../Loader/Animation/mmdAnimationBase" {
    export interface MmdAnimationBase extends IMmdBindableCameraAnimation<MmdRuntimeCameraAnimation> { }
}

/**
 * Create runtime camera animation
 * @param camera bind target
 * @returns MmdRuntimeCameraAnimation instance
 */
MmdAnimationBase.prototype.createRuntimeCameraAnimation = function(camera: MmdCamera): MmdRuntimeCameraAnimation {
    return MmdRuntimeCameraAnimation.Create(this, camera);
};
