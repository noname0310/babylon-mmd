import type { IFileRequest, ISceneLoaderAsyncResult, ISceneLoaderPluginAsync, ISceneLoaderPluginExtensions, ISceneLoaderProgressEvent, LoadFileError, Scene, WebRequest } from "@babylonjs/core";
import { Quaternion, Vector3 } from "@babylonjs/core";
import { Bone, Matrix } from "@babylonjs/core";
import { Skeleton } from "@babylonjs/core";
import { AssetContainer, Geometry, Mesh, MultiMaterial, SubMesh, Tools, VertexData } from "@babylonjs/core";

import type { IMmdMaterialBuilder } from "./IMmdMaterialBuilder";
import { MmdStandardMaterialBuilder } from "./MmdStandardMaterialBuilder";
import { PmxReader } from "./parser/PmxReader";

export class PmxLoader implements ISceneLoaderPluginAsync {
    /**
     * Name of the loader ("pmx")
     */
    public name: string;
    public extensions: ISceneLoaderPluginExtensions;

    public materialBuilder: IMmdMaterialBuilder;

    public constructor() {
        this.name = "pmx";
        this.extensions = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".pmx": { isBinary: true }
        };

        this.materialBuilder = new MmdStandardMaterialBuilder();
    }

    public importMeshAsync(
        meshesNames: any,
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<ISceneLoaderAsyncResult> {
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
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<void> {
        // data must be ArrayBuffer
        const pmxObject = await PmxReader.parseAsync(data)
            .catch((e: any) => {
                return Promise.reject(e);
            });

        const mesh = new Mesh(pmxObject.header.modelName, scene);

        const vertexData = new VertexData();
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
                        await Tools.DelayAsync(0);
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
                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }
            }

            vertexData.positions = positions;
            vertexData.normals = normals;
            vertexData.uvs = uvs;
            vertexData.indices = indices;
        }

        const geometry = new Geometry(pmxObject.header.modelName, scene, vertexData, false);
        geometry.applyToMesh(mesh);

        const multiMaterial = new MultiMaterial(pmxObject.header.modelName + "_multi", scene);
        const buildMaterialsPromise = this.materialBuilder.buildMaterials(
            pmxObject,
            rootUrl,
            scene,
            vertexData.indices,
            vertexData.uvs,
            multiMaterial
        );
        if (buildMaterialsPromise !== undefined) {
            await buildMaterialsPromise;
        }
        mesh.material = multiMaterial;

        mesh.subMeshes.length = 0;
        {
            const materials = pmxObject.materials;
            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                new SubMesh(
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

        const skeleton = new Skeleton(pmxObject.header.modelName, pmxObject.header.modelName + "_skeleton", scene);
        {
            const bonesInfo = pmxObject.bones;
            {
                const bones: Bone[] = [];

                for (let i = 0; i < bonesInfo.length; ++i) {
                    const boneInfo = bonesInfo[i];
                    const boneWorldPosition = boneInfo.position;

                    const boneMatrix = Matrix.Compose(
                        new Vector3(1, 1, 1),
                        Quaternion.FromArray([0, 0, 0, 1]),
                        Vector3.FromArray(boneWorldPosition)
                    );


                    const bone = new Bone(
                        boneInfo.name,
                        skeleton,
                        undefined,
                        boneMatrix,
                        undefined,
                        undefined,
                        i // bone index
                    );
                    bones.push(bone);
                }

                for (let i = 0; i < bones.length; ++i) {
                    const boneInfo = bonesInfo[i];
                    const bone = bones[i];

                    if (boneInfo.parentBoneIndex !== -1) {
                        bone.setParent(bones[boneInfo.parentBoneIndex]);
                    }
                }
            }
        }
        mesh.skeleton = skeleton;

        onProgress;
        fileName;
    }

    public loadAssetContainerAsync(
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<AssetContainer> {
        const assetContainer = new AssetContainer(scene);
        data;
        rootUrl;
        onProgress;
        fileName;
        return Promise.resolve(assetContainer);
    }

    public loadFile(
        scene: Scene,
        fileOrUrl: string | File,
        onSuccess: (data: any, responseURL?: string | undefined) => void,
        onProgress?: ((ev: ISceneLoaderProgressEvent) => void) | undefined,
        useArrayBuffer?: boolean | undefined,
        onError?: ((request?: WebRequest | undefined, exception?: LoadFileError | undefined) => void) | undefined
    ): IFileRequest {
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
