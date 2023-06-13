import type { MultiMaterial, Scene } from "@babylonjs/core";
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
     * lower value is more likely to use transparency mode. (0 - 255) default is 200.
     */
    public alphaThreshold = 200;

    /**
     * The threshold of transparency mode to use alpha blend.
     *
     * lower value is more likely to use alpha blend mode. otherwise use alpha test mode. default is 50.
     */
    public alphaBlendThreshold = 50;

    public useAlphaEvaluation = true;

    private readonly _textureLoader = new MmdAsyncTextureLoader();

    public buildMaterials(
        uniqueId: number,
        pmxObject: PmxObject,
        rootUrl: string,
        scene: Scene,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        multiMaterial: MultiMaterial,
        onComplete?: () => void
    ): void {
        // Block the marking of materials dirty until all materials are built.
        const oldBlockMaterialDirtyMechanism = scene.blockMaterialDirtyMechanism;
        scene.blockMaterialDirtyMechanism = true;

        const materials = pmxObject.materials;
        const alphaEvaluateRenderingContext = this.useAlphaEvaluation
            ? TextureAlphaChecker.createRenderingContext()
            : null;

        const promises: Promise<void>[] = [];

        let offset = 0;
        for (let i = 0; i < materials.length; ++i) {
            const materialInfo = materials[i];

            const material = new MmdStandardMaterial(materialInfo.name, scene);
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
                    rootUrl,
                    indices,
                    uvs,
                    offset,
                    alphaEvaluateRenderingContext
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
                    rootUrl
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
                    rootUrl
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
                    // Restore the blocking of material dirty.
                    scene.blockMaterialDirtyMechanism = oldBlockMaterialDirtyMechanism;
                    onComplete?.();
                });
            });
        } else {
            Promise.all(promises).then(() => {
                // Restore the blocking of material dirty.
                scene.blockMaterialDirtyMechanism = oldBlockMaterialDirtyMechanism;
                onComplete?.();
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
        rootUrl: string,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        materialIndexOffset: number,
        alphaEvaluateRenderingContext: WebGL2RenderingContext | null
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            pmxObject,
            scene,
            rootUrl,
            indices,
            uvs,
            offset,
            alphaEvaluateRenderingContext
        ): Promise<void> => {
            material.backFaceCulling = materialInfo.flag & PmxObject.Material.Flag.isDoubleSided ? false : true;

            const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
            if (diffuseTexturePath !== undefined) {
                const diffuseTexture = await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    diffuseTexturePath,
                    scene
                );

                if (diffuseTexture !== null) {
                    material.diffuseTexture = diffuseTexture;

                    const transparencyMode = await TextureAlphaChecker.textureHasAlphaOnGeometry(
                        alphaEvaluateRenderingContext,
                        diffuseTexture,
                        indices,
                        uvs,
                        offset,
                        materialInfo.surfaceCount,
                        this.alphaThreshold,
                        this.alphaBlendThreshold
                    );
                    const hasAlpha = transparencyMode !== Material.MATERIAL_OPAQUE;

                    diffuseTexture.hasAlpha = hasAlpha;
                    material.useAlphaFromDiffuseTexture = hasAlpha;
                    material.transparencyMode = transparencyMode;
                    if (hasAlpha) material.backFaceCulling = false;
                }
            }
        };

    public loadSphereTexture: (
        uniqueId: number,
        material: MmdStandardMaterial,
        materialInfo: PmxObject.Material,
        pmxObject: PmxObject,
        scene: Scene,
        rootUrl: string
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            pmxObject,
            scene,
            rootUrl
        ): Promise<void> => {
            if (materialInfo.sphereTextureMode !== PmxObject.Material.SphereTextureMode.off) {
                const sphereTexturePath = pmxObject.textures[materialInfo.sphereTextureIndex];
                if (sphereTexturePath !== undefined) {
                    const sphereTexture = await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        sphereTexturePath,
                        scene
                    );

                    if (sphereTexture !== null) {
                        material.sphereTexture = sphereTexture;
                        material.sphereTextureBlendMode = materialInfo.sphereTextureMode === 1
                            ? MmdPluginMaterialSphereTextureBlendMode.Multiply
                            : MmdPluginMaterialSphereTextureBlendMode.Add;
                    }
                }
            }
        };

    public loadToonTexture: (
        uniqueId: number,
        material: MmdStandardMaterial,
        materialInfo: PmxObject.Material,
        pmxObject: PmxObject,
        scene: Scene,
        rootUrl: string
    ) => Promise<void> | void = async(
            uniqueId,
            material,
            materialInfo,
            pmxObject,
            scene,
            rootUrl
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
                    scene
                );

                if (toonTexture !== null) {
                    material.toonTexture = toonTexture;
                }
            }
        };

    public loadOutlineRenderingProperties: (
        material: MmdStandardMaterial,
        materialInfo: PmxObject.Material
    ) => Promise<void> | void = (
            material,
            materialInfo
        ): void => {
            if (materialInfo.flag & PmxObject.Material.Flag.enabledToonEdge) {
                MmdOutlineRenderer.registerMmdOutlineRendererIfNeeded();

                material.renderOutline = true;
                material.outlineWidth = materialInfo.edgeSize * 0.01;
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
