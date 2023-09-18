import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { IFileRequest } from "@babylonjs/core/Misc/fileRequest";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { WebRequest } from "@babylonjs/core/Misc/webRequest";
import type { Scene } from "@babylonjs/core/scene";

import type { MmdAnimation } from "./Animation/mmdAnimation";
import { VpdReader } from "./Parser/vpdReader";

/**
 * VpdLoader is a loader that loads MMD pose data in VPD format
 *
 * VPD format is a binary format for MMD animation data
 */
export class VpdLoader {
    private readonly _scene: Scene;
    private readonly _textDecoder: TextDecoder;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    /**
     * Create a new VpdLoader
     * @param scene Scene for loading file
     */
    public constructor(scene: Scene) {
        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._scene = scene;
        this._textDecoder = new TextDecoder("shift_jis");
    }

    /**
     * Load MMD animation data from VPD array buffer
     * @param name Animation name
     * @param buffer VPD array buffer
     * @returns Animation data
     * @throws {LoadFileError} when validation fails
     */
    public loadFromBuffer(
        name: string,
        buffer: ArrayBuffer
    ): MmdAnimation {
        const text = this._textDecoder.decode(buffer);
        return VpdReader.Parse(name, text, this);
    }

    /**
     * Load MMD animation data from VPD file or URL
     * @param name Animation name
     * @param fileOrUrl VPD file or URL
     * @param onLoad Callback function that is called when load is complete
     * @param onProgress Callback function that is called while loading
     * @param onError Callback function that is called when loading is failed
     * @returns File request
     */
    public load(
        name: string,
        fileOrUrl: File | string,
        onLoad: (animation: MmdAnimation) => void,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        onError?: ((request?: WebRequest | undefined, exception?: Error | undefined) => void) | undefined
    ): IFileRequest {
        return this._scene._loadFile(
            fileOrUrl,
            (data: string | ArrayBuffer) => onLoad(this.loadFromBuffer(name, data as ArrayBuffer)),
            onProgress,
            true,
            true,
            onError
        );
    }

    /**
     * Load MMD animation data from VPD file or URL asynchronously
     * @param name Animation name
     * @param fileOrUrl VPD file or URL
     * @param onProgress Callback function that is called while loading
     */
    public loadAsync(
        name: string,
        fileOrUrl: File | string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<MmdAnimation> {
        return new Promise<MmdAnimation>((resolve, reject) => {
            this.load(name, fileOrUrl, resolve, onProgress, (request, exception) => reject({ request, exception }));
        });
    }

    /**
     * Enable or disable debug logging (default: false)
     */
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
