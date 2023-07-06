import type { AssetContainer, Nullable, Scene } from "@babylonjs/core";
import { Observable, Texture } from "@babylonjs/core";

import { SharedToonTextures } from "./SharedToonTextures";

class TextureLoadingModel {
    public readonly uniqueId: number;
    public leftLoadCount: number;
    public isRequesting: boolean;

    public constructor(uniqueId: number) {
        this.uniqueId = uniqueId;
        this.leftLoadCount = 0;
        this.isRequesting = true;
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
    private _arrayBuffer: ArrayBuffer | null;
    private _texture: Texture | null;

    public constructor(
        scene: Scene,
        assetContainer: AssetContainer | null,
        urlOrTextureName: string,
        arrayBuffer: ArrayBuffer | null,
        onLoad?: Nullable<() => void>,
        onError?: Nullable<(message?: string, exception?: any) => void>
    ) {
        this._arrayBuffer = null;
        this._texture = null;

        if (arrayBuffer === null) {
            scene._loadFile(
                urlOrTextureName,
                (data) => {
                    const arrayBuffer = this._arrayBuffer = data as ArrayBuffer;
                    this._createTexture(
                        scene,
                        assetContainer,
                        urlOrTextureName,
                        arrayBuffer,
                        onLoad,
                        onError
                    );
                },
                undefined,
                true,
                true,
                (request, exception) => {
                    onError?.(request ? request.status + " " + request.statusText : "", exception);
                }
            );
        } else {
            this._arrayBuffer = arrayBuffer;
            this._createTexture(
                scene,
                assetContainer,
                urlOrTextureName,
                arrayBuffer,
                onLoad,
                onError
            );
        }
    }

    private _createTexture(
        scene: Scene,
        assetContainer: AssetContainer | null,
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

    public get arrayBuffer(): ArrayBuffer | null {
        return this._arrayBuffer;
    }

    public get texture(): Texture | null {
        return this._texture;
    }
}

export interface MmdTextureLoadResult {
    readonly texture: Texture | null;
    readonly arrayBuffer: ArrayBuffer | null;
}

export class MmdAsyncTextureLoader {
    public readonly onModelTextureLoadedObservable = new Map<number, Observable<void>>(); // key: uniqueId, value: Observable<void>

    public readonly textureCache = new Map<string, WeakRef<MmdTextureData>>(); // key: requestString, value: texture

    private readonly _textureLoadInfoMap = new Map<string, TextureLoadInfo>(); // key: requestString
    private readonly _loadingModels = new Map<number, TextureLoadingModel>(); // key: uniqueId

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
            this._loadingModels.delete(uniqueId);
            const observable = this.onModelTextureLoadedObservable.get(uniqueId);
            observable?.notifyObservers();
            observable?.clear();
            this.onModelTextureLoadedObservable.delete(uniqueId);
        }
    }

    private async _loadTextureAsyncInternal(
        uniqueId: number,
        urlOrTextureName: string,
        arrayBuffer: ArrayBuffer | null,
        sharedTextureIndex: number | null,
        scene: Scene,
        assetContainer: AssetContainer | null
    ): Promise<MmdTextureLoadResult> {
        const model = this._incrementLeftLoadCount(uniqueId);

        let textureLoadInfo = this._textureLoadInfoMap.get(urlOrTextureName);
        if (textureLoadInfo === undefined) {
            textureLoadInfo = new TextureLoadInfo();
            this._textureLoadInfoMap.set(urlOrTextureName, textureLoadInfo);
        }

        let textureData = this.textureCache.get(urlOrTextureName)?.deref();
        if (textureData === undefined && !textureLoadInfo.hasLoadError) {
            const blobOrUrl = sharedTextureIndex !== null ? SharedToonTextures.Data[sharedTextureIndex]
                : urlOrTextureName;

            textureData = new MmdTextureData(
                scene,
                assetContainer,
                blobOrUrl,
                arrayBuffer,
                () => {
                    textureLoadInfo!.hasLoadError = false;
                    textureLoadInfo!.observable.notifyObservers(false);
                    textureLoadInfo!.observable.clear();
                },
                (_message, _exception) => {
                    textureData!.texture!.dispose();
                    this.textureCache.delete(urlOrTextureName);

                    textureLoadInfo!.hasLoadError = true;
                    textureLoadInfo!.observable.notifyObservers(true);
                    textureLoadInfo!.observable.clear();
                }
            );

            this.textureCache.set(urlOrTextureName, new WeakRef(textureData));
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
        assetContainer: AssetContainer | null
    ): Promise<MmdTextureLoadResult> {
        const isSharedToonTexture = typeof relativeTexturePathOrIndex === "number";

        const finalRelativeTexturePath = isSharedToonTexture
            ? "shared_toon_texture_" + relativeTexturePathOrIndex
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

    public async loadTextureFromArrayBufferAsync(
        uniqueId: number,
        textureName: string,
        arrayBuffer: ArrayBuffer,
        scene: Scene,
        assetContainer: AssetContainer | null
    ): Promise<MmdTextureLoadResult> {
        return await this._loadTextureAsyncInternal(
            uniqueId,
            textureName,
            arrayBuffer,
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
