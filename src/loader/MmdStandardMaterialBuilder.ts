import type { AssetContainer, ISceneLoaderProgressEvent, MultiMaterial, Nullable, Scene, Texture } from "@babylonjs/core";
import { Color3, Material } from "@babylonjs/core";

import type { IMmdMaterialBuilder, MaterialInfo } from "./IMmdMaterialBuilder";
import type { MmdTextureLoadResult } from "./MmdAsyncTextureLoader";
import { MmdAsyncTextureLoader } from "./MmdAsyncTextureLoader";
import { MmdOutlineRenderer } from "./MmdOutlineRenderer";
import { MmdPluginMaterialSphereTextureBlendMode } from "./MmdPluginMaterial";
import { MmdStandardMaterial } from "./MmdStandardMaterial";
import type { BpmxObject } from "./optimized/parser/BpmxObject";
import { PmxObject } from "./parser/PmxObject";
import type { IArrayBufferFile} from "./ReferenceFileResolver";
import { ReferenceFileResolver } from "./ReferenceFileResolver";
import { TextureAlphaChecker } from "./TextureAlphaChecker";

export class MmdStandardMaterialBuilder implements IMmdMaterialBuilder {
    public static EdgeSizeScaleFactor = 0.01;

    /**
     * The threshold of material alpha to use transparency mode.
     *
     * lower value is more likely to use transparency mode. (0 - 255) default is 195.
     */
    public alphaThreshold = 195;

    /**
     * The threshold of transparency mode to use alpha blend.
     *
     * lower value is more likely to use alpha test mode. otherwise use alpha blemd mode. default is 100.
     */
    public alphaBlendThreshold = 100;

    public useAlphaEvaluation = true;

    public alphaEvaluationResolution = 512;

    private readonly _textureLoader = new MmdAsyncTextureLoader();

    public buildMaterials(
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
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): void {
        // Block the marking of materials dirty until all materials are built.
        const oldBlockMaterialDirtyMechanism = scene.blockMaterialDirtyMechanism;
        scene.blockMaterialDirtyMechanism = true;

        let textureAlphaChecker: Nullable<TextureAlphaChecker> = null;
        const getTextureAlpphaChecker = (): Nullable<TextureAlphaChecker> => {
            if (textureAlphaChecker !== null) return textureAlphaChecker;
            return this.useAlphaEvaluation
                ? textureAlphaChecker = new TextureAlphaChecker(uvs, indices, this.alphaEvaluationResolution)
                : null;
        };

        const referenceFileResolver = new ReferenceFileResolver(referenceFiles as readonly IArrayBufferFile[], rootUrl, fileRootId);

        const promises: Promise<void>[] = [];

        const progressEvent = {
            lengthComputable: true,
            loaded: 0,
            total: materialsInfo.length * 3
        };
        const incrementProgress = (): void => {
            progressEvent.loaded += 1;
            onTextureLoadProgress?.(progressEvent);
        };

        let offset = 0;
        for (let i = 0; i < materialsInfo.length; ++i) {
            const materialInfo = materialsInfo[i];

            scene._blockEntityCollection = !!assetContainer;
            const material = new MmdStandardMaterial(materialInfo.name, scene);
            material._parentContainer = assetContainer;
            scene._blockEntityCollection = false;
            assetContainer?.materials.push(material);
            {
                const singleMaterialPromises: Promise<void>[] = [];

                const loadScalarPropertiesPromise = this.loadGeneralScalarProperties(
                    material,
                    materialInfo
                );
                if (loadScalarPropertiesPromise !== undefined) {
                    singleMaterialPromises.push(loadScalarPropertiesPromise);
                }

                const loadDiffuseTexturePromise = this.loadDiffuseTexture(
                    uniqueId,
                    material,
                    materialInfo,
                    texturePathTable,
                    scene,
                    assetContainer,
                    rootUrl,
                    fileRootId,
                    referenceFileResolver,
                    offset,
                    getTextureAlpphaChecker,
                    incrementProgress
                );
                if (loadDiffuseTexturePromise !== undefined) {
                    singleMaterialPromises.push(loadDiffuseTexturePromise);
                }

                const loadSphereTexturePromise = this.loadSphereTexture(
                    uniqueId,
                    material,
                    materialInfo,
                    texturePathTable,
                    scene,
                    assetContainer,
                    rootUrl,
                    fileRootId,
                    referenceFileResolver,
                    incrementProgress
                );
                if (loadSphereTexturePromise !== undefined) {
                    singleMaterialPromises.push(loadSphereTexturePromise);
                }

                const loadToonTexturePromise = this.loadToonTexture(
                    uniqueId,
                    material,
                    materialInfo,
                    texturePathTable,
                    scene,
                    assetContainer,
                    rootUrl,
                    fileRootId,
                    referenceFileResolver,
                    incrementProgress
                );
                if (loadToonTexturePromise !== undefined) {
                    singleMaterialPromises.push(loadToonTexturePromise);
                }

                const loadOutlineRenderingPropertiesPromise = this.loadOutlineRenderingProperties(
                    material,
                    materialInfo
                );
                if (loadOutlineRenderingPropertiesPromise !== undefined) {
                    singleMaterialPromises.push(loadOutlineRenderingPropertiesPromise);
                }

                promises.push(...singleMaterialPromises);

                Promise.all(singleMaterialPromises).then(() => {
                    this.afterBuildSingleMaterial(
                        material,
                        i, // materialIndex
                        materialInfo,
                        multiMaterial,
                        texturePathTable,
                        scene,
                        rootUrl
                    );
                });
            }
            multiMaterial.subMaterials.push(material);

            offset += materialInfo.surfaceCount;
        }

        this._textureLoader.loadModelTexturesEnd(uniqueId);

        const onModelTextureLoadedObservable = this._textureLoader.onModelTextureLoadedObservable.get(uniqueId);
        if (onModelTextureLoadedObservable !== undefined) {
            onModelTextureLoadedObservable.addOnce(() => {
                Promise.all(promises).then(() => {
                    textureAlphaChecker?.dispose();
                    // Restore the blocking of material dirty.
                    scene.blockMaterialDirtyMechanism = oldBlockMaterialDirtyMechanism;
                    onTextureLoadComplete?.();
                });
            });
        } else {
            Promise.all(promises).then(() => {
                textureAlphaChecker?.dispose();
                // Restore the blocking of material dirty.
                scene.blockMaterialDirtyMechanism = oldBlockMaterialDirtyMechanism;
                onTextureLoadComplete?.();
            });
        }
    }

    public loadGeneralScalarProperties: (
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo
    ) => Promise<void> | void = (
            material,
            materialInfo
        ): void => {
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

            material.specularPower = materialInfo.shininess;
        };

    public loadDiffuseTexture: (
        uniqueId: number,
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        texturePathTable: readonly string[],
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        fileRootId: string,
        referenceFileResolver: ReferenceFileResolver,
        materialIndexOffset: number,
        getTextureAlphaChecker: () => Nullable<TextureAlphaChecker>,
        onTextureLoadComplete?: () => void
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            texturePathTable,
            scene,
            assetContainer,
            rootUrl,
            fileRootId,
            referenceFileResolver,
            offset,
            getTextureAlphaChecker,
            onTextureLoadComplete
        ): Promise<void> => {
            material.backFaceCulling = materialInfo.flag & PmxObject.Material.Flag.IsDoubleSided ? false : true;

            const diffuseTexturePath = texturePathTable[materialInfo.textureIndex];
            if (diffuseTexturePath !== undefined) {
                const diffuseTextureFileFullPath = fileRootId + diffuseTexturePath;

                let textureLoadResult: MmdTextureLoadResult;
                const file = referenceFileResolver.resolve(diffuseTextureFileFullPath);
                if (file !== undefined) {
                    textureLoadResult = await this._textureLoader.loadTextureFromBufferAsync(
                        uniqueId,
                        diffuseTextureFileFullPath,
                        file instanceof File ? file : file.data,
                        scene,
                        assetContainer
                    );
                } else {
                    textureLoadResult = await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        diffuseTexturePath,
                        scene,
                        assetContainer
                    );
                }

                const diffuseTexture = textureLoadResult.texture;

                if (diffuseTexture !== null) {
                    material.diffuseTexture = diffuseTexture;

                    let transparencyMode = Number.MAX_SAFE_INTEGER;

                    const evauatedTransparency = (materialInfo as BpmxObject.Material).evauatedTransparency;
                    if (evauatedTransparency !== undefined && evauatedTransparency !== -1) {
                        transparencyMode = evauatedTransparency;
                    } else {
                        const textureAlphaChecker = getTextureAlphaChecker();
                        if (textureAlphaChecker !== null) {
                            transparencyMode = await textureAlphaChecker.textureHasAlphaOnGeometry(
                                textureLoadResult.arrayBuffer!,
                                offset,
                                materialInfo.surfaceCount,
                                this.alphaThreshold,
                                this.alphaBlendThreshold
                            );
                        }
                    }

                    if (transparencyMode !== Number.MAX_SAFE_INTEGER) {
                        const hasAlpha = transparencyMode !== Material.MATERIAL_OPAQUE;

                        if (hasAlpha) diffuseTexture.hasAlpha = true;
                        material.useAlphaFromDiffuseTexture = hasAlpha;
                        material.transparencyMode = transparencyMode;
                        if (hasAlpha) material.backFaceCulling = false;
                    }

                    onTextureLoadComplete?.();
                } else {
                    onTextureLoadComplete?.();
                }
            } else {
                onTextureLoadComplete?.();
            }
        };

    public loadSphereTexture: (
        uniqueId: number,
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        texturePathTable: readonly string[],
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        fileRootId: string,
        referenceFileResolver: ReferenceFileResolver,
        onTextureLoadComplete?: () => void
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            texturePathTable,
            scene,
            assetContainer,
            rootUrl,
            fileRootId,
            referenceFileResolver,
            onTextureLoadComplete
        ): Promise<void> => {
            if (materialInfo.sphereTextureMode !== PmxObject.Material.SphereTextureMode.Off) {
                const sphereTexturePath = texturePathTable[materialInfo.sphereTextureIndex];
                if (sphereTexturePath !== undefined) {
                    const sphereTextureFileFullPath = fileRootId + sphereTexturePath;

                    let sphereTexture: Nullable<Texture>;
                    const file = referenceFileResolver.resolve(sphereTextureFileFullPath);
                    if (file !== undefined) {
                        sphereTexture = (await this._textureLoader.loadTextureFromBufferAsync(
                            uniqueId,
                            sphereTextureFileFullPath,
                            file instanceof File ? file : file.data,
                            scene,
                            assetContainer
                        )).texture;
                    } else {
                        sphereTexture = (await this._textureLoader.loadTextureAsync(
                            uniqueId,
                            rootUrl,
                            sphereTexturePath,
                            scene,
                            assetContainer
                        )).texture;
                    }

                    if (sphereTexture !== null) {
                        material.sphereTexture = sphereTexture;
                        material.sphereTextureBlendMode = materialInfo.sphereTextureMode === 1
                            ? MmdPluginMaterialSphereTextureBlendMode.Multiply
                            : MmdPluginMaterialSphereTextureBlendMode.Add;
                    }

                    onTextureLoadComplete?.();
                } else {
                    onTextureLoadComplete?.();
                }
            } else {
                onTextureLoadComplete?.();
            }
        };

    public loadToonTexture: (
        uniqueId: number,
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        texturePathTable: readonly string[],
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        fileRootId: string,
        referenceFileResolver: ReferenceFileResolver,
        onTextureLoadComplete?: () => void
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            texturePathTable,
            scene,
            assetContainer,
            rootUrl,
            fileRootId,
            referenceFileResolver,
            onTextureLoadComplete
        ): Promise<void> => {
            let toonTexturePath;
            if (materialInfo.isSharedToonTexture) {
                toonTexturePath = materialInfo.toonTextureIndex === -1
                    ? undefined
                    : materialInfo.toonTextureIndex;
            } else {
                toonTexturePath = texturePathTable[materialInfo.toonTextureIndex];
            }
            if (toonTexturePath !== undefined) {
                const toonTextureFileFullPath = fileRootId + toonTexturePath;

                let toonTexture: Nullable<Texture>;
                const file = typeof toonTexturePath === "string" ? referenceFileResolver.resolve(toonTextureFileFullPath) : undefined;
                if (file !== undefined) {
                    toonTexture = (await this._textureLoader.loadTextureFromBufferAsync(
                        uniqueId,
                        toonTextureFileFullPath,
                        file instanceof File ? file : file.data,
                        scene,
                        assetContainer
                    )).texture;
                } else {
                    toonTexture = (await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        toonTexturePath,
                        scene,
                        assetContainer
                    )).texture;
                }

                if (toonTexture !== null) {
                    material.toonTexture = toonTexture;
                }

                onTextureLoadComplete?.();
            } else {
                onTextureLoadComplete?.();
            }
        };

    public loadOutlineRenderingProperties: (
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo
    ) => Promise<void> | void = (
            material,
            materialInfo
        ): void => {
            if (materialInfo.flag & PmxObject.Material.Flag.EnabledToonEdge) {
                MmdOutlineRenderer.RegisterMmdOutlineRendererIfNeeded();

                material.renderOutline = true;
                material.outlineWidth = materialInfo.edgeSize * MmdStandardMaterialBuilder.EdgeSizeScaleFactor;
                const edgeColor = materialInfo.edgeColor;
                material.outlineColor = new Color3(
                    edgeColor[0], edgeColor[1], edgeColor[2]
                );
                material.outlineAlpha = edgeColor[3];
            }
        };

    public afterBuildSingleMaterial: (
        material: MmdStandardMaterial,
        materialIndex: number,
        materialInfo: MaterialInfo,
        multiMaterial: MultiMaterial,
        texturePathTable: readonly string[],
        scene: Scene,
        rootUrl: string
    ) => void = (): void => { /* do nothing */ };
}
