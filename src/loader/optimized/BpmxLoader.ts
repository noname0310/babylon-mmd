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
import { MmdDataDeserializer } from "../parser/MmdDataDeserializer";

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

        const deserializer = new MmdDataDeserializer(data);
        deserializer.initializeTextDecoder("utf-8");

        const signature = deserializer.getDecoderString(4, false);
        if (signature !== "BPMX") {
            throw new LoadFileError("BPMX signature is not valid");
        }

        const version = [deserializer.getUint8(), deserializer.getUint8(), deserializer.getUint8()];
        if (version[0] !== 1 || version[1] !== 0 || version[2] !== 0) {
            throw new LoadFileError("BPMX version is not supported");
        }


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
