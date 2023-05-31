import * as BABYLON from "@babylonjs/core";

import { MmdOutlineRenderer } from "./MmdOutlineRenderer";
import { MmdPluginMaterialSphereTextureBlendMode } from "./MmdPluginMaterial";
import { MmdStandardMaterial } from "./MmdStandardMaterial";
import { PmxObject } from "./parser/PmxObject";
import { PmxReader } from "./parser/PmxReader";
import { SharedToonTextures } from "./SharedToonTextures";
import { TextureAlphaChecker } from "./TextureAlphaChecker";

export class PmxLoader implements BABYLON.ISceneLoaderPluginAsync {
    private readonly _textureCache = new Map<string, WeakRef<BABYLON.Texture>>();

    /**
     * Name of the loader ("pmx")
     */
    public name: string;
    public extensions: BABYLON.ISceneLoaderPluginExtensions;

    public constructor() {
        this.name = "pmx";
        this.extensions = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".pmx": { isBinary: true }
        };
    }

    public importMeshAsync(
        meshesNames: any,
        scene: BABYLON.Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: BABYLON.ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<BABYLON.ISceneLoaderAsyncResult> {
        // meshesNames type is string | string[] | any
        // you can select
        meshesNames;
        scene;
        data;
        rootUrl;
        onProgress;
        fileName;
        console.log("importMesh");
        throw new Error("Method not implemented.");
    }

    public async loadAsync(
        scene: BABYLON.Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: BABYLON.ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<void> {
        // data must be ArrayBuffer
        const pmxObject = await PmxReader.parseAsync(data)
            .catch((e: any) => {
                return Promise.reject(e);
            });

        const mesh = new BABYLON.Mesh(pmxObject.header.modelName, scene);

        const vertexData = new BABYLON.VertexData();
        {
            const vertices = pmxObject.vertices;
            const positions = new Float32Array(vertices.length * 3);
            const normals = new Float32Array(vertices.length * 3);
            const uvs = new Float32Array(vertices.length * 2);
            let indices;
            if (pmxObject.faces instanceof Uint8Array || pmxObject.faces instanceof Uint16Array) {
                indices = new Uint16Array(pmxObject.faces.length);
            } else {
                indices = new Uint32Array(pmxObject.faces.length);
            }
            {
                let time = performance.now();
                for (let i = 0; i < indices.length; i += 3) { // reverse winding order
                    indices[i + 0] = pmxObject.faces[i + 0];
                    indices[i + 1] = pmxObject.faces[i + 2];
                    indices[i + 2] = pmxObject.faces[i + 1];

                    if (i % 10000 === 0 && 100 < performance.now() - time) {
                        await BABYLON.Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }
            }

            {
                let time = performance.now();
                for (let i = 0; i < vertices.length; ++i) {
                    const vertex = vertices[i];
                    positions[i * 3 + 0] = vertex.position[0];
                    positions[i * 3 + 1] = vertex.position[1];
                    positions[i * 3 + 2] = vertex.position[2];

                    normals[i * 3 + 0] = vertex.normal[0];
                    normals[i * 3 + 1] = vertex.normal[1];
                    normals[i * 3 + 2] = vertex.normal[2];

                    uvs[i * 2 + 0] = vertex.uv[0];
                    uvs[i * 2 + 1] = 1 - vertex.uv[1]; // flip y axis

                    if (i % 10000 === 0 && 100 < performance.now() - time) {
                        await BABYLON.Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }
            }

            vertexData.positions = positions;
            vertexData.normals = normals;
            vertexData.uvs = uvs;
            vertexData.indices = indices;
        }

        const geometry = new BABYLON.Geometry(pmxObject.header.modelName, scene, vertexData, false);
        geometry.applyToMesh(mesh);

        const multiMaterial = new BABYLON.MultiMaterial(pmxObject.header.modelName + "_multi", scene);
        {
            const materials = pmxObject.materials;
            const alphaEvaluateRenderingContext = TextureAlphaChecker.createRenderingContext();
            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                const material = new MmdStandardMaterial(materialInfo.name, scene);
                {
                    const diffuse = materialInfo.diffuse;
                    material.diffuseColor = new BABYLON.Color3(
                        diffuse[0],
                        diffuse[1],
                        diffuse[2]
                    );

                    const specular = materialInfo.specular;
                    material.specularColor = new BABYLON.Color3(
                        specular[0],
                        specular[1],
                        specular[2]
                    );

                    const ambient = materialInfo.ambient;
                    material.ambientColor = new BABYLON.Color3(
                        ambient[0],
                        ambient[1],
                        ambient[2]
                    );

                    const alpha = materialInfo.diffuse[3];
                    material.alpha = alpha;

                    material.specularPower = materialInfo.shininess;

                    const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
                    if (diffuseTexturePath !== undefined) {
                        const requestString = this.pathNormalize(rootUrl + diffuseTexturePath);
                        let diffuseTexture = this._textureCache.get(requestString)?.deref();
                        if (diffuseTexture === undefined) {
                            diffuseTexture = new BABYLON.Texture(requestString, scene);
                            this._textureCache.set(requestString, new WeakRef(diffuseTexture));
                        }

                        material.diffuseTexture = diffuseTexture;
                        material.cullBackFaces = materialInfo.flag & PmxObject.Material.Flag.isDoubleSided ? false : true;

                        TextureAlphaChecker.textureHasAlphaOnGeometry(
                            alphaEvaluateRenderingContext,
                            diffuseTexture,
                            vertexData.indices,
                            vertexData.uvs,
                            offset,
                            materialInfo.surfaceCount
                        ).then((hasAlpha) => {
                            diffuseTexture!.hasAlpha = hasAlpha;
                            material.useAlphaFromDiffuseTexture = hasAlpha;
                            material.transparencyMode = hasAlpha ? BABYLON.Material.MATERIAL_ALPHABLEND : BABYLON.Material.MATERIAL_OPAQUE;
                        });
                    }

                    if (materialInfo.sphereTextureMode !== PmxObject.Material.SphereTextureMode.off) {
                        const sphereTexturePath = pmxObject.textures[materialInfo.sphereTextureIndex];
                        if (sphereTexturePath !== undefined) {
                            const requestString = this.pathNormalize(rootUrl + sphereTexturePath);
                            let sphereTexture = this._textureCache.get(requestString)?.deref();
                            if (sphereTexture === undefined) {
                                sphereTexture = new BABYLON.Texture(requestString, scene);
                                this._textureCache.set(requestString, new WeakRef(sphereTexture));
                            }
                            material.sphereTexture = sphereTexture;
                            material.sphereTextureBlendMode = materialInfo.sphereTextureMode === 1
                                ? MmdPluginMaterialSphereTextureBlendMode.Multiply
                                : MmdPluginMaterialSphereTextureBlendMode.Add;
                        }
                    }

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
                        let toonTexture = this._textureCache.get(requestString)?.deref();
                        if (toonTexture === undefined) {
                            const blobOrUrl = materialInfo.isSharedToonTexture
                                ? SharedToonTextures.data[materialInfo.toonTextureIndex]
                                : requestString;
                            toonTexture = new BABYLON.Texture(blobOrUrl, scene);
                            this._textureCache.set(requestString, new WeakRef(toonTexture));
                        }

                        material.toonTexture = toonTexture;
                    }

                    if (materialInfo.flag & PmxObject.Material.Flag.enabledToonEdge) {
                        MmdOutlineRenderer.registerMmdOutlineRendererIfNeeded();

                        material.renderOutline = true;
                        material.renderOverlay = true;
                        material.outlineWidth = materialInfo.edgeSize / 100;
                        console.log(materialInfo.edgeSize);
                        const edgeColor = materialInfo.edgeColor;
                        material.overlayColor = new BABYLON.Color3(
                            edgeColor[0],
                            edgeColor[1],
                            edgeColor[2]
                        );
                        material.overlayAlpha = edgeColor[3];
                    }
                }

                multiMaterial.subMaterials.push(material);

                offset += materialInfo.surfaceCount;
            }
        }
        mesh.material = multiMaterial;

        mesh.subMeshes.length = 0;
        {
            const materials = pmxObject.materials;
            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                new BABYLON.SubMesh(
                    i, // materialIndex
                    0, // verticesStart
                    pmxObject.vertices.length, // verticesCount
                    offset, // indexStart
                    materialInfo.surfaceCount, // indexCount
                    mesh
                );

                offset += materialInfo.surfaceCount;
            }
        }

        onProgress;
        fileName;
    }

    public loadAssetContainerAsync(
        scene: BABYLON.Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: BABYLON.ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<BABYLON.AssetContainer> {
        const assetContainer = new BABYLON.AssetContainer(scene);
        data;
        rootUrl;
        onProgress;
        fileName;
        return Promise.resolve(assetContainer);
    }

    public loadFile(
        scene: BABYLON.Scene,
        fileOrUrl: string | File,
        onSuccess: (data: any, responseURL?: string | undefined) => void,
        onProgress?: ((ev: BABYLON.ISceneLoaderProgressEvent) => void) | undefined,
        useArrayBuffer?: boolean | undefined,
        onError?: ((request?: BABYLON.WebRequest | undefined, exception?: BABYLON.LoadFileError | undefined) => void) | undefined
    ): BABYLON.IFileRequest {
        const request = scene._loadFile(
            fileOrUrl,
            onSuccess,
            onProgress,
            true,
            useArrayBuffer,
            onError
        );
        return request;
    }

    private pathNormalize(path: string): string {
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
