import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

import type { IMmdModel } from "@/Runtime/IMmdModel";

export interface IAttachToBoneOptions {
    directionalLightPosition?: Vector3;
    cameraTargetPosition?: Vector3;
    cameraTargetYpositionOffset?: number;
    worldScale?: number;
    centerBoneName?: string;
    worldMatrix?: Matrix;
}

export function AttachToBone(
    scene: Scene,
    mmdModel: IMmdModel,
    options: IAttachToBoneOptions = {}
): void {
    const {
        directionalLightPosition,
        cameraTargetPosition,
        cameraTargetYpositionOffset = 0,
        worldScale = 1,
        centerBoneName = "センター",
        worldMatrix
    } = options;

    const bodyBone = mmdModel.runtimeBones.find((bone) => bone.name === centerBoneName);
    const meshWorldMatrix = worldMatrix ?? mmdModel.mesh.getWorldMatrix();
    const boneWorldMatrix = new Matrix();
    const lightYpositionOffset = -10 * worldScale;
    const cameraYpositionOffset = 3 * worldScale + cameraTargetYpositionOffset;
    scene.onBeforeRenderObservable.add(() => {
        bodyBone!.getWorldMatrixToRef(boneWorldMatrix).multiplyToRef(meshWorldMatrix, boneWorldMatrix);

        if (directionalLightPosition !== undefined) {
            boneWorldMatrix.getTranslationToRef(directionalLightPosition);
            directionalLightPosition.y += lightYpositionOffset;
        }

        if (cameraTargetPosition !== undefined) {
            boneWorldMatrix.getTranslationToRef(cameraTargetPosition);
            cameraTargetPosition.y += cameraYpositionOffset;
        }
    });
}
