import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Observable } from "@babylonjs/core/Misc/observable";
import { TimingTools } from "@babylonjs/core/Misc/timingTools";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import { SharedToonTextures } from "./sharedToonTextures";

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
    private readonly _deleteBuffer: boolean;
    private readonly _onLoad: Nullable<() => void>;
    private readonly _onError?: Nullable<(message?: string, exception?: any) => void>;

    private _texture: Nullable<Texture>;

    public constructor(
        cacheKey: string,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        urlOrTextureName: string,
        useLazyLoadWithBuffer: boolean,
        deleteBuffer: boolean,
        onLoad: Nullable<() => void>,
        onError?: Nullable<(message?: string, exception?: any) => void>
    ) {
        this.cacheKey = cacheKey;
        this._scene = scene;
        this._assetContainer = assetContainer;
        this._deleteBuffer = deleteBuffer;
        this._onLoad = onLoad;
        this._onError = onError;

        this._texture = null;

        if (!useLazyLoadWithBuffer) {
            scene._loadFile(
                urlOrTextureName,
                (data) => {
                    this._createTexture(
                        scene,
                        assetContainer,
                        cacheKey,
                        data as ArrayBuffer,
                        deleteBuffer,
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
            this.cacheKey,
            arrayBuffer,
            this._deleteBuffer,
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
        arrayBuffer: ArrayBuffer,
        deleteBuffer: boolean,
        onLoad: Nullable<() => void>,
        onError?: Nullable<(message?: string, exception?: any) => void>
    ): void {
        scene._blockEntityCollection = !!assetContainer;
        const texture = this._texture = new Texture(
            "data:" + textureName,
            scene,
            undefined,
            undefined,
            undefined,
            () => {
                if (this._texture === null) {
                    if (onLoad !== null) TimingTools.SetImmediate(onLoad);
                } else {
                    onLoad?.();
                }
            },
            onError,
            arrayBuffer,
            deleteBuffer
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

    private async _loadTextureAsyncInternal(
        uniqueId: number,
        urlOrTextureName: string,
        arrayBufferOrBlob: Nullable<ArrayBuffer | Blob>,
        sharedTextureIndex: Nullable<number>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        deleteBuffer: boolean
    ): Promise<Nullable<Texture>> {
        const model = this._incrementLeftLoadCount(uniqueId);

        let textureLoadInfo = this._textureLoadInfoMap.get(urlOrTextureName);
        if (textureLoadInfo === undefined) {
            textureLoadInfo = new TextureLoadInfo();
            this._textureLoadInfoMap.set(urlOrTextureName, textureLoadInfo);
        }

        let textureData = this.textureCache.get(urlOrTextureName);
        if (textureData === undefined && !textureLoadInfo.hasLoadError) {
            const blobOrUrl = sharedTextureIndex !== null ? SharedToonTextures.Data[sharedTextureIndex]
                : urlOrTextureName;

            textureData = new MmdTextureData(
                urlOrTextureName,
                scene,
                assetContainer,
                blobOrUrl,
                arrayBufferOrBlob !== null,
                deleteBuffer,
                () => {
                    this._handleTextureOnDispose(textureData!);

                    textureLoadInfo!.hasLoadError = false;
                    textureLoadInfo!.observable.notifyObservers(false);
                    textureLoadInfo!.observable.clear();
                },
                (_message, _exception) => {
                    if (textureData!.texture !== null) this._handleTextureOnDispose(textureData!);
                    this._addErrorTextureReferenceCount(uniqueId, textureData!);

                    textureLoadInfo!.hasLoadError = true;
                    textureLoadInfo!.observable.notifyObservers(true);
                    textureLoadInfo!.observable.clear();
                }
            );

            this.textureCache.set(urlOrTextureName, textureData);

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
     * @param deleteBuffer Whether to delete the buffer after loading the texture
     * @returns Texture
     */
    public async loadTextureAsync(
        uniqueId: number,
        rootUrl: string,
        relativeTexturePathOrIndex: string | number,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        deleteBuffer: boolean
    ): Promise<Nullable<Texture>> {
        const isSharedToonTexture = typeof relativeTexturePathOrIndex === "number";

        const finalRelativeTexturePath = isSharedToonTexture
            ? "file:shared_toon_texture_" + relativeTexturePathOrIndex
            : relativeTexturePathOrIndex;

        const requestString = isSharedToonTexture
            ? finalRelativeTexturePath
            : this.pathNormalize(rootUrl + relativeTexturePathOrIndex);

        return await this._loadTextureAsyncInternal(
            uniqueId,
            requestString,
            null,
            isSharedToonTexture ? relativeTexturePathOrIndex : null,
            scene,
            assetContainer,
            deleteBuffer
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
     * @param deleteBuffer Whether to delete the buffer after loading the texture
     * @param applyPathNormalization Whether to apply path normalization to the texture name (default: true)
     * @returns Texture
     */
    public async loadTextureFromBufferAsync(
        uniqueId: number,
        textureName: string,
        arrayBufferOrBlob: ArrayBuffer | Blob,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        deleteBuffer: boolean,
        applyPathNormalization = true
    ): Promise<Nullable<Texture>> {
        if (applyPathNormalization) {
            textureName = this.pathNormalize(textureName);
        }

        return await this._loadTextureAsyncInternal(
            uniqueId,
            textureName,
            arrayBufferOrBlob,
            null,
            scene,
            assetContainer,
            deleteBuffer
        );
    }

    /**
     * Normalize path
     * @param path Path
     * @returns Normalized path
     */
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
