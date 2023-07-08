import type {
    IFileRequest,
    ISceneLoaderAsyncResult,
    ISceneLoaderPluginAsync,
    ISceneLoaderPluginExtensions,
    ISceneLoaderProgressEvent,
    Scene,
    WebRequest
} from "@babylonjs/core";
import {
    LoadFileError
} from "@babylonjs/core";
import {
    AssetContainer,
    Bone,
    BoundingInfo,
    Geometry,
    Logger,
    Matrix,
    Mesh,
    MorphTarget,
    MorphTargetManager,
    MultiMaterial,
    Skeleton,
    SubMesh,
    Tools,
    Vector3,
    VertexData
} from "@babylonjs/core";

import type { IMmdMaterialBuilder } from "../IMmdMaterialBuilder";
import { MmdStandardMaterialBuilder } from "../MmdStandardMaterialBuilder";
import type { ILogger } from "../parser/ILogger";
import { BpmxReader } from "./parser/BpmxReader";
import { PmxObject } from "../parser/PmxObject";
import { BpmxObject } from "./parser/BpmxObject";
import { SdefMesh } from "../SdefMesh";
import { SdefBufferKind } from "../SdefBufferKind";

export class BpmxLoader implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Name of the loader ("bpmx")
     */
    public name: string;
    public extensions: ISceneLoaderPluginExtensions;

    public materialBuilder: IMmdMaterialBuilder;
    public useSdef: boolean;
    public boundingBoxMargin: number;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    public constructor() {
        this.name = "bpmx";
        this.extensions = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".bpmx": { isBinary: true }
        };

        this.materialBuilder = new MmdStandardMaterialBuilder();
        this.useSdef = true;
        this.boundingBoxMargin = 10;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    public importMeshAsync(
        _meshesNames: any,
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        _fileName?: string
    ): Promise<ISceneLoaderAsyncResult> {
        return this._loadAsyncInternal(scene, null, data, rootUrl, onProgress);
    }

    public loadAsync(
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        _fileName?: string
    ): Promise<void> {
        return this._loadAsyncInternal(scene, null, data, rootUrl, onProgress).then(() => {
            return;
        });
    }

    public loadAssetContainerAsync(
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        _fileName?: string
    ): Promise<AssetContainer> {
        const assetContainer = new AssetContainer(scene);

        return this._loadAsyncInternal(scene, assetContainer, data, rootUrl, onProgress).then(() => {
            return assetContainer;
        });
    }

    public loadFile(
        scene: Scene,
        fileOrUrl: string | File,
        _rootUrl: string,
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

    private async _loadAsyncInternal(
        scene: Scene,
        assetContainer: AssetContainer | null,
        data: ArrayBuffer,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<ISceneLoaderAsyncResult> {
        const useSdef = this.useSdef;
        const boundingBoxMargin = this.boundingBoxMargin;

        const bpmxObject = await BpmxReader.ParseAsync(data, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });

        const parseCost = Math.floor(data.byteLength / 100);
        const buildGeometryCost = bpmxObject.geometry.indices.length;
        const buildMaterialCost = 100 * bpmxObject.materials.length;
        const buildSkeletonCost = 100 * bpmxObject.bones.length;
        let buildMorphCost = 0;
        {
            const morphsInfo = bpmxObject.morphs;
            for (let i = 0; i < morphsInfo.length; ++i) {
                const morphInfo = morphsInfo[i];
                if (
                    morphInfo.type !== PmxObject.Morph.Type.VertexMorph &&
                    morphInfo.type !== PmxObject.Morph.Type.UvMorph &&
                    morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph1 &&
                    morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph2 &&
                    morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph3 &&
                    morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph4
                ) {
                    // group morph, bone morph, material morph will be handled by cpu bound custom runtime
                    continue;
                }

                buildMorphCost += (morphInfo as BpmxObject.Morph.VertexMorph | BpmxObject.Morph.UvMorph).elements.length;
            }
        }
        const textureLoadCost = 30000 * bpmxObject.textures.length;
        
        let applyTextureLoading = false;

        const progressEvent = {
            lengthComputable: true,
            loaded: parseCost,
            total: parseCost + buildGeometryCost + buildMaterialCost + buildSkeletonCost + buildMorphCost + textureLoadCost
        };
        
        onProgress?.({...progressEvent});

        let lastStageLoaded = parseCost;

        scene._blockEntityCollection = !!assetContainer;
        const mesh = new (useSdef ? SdefMesh : Mesh)(bpmxObject.header.modelName, scene);
        mesh._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        const vertexData = new VertexData();
        vertexData.positions = bpmxObject.geometry.positions;
        vertexData.normals = bpmxObject.geometry.normals;
        vertexData.uvs = bpmxObject.geometry.uvs;
        vertexData.indices = bpmxObject.geometry.indices;
        vertexData.matricesIndices = bpmxObject.geometry.matricesIndices;
        vertexData.matricesWeights = bpmxObject.geometry.matricesWeights;
        
        scene._blockEntityCollection = !!assetContainer;
        const geometry = new Geometry(bpmxObject.header.modelName, scene, vertexData, false);
        geometry._parentContainer = assetContainer;
        scene._blockEntityCollection = false;
        
        if (useSdef && bpmxObject.geometry.sdef !== undefined) {
            const sdefData = bpmxObject.geometry.sdef;
            geometry.setVerticesData(SdefBufferKind.MatricesSdefCKind, sdefData.c, false, 3);
            geometry.setVerticesData(SdefBufferKind.MatricesSdefR0Kind, sdefData.r0, false, 3);
            geometry.setVerticesData(SdefBufferKind.MatricesSdefR1Kind, sdefData.r1, false, 3);
        }
        geometry.applyToMesh(mesh);

        progressEvent.loaded = lastStageLoaded + buildGeometryCost;
        onProgress?.({...progressEvent});
        lastStageLoaded += buildGeometryCost;

        scene._blockEntityCollection = !!assetContainer;
        const multiMaterial = new MultiMaterial(bpmxObject.header.modelName + "_multi", scene);
        multiMaterial._parentContainer = assetContainer;
        scene._blockEntityCollection = false;
        
        let buildMaterialsPromise: void | Promise<void> = undefined;

        const textureLoadPromise = new Promise<void>((resolve) => {
            buildMaterialsPromise = this.materialBuilder.buildMaterials(
                mesh.uniqueId,
                bpmxObject.materials,
                bpmxObject.textures.map((texture) => texture.relativePath),
                rootUrl,
                bpmxObject.textures,
                scene,
                assetContainer,
                vertexData.indices as Uint16Array | Uint32Array,
                vertexData.uvs as Float32Array,
                multiMaterial,
                (event) => {
                    if (!applyTextureLoading) return;
                    const loadedRatio = event.loaded / event.total;
                    progressEvent.loaded = lastStageLoaded + Math.floor(textureLoadCost * loadedRatio);
                    onProgress?.({...progressEvent});
                },
                () => resolve()
            );
        });
        if (buildMaterialsPromise !== undefined) {
            await buildMaterialsPromise;
        }
        mesh.material = multiMaterial;

        mesh.subMeshes.length = 0;
        {
            const materials = bpmxObject.materials;
            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                new SubMesh(
                    i, // materialIndex
                    0, // verticesStart
                    Math.floor(bpmxObject.geometry.positions.length / 3), // verticesCount
                    offset, // indexStart
                    materialInfo.surfaceCount, // indexCount
                    mesh
                );

                offset += materialInfo.surfaceCount;
            }
        }

        progressEvent.loaded = lastStageLoaded + buildMaterialCost;
        onProgress?.({...progressEvent});
        lastStageLoaded += buildMaterialCost;

    }

    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this._logEnabled;
            this.warn = this._warnEnabled;
            this.error = this._errorEnabled;
        } else {
            this.log = this._logDisabled;
            this.warn = this._warnDisabled;
            this.error = this._errorDisabled;
        }
    }

    private _logEnabled(message: string): void {
        Logger.Log(message);
    }

    private _logDisabled(): void {
        // do nothing
    }

    private _warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private _warnDisabled(): void {
        // do nothing
    }

    private _errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private _errorDisabled(): void {
        // do nothing
    }
}
