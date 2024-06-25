import type { Scene } from "@babylonjs/core/scene";

export interface OptimizeSceneOptions {
    clearCachedVertexData?: boolean;
    freezeMaterials?: boolean;
}

export function optimizeScene(scene: Scene, options: OptimizeSceneOptions = {}): void {
    const {
        clearCachedVertexData = true,
        freezeMaterials = true
    } = options;

    if (freezeMaterials) scene.freezeMaterials();

    const meshes = scene.meshes;
    for (let i = 0, len = meshes.length; i < len; ++i) {
        const mesh = meshes[i];
        mesh.freezeWorldMatrix();
        mesh.doNotSyncBoundingInfo = true;
        mesh.isPickable = false;
        mesh.alwaysSelectAsActiveMesh = true;
    }

    scene.skipPointerMovePicking = true;
    scene.skipPointerDownPicking = true;
    scene.skipPointerUpPicking = true;
    scene.skipFrustumClipping = true;
    scene.blockMaterialDirtyMechanism = true;
    if (clearCachedVertexData) scene.clearCachedVertexData();
    scene.cleanCachedTextureBuffer();

    // very unstable memory optimization
    // const morphTargetManagers = scene.morphTargetManagers;
    // for (let i = 0, len = morphTargetManagers.length; i < len; ++i) {
    //     const morphTargetManager = morphTargetManagers[i];
    //     const numTargets = morphTargetManager.numTargets;
    //     for (let j = 0; j < numTargets; ++j) {
    //         const target = morphTargetManager.getTarget(j) as any;
    //         target._positions = null;
    //         target._uvs = null;
    //     }
    // }
}
