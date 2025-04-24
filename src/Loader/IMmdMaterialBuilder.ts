import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdTextureLoadOptions } from "./mmdAsyncTextureLoader";
import type { BpmxObject } from "./Optimized/Parser/bpmxObject";
import type { ILogger } from "./Parser/ILogger";
import type { PmxObject } from "./Parser/pmxObject";
import type { IArrayBufferFile } from "./referenceFileResolver";
import { IMmdSerlizationMaterial } from "./IMmdSerlizationMaterial";

/**
 * Material information
 */
export type MaterialInfo = PmxObject.Material | BpmxObject.Material;

/**
 * Texture information
 */
export type TextureInfo = Omit<IMmdTextureLoadOptions, "deleteBuffer" | "mimeType"> & {
    imagePathIndex: number;
};

/**
 * Referenced mesh
 */
export type ReferencedMesh = Mesh | { mesh: Mesh, subMeshIndex: number };

/**
 * Mmd material builder interface
 *
 * If you implement this interface, you can use your own material builder
 *
 * Creating a custom builder is quite complicated
 *
 * We recommend that you refer to the `MmdStandardMaterialBuilder` to make your own builder
 */
export interface IMmdMaterialBuilder<TMaterial extends Material = any> {
    /**
     * Indicates if this builder preserves serialization data in the material
     * 
     * If true, the loader will preserve the Material metadata in the material
     * 
     * Otherwise, the loader will preserve the Material metadata separately to ensure that no data is lost in serialization
     * 
     * The following three properties are always preserved Regardless of this value:
     * - englishName
     * - comment
     * - flag
     * 
     * and other MMD material properties should be preserved in the form of `MmdStandardMaterial`
     */
    readonly preserveSerlizationData: TMaterial extends IMmdSerlizationMaterial ? boolean : false;

    /**
     * Build materials
     * @param uniqueId Model unique id for load texture with cache
     * @param materialsInfo Materials information
     * @param texturesInfo Texture information
     * @param imagePathTable Image path table
     * @param rootUrl Root url
     * @param fileRootId File root id
     * @param referenceFiles Reference files for load from files (textures)
     * @param referencedMeshes mesh information for alpha evaluation and set visibility
     * @param meshes Meshes for set render order
     * @param scene Scene
     * @param assetContainer Asset container
     * @param textureNameMap Texture name map for preserve texture name
     * @param logger Logger
     * @param onTextureLoadProgress Texture load progress callback
     * @param onTextureLoadComplete Texture load complete callback
     * @returns Created materials or promise of created materials
     */
    buildMaterials(
        uniqueId: number,

        // for create materials
        materialsInfo: readonly MaterialInfo[],

        // for load texture from network
        texturesInfo: readonly TextureInfo[],
        imagePathTable: readonly string[],

        // for load texture from files
        rootUrl: string,
        fileRootId: string,
        referenceFiles: readonly File[] | readonly IArrayBufferFile[],

        // for alpha evaluation and set visibility
        referencedMeshes: (readonly ReferencedMesh[])[],

        // for set render order
        meshes: Mesh[],

        // for create babylonjs objects
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,

        // for preserve texture name
        textureNameMap: Nullable<Map<BaseTexture, string>>,

        // for logging
        logger: ILogger,

        // callbacks
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): Promise<Material[]> | Material[];
}
