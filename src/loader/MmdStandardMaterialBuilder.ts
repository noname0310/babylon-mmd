import type { MultiMaterial, Scene } from "@babylonjs/core";
import { Color3, Material, Texture } from "@babylonjs/core";

import type { IMmdMaterialBuilder } from "./IMmdMaterialBuilder";
import { MmdOutlineRenderer } from "./MmdOutlineRenderer";
import { MmdPluginMaterialSphereTextureBlendMode } from "./MmdPluginMaterial";
import { MmdStandardMaterial } from "./MmdStandardMaterial";
import { PmxObject } from "./parser/PmxObject";
import { SharedToonTextures } from "./SharedToonTextures";
import { TextureAlphaChecker } from "./TextureAlphaChecker";

export class MmdStandardMaterialBuilder implements IMmdMaterialBuilder {
    /**
     * The threshold of material alpha to use alpha blend.
     *
     * lower value is more likely to use alpha blend. (0 - 255) default is 200.
     */
    public alpheblendThreshold = 200;

    public useAlphaEvaluation = true;

    public readonly textureCache = new Map<string, WeakRef<Texture>>();

    public buildMaterials(
        pmxObject: PmxObject,
        rootUrl: string,
        scene: Scene,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        multiMaterial: MultiMaterial
    ): void {
        // Block the marking of materials dirty until all materials are built.
        const oldBlockMaterialDirtyMechanism = scene.blockMaterialDirtyMechanism;
        scene.blockMaterialDirtyMechanism = true;

        const materials = pmxObject.materials;
        const alphaEvaluateRenderingContext = this.useAlphaEvaluation
            ? TextureAlphaChecker.createRenderingContext()
            : null;

        let offset = 0;
        for (let i = 0; i < materials.length; ++i) {
            const materialInfo = materials[i];


            const material = new MmdStandardMaterial(materialInfo.name, scene);
            {
                const promises: Promise<void>[] = [];

                const loadScalarPropertiesPromise = this.loadGeneralScalarProperties(
                    material,
                    materialInfo
                );
                if (loadScalarPropertiesPromise !== undefined) {
                    promises.push(loadScalarPropertiesPromise);
                }

                const loadDiffuseTexturePromise = this.loadDiffuseTexture(
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
                    promises.push(loadDiffuseTexturePromise);
                }

                const loadSphereTexturePromise = this.loadSphereTexture(
                    material,
                    materialInfo,
                    pmxObject,
                    scene,
                    rootUrl
                );
                if (loadSphereTexturePromise !== undefined) {
                    promises.push(loadSphereTexturePromise);
                }

                const loadToonTexturePromise = this.loadToonTexture(
                    material,
                    materialInfo,
                    pmxObject,
                    scene,
                    rootUrl
                );
                if (loadToonTexturePromise !== undefined) {
                    promises.push(loadToonTexturePromise);
                }

                const loadOutlineRenderingPropertiesPromise = this.loadOutlineRenderingProperties(
                    material,
                    materialInfo
                );
                if (loadOutlineRenderingPropertiesPromise !== undefined) {
                    promises.push(loadOutlineRenderingPropertiesPromise);
                }

                Promise.all(promises).then(() => {
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

        // Restore the blocking of material dirty.
        scene.blockMaterialDirtyMechanism = oldBlockMaterialDirtyMechanism;
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
            const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
            if (diffuseTexturePath !== undefined) {
                const requestString = this.pathNormalize(rootUrl + diffuseTexturePath);
                let diffuseTexture = this.textureCache.get(requestString)?.deref();
                if (diffuseTexture === undefined) {
                    diffuseTexture = new Texture(requestString, scene);
                    this.textureCache.set(requestString, new WeakRef(diffuseTexture));
                }

                material.diffuseTexture = diffuseTexture;
                material.cullBackFaces = materialInfo.flag & PmxObject.Material.Flag.isDoubleSided ? false : true;

                const hasAlpha = await TextureAlphaChecker.textureHasAlphaOnGeometry(
                    alphaEvaluateRenderingContext,
                    diffuseTexture,
                    indices,
                    uvs,
                    offset,
                    materialInfo.surfaceCount,
                    this.alpheblendThreshold
                );

                diffuseTexture.hasAlpha = hasAlpha;
                material.useAlphaFromDiffuseTexture = hasAlpha;
                material.transparencyMode = hasAlpha ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_OPAQUE;
            }
        };

    public loadSphereTexture: (
        material: MmdStandardMaterial,
        materialInfo: PmxObject.Material,
        pmxObject: PmxObject,
        scene: Scene,
        rootUrl: string
    ) => Promise<void> | void = (
            material,
            materialInfo,
            pmxObject,
            scene,
            rootUrl
        ): void => {
            if (materialInfo.sphereTextureMode !== PmxObject.Material.SphereTextureMode.off) {
                const sphereTexturePath = pmxObject.textures[materialInfo.sphereTextureIndex];
                if (sphereTexturePath !== undefined) {
                    const requestString = this.pathNormalize(rootUrl + sphereTexturePath);
                    let sphereTexture = this.textureCache.get(requestString)?.deref();
                    if (sphereTexture === undefined) {
                        sphereTexture = new Texture(requestString, scene);
                        this.textureCache.set(requestString, new WeakRef(sphereTexture));
                    }
                    material.sphereTexture = sphereTexture;
                    material.sphereTextureBlendMode = materialInfo.sphereTextureMode === 1
                        ? MmdPluginMaterialSphereTextureBlendMode.Multiply
                        : MmdPluginMaterialSphereTextureBlendMode.Add;
                }
            }
        };

    public loadToonTexture: (
        material: MmdStandardMaterial,
        materialInfo: PmxObject.Material,
        pmxObject: PmxObject,
        scene: Scene,
        rootUrl: string
    ) => Promise<void> | void = (
            material,
            materialInfo,
            pmxObject,
            scene,
            rootUrl
        ): void => {
            let toonTexturePath;
            if (materialInfo.isSharedToonTexture) {
                toonTexturePath = materialInfo.toonTextureIndex === -1
                    ? undefined
                    : "shared_toon_texture" + materialInfo.toonTextureIndex;
            } else {
                toonTexturePath = pmxObject.textures[materialInfo.toonTextureIndex];
            }
            if (toonTexturePath !== undefined) {
                const requestString = materialInfo.isSharedToonTexture
                    ? toonTexturePath
                    : this.pathNormalize(rootUrl + toonTexturePath);
                let toonTexture = this.textureCache.get(requestString)?.deref();
                if (toonTexture === undefined) {
                    const blobOrUrl = materialInfo.isSharedToonTexture
                        ? SharedToonTextures.data[materialInfo.toonTextureIndex]
                        : requestString;
                    toonTexture = new Texture(blobOrUrl, scene);
                    if (materialInfo.isSharedToonTexture) {
                        toonTexture.name = requestString;
                    }
                    this.textureCache.set(requestString, new WeakRef(toonTexture));
                }

                material.toonTexture = toonTexture;
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
                material.outlineWidth = materialInfo.edgeSize * 0.1;
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

    public pathNormalize(path: string): string {
        path = path.replace(/\\/g, "/");
        const pathArray = path.split("/");
        const resultArray = [];
        for (let i = 0; i < pathArray.length; ++i) {
            const pathElement = pathArray[i];
            if (pathElement === ".") {
                continue;
            } else if (pathElement === "..") {
                resultArray.pop();
            } else {
                resultArray.push(pathElement);
            }
        }
        return resultArray.join("/");
    }
}
