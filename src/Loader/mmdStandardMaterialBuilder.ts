import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import { Material } from "@babylonjs/core/Materials/material";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdMaterialBuilder, MaterialInfo } from "./IMmdMaterialBuilder";
import { MmdAsyncTextureLoader } from "./mmdAsyncTextureLoader";
import { MmdPluginMaterialSphereTextureBlendMode } from "./mmdPluginMaterial";
import { MmdStandardMaterial } from "./mmdStandardMaterial";
import type { BpmxObject } from "./Optimized/Parser/bpmxObject";
import type { ILogger } from "./Parser/ILogger";
import { PmxObject } from "./Parser/pmxObject";
import type { IArrayBufferFile } from "./referenceFileResolver";
import { ReferenceFileResolver } from "./referenceFileResolver";
import { TextureAlphaChecker } from "./textureAlphaChecker";

/**
 * MMD standard material builder
 *
 * Use `MmdStandardMaterial` to create a mesh material
 */
export class MmdStandardMaterialBuilder implements IMmdMaterialBuilder {
    /**
     * The scale factor of the edge size (default: 0.01)
     *
     * The mmd outline parameter needs to be scaled to fit the outline shader of the Babylon.js
     */
    public static EdgeSizeScaleFactor = 0.01;

    /**
     * The threshold of material alpha to use transparency mode. (default: 195)
     *
     * lower value is more likely to use transparency mode. (0 - 255)
     */
    public alphaThreshold = 195;

    /**
     * The threshold of transparency mode to use alpha blend. (default: 100)
     *
     * lower value is more likely to use alpha test mode. otherwise use alpha blemd mode
     */
    public alphaBlendThreshold = 100;

    /**
     * Whether to use alpha evaluation (default: true)
     *
     * If true, evaluate the alpha of the texture to automatically determine the blending method of the material
     *
     * This automatic blend mode decision is not perfect and is quite costly
     *
     * For load time optimization, it is recommended to turn off this feature and set the blending mode for the material manually
     */
    public useAlphaEvaluation = true;

    /**
     * The canvas resolution to evaluate alpha (default: 512)
     *
     * Resolution of the render canvas used to evaluate alpha internally
     *
     * The higher the resolution, the higher the accuracy and the longer the load time
     */
    public alphaEvaluationResolution = 512;

    /**
     * Whether to delete the texture buffer after loading (default: true)
     */
    public deleteTextureBufferAfterLoad = true;

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
        meshes: Mesh[],
        logger: ILogger,
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): Material[] {
        // Block the marking of materials dirty until all materials are built.
        const oldBlockMaterialDirtyMechanism = scene.blockMaterialDirtyMechanism;
        scene._forceBlockMaterialDirtyMechanism(true);

        let textureAlphaChecker: Nullable<TextureAlphaChecker> = null;
        const getTextureAlpphaChecker = (): Nullable<TextureAlphaChecker> => {
            if (textureAlphaChecker !== null) return textureAlphaChecker;
            return this.useAlphaEvaluation
                ? textureAlphaChecker = new TextureAlphaChecker(scene, this.alphaEvaluationResolution)
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

        const materials: Material[] = [];

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
                    meshes[i],
                    logger,
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
                    logger,
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
                    logger,
                    incrementProgress
                );
                if (loadToonTexturePromise !== undefined) {
                    singleMaterialPromises.push(loadToonTexturePromise);
                }

                const loadOutlineRenderingPropertiesPromise = this.loadOutlineRenderingProperties(
                    material,
                    materialInfo,
                    logger
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
                        texturePathTable,
                        scene,
                        rootUrl
                    );
                });
            }
            materials.push(material);
        }

        this._textureLoader.loadModelTexturesEnd(uniqueId);

        const onModelTextureLoadedObservable = this._textureLoader.onModelTextureLoadedObservable.get(uniqueId);
        if (onModelTextureLoadedObservable !== undefined) {
            onModelTextureLoadedObservable.addOnce(() => {
                Promise.all(promises).then(() => {
                    textureAlphaChecker?.dispose();
                    // Restore the blocking of material dirty.
                    scene._forceBlockMaterialDirtyMechanism(oldBlockMaterialDirtyMechanism);
                    onTextureLoadComplete?.();
                });
            });
        } else {
            Promise.all(promises).then(() => {
                textureAlphaChecker?.dispose();
                // Restore the blocking of material dirty.
                scene._forceBlockMaterialDirtyMechanism(oldBlockMaterialDirtyMechanism);
                onTextureLoadComplete?.();
            });
        }

        return materials;
    }

    /**
     * Load general scalar properties (diffuse, specular, ambient, alpha, shininess)
     *
     * This method can be overridden for customizing the material loading process
     * @param material Material
     * @param materialInfo Material information
     */
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

    /**
     * Load diffuse texture
     *
     * This method can be overridden for customizing the material loading process
     * @param uniqueId Model unique id
     * @param material Material
     * @param materialInfo Material information
     * @param texturePathTable Texture path table
     * @param scene Scene
     * @param assetContainer Asset container
     * @param rootUrl Root url
     * @param fileRootId File root id
     * @param referenceFileResolver Reference file resolver
     * @param materialIndex Material index (same as the index of the submesh)
     * @param logger Logger
     * @param getTextureAlphaChecker Get texture alpha checker
     * @param onTextureLoadComplete Texture load complete callback
     */
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
        mesh: Mesh,
        logger: ILogger,
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
            mesh,
            logger,
            getTextureAlphaChecker,
            onTextureLoadComplete
        ): Promise<void> => {
            material.backFaceCulling = materialInfo.flag & PmxObject.Material.Flag.IsDoubleSided ? false : true;

            const diffuseTexturePath = texturePathTable[materialInfo.textureIndex];
            if (diffuseTexturePath !== undefined) {
                const diffuseTextureFileFullPath = fileRootId + diffuseTexturePath;

                let texture: Nullable<Texture>;
                const file = referenceFileResolver.resolve(diffuseTextureFileFullPath);
                if (file !== undefined) {
                    texture = await this._textureLoader.loadTextureFromBufferAsync(
                        uniqueId,
                        diffuseTextureFileFullPath,
                        file instanceof File ? file : file.data,
                        scene,
                        assetContainer,
                        this.deleteTextureBufferAfterLoad
                    );
                } else {
                    texture = await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        diffuseTexturePath,
                        scene,
                        assetContainer,
                        this.deleteTextureBufferAfterLoad
                    );
                }

                const diffuseTexture = texture;

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
                                diffuseTexture,
                                mesh,
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
                    logger.error(`Failed to load diffuse texture: ${diffuseTextureFileFullPath}`);
                    onTextureLoadComplete?.();
                }
            } else {
                onTextureLoadComplete?.();
            }
        };

    /**
     * Load sphere texture
     *
     * This method can be overridden for customizing the material loading process
     * @param uniqueId Model unique id
     * @param material Material
     * @param materialInfo Material information
     * @param texturePathTable Texture path table
     * @param scene Scene
     * @param assetContainer Asset container
     * @param rootUrl Root url
     * @param fileRootId File root id
     * @param referenceFileResolver Reference file resolver
     * @param logger Logger
     * @param onTextureLoadComplete Texture load complete callback
     */
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
        logger: ILogger,
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
            logger,
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
                            assetContainer,
                            this.deleteTextureBufferAfterLoad
                        ));
                    } else {
                        sphereTexture = (await this._textureLoader.loadTextureAsync(
                            uniqueId,
                            rootUrl,
                            sphereTexturePath,
                            scene,
                            assetContainer,
                            this.deleteTextureBufferAfterLoad
                        ));
                    }

                    if (sphereTexture !== null) {
                        material.sphereTexture = sphereTexture;
                        material.sphereTextureBlendMode = materialInfo.sphereTextureMode === 1
                            ? MmdPluginMaterialSphereTextureBlendMode.Multiply
                            : MmdPluginMaterialSphereTextureBlendMode.Add;
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
        };

    /**
     * Load toon texture
     *
     * This method can be overridden for customizing the material loading process
     * @param uniqueId Model unique id
     * @param material Material
     * @param materialInfo Material information
     * @param texturePathTable Texture path table
     * @param scene Scene
     * @param assetContainer Asset container
     * @param rootUrl Root url
     * @param fileRootId File root id
     * @param referenceFileResolver Reference file resolver
     * @param logger Logger
     * @param onTextureLoadComplete Texture load complete callback
     */
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
        logger: ILogger,
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
            logger,
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
                        assetContainer,
                        this.deleteTextureBufferAfterLoad
                    ));
                } else {
                    toonTexture = (await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        toonTexturePath,
                        scene,
                        assetContainer,
                        this.deleteTextureBufferAfterLoad
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
        };

    /**
     * Load outline rendering properties
     *
     * This method can be overridden for customizing the material loading process
     * @param material Material
     * @param materialInfo Material information
     * @param logger Logger
     */
    public loadOutlineRenderingProperties: (
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        logger: ILogger
    ) => Promise<void> | void = (
            material,
            materialInfo,
            logger
        ): void => {
            if (materialInfo.flag & PmxObject.Material.Flag.EnabledToonEdge) {
                if (Scene.prototype.getMmdOutlineRenderer === undefined) {
                    logger.warn("MMD Outline Renderer is not available. Please import \"babylon-mmd/esm/Loader/mmdOutlineRenderer\".");
                }

                material.renderOutline = true;
                material.outlineWidth = materialInfo.edgeSize * MmdStandardMaterialBuilder.EdgeSizeScaleFactor;
                const edgeColor = materialInfo.edgeColor;
                material.outlineColor = new Color3(
                    edgeColor[0], edgeColor[1], edgeColor[2]
                );
                material.outlineAlpha = edgeColor[3];
            }
        };

    /**
     * Called after building a single material
     *
     * This method is called after the material and textures have been loaded
     */
    public afterBuildSingleMaterial: (
        material: MmdStandardMaterial,
        materialIndex: number,
        materialInfo: MaterialInfo,
        texturePathTable: readonly string[],
        scene: Scene,
        rootUrl: string
    ) => void = (): void => { /* do nothing */ };
}
