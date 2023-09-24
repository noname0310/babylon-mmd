import type { Bone } from "@babylonjs/core/Bones/bone";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdCamera } from "@/Runtime/mmdCamera";

export class MmdCameraAutoFocus {
    private readonly _camera: MmdCamera;
    private readonly _pipeline: DefaultRenderingPipeline;

    private _headBone: Nullable<Bone>;
    private _beforeRender: Nullable<() => void>;

    public constructor(camera: MmdCamera, pipeline: DefaultRenderingPipeline) {
        this._camera = camera;
        this._pipeline = pipeline;
        pipeline.depthOfField.fStop = 0.05;
        pipeline.depthOfField.focalLength = 20;

        this._headBone = null;
        this._beforeRender = null;
    }

    public setTarget(modelMesh: Mesh, headBoneName: string = "頭"): void {
        this._headBone = modelMesh.skeleton?.bones.find((bone) => bone.name === headBoneName) ?? null;
    }

    public register(scene: Scene): void {
        if (this._beforeRender) return;

        const camera = this._camera;
        const defaultPipeline = this._pipeline;
        const rotationMatrix = new Matrix();
        const cameraNormal = new Vector3();
        const cameraEyePosition = new Vector3();
        const headRelativePosition = new Vector3();

        // note: this dof distance compute will broken when camera and mesh is not in same space
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

            this._headBone!.getFinalMatrix().getTranslationToRef(headRelativePosition)
                .subtractToRef(cameraEyePosition, headRelativePosition);

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
