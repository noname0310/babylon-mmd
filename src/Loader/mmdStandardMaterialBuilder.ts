import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { _GetCompatibleTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdMaterialBuilder, MaterialInfo, ReferencedMesh, TextureInfo } from "./IMmdMaterialBuilder";
import { MmdAsyncTextureLoader } from "./mmdAsyncTextureLoader";
import { MmdStandardMaterial } from "./mmdStandardMaterial";
import type { BpmxObject } from "./Optimized/Parser/bpmxObject";
import type { ILogger } from "./Parser/ILogger";
import { PmxObject } from "./Parser/pmxObject";
import type { IArrayBufferFile } from "./referenceFileResolver";
import { ReferenceFileResolver } from "./referenceFileResolver";
import { TextureAlphaChecker } from "./textureAlphaChecker";

/**
 * Render method of MMD standard material
 *
 * The drawing behavior of MMD is not conducive to modern renderers like Babylon.js
 * That's why you need to decide which shading method is right for your use case
 */
export enum MmdStandardMaterialRenderMethod {
    /**
     * Force depth write alpha blending with alpha evaluation
     *
     * This approach first determines via alpha evaluation if the meshes to be rendered are opaque,
     * and then only enables forceDepthWrite and performs alphaBlending on non-opaque meshes
     *
     * This approach is similar to mmd, but is more performance friendly and partially solves the draw order problem
     */
    DepthWriteAlphaBlendingWithEvaluation = 0,

    /**
     * Force depth write alpha blending
     *
     * Materials loaded this way will all have forceDepthWrite true and will alphaBlend true
     *
     * Since it does depth writing and alpha blending, the draw order becomes very important
     *
     * This approach gives you exactly the same results as mmd,
     * but it introduces a problem that mmd is known for: manually managing the draw order
     */
    DepthWriteAlphaBlending = 1,

    /**
     * Alpha evaluation
     *
     * This method uses an alpha evaluation to determine whether the mesh is best rendered as opaque, alphatest, or alphablend
     *
     * Since this method does not use forceDepthWrite, it can give different results than mmd but has better compatibility for several shader effects
     */
    AlphaEvaluation = 2
}

/**
 * MMD standard material builder
 *
 * Use `MmdStandardMaterial` to create a mesh material
 */
export class MmdStandardMaterialBuilder implements IMmdMaterialBuilder {
    /**
     * Render method of MMD standard material (default: DepthWriteAlphaBlendingWithEvaluation)
     */
    public renderMethod = MmdStandardMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation;

    /**
     * Whether to force disable alpha evaluation (default: false)
     *
     * If true, load time alpha evaluation will be disabled
     *
     * For load time optimization, it is recommended to disable alpha evaluation feature and set the blending mode for the material manually
     */
    public forceDisableAlphaEvaluation = false;

    /**
     * The threshold of material alpha to use transparency mode. (default: 195)
     *
     * lower value is more likely to use transparency mode. (0 - 255)
     */
    public alphaThreshold = 195;

    /**
     * The threshold of transparency mode to use alpha blend. (default: 100)
     *
     * lower value is more likely to use alpha test mode. otherwise use alpha blend mode
     */
    public alphaBlendThreshold = 100;

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

    /**
     * Next starting alpha index for force depth write alpha blending rendering
     */
    public nextStartingAlphaIndex = 1 << 16;

    /**
     * Alpha index increments per model for force depth write alpha blending rendering
     */
    public alphaIndexIncrementsPerModel = 1 << 10;

    protected _setMeshesAlphaIndex(meshes: Mesh[]): void {
        let alphaIndex = this.nextStartingAlphaIndex;
        for (let i = 0; i < meshes.length; ++i) {
            meshes[i].alphaIndex = alphaIndex;
            alphaIndex += 1;
        }
        this.nextStartingAlphaIndex += this.alphaIndexIncrementsPerModel;
    }

    public buildMaterials(
        uniqueId: number,
        materialsInfo: readonly MaterialInfo[],
        texturesInfo: readonly TextureInfo[],
        imagePathTable: readonly string[],
        rootUrl: string,
        fileRootId: string,
        referenceFiles: readonly File[] | readonly IArrayBufferFile[],
        referencedMeshes: (readonly ReferencedMesh[])[],
        meshes: Mesh[],
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        textureNameMap: Nullable<Map<BaseTexture, string>>,
        logger: ILogger,
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): Material[] {
        if (this.renderMethod === MmdStandardMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation ||
            this.renderMethod === MmdStandardMaterialRenderMethod.DepthWriteAlphaBlending) {
            this._setMeshesAlphaIndex(meshes);
        }

        // Block the marking of materials dirty until all materials are built.
        const oldBlockMaterialDirtyMechanism = scene.blockMaterialDirtyMechanism;
        scene._forceBlockMaterialDirtyMechanism(true);

        let textureAlphaChecker: Nullable<TextureAlphaChecker> = null;
        const getTextureAlphaChecker = (): Nullable<TextureAlphaChecker> => {
            if (textureAlphaChecker !== null) return textureAlphaChecker;
            return this.forceDisableAlphaEvaluation
                ? null
                : textureAlphaChecker = new TextureAlphaChecker(
                    scene,
                    this.alphaEvaluationResolution
                );
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

        const materials: MmdStandardMaterial[] = [];

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
                    materialInfo,
                    referencedMeshes[i]
                );
                if (loadScalarPropertiesPromise !== undefined) {
                    singleMaterialPromises.push(loadScalarPropertiesPromise);
                }

                const loadDiffuseTexturePromise = this.loadDiffuseTexture(
                    uniqueId,
                    material,
                    materialInfo,
                    imagePathTable,
                    (texturesInfo[materialInfo.textureIndex] ?? null) as Nullable<TextureInfo>,
                    scene,
                    assetContainer,
                    rootUrl,
                    referenceFileResolver,
                    logger,
                    incrementProgress
                );
                const createSetAlphaBlendModePromise = (): Promise<void> | void => {
                    return this.setAlphaBlendMode(
                        material,
                        materialInfo,
                        referencedMeshes[i],
                        logger,
                        getTextureAlphaChecker
                    );
                };
                if (loadDiffuseTexturePromise !== undefined) {
                    const setAlphaBlendModePromise = loadDiffuseTexturePromise.then(createSetAlphaBlendModePromise);
                    singleMaterialPromises.push(setAlphaBlendModePromise);
                } else {
                    const setAlphaBlendModePromise = createSetAlphaBlendModePromise();
                    if (setAlphaBlendModePromise !== undefined) {
                        singleMaterialPromises.push(setAlphaBlendModePromise);
                    }
                }

                const loadSphereTexturePromise = this.loadSphereTexture(
                    uniqueId,
                    material,
                    materialInfo,
                    imagePathTable,
                    (texturesInfo[materialInfo.sphereTextureIndex] ?? null) as Nullable<TextureInfo>,
                    scene,
                    assetContainer,
                    rootUrl,
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
                    imagePathTable,
                    (texturesInfo[materialInfo.toonTextureIndex] ?? null) as Nullable<TextureInfo>,
                    scene,
                    assetContainer,
                    rootUrl,
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
                        imagePathTable,
                        texturesInfo,
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
                    if (textureNameMap !== null) this._buildTextureNameMap(materialsInfo, materials, imagePathTable, texturesInfo, textureNameMap);
                    onTextureLoadComplete?.();
                });
            });
        } else {
            Promise.all(promises).then(() => {
                textureAlphaChecker?.dispose();
                // Restore the blocking of material dirty.
                scene._forceBlockMaterialDirtyMechanism(oldBlockMaterialDirtyMechanism);
                if (textureNameMap !== null) this._buildTextureNameMap(materialsInfo, materials, imagePathTable, texturesInfo, textureNameMap);
                onTextureLoadComplete?.();
            });
        }

        return materials;
    }

    private _buildTextureNameMap(
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

    private _getForcedExtension(texturePath: string): string | undefined {
        if (texturePath.substring(texturePath.length - 4).toLowerCase() === ".bmp") {
            if (_GetCompatibleTextureLoader(".dxbmp") !== null) {
                return ".dxbmp";
            }
        }
        return undefined;
    }

    /**
     * Load general scalar properties (diffuse, specular, ambient, alpha, shininess)
     *
     * This method can be overridden for customizing the material loading process
     * @param material Material
     * @param materialInfo Material information
     * @param meshes Meshes that use the material
     */
    public loadGeneralScalarProperties: (
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[]
    ) => Promise<void> | void = (
            material,
            materialInfo,
            meshes
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
        };

    /**
     * Load diffuse texture
     *
     * This method can be overridden for customizing the material loading process
     * @param uniqueId Model unique id
     * @param material Material
     * @param materialInfo Material information
     * @param imagePathTable Image path table
     * @param textureInfo Texture information
     * @param scene Scene
     * @param assetContainer Asset container
     * @param rootUrl Root url
     * @param referenceFileResolver Reference file resolver
     * @param meshes Meshes that use the material
     * @param logger Logger
     * @param getTextureAlphaChecker Get texture alpha checker
     * @param onTextureLoadComplete Texture load complete callback
     */
    public loadDiffuseTexture: (
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
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            imagePathTable,
            textureInfo,
            scene,
            assetContainer,
            rootUrl,
            referenceFileResolver,
            logger,
            onTextureLoadComplete
        ): Promise<void> => {
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

    protected async _evaluateDiffuseTextureTransparencyMode(
        diffuseTexture: BaseTexture,
        evaluatedTransparency: number,
        referencedMeshes: readonly ReferencedMesh[],
        logger: ILogger,
        getTextureAlphaChecker: () => Nullable<TextureAlphaChecker>
    ): Promise<Nullable<number>> {
        let transparencyMode = Number.MIN_SAFE_INTEGER;

        if (this.renderMethod === MmdStandardMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
            let etIsNotOpaque = (evaluatedTransparency >> 4) & 0x03;
            if ((etIsNotOpaque ^ 0x03) === 0) { // 11: not evaluated
                etIsNotOpaque = -1;
            }

            if (etIsNotOpaque === -1) {
                transparencyMode = Material.MATERIAL_OPAQUE;

                const textureAlphaChecker = getTextureAlphaChecker();
                if (textureAlphaChecker !== null) {
                    for (let i = 0; i < referencedMeshes.length; ++i) {
                        const referencedMesh = referencedMeshes[i];

                        const isMeshOpaque = await textureAlphaChecker.hasFragmentsOnlyOpaqueOnGeometry(
                            diffuseTexture,
                            (referencedMesh as { mesh: Mesh })?.mesh ?? referencedMesh as Mesh,
                            (referencedMesh as { subMeshIndex: number })?.subMeshIndex !== undefined
                                ? (referencedMesh as { subMeshIndex: number }).subMeshIndex
                                : null
                        );

                        if (!isMeshOpaque) {
                            transparencyMode = Material.MATERIAL_ALPHABLEND;
                            break;
                        }
                    }
                }
            } else if (etIsNotOpaque === 0) { // 00: opaque
                transparencyMode = Material.MATERIAL_OPAQUE;
            } else {
                transparencyMode = Material.MATERIAL_ALPHABLEND;
            }
        } else if (this.renderMethod === MmdStandardMaterialRenderMethod.AlphaEvaluation) {
            let etAlphaEvaluateResult = evaluatedTransparency & 0x0F;
            if ((etAlphaEvaluateResult ^ 0x0F) === 0) { // 1111: not evaluated
                etAlphaEvaluateResult = -1;
            }

            if (etAlphaEvaluateResult !== -1) {
                transparencyMode = etAlphaEvaluateResult;
            } else {
                const textureAlphaChecker = getTextureAlphaChecker();
                if (textureAlphaChecker !== null) {
                    for (let i = 0; i < referencedMeshes.length; ++i) {
                        const referencedMesh = referencedMeshes[i];

                        const newTransparencyMode = await textureAlphaChecker.hasTranslucentFragmentsOnGeometry(
                            diffuseTexture,
                            (referencedMesh as { mesh: Mesh })?.mesh ?? referencedMesh as Mesh,
                            (referencedMesh as { subMeshIndex: number })?.subMeshIndex !== undefined
                                ? (referencedMesh as { subMeshIndex: number }).subMeshIndex
                                : null,
                            this.alphaThreshold,
                            this.alphaBlendThreshold
                        );

                        if (transparencyMode < newTransparencyMode) {
                            transparencyMode = newTransparencyMode;
                        }
                    }
                }
            }
        } else {
            logger.warn(`Unknown shading method for evaluating transparency mode: ${this.renderMethod}`);
        }

        return transparencyMode !== Number.MIN_SAFE_INTEGER ? transparencyMode : null;
    }

    public setAlphaBlendMode: (
        material: MmdStandardMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[],
        logger: ILogger,
        getTextureAlphaChecker: () => Nullable<TextureAlphaChecker>
    ) => Promise<void> | void = async(
            material,
            materialInfo,
            meshes,
            logger,
            getTextureAlphaChecker
        ): Promise<void> => {
            if (this.renderMethod === MmdStandardMaterialRenderMethod.DepthWriteAlphaBlending) {
                if (material.diffuseTexture) {
                    material.diffuseTexture.hasAlpha = true;
                    material.useAlphaFromDiffuseTexture = true;
                }
                material.transparencyMode = Material.MATERIAL_ALPHABLEND;
                material.forceDepthWrite = true;

                return;
            }

            if (this.renderMethod === MmdStandardMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
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
                    if (this.renderMethod === MmdStandardMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
                        material.forceDepthWrite = hasAlpha;
                    }
                }
            } else {
                if (this.renderMethod === MmdStandardMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
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
        };

    /**
     * Load sphere texture
     *
     * This method can be overridden for customizing the material loading process
     * @param uniqueId Model unique id
     * @param material Material
     * @param materialInfo Material information
     * @param imagePathTable Texture path table
     * @param textureInfo Texture information
     * @param scene Scene
     * @param assetContainer Asset container
     * @param rootUrl Root url
     * @param referenceFileResolver Reference file resolver
     * @param logger Logger
     * @param onTextureLoadComplete Texture load complete callback
     */
    public loadSphereTexture: (
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
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            imagePathTable,
            textureInfo,
            scene,
            assetContainer,
            rootUrl,
            referenceFileResolver,
            logger,
            onTextureLoadComplete
        ): Promise<void> => {
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
        };

    /**
     * Load toon texture
     *
     * This method can be overridden for customizing the material loading process
     * @param uniqueId Model unique id
     * @param material Material
     * @param materialInfo Material information
     * @param imagePathTable Image path table
     * @param textureInfo Texture information
     * @param scene Scene
     * @param assetContainer Asset container
     * @param rootUrl Root url
     * @param referenceFileResolver Reference file resolver
     * @param logger Logger
     * @param onTextureLoadComplete Texture load complete callback
     */
    public loadToonTexture: (
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
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            imagePathTable,
            textureInfo,
            scene,
            assetContainer,
            rootUrl,
            referenceFileResolver,
            logger,
            onTextureLoadComplete
        ): Promise<void> => {
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
                material.outlineWidth = materialInfo.edgeSize;
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
     * @param material Material
     * @param materialIndex Material index
     * @param materialInfo Material information
     * @param imagePathTable Image path table
     * @param texturesInfo Texture information
     * @param scene Scene
     * @param rootUrl Root url
     */
    public afterBuildSingleMaterial: (
        material: MmdStandardMaterial,
        materialIndex: number,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        texturesInfo: readonly TextureInfo[],
        scene: Scene,
        rootUrl: string
    ) => void = (): void => { /* do nothing */ };
}
