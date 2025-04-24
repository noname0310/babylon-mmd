import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { _GetCompatibleTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { MaterialInfo, ReferencedMesh, TextureInfo } from "./IMmdMaterialBuilder";
import { MaterialBuilderBase, MmdMaterialRenderMethod } from "./materialBuilderBase";
import type { BpmxObject } from "./Optimized/Parser/bpmxObject";
import type { ILogger } from "./Parser/ILogger";
import { PmxObject } from "./Parser/pmxObject";
import type { ReferenceFileResolver } from "./referenceFileResolver";
import type { TextureAlphaChecker } from "./textureAlphaChecker";

/**
 * Standard material builder base class
 */
export abstract class StandardMaterialBuilderBase<TMaterial extends StandardMaterial> extends MaterialBuilderBase<TMaterial> {
    protected _getForcedExtension(texturePath: string): string | undefined {
        if (texturePath.substring(texturePath.length - 4).toLowerCase() === ".bmp") {
            if (_GetCompatibleTextureLoader(".dxbmp") !== null) {
                return ".dxbmp";
            }
        }
        return undefined;
    }

    public override loadGeneralScalarProperties(
        material: TMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[]
    ): void {
        const diffuse = materialInfo.diffuse;
        material.diffuseColor = new Color3(
            diffuse[0],
            diffuse[1],
            diffuse[2]
        );

        const specular = materialInfo.specular;
        material.specularColor = new Color3(
            specular[0],
            specular[1],
            specular[2]
        );

        const ambient = materialInfo.ambient;
        material.ambientColor = new Color3(
            ambient[0],
            ambient[1],
            ambient[2]
        );

        const alpha = materialInfo.diffuse[3];
        material.alpha = alpha;
        if (alpha === 0) {
            for (let i = 0; i < meshes.length; ++i) {
                const mesh = meshes[i];
                if ((mesh as Mesh).isVisible !== undefined) {
                    (mesh as Mesh).isVisible = false;
                } else {
                    // TODO: handle visibility of submeshes individually
                }
            }
        }

        material.specularPower = materialInfo.shininess;
    }

    public override async loadDiffuseTexture(
        uniqueId: number,
        material: TMaterial,
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
        material.backFaceCulling = (materialInfo.flag & PmxObject.Material.Flag.IsDoubleSided) ? false : true;

        const diffuseTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
        if (diffuseTexturePath !== undefined) {
            const diffuseTextureFileFullPath = referenceFileResolver.createFullPath(diffuseTexturePath);

            let texture: Nullable<Texture>;
            const file = referenceFileResolver.resolve(diffuseTextureFileFullPath);
            if (file !== undefined) {
                texture = await this._textureLoader.loadTextureFromBufferAsync(
                    uniqueId,
                    diffuseTextureFileFullPath,
                    file instanceof File ? file : file.data,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: Constants.TEXTUREFORMAT_RGBA,
                        mimeType: file instanceof File ? file.type : file.mimeType,
                        forcedExtension: this._getForcedExtension(diffuseTexturePath)
                    }
                );
            } else {
                texture = await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    diffuseTexturePath,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: Constants.TEXTUREFORMAT_RGBA,
                        forcedExtension: this._getForcedExtension(diffuseTexturePath)
                    }
                );
            }

            const diffuseTexture = texture;

            if (diffuseTexture !== null) {
                material.diffuseTexture = diffuseTexture;
            } else {
                logger.error(`Failed to load diffuse texture: ${diffuseTextureFileFullPath}`);
            }
            onTextureLoadComplete?.();
        } else {
            onTextureLoadComplete?.();
        }
    };

    public override async setAlphaBlendMode(
        material: TMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[],
        logger: ILogger,
        getTextureAlphaChecker: () => Nullable<TextureAlphaChecker>
    ): Promise<void> {
        if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlending) {
            if (material.diffuseTexture) {
                material.diffuseTexture.hasAlpha = true;
                material.useAlphaFromDiffuseTexture = true;
            }
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;
            material.forceDepthWrite = true;

            return;
        }

        if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
            if (material.alpha < 1) {
                if (material.diffuseTexture) {
                    material.diffuseTexture.hasAlpha = true;
                    material.useAlphaFromDiffuseTexture = true;
                }
                material.transparencyMode = Material.MATERIAL_ALPHABLEND;
                material.forceDepthWrite = true;

                return;
            }
        }

        const diffuseTexture = material.diffuseTexture;
        const evaluatedTransparency = (materialInfo as Partial<BpmxObject.Material>).evaluatedTransparency ?? -1;
        if (diffuseTexture !== null) {
            const transparencyMode = await this._evaluateDiffuseTextureTransparencyMode(
                diffuseTexture,
                evaluatedTransparency,
                meshes,
                logger,
                getTextureAlphaChecker
            );
            if (transparencyMode !== null) {
                const hasAlpha = transparencyMode !== Material.MATERIAL_OPAQUE;

                if (hasAlpha) diffuseTexture.hasAlpha = true;
                material.useAlphaFromDiffuseTexture = hasAlpha;
                material.transparencyMode = transparencyMode;
                if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
                    material.forceDepthWrite = hasAlpha;
                }
            }
        } else {
            if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
                let etIsNotOpaque = (evaluatedTransparency >> 4) & 0x03;
                if ((etIsNotOpaque ^ 0x03) === 0) { // 11: not evaluated
                    etIsNotOpaque = 0; // fallback to opaque
                }

                material.transparencyMode = etIsNotOpaque === 0 ? Material.MATERIAL_OPAQUE : Material.MATERIAL_ALPHABLEND;
            } else /* if (this.renderMethod === MmdStandardMaterialRenderMethod.AlphaEvaluation) */ {
                let etAlphaEvaluateResult = evaluatedTransparency & 0x0F;
                if ((etAlphaEvaluateResult ^ 0x0F) === 0) { // 1111: not evaluated
                    etAlphaEvaluateResult = 0; // fallback to opaque
                }

                material.transparencyMode = Material.MATERIAL_OPAQUE;
            }
        }
    }
}

/**
 * Standard material builder
 *
 * Use `StandardMaterial` to create a mmdmesh material
 */
export class StandardMaterialBuilder extends StandardMaterialBuilderBase<StandardMaterial> {
    public override readonly preserveSerlizationData = false;
    
    public constructor() {
        super(StandardMaterial);
    }

    protected override _buildTextureNameMap(materialsInfo: readonly MaterialInfo[], materials: StandardMaterial[], imagePathTable: readonly string[], texturesInfo: readonly TextureInfo[], textureNameMap: Map<BaseTexture, string>): void {
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
        }
    }

    public override loadSphereTexture(): void { /* do nothing */ }
    public override loadToonTexture(): void { /* do nothing */ }
    public override loadOutlineRenderingProperties(): void { /* do nothing */ }
}
