import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export interface AttachToBoneOptions {
    directionalLightPosition?: Vector3;
    cameraTargetPosition?: Vector3;
    cameraTargetYpositionOffset?: number;
    worldScale?: number;
    centerBoneName?: string;
}

export function attachToBone(
    scene: Scene,
    mesh: Mesh,
    options: AttachToBoneOptions = {}
): void {
    const {
        directionalLightPosition,
        cameraTargetPosition,
        cameraTargetYpositionOffset = 0,
        worldScale = 1,
        centerBoneName = "センター"
    } = options;

    const bodyBone = mesh.skeleton!.bones.find((bone) => bone.name === centerBoneName);
    const meshWorldMatrix = mesh.getWorldMatrix();
    const boneWorldMatrix = new Matrix();
    const lightYpositionOffset = -10 * worldScale;
    const cameraYpositionOffset = 3 * worldScale + cameraTargetYpositionOffset;
    scene.onBeforeRenderObservable.add(() => {
        boneWorldMatrix.copyFrom(bodyBone!.getFinalMatrix()).multiplyToRef(meshWorldMatrix, boneWorldMatrix);

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
