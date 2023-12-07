import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { BpmxObject } from "./Optimized/Parser/bpmxObject";
import type { ILogger } from "./Parser/ILogger";
import type { PmxObject } from "./Parser/pmxObject";
import type { IArrayBufferFile } from "./referenceFileResolver";

/**
 * Material information
 */
export type MaterialInfo = PmxObject.Material | BpmxObject.Material;

/**
 * Mmd material builder interface
 *
 * If you implement this interface, you can use your own material builder
 *
 * Creating a custom builder is quite complicated
 *
 * We recommend that you refer to the `MmdStandardMaterialBuilder` to make your own builder
 */
export interface IMmdMaterialBuilder {
    /**
     * Build materials
     * @param uniqueId Model unique id
     * @param materialsInfo Materials information
     * @param texturePathTable Texture path table
     * @param rootUrl Root url
     * @param fileRootId File root id
     * @param referenceFiles Reference files for load from files (textures)
     * @param scene Scene
     * @param assetContainer Asset container
     * @param meshes mesh information for alpha evaluation
     * @param logger Logger
     * @param onTextureLoadProgress Texture load progress callback
     * @param onTextureLoadComplete Texture load complete callback
     */
    buildMaterials(
        uniqueId: number,
        materialsInfo: readonly MaterialInfo[],
        texturePathTable: readonly string[],
        rootUrl: string,
        fileRootId: string,
        referenceFiles: readonly File[] | readonly IArrayBufferFile[],
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        meshes: Mesh[],
        logger: ILogger,
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): Promise<Material[]> | Material[];
}
