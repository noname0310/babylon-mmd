import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Scene } from "@babylonjs/core/scene";

import type { MmdModelLoader } from "@/Loader/mmdModelLoader";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";

export function optimizeScene(scene: Scene): void {
    scene.freezeMaterials();

    const meshes = scene.meshes;
    for (let i = 0, len = meshes.length; i < len; ++i) {
        const mesh = meshes[i];
        mesh.freezeWorldMatrix();
        mesh.doNotSyncBoundingInfo = true;
        mesh.isPickable = false;
        mesh.doNotSyncBoundingInfo = true;
        mesh.alwaysSelectAsActiveMesh = true;
    }

    scene.skipPointerMovePicking = true;
    scene.skipPointerDownPicking = true;
    scene.skipPointerUpPicking = true;
    scene.skipFrustumClipping = true;
    scene.blockMaterialDirtyMechanism = true;
    scene.clearCachedVertexData();
    scene.cleanCachedTextureBuffer();

    const extensions = [".pmx", ".pmd", ".bpmx"];
    for (const extension of extensions) {
        let plugin: MmdModelLoader<any, any, any>;
        try {
            plugin = SceneLoader.GetPluginForExtension(extension) as MmdModelLoader<any, any, any>;
        } catch (e) {
            continue;
        }
        const materialBuilder = plugin.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.flushTextureCache();
    }
}
