import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { ITextureCreationOptions } from "@babylonjs/core/Materials/Textures/texture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Observable } from "@babylonjs/core/Misc/observable";
import { TimingTools } from "@babylonjs/core/Misc/timingTools";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import { SharedToonTextures } from "./sharedToonTextures";
import { pathNormalize } from "./Util/pathNormalize";

/**
 * MMD texture load options
 */
export interface IMmdTextureLoadOptions {
    /**
     * Defines if the texture will require mip maps or not (default: false)
     */
    noMipmap?: boolean;

    /**
     * Defines if the texture needs to be inverted on the y axis during loading (default: true)
     */
    invertY?: boolean;

    /**
     * Defines the sampling mode we want for the texture while fetching from it (Texture.NEAREST_SAMPLINGMODE...) (default: Texture.TRILINEAR_SAMPLINGMODE)
     */
    samplingMode?: number;

    /**
     * Defines if the buffer we are loading the texture from should be deleted after load (default: false)
     */
    deleteBuffer?: boolean;

    /**
     * Defines the format of the texture we are trying to load (Engine.TEXTUREFORMAT_RGBA...) (default: )
     */
    format?: number;

    /**
     * Defines an optional mime type information (default: undefined)
     */
    mimeType?: string;
}

class TextureLoadingModel {
    public readonly uniqueId: number;
    public leftLoadCount: number;
    public isRequesting: boolean;

    public readonly errorTextureDatas: MmdTextureData[];

    public constructor(uniqueId: number) {
        this.uniqueId = uniqueId;
        this.leftLoadCount = 0;
        this.isRequesting = true;

        this.errorTextureDatas = [];
    }
}

class TextureLoadInfo {
    public readonly observable: Observable<boolean>;
    public hasLoadError: boolean;

    public constructor() {
        this.observable = new Observable<boolean>();
        this.hasLoadError = false;
    }
}

class MmdTextureData {
    public readonly cacheKey: string;
    private readonly _scene: Scene;
    private readonly _assetContainer: Nullable<AssetContainer>;
    private readonly _textureName: string;
    private readonly _options: IMmdTextureLoadOptions;
    private readonly _onLoad: Nullable<() => void>;
    private readonly _onError?: Nullable<(message?: string, exception?: any) => void>;

    private _texture: Nullable<Texture>;

    public constructor(
        cacheKey: string,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        blobOrUrl: string,
        textureName: string,
        useLazyLoadWithBuffer: boolean,
        options: IMmdTextureLoadOptions,
        onLoad: Nullable<() => void>,
        onError?: Nullable<(message?: string, exception?: any) => void>
    ) {
        this.cacheKey = cacheKey;
        this._scene = scene;
        this._assetContainer = assetContainer;
        this._textureName = textureName;
        this._options = options;
        this._onLoad = onLoad;
        this._onError = onError;

        this._texture = null;

        if (!useLazyLoadWithBuffer) {
            scene._loadFile(
                blobOrUrl,
                (data) => {
                    this._createTexture(
                        scene,
                        assetContainer,
                        textureName,
                        data as ArrayBuffer,
                        options,
                        onLoad,
                        (message, exception) => {
                            onError?.(message, exception);
                        }
                    );
                },
                undefined,
                true,
                true,
                (request, exception) => {
                    onError?.(request ? request.status + " " + request.statusText : "", exception);
                }
            );
        }
    }

    public loadFromArrayBuffer(arrayBuffer: ArrayBuffer): void {
        this._createTexture(
            this._scene,
            this._assetContainer,
            this._textureName,
            arrayBuffer,
            this._options,
            this._onLoad,
            (message, exception) => {
                this._onError?.(message, exception);
            }
        );
    }

    private _onDisposeCallback: Nullable<() => void> = null;

    public registerOnDisposeCallback(callback: () => void): void {
        // dead code. for optimization we don't need to check this
        // if (this._onDisposeCallback !== null) throw new Error("On dispose callback is already registered");
        this._onDisposeCallback = callback;
        this._texture!.onDisposeObservable.addOnce(callback);
    }

    public unregisterOnDisposeCallback(): Nullable<() => void> {
        const callback = this._onDisposeCallback;
        if (callback === null) return null;
        this._onDisposeCallback = null;
        this._texture!.onDisposeObservable.removeCallback(callback);
        return callback;
    }

    private _createTexture(
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        textureName: string,
        buffer: ArrayBuffer,
        options: IMmdTextureLoadOptions,
        onLoad: Nullable<() => void>,
        onError?: Nullable<(message?: string, exception?: any) => void>
    ): void {
        scene._blockEntityCollection = !!assetContainer;
        const textureCreationOptions: ITextureCreationOptions = {
            noMipmap: options.noMipmap,
            invertY: options.invertY,
            samplingMode: options.samplingMode,
            onLoad: () => {
                if (this._texture === null) {
                    if (onLoad !== null) TimingTools.SetImmediate(onLoad);
                } else {
                    onLoad?.();
                }
            },
            onError,
            buffer,
            deleteBuffer: options.deleteBuffer,
            format: options.format,
            mimeType: options.mimeType
        };
        const texture = this._texture = new Texture(
            "data:" + textureName,
            scene,
            textureCreationOptions
        );
        texture._parentContainer = assetContainer;
        scene._blockEntityCollection = false;
        assetContainer?.textures.push(texture);

        texture.name = textureName;
    }

    public get texture(): Nullable<Texture> {
        return this._texture;
    }
}

/**
 * MMD async texture loader
 *
 * The MMD async texture loader caches redundant textures across multiple materials and simplifies asynchronous textural loading
 *
 * It also includes handling when multiple models are loaded at the same time
 */
export class MmdAsyncTextureLoader {
    /**
     * Observable which is notified when all textures of the model are loaded
     *
     * key: uniqueId, value: Observable<void>
     */
    public readonly onModelTextureLoadedObservable = new Map<number, Observable<void>>();

    /**
     * Texture cache
     *
     * This cache is used to avoid loading the same texture multiple times
     *
     * Once loaded, all textures are stored in the cache and deleted from the cache on their own when the texture is disposed
     *
     * key: requestString, value: texture
     */
    public readonly textureCache = new Map<string, MmdTextureData>();

    private readonly _textureLoadInfoMap = new Map<string, TextureLoadInfo>(); // key: requestString
    private readonly _loadingModels = new Map<number, TextureLoadingModel>(); // key: uniqueId

    private readonly _errorTexturesReferenceCount = new Map<MmdTextureData, number>(); // key: textureName, value: referenceModelCount

    private _incrementLeftLoadCount(uniqueId: number): TextureLoadingModel {
        let model = this._loadingModels.get(uniqueId);
        if (model === undefined) {
            model = new TextureLoadingModel(uniqueId);
            this._loadingModels.set(uniqueId, model);
        }
        model.leftLoadCount += 1;

        let observable = this.onModelTextureLoadedObservable.get(uniqueId);
        if (observable === undefined) {
            observable = new Observable<void>();
            this.onModelTextureLoadedObservable.set(uniqueId, observable);
        }

        return model;
    }

    private _decrementLeftLoadCount(model: TextureLoadingModel): void {
        model.leftLoadCount -= 1;
        if (!model.isRequesting && model.leftLoadCount === 0) {
            this._removeErrorTexturesReferenceCount(model.uniqueId);

            this._loadingModels.delete(model.uniqueId);
            const observable = this.onModelTextureLoadedObservable.get(model.uniqueId);
            observable?.notifyObservers();
            observable?.clear();
            this.onModelTextureLoadedObservable.delete(model.uniqueId);
        }
    }

    /**
     * Notify that the model texture load request has been ended
     *
     * If all the textures are cached, no event callback is called
     *
     * so this method must be called and specified at the end of the model's text load request to handle such an edge case
     *
     * @param uniqueId Model unique id
     */
    public loadModelTexturesEnd(uniqueId: number): void {
        const model = this._loadingModels.get(uniqueId);
        if (model === undefined) return;

        model.isRequesting = false;
        if (model.leftLoadCount === 0) {
            this._removeErrorTexturesReferenceCount(uniqueId);

            this._loadingModels.delete(uniqueId);
            const observable = this.onModelTextureLoadedObservable.get(uniqueId);
            observable?.notifyObservers();
            observable?.clear();
            this.onModelTextureLoadedObservable.delete(uniqueId);
        }
    }

    private _addErrorTextureReferenceCount(uniqueId: number, textureData: MmdTextureData): void {
        const model = this._loadingModels.get(uniqueId)!;
        model.errorTextureDatas.push(textureData);
        this._errorTexturesReferenceCount.set(textureData, (this._errorTexturesReferenceCount.get(textureData) ?? 0) + 1);
    }

    private _removeErrorTexturesReferenceCount(uniqueId: number): void {
        const model = this._loadingModels.get(uniqueId)!;
        for (let i = 0; i < model.errorTextureDatas.length; ++i) {
            const textureData = model.errorTextureDatas[i];
            const referenceCount = this._errorTexturesReferenceCount.get(textureData)! - 1;
            if (referenceCount === 0) {
                if (textureData.texture !== null) {
                    textureData.texture.dispose();
                } else {
                    this._textureLoadInfoMap.delete(textureData.cacheKey);
                    this.textureCache.delete(textureData.cacheKey);
                    this._errorTexturesReferenceCount.delete(textureData);
                }
            } else {
                this._errorTexturesReferenceCount.set(textureData, referenceCount);
            }
        }
    }

    private _handleTextureOnDispose(textureData: MmdTextureData): void {
        textureData.registerOnDisposeCallback(() => {
            this._textureLoadInfoMap.delete(textureData.cacheKey);
            this.textureCache.delete(textureData.cacheKey);
            this._errorTexturesReferenceCount.delete(textureData);
        });
    }

    private _createTextureCacheKey(urlOrTextureName: string, options: IMmdTextureLoadOptions): string {
        const extensionIndex = urlOrTextureName.lastIndexOf(".");

        let extension = "";
        if (extensionIndex !== -1) {
            extension = urlOrTextureName.substring(extensionIndex);
            urlOrTextureName = urlOrTextureName.substring(0, extensionIndex);
        }

        return urlOrTextureName +
            +(options.noMipmap ?? false) +
            +(options.invertY ?? true) +
            (options.samplingMode ?? Texture.TRILINEAR_SAMPLINGMODE) +
            (options.format ?? Constants.TEXTUREFORMAT_RGBA) +
            extension;
    }

    private async _loadTextureAsyncInternal(
        uniqueId: number,
        urlOrTextureName: string,
        arrayBufferOrBlob: Nullable<ArrayBuffer | Blob>,
        sharedTextureIndex: Nullable<number>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        options: IMmdTextureLoadOptions
    ): Promise<Nullable<Texture>> {
        const model = this._incrementLeftLoadCount(uniqueId);

        const cacheKey = this._createTextureCacheKey(urlOrTextureName, options);

        let textureLoadInfo = this._textureLoadInfoMap.get(cacheKey);
        if (textureLoadInfo === undefined) {
            textureLoadInfo = new TextureLoadInfo();
            this._textureLoadInfoMap.set(cacheKey, textureLoadInfo);
        }

        let textureData = this.textureCache.get(cacheKey);
        if (textureData === undefined && !textureLoadInfo.hasLoadError) {
            const blobOrUrl = sharedTextureIndex !== null ? SharedToonTextures.Data[sharedTextureIndex]
                : urlOrTextureName;

            textureData = new MmdTextureData(
                cacheKey,
                scene,
                assetContainer,
                blobOrUrl,
                urlOrTextureName,
                arrayBufferOrBlob !== null,
                options,
                () => {
                    this._handleTextureOnDispose(textureData!);

                    textureLoadInfo!.hasLoadError = false;
                    textureLoadInfo!.observable.notifyObservers(false);
                    textureLoadInfo!.observable.clear();
                },
                (_message, _exception) => { // there's bug in Babylon.js. onError is called twice when fallback texture load failed
                    if (textureData!.texture !== null) this._handleTextureOnDispose(textureData!);
                    this._addErrorTextureReferenceCount(uniqueId, textureData!);

                    textureLoadInfo!.hasLoadError = true;
                    textureLoadInfo!.observable.notifyObservers(true);
                    textureLoadInfo!.observable.clear();
                }
            );

            this.textureCache.set(cacheKey, textureData);

            const arrayBuffer = arrayBufferOrBlob instanceof Blob
                ? await arrayBufferOrBlob.arrayBuffer()
                : arrayBufferOrBlob;

            if (arrayBuffer !== null) {
                textureData.loadFromArrayBuffer(arrayBuffer);
            }
        }

        if (textureData!.texture !== null && textureData!.texture.isReady()) {
            this._decrementLeftLoadCount(model!);
            if (textureLoadInfo.hasLoadError) return null;
            return textureData!.texture;
        }

        return new Promise<Nullable<Texture>>((resolve) => {
            textureLoadInfo!.observable.addOnce((hasLoadError) => {
                this._decrementLeftLoadCount(model);
                resolve(hasLoadError ? null : textureData!.texture);
            });
        });
    }

    /**
     * Load texture asynchronously
     *
     * All texture requests for one model must be executed within one synchronization routine without await
     *
     * Because the internally used left texture count mechanism requires knowing the total number of textures required at the time the request is processed
     *
     * @param uniqueId Model unique id
     * @param rootUrl Root url
     * @param relativeTexturePathOrIndex Relative texture path or shared toon texture index
     * @param scene Scene
     * @param assetContainer Asset container
     * @param options Texture load options
     * @returns Texture
     */
    public async loadTextureAsync(
        uniqueId: number,
        rootUrl: string,
        relativeTexturePathOrIndex: string | number,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        options: IMmdTextureLoadOptions
    ): Promise<Nullable<Texture>> {
        let isSharedToonTexture: boolean;
        if (typeof relativeTexturePathOrIndex === "number") {
            if (relativeTexturePathOrIndex < -1 || 9 < relativeTexturePathOrIndex) { // max shared toon texture index is 9. -1 is for error texture
                relativeTexturePathOrIndex = -1;
            }
            relativeTexturePathOrIndex += 1; // remap to 0-10

            isSharedToonTexture = true;
        } else {
            isSharedToonTexture = false;
        }

        const finalRelativeTexturePath = isSharedToonTexture
            ? "file:shared_toon_texture_" + relativeTexturePathOrIndex
            : (relativeTexturePathOrIndex as string);

        const requestString = isSharedToonTexture
            ? finalRelativeTexturePath
            : pathNormalize(rootUrl + relativeTexturePathOrIndex);

        return await this._loadTextureAsyncInternal(
            uniqueId,
            requestString,
            null,
            isSharedToonTexture ? (relativeTexturePathOrIndex as number) : null,
            scene,
            assetContainer,
            options
        );
    }

    /**
     * Load texture from buffer asynchronously
     *
     * All texture requests for one model must be executed within one synchronization routine without await
     *
     * Because the internally used left texture count mechanism requires knowing the total number of textures required at the time the request is processed
     *
     * @param uniqueId Model unique id
     * @param textureName Texture name
     * @param arrayBufferOrBlob Texture data encoded in PNG/JPG/BMP
     * @param scene Scene
     * @param assetContainer Asset container
     * @param options Texture load options
     * @param applyPathNormalization Whether to apply path normalization to the texture name (default: true)
     * @returns Texture
     */
    public async loadTextureFromBufferAsync(
        uniqueId: number,
        textureName: string,
        arrayBufferOrBlob: ArrayBuffer | Blob,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        options: IMmdTextureLoadOptions,
        applyPathNormalization = true
    ): Promise<Nullable<Texture>> {
        if (applyPathNormalization) {
            textureName = pathNormalize(textureName);
        }

        return await this._loadTextureAsyncInternal(
            uniqueId,
            textureName,
            arrayBufferOrBlob,
            null,
            scene,
            assetContainer,
            options
        );
    }
}
