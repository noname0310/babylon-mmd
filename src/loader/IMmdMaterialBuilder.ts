import type { AssetContainer, ISceneLoaderProgressEvent, MultiMaterial, Scene } from "@babylonjs/core";

import type { PmxObject } from "./parser/PmxObject";

export interface IMmdMaterialBuilder {
    buildMaterials(
        uniqueId: number,
        pmxObject: PmxObject,
        rootUrl: string,
        scene: Scene,
        assetContainer: AssetContainer | null,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        multiMaterial: MultiMaterial,
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): Promise<void> | void;
}
