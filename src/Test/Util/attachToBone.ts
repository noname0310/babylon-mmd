import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";

export function attachToBone(
    scene: Scene,
    mesh: Mesh,
    directionalLightPosition?: Vector3,
    cameraTargetPosition?: Vector3,
    worldScale = 1
): void {
    const bodyBone = mesh.skeleton!.bones.find((bone) => bone.name === "センター");
    const meshWorldMatrix = mesh.getWorldMatrix();
    const boneWorldMatrix = new Matrix();
    const lightYpositionOffset = -10 * worldScale;
    const cameraYpositionOffset = 3 * worldScale;
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
