import * as BABYLON from "@babylonjs/core";

import type { PmxObject } from "./parser/PmxObject";
import { PmxReader } from "./parser/PmxReader";
import { ISceneLoaderProgressEvent } from "@babylonjs/core";

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
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string) | undefined
    ): Promise<BABYLON.AbstractMesh[]> {
        // meshesNames type is string | string[] | any
        // you can select
        meshesNames;
        scene;
        data;
        rootUrl;
        meshes;
        particleSystems;
        skeletons;
        onError;
        console.log("importMesh");
        throw new Error("Method not implemented.");
    }

    public load(
        scene: BABYLON.Scene,
        data: any,
        rootUrl: string,
        onError?: ((message: string, exception?: any) => void) | undefined
    ): boolean {
        // data must be ArrayBuffer
        let pmxObject: PmxObject;
        try {
            pmxObject = PmxReader.parse(data);
        } catch (e: any) {
            onError?.(e.message, e);
            return false;
        }

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

            for (let i = 0; i < vertices.length; i++) {
                const vertex = vertices[i];
                positions[i * 3 + 0] = vertex.position[0];
                positions[i * 3 + 1] = vertex.position[1];
                positions[i * 3 + 2] = vertex.position[2];

                normals[i * 3 + 0] = vertex.normal[0];
                normals[i * 3 + 1] = vertex.normal[1];
                normals[i * 3 + 2] = vertex.normal[2];

                uvs[i * 2 + 0] = vertex.uv[0];
                uvs[i * 2 + 1] = vertex.uv[1];
            }

            vertexData.positions = positions;
            vertexData.normals = normals;
            vertexData.uvs = uvs;
            vertexData.indices = indices;
        }

        const geometry = new BABYLON.Geometry(pmxObject.header.modelName, scene, vertexData, false);
        scene.pushGeometry(geometry, true);
        const mesh = new BABYLON.Mesh(pmxObject.header.modelName, scene);
        geometry.applyToMesh(mesh);

        const material = new BABYLON.StandardMaterial(pmxObject.header.modelName, scene);
        material.backFaceCulling = false;
        material.specularColor = new BABYLON.Color3(0, 0, 0);
        mesh.material = material;

        rootUrl;
        return true;
    }

    public loadAssetContainer(
        scene: BABYLON.Scene,
        data: any,
        rootUrl: string,
        onError?: ((message: string, exception?: any) => void) | undefined
    ): BABYLON.AssetContainer {
        const assetContainer = new BABYLON.AssetContainer(scene);
        data;
        rootUrl;
        onError;
        return assetContainer;
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
