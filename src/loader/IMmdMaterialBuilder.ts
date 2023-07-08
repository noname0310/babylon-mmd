import type { AssetContainer, ISceneLoaderProgressEvent, MultiMaterial, Scene } from "@babylonjs/core";

import type { PmxObject } from "./parser/PmxObject";
import { BpmxObject } from "./optimized/parser/BpmxObject";
import { IArrayBufferFile } from "./ReferenceFileResolver";

export type MaterialInfo = PmxObject.Material | BpmxObject.Material;

export interface IMmdMaterialBuilder {
    buildMaterials(
        uniqueId: number,
        materialsInfo: readonly MaterialInfo[],
        texturePathTable: readonly string[],
        rootUrl: string,
        referenceFiles: readonly File[] | readonly IArrayBufferFile[],
        scene: Scene,
        assetContainer: AssetContainer | null,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        multiMaterial: MultiMaterial,
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): Promise<void> | void;
}
