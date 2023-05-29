import * as BABYLON from "@babylonjs/core";

import { MmdStandardMaterial } from "./MmdStandardMaterial";
import { PmxObject } from "./parser/PmxObject";
import { PmxReader } from "./parser/PmxReader";

export class PmxLoader implements BABYLON.ISceneLoaderPluginAsync {
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
            let indices = pmxObject.faces;
            if (indices instanceof Uint8Array) {
                indices = new Uint16Array(indices);
            }

            const boneIndecesSet = new Set<number>();

            for (let i = 0; i < vertices.length; ++i) {
                const vertex = vertices[i];
                positions[i * 3 + 0] = vertex.position[0];
                positions[i * 3 + 1] = vertex.position[1];
                positions[i * 3 + 2] = vertex.position[2];

                normals[i * 3 + 0] = vertex.normal[0];
                normals[i * 3 + 1] = vertex.normal[1];
                normals[i * 3 + 2] = vertex.normal[2];

                uvs[i * 2 + 0] = vertex.uv[0];
                uvs[i * 2 + 1] = -vertex.uv[1]; // flip y axis

                if (i % 1000 === 0) await BABYLON.Tools.DelayAsync(0);
                if (vertex.weightType === PmxObject.Vertex.BoneWeightType.sdef) {
                    if (boneIndecesSet.has(vertex.boneWeight.boneIndices[0])) {
                        continue;
                    }
                    boneIndecesSet.add(vertex.boneWeight.boneIndices[0]);
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

            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                const material = new MmdStandardMaterial(materialInfo.name, scene);
                {
                    const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
                    if (diffuseTexturePath !== undefined) {
                        const diffuseTexture = new BABYLON.Texture(rootUrl + diffuseTexturePath, scene);
                        material.diffuseTexture = diffuseTexture;
                    }

                    const sphereTexturePath = pmxObject.textures[materialInfo.sphereTextureIndex];
                    if (sphereTexturePath !== undefined) {
                        const sphereTexture = new BABYLON.Texture(rootUrl + sphereTexturePath, scene);
                        material.sphereTexture = sphereTexture;
                    }
                }

                multiMaterial.subMaterials.push(material);

                new BABYLON.SubMesh(
                    i, // materialIndex
                    0, // verticesStart
                    pmxObject.vertices.length, // verticesCount
                    offset, // indexStart
                    materialInfo.faceCount, // indexCount
                    mesh
                );

                offset += materialInfo.faceCount;
            }
        }

        mesh.material = multiMaterial;

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
}
