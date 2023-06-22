import type { AssetContainer, ISceneLoaderProgressEvent, MultiMaterial, Scene } from "@babylonjs/core";
import { Color3, Material } from "@babylonjs/core";

import type { IMmdMaterialBuilder } from "./IMmdMaterialBuilder";
import { MmdAsyncTextureLoader } from "./MmdAsyncTextureLoader";
import { MmdOutlineRenderer } from "./MmdOutlineRenderer";
import { MmdPluginMaterialSphereTextureBlendMode } from "./MmdPluginMaterial";
import { MmdStandardMaterial } from "./MmdStandardMaterial";
import { PmxObject } from "./parser/PmxObject";
import { TextureAlphaChecker } from "./TextureAlphaChecker";

export class MmdStandardMaterialBuilder implements IMmdMaterialBuilder {
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

    public static EdgeSizeScaleFactor = 0.01;

    public useAlphaEvaluation = true;

    private readonly _textureLoader = new MmdAsyncTextureLoader();

    public buildMaterials(
        uniqueId: number,
        pmxObject: PmxObject,
        rootUrl: string,
        scene: Scene,
        assetContainer: AssetContainer | null,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        multiMaterial: MultiMaterial,
        onTextureLoadProgress?: (event: ISceneLoaderProgressEvent) => void,
        onTextureLoadComplete?: () => void
    ): void {
        // Block the marking of materials dirty until all materials are built.
        const oldBlockMaterialDirtyMechanism = scene.blockMaterialDirtyMechanism;
        scene.blockMaterialDirtyMechanism = true;

        const materials = pmxObject.materials;
        const textureAlphaChecker = this.useAlphaEvaluation
            ? new TextureAlphaChecker(uvs, indices)
            : null;

        const promises: Promise<void>[] = [];

        const progressEvent = {
            lengthComputable: true,
            loaded: 0,
            total: materials.length * 3
        };
        const incrementProgress = (): void => {
            progressEvent.loaded += 1;
            onTextureLoadProgress?.(progressEvent);
        };

        let offset = 0;
        for (let i = 0; i < materials.length; ++i) {
            const materialInfo = materials[i];

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
                    pmxObject,
                    scene,
                    assetContainer,
                    rootUrl,
                    offset,
                    textureAlphaChecker,
                    incrementProgress
                );
                if (loadDiffuseTexturePromise !== undefined) {
                    singleMaterialPromises.push(loadDiffuseTexturePromise);
                }

                const loadSphereTexturePromise = this.loadSphereTexture(
                    uniqueId,
                    material,
                    materialInfo,
                    pmxObject,
                    scene,
                    assetContainer,
                    rootUrl,
                    incrementProgress
                );
                if (loadSphereTexturePromise !== undefined) {
                    singleMaterialPromises.push(loadSphereTexturePromise);
                }

                const loadToonTexturePromise = this.loadToonTexture(
                    uniqueId,
                    material,
                    materialInfo,
                    pmxObject,
                    scene,
                    assetContainer,
                    rootUrl,
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
                        pmxObject,
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
        materialInfo: PmxObject.Material
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
        materialInfo: PmxObject.Material,
        pmxObject: PmxObject,
        scene: Scene,
        assetContainer: AssetContainer | null,
        rootUrl: string,
        materialIndexOffset: number,
        textureAlphaChecker: TextureAlphaChecker | null,
        onTextureLoadComplete?: () => void
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            pmxObject,
            scene,
            assetContainer,
            rootUrl,
            offset,
            textureAlphaChecker,
            onTextureLoadComplete
        ): Promise<void> => {
            material.backFaceCulling = materialInfo.flag & PmxObject.Material.Flag.IsDoubleSided ? false : true;

            const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
            if (diffuseTexturePath !== undefined) {
                const diffuseTexture = await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    diffuseTexturePath,
                    scene,
                    assetContainer
                );

                if (diffuseTexture !== null) {
                    material.diffuseTexture = diffuseTexture;

                    if (textureAlphaChecker !== null) {
                        const transparencyMode = await textureAlphaChecker.textureHasAlphaOnGeometry(
                            diffuseTexture,
                            offset,
                            materialInfo.surfaceCount,
                            this.alphaThreshold,
                            this.alphaBlendThreshold
                        );
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
        materialInfo: PmxObject.Material,
        pmxObject: PmxObject,
        scene: Scene,
        assetContainer: AssetContainer | null,
        rootUrl: string,
        onTextureLoadComplete?: () => void
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            pmxObject,
            scene,
            assetContainer,
            rootUrl,
            onTextureLoadComplete
        ): Promise<void> => {
            if (materialInfo.sphereTextureMode !== PmxObject.Material.SphereTextureMode.Off) {
                const sphereTexturePath = pmxObject.textures[materialInfo.sphereTextureIndex];
                if (sphereTexturePath !== undefined) {
                    const sphereTexture = await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        sphereTexturePath,
                        scene,
                        assetContainer
                    );

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
        materialInfo: PmxObject.Material,
        pmxObject: PmxObject,
        scene: Scene,
        assetContainer: AssetContainer | null,
        rootUrl: string,
        onTextureLoadComplete?: () => void
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            pmxObject,
            scene,
            assetContainer,
            rootUrl,
            onTextureLoadComplete
        ): Promise<void> => {
            let toonTexturePath;
            if (materialInfo.isSharedToonTexture) {
                toonTexturePath = materialInfo.toonTextureIndex === -1
                    ? undefined
                    : materialInfo.toonTextureIndex;
            } else {
                toonTexturePath = pmxObject.textures[materialInfo.toonTextureIndex];
            }
            if (toonTexturePath !== undefined) {
                const toonTexture = await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    toonTexturePath,
                    scene,
                    assetContainer
                );

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
        materialInfo: PmxObject.Material
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
        materialInfo: PmxObject.Material,
        multiMaterial: MultiMaterial,
        pmxObject: PmxObject,
        scene: Scene,
        rootUrl: string
    ) => void = (): void => { /* do nothing */ };
}
