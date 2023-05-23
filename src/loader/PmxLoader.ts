import type * as BABYLON from "@babylonjs/core";

export class PmxLoader implements BABYLON.ISceneLoaderPlugin {
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

    public importMesh(
        meshesNames: any,
        scene: BABYLON.Scene,
        data: any,
        rootUrl: string,
        meshes: BABYLON.AbstractMesh[],
        particleSystems: BABYLON.IParticleSystem[],
        skeletons: BABYLON.Skeleton[],
        onError?: ((message: string, exception?: any) => void) | undefined
    ): boolean {
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
        scene;
        data;
        rootUrl;
        onError;
        console.log("load");
        throw new Error("Method not implemented.");
    }

    public loadAssetContainer(
        scene: BABYLON.Scene,
        data: any,
        rootUrl: string,
        onError?: ((message: string, exception?: any) => void) | undefined
    ): BABYLON.AssetContainer {
        scene;
        data;
        rootUrl;
        onError;
        console.log("loadAssetContainer");
        throw new Error("Method not implemented.");
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
