import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { _GetCompatibleTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdMaterialBuilder, MaterialInfo, TextureInfo } from "./IMmdMaterialBuilder";
import { MmdStandardMaterial } from "./mmdStandardMaterial";
import type { ILogger } from "./Parser/ILogger";
import { PmxObject } from "./Parser/pmxObject";
import type { ReferenceFileResolver } from "./referenceFileResolver";
import { StandardMaterialBuilderBase } from "./standardMaterialBuilder";

/**
 * MMD standard material builder
 *
 * Use `MmdStandardMaterial` to create a mmdmesh material
 */
export class MmdStandardMaterialBuilder extends StandardMaterialBuilderBase<MmdStandardMaterial> implements IMmdMaterialBuilder {
    public constructor() {
        super(MmdStandardMaterial);
    }

    protected override _buildTextureNameMap(
        materialsInfo: readonly MaterialInfo[],
        materials: MmdStandardMaterial[],
        imagePathTable: readonly string[],
        texturesInfo: readonly TextureInfo[],
        textureNameMap: Map<BaseTexture, string>
    ): void {
        for (let i = 0; i < materialsInfo.length; ++i) {
            const materialInfo = materialsInfo[i];
            const material = materials[i];

            const diffuseTexturePath = imagePathTable[texturesInfo[materialInfo.textureIndex]?.imagePathIndex];
            if (diffuseTexturePath !== undefined) {
                const diffuseTexture = material.diffuseTexture;
                if (diffuseTexture !== null) {
                    textureNameMap.set(diffuseTexture, diffuseTexturePath);
                }
            }

            const sphereTexturePath = imagePathTable[texturesInfo[materialInfo.sphereTextureIndex]?.imagePathIndex];
            if (sphereTexturePath !== undefined) {
                const sphereTexture = material.sphereTexture;
                if (sphereTexture !== null) {
                    textureNameMap.set(sphereTexture, sphereTexturePath);
                }
            }

            const toonTexturePath = imagePathTable[texturesInfo[materialInfo.toonTextureIndex]?.imagePathIndex];
            if (toonTexturePath !== undefined) {
                const toonTexture = material.toonTexture;
                if (toonTexture !== null) {
                    textureNameMap.set(toonTexture, toonTexturePath);
                }
            }
        }
    }

    public override async loadSphereTexture(
        uniqueId: number,
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        textureInfo: Nullable<TextureInfo>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        referenceFileResolver: ReferenceFileResolver,
        logger: ILogger,
        onTextureLoadComplete?: () => void
    ): Promise<void> {
        if (materialInfo.sphereTextureMode !== PmxObject.Material.SphereTextureMode.Off) {
            const sphereTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
            if (sphereTexturePath !== undefined) {
                const format = scene.getEngine().isWebGPU || materialInfo.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply
                    ? Constants.TEXTUREFORMAT_RGBA
                    : Constants.TEXTUREFORMAT_RGB; // Maybe we should not use RGB format for performance reasons

                const sphereTextureFileFullPath = referenceFileResolver.createFullPath(sphereTexturePath);

                let sphereTexture: Nullable<Texture>;
                const file = referenceFileResolver.resolve(sphereTextureFileFullPath);
                if (file !== undefined) {
                    sphereTexture = (await this._textureLoader.loadTextureFromBufferAsync(
                        uniqueId,
                        sphereTextureFileFullPath,
                        file instanceof File ? file : file.data,
                        scene,
                        assetContainer,
                        {
                            ...textureInfo,
                            deleteBuffer: this.deleteTextureBufferAfterLoad,
                            format: format,
                            mimeType: file instanceof File ? file.type : file.mimeType,
                            forcedExtension: this._getForcedExtension(sphereTexturePath)
                        }
                    ));
                } else {
                    sphereTexture = (await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        sphereTexturePath,
                        scene,
                        assetContainer,
                        {
                            ...textureInfo,
                            deleteBuffer: this.deleteTextureBufferAfterLoad,
                            format: format,
                            forcedExtension: this._getForcedExtension(sphereTexturePath)
                        }
                    ));
                }

                if (sphereTexture !== null) {
                    material.sphereTexture = sphereTexture;
                    material.sphereTextureBlendMode = materialInfo.sphereTextureMode as number;
                } else {
                    logger.error(`Failed to load sphere texture: ${sphereTextureFileFullPath}`);
                }

                onTextureLoadComplete?.();
            } else {
                onTextureLoadComplete?.();
            }
        } else {
            onTextureLoadComplete?.();
        }
    }

    public override async loadToonTexture(
        uniqueId: number,
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        textureInfo: Nullable<TextureInfo>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        referenceFileResolver: ReferenceFileResolver,
        logger: ILogger,
        onTextureLoadComplete?: () => void
    ): Promise<void> {
        let toonTexturePath;
        if (materialInfo.isSharedToonTexture) {
            toonTexturePath = materialInfo.toonTextureIndex;
        } else {
            toonTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
        }
        if (toonTexturePath !== undefined) {
            const toonTextureFileFullPath = referenceFileResolver.createFullPath(toonTexturePath.toString());

            let toonTexture: Nullable<Texture>;
            const file = typeof toonTexturePath === "string" ? referenceFileResolver.resolve(toonTextureFileFullPath) : undefined;
            if (file !== undefined) {
                toonTexture = (await this._textureLoader.loadTextureFromBufferAsync(
                    uniqueId,
                    toonTextureFileFullPath,
                    file instanceof File ? file : file.data,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: scene.getEngine().isWebGPU ? Constants.TEXTUREFORMAT_RGBA : Constants.TEXTUREFORMAT_RGB,
                        mimeType: file instanceof File ? file.type : file.mimeType
                    }
                ));
            } else {
                toonTexture = (await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    toonTexturePath,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: scene.getEngine().isWebGPU ? Constants.TEXTUREFORMAT_RGBA : Constants.TEXTUREFORMAT_RGB
                    }
                ));
            }

            if (toonTexture !== null) {
                material.toonTexture = toonTexture;
            } else {
                logger.error(`Failed to load toon texture: ${toonTextureFileFullPath}`);
            }

            onTextureLoadComplete?.();
        } else {
            onTextureLoadComplete?.();
        }
    }

    /**
     * Load outline rendering properties
     *
     * This method can be overridden for customizing the material loading process
     * @param material Material
     * @param materialInfo Material information
     * @param logger Logger
     */
    public override loadOutlineRenderingProperties(
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        logger: ILogger
    ): void {
        if (materialInfo.flag & PmxObject.Material.Flag.EnabledToonEdge) {
            if (Scene.prototype.getMmdOutlineRenderer === undefined) {
                logger.warn("MMD Outline Renderer is not available. Please import \"babylon-mmd/esm/Loader/mmdOutlineRenderer\".");
            }

            material.renderOutline = true;
            material.outlineWidth = materialInfo.edgeSize;
            const edgeColor = materialInfo.edgeColor;
            material.outlineColor = new Color3(
                edgeColor[0], edgeColor[1], edgeColor[2]
            );
            material.outlineAlpha = edgeColor[3];
        }
    };
}
