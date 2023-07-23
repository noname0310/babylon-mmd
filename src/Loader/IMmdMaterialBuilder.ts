import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { BpmxObject } from "./Optimized/Parser/bpmxObject";
import type { ILogger } from "./Parser/ILogger";
import type { PmxObject } from "./Parser/pmxObject";
import type { IArrayBufferFile } from "./referenceFileResolver";

export type MaterialInfo = PmxObject.Material | BpmxObject.Material;

export interface IMmdMaterialBuilder {
    buildMaterials(
        uniqueId: number,
        materialsInfo: readonly MaterialInfo[],
        texturePathTable: readonly string[],
        rootUrl: string,
        fileRootId: string,
        referenceFiles: readonly File[] | readonly IArrayBufferFile[],
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        multiMaterial: MultiMaterial,
        logger: ILogger,
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): Promise<void> | void;
}
