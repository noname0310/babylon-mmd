import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdMaterialBuilder, MaterialInfo, ReferencedMesh, TextureInfo } from "./IMmdMaterialBuilder";
import { MmdAsyncTextureLoader } from "./mmdAsyncTextureLoader";
import type { ILogger } from "./Parser/ILogger";
import type { IArrayBufferFile } from "./referenceFileResolver";
import { ReferenceFileResolver } from "./referenceFileResolver";
import { TextureAlphaChecker } from "./textureAlphaChecker";

/**
 * Render method of MMD material
 *
 * The drawing behavior of MMD is not conducive to modern renderers like Babylon.js
 * That's why you need to decide which shading method is right for your use case
 */
export enum MmdMaterialRenderMethod {
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
 * Material constructor type for mmd material builder
 */
export type MmdMaterialConstructor<TMaterial extends Material> = new (name: string, scene: Scene) => TMaterial;

/**
 * Material builder base class for creating mmd model materials
 */
export abstract class MaterialBuilderBase<TMaterial extends Material> implements IMmdMaterialBuilder {
    /**
     * Render method of MMD standard material (default: DepthWriteAlphaBlendingWithEvaluation)
     */
    public renderMethod = MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation;

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

    /**
     * For parallel texture loading and caching duplicate texture requests
     *
     * we use a custom texture loader to load the textures
     */
    protected readonly _textureLoader = new MmdAsyncTextureLoader();

    /**
     * Next starting alpha index for force depth write alpha blending rendering
     */
    public nextStartingAlphaIndex = 1 << 16;

    /**
     * Alpha index increments per model for force depth write alpha blending rendering
     */
    public alphaIndexIncrementsPerModel = 1 << 10;

    private readonly _materialConstructor: MmdMaterialConstructor<TMaterial>;

    /**
     * pass the material constructor to the builder for creating the material
     * @param materialConstructor material constructor
     */
    public constructor(materialConstructor: MmdMaterialConstructor<TMaterial>) {
        this._materialConstructor = materialConstructor;
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
        if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation ||
            this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlending) {
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

        const materials: TMaterial[] = [];

        for (let i = 0; i < materialsInfo.length; ++i) {
            const materialInfo = materialsInfo[i];

            scene._blockEntityCollection = !!assetContainer;
            const material = new this._materialConstructor(materialInfo.name, scene);
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

    /**
     * Texture name map should preserve the original texture name for lossless bpmx conversion
     *
     * @param materialsInfo materials information
     * @param materials materials
     * @param imagePathTable image path table
     * @param texturesInfo textures information
     * @param textureNameMap texture name map to be built
     */
    protected abstract _buildTextureNameMap(
        materialsInfo: readonly MaterialInfo[],
        materials: TMaterial[],
        imagePathTable: readonly string[],
        texturesInfo: readonly TextureInfo[],
        textureNameMap: Map<BaseTexture, string>
    ): void;

    private _setMeshesAlphaIndex(meshes: Mesh[]): void {
        let alphaIndex = this.nextStartingAlphaIndex;
        for (let i = 0; i < meshes.length; ++i) {
            meshes[i].alphaIndex = alphaIndex;
            alphaIndex += 1;
        }
        this.nextStartingAlphaIndex += this.alphaIndexIncrementsPerModel;
    }

    /**
     * Load general scalar properties (diffuse, specular, ambient, alpha, shininess)
     *
     * This method can be overridden for customizing the material loading process
     * @param material Material
     * @param materialInfo Material information
     * @param meshes Meshes that use the material
     */
    public abstract loadGeneralScalarProperties(
        material: TMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[]
    ): Promise<void> | void;

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
     * @param logger Logger
     * @param onTextureLoadComplete Texture load complete callback
     */
    public abstract loadDiffuseTexture(
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
    ): Promise<void> | void;

    /**
     * Evaluate diffuse texture transparency mode from the diffuse texture and meshes
     * @param diffuseTexture diffuse texture
     * @param evaluatedTransparency evaluated transparency
     * @param referencedMeshes meshes that use the diffuse texture
     * @param logger logger
     * @param getTextureAlphaChecker get texture alpha checker function
     * @returns transparency mode
     */
    protected async _evaluateDiffuseTextureTransparencyModeAsync(
        diffuseTexture: BaseTexture,
        evaluatedTransparency: number,
        referencedMeshes: readonly ReferencedMesh[],
        logger: ILogger,
        getTextureAlphaChecker: () => Nullable<TextureAlphaChecker>
    ): Promise<Nullable<number>> {
        let transparencyMode = Number.MIN_SAFE_INTEGER;

        if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
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

                        const isMeshOpaque = await textureAlphaChecker.hasFragmentsOnlyOpaqueOnGeometryAsync(
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
        } else if (this.renderMethod === MmdMaterialRenderMethod.AlphaEvaluation) {
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

                        const newTransparencyMode = await textureAlphaChecker.hasTranslucentFragmentsOnGeometryAsync(
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

    /**
     * set material alpha blend mode
     *
     * this method is called after diffuse texture loading
     * @param material Material
     * @param materialInfo Material information
     * @param meshes Meshes that use the material
     * @param logger Logger
     * @param getTextureAlphaChecker Get texture alpha checker function
     */
    public abstract setAlphaBlendMode(
        material: TMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[],
        logger: ILogger,
        getTextureAlphaChecker: () => Nullable<TextureAlphaChecker>
    ): Promise<void> | void;

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
    public abstract loadSphereTexture(
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
    ): Promise<void> | void;

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
    public abstract loadToonTexture(
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
    ): Promise<void> | void;

    /**
     * Load outline rendering properties
     *
     * This method can be overridden for customizing the material loading process
     * @param material Material
     * @param materialInfo Material information
     * @param logger Logger
     */
    public abstract loadOutlineRenderingProperties(
        material: TMaterial,
        materialInfo: MaterialInfo,
        logger: ILogger
    ): Promise<void> | void;

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
        material: TMaterial,
        materialIndex: number,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        texturesInfo: readonly TextureInfo[],
        scene: Scene,
        rootUrl: string
    ) => void = (): void => { /* do nothing */ };
}
