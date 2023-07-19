import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Observable } from "@babylonjs/core/Misc/observable";
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
    private readonly _onLoad?: Nullable<() => void>;
    private readonly _onError?: Nullable<(message?: string, exception?: any) => void>;

    private _arrayBuffer: Nullable<ArrayBuffer>;
    private _texture: Nullable<Texture>;


    public constructor(
        cacheKey: string,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        urlOrTextureName: string,
        useLazyLoadWithBuffer: boolean,
        onLoad?: Nullable<() => void>,
        onError?: Nullable<(message?: string, exception?: any) => void>
    ) {
        this.cacheKey = cacheKey;
        this._scene = scene;
        this._assetContainer = assetContainer;
        this._onLoad = onLoad;
        this._onError = onError;

        this._arrayBuffer = null;
        this._texture = null;

        if (!useLazyLoadWithBuffer) {
            scene._loadFile(
                urlOrTextureName,
                (data) => {
                    const arrayBuffer = this._arrayBuffer = data as ArrayBuffer;
                    this._createTexture(
                        scene,
                        assetContainer,
                        cacheKey,
                        arrayBuffer,
                        onLoad,
                        (message, exception) => {
                            this._arrayBuffer = null;
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
        this._arrayBuffer = arrayBuffer;
        this._createTexture(
            this._scene,
            this._assetContainer,
            this.cacheKey,
            this._arrayBuffer,
            this._onLoad,
            (message, exception) => {
                this._arrayBuffer = null;
                this._onError?.(message, exception);
            }
        );
    }

    private _createTexture(
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        textureName: string,
        arrayBuffer: ArrayBuffer,
        onLoad?: Nullable<() => void>,
        onError?: Nullable<(message?: string, exception?: any) => void>
    ): void {
        scene._blockEntityCollection = !!assetContainer;
        const texture = this._texture = new Texture(
            "data:" + textureName,
            scene,
            undefined,
            undefined,
            undefined,
            onLoad,
            onError,
            arrayBuffer,
            true
        );
        texture._parentContainer = assetContainer;
        scene._blockEntityCollection = false;
        assetContainer?.textures.push(texture);

        texture.name = textureName;
    }

    public get arrayBuffer(): Nullable<ArrayBuffer> {
        return this._arrayBuffer;
    }

    public get texture(): Nullable<Texture> {
        return this._texture;
    }
}

export interface MmdTextureLoadResult {
    readonly texture: Nullable<Texture>;
    readonly arrayBuffer: Nullable<ArrayBuffer>;
}

export class MmdAsyncTextureLoader {
    public readonly onModelTextureLoadedObservable = new Map<number, Observable<void>>(); // key: uniqueId, value: Observable<void>

    public readonly textureCache = new Map<string, MmdTextureData>(); // key: requestString, value: texture

    private readonly _textureLoadInfoMap = new Map<string, TextureLoadInfo>(); // key: requestString
    private readonly _loadingModels = new Map<number, TextureLoadingModel>(); // key: uniqueId

    private readonly _errorTexturesReferenceCount = new Map<MmdTextureData, number>(); // key: textureName, value: referenceModelCount

    private static readonly _EmptyResult: MmdTextureLoadResult = {
        texture: null,
        arrayBuffer: null
    };

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
        textureData.texture!.onDisposeObservable.addOnce(() => {
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
        assetContainer: Nullable<AssetContainer>
    ): Promise<MmdTextureLoadResult> {
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
            if (textureLoadInfo.hasLoadError) return MmdAsyncTextureLoader._EmptyResult;
            return (textureData!);
        }

        return new Promise<MmdTextureLoadResult>((resolve) => {
            textureLoadInfo!.observable.addOnce((hasLoadError) => {
                this._decrementLeftLoadCount(model);
                resolve(hasLoadError ? MmdAsyncTextureLoader._EmptyResult : textureData!);
            });
        });
    }

    public async loadTextureAsync(
        uniqueId: number,
        rootUrl: string,
        relativeTexturePathOrIndex: string | number,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>
    ): Promise<MmdTextureLoadResult> {
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
            assetContainer
        );
    }

    public async loadTextureFromBufferAsync(
        uniqueId: number,
        textureName: string,
        arrayBufferOrBlob: ArrayBuffer | Blob,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        applyPathNormalization = true
    ): Promise<MmdTextureLoadResult> {
        if (applyPathNormalization) {
            textureName = this.pathNormalize(textureName);
        }

        return await this._loadTextureAsyncInternal(
            uniqueId,
            textureName,
            arrayBufferOrBlob,
            null,
            scene,
            assetContainer
        );
    }

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
