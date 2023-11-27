import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdModel } from "@/Runtime/IMmdModel";
import type { MmdCamera } from "@/Runtime/mmdCamera";
import type { IMmdRuntimeBone } from "@/Runtime/mmdRuntimeBone";

export class MmdCameraAutoFocus2 {
    private readonly _camera: MmdCamera;
    private readonly _pipeline: DefaultRenderingPipeline;

    private readonly _headBones: IMmdRuntimeBone[];
    private _skeletonWorldMatrix: Nullable<Matrix>;
    private _beforeRender: Nullable<() => void>;

    public constructor(camera: MmdCamera, pipeline: DefaultRenderingPipeline) {
        this._camera = camera;
        this._pipeline = pipeline;
        pipeline.depthOfField.fStop = 0.05;
        pipeline.depthOfField.focalLength = 20;

        this._headBones = [];
        this._skeletonWorldMatrix = null;
        this._beforeRender = null;
    }

    public setTargets(models: ([IMmdModel, string] | IMmdModel)[]): void {
        for (let i = 0; i < models.length; i++) {
            const target = models[i];
            let model: IMmdModel;
            let headBoneName: string;

            if (Array.isArray(target)) {
                model = target[0];
                headBoneName = target[1];
            } else {
                model = target;
                headBoneName = "頭";
            }

            const headBone = model.runtimeBones.find((bone) => bone.name === headBoneName);
            if (headBone !== undefined) this._headBones.push(headBone);
        }
    }

    public setSkeletonWorldMatrix(matrix: Matrix): void {
        this._skeletonWorldMatrix = matrix;
    }

    public register(scene: Scene): void {
        if (this._beforeRender) return;

        const camera = this._camera;
        const defaultPipeline = this._pipeline;
        const rotationMatrix = new Matrix();
        const cameraNormal = new Vector3();
        const cameraEyePosition = new Vector3();
        const skeletonWorldMatrix = this._skeletonWorldMatrix;
        const boneWorldMatrix = new Matrix();
        const closestHeadPosition = new Vector3();
        const cameraFocusTarget = new Vector3(0, 0, 0);
        const headRelativePosition = new Vector3();

        this._beforeRender = (): void => {
            if (scene.activeCamera !== camera) {
                defaultPipeline.depthOfFieldEnabled = false;
                return;
            }
            defaultPipeline.depthOfFieldEnabled = true;

            const cameraRotation = camera.rotation;
            Matrix.RotationYawPitchRollToRef(-cameraRotation.y, -cameraRotation.x, -cameraRotation.z, rotationMatrix);

            Vector3.TransformNormalFromFloatsToRef(0, 0, 1, rotationMatrix, cameraNormal);

            camera.position.addToRef(
                Vector3.TransformCoordinatesFromFloatsToRef(0, 0, camera.distance, rotationMatrix, cameraEyePosition),
                cameraEyePosition
            );

            if (camera.parent !== null) {
                camera.parent.computeWorldMatrix();
                const cameraParentWorldMatrix = camera.parent.getWorldMatrix();

                Vector3.TransformCoordinatesToRef(cameraEyePosition, cameraParentWorldMatrix, cameraEyePosition);
                Vector3.TransformNormalToRef(cameraNormal, cameraParentWorldMatrix, cameraNormal);
                cameraNormal.normalize();
            }

            let closestDistanceSq = Infinity;
            for (let i = 0; i < this._headBones.length; i++) {
                const headBone = this._headBones[i];
                if (skeletonWorldMatrix !== null) {
                    headBone.getWorldMatrixToRef(boneWorldMatrix).multiplyToRef(skeletonWorldMatrix, boneWorldMatrix);
                } else {
                    headBone.getWorldMatrixToRef(boneWorldMatrix);
                }

                boneWorldMatrix.getTranslationToRef(headRelativePosition)
                    .subtractToRef(cameraEyePosition, headRelativePosition);

                const distance = headRelativePosition.lengthSquared();
                if (distance < closestDistanceSq) {
                    closestDistanceSq = distance;
                    boneWorldMatrix.getTranslationToRef(closestHeadPosition);
                }
            }

            const alpha = 0.1;
            cameraFocusTarget.x += (closestHeadPosition.x - cameraFocusTarget.x) * alpha;
            cameraFocusTarget.y += (closestHeadPosition.y - cameraFocusTarget.y) * alpha;
            cameraFocusTarget.z += (closestHeadPosition.z - cameraFocusTarget.z) * alpha;

            cameraFocusTarget.subtractToRef(cameraEyePosition, headRelativePosition);

            defaultPipeline.depthOfField.focusDistance = (Vector3.Dot(headRelativePosition, cameraNormal) / Vector3.Dot(cameraNormal, cameraNormal)) * 1000;
        };

        scene.onBeforeRenderObservable.add(this._beforeRender);
    }

    public unregister(scene: Scene): void {
        if (!this._beforeRender) return;

        scene.onBeforeRenderObservable.removeCallback(this._beforeRender);
        this._beforeRender = null;
    }
}
