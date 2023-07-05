import type { AssetContainer, Scene } from "@babylonjs/core";
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

export class MmdAsyncTextureLoader {
    public readonly onModelTextureLoadedObservable = new Map<number, Observable<void>>(); // key: uniqueId, value: Observable<void>

    public readonly textureCache = new Map<string, WeakRef<Texture>>(); // key: requestString, value: texture

    private readonly _textureLoadInfoMap = new Map<string, TextureLoadInfo>(); // key: requestString
    private readonly _loadingModels = new Map<number, TextureLoadingModel>(); // key: uniqueId

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
    ): Promise<Texture | null> {
        const model = this._incrementLeftLoadCount(uniqueId);

        let textureLoadInfo = this._textureLoadInfoMap.get(urlOrTextureName);
        if (textureLoadInfo === undefined) {
            textureLoadInfo = new TextureLoadInfo();
            this._textureLoadInfoMap.set(urlOrTextureName, textureLoadInfo);
        }

        let texture = this.textureCache.get(urlOrTextureName)?.deref();
        if (texture === undefined && !textureLoadInfo.hasLoadError) {
            const blobOrUrl = sharedTextureIndex !== null ? SharedToonTextures.Data[sharedTextureIndex]
                : urlOrTextureName;

            scene._blockEntityCollection = !!assetContainer;
            texture = new Texture(
                arrayBuffer === null ? blobOrUrl : null,
                scene,
                undefined,
                undefined,
                undefined,
                () => {
                    textureLoadInfo!.hasLoadError = false;
                    textureLoadInfo!.observable.notifyObservers(false);
                    textureLoadInfo!.observable.clear();
                },
                (_message, _exception) => {
                    texture!.dispose();
                    this.textureCache.delete(urlOrTextureName);

                    textureLoadInfo!.hasLoadError = true;
                    textureLoadInfo!.observable.notifyObservers(true);
                    textureLoadInfo!.observable.clear();
                },
                arrayBuffer
            );
            texture._parentContainer = assetContainer;
            scene._blockEntityCollection = false;
            assetContainer?.textures.push(texture);

            if (sharedTextureIndex !== null || arrayBuffer !== null) texture.name = urlOrTextureName;

            this.textureCache.set(urlOrTextureName, new WeakRef(texture));
        }

        if (texture === undefined || texture.isReady()) {
            this._decrementLeftLoadCount(model!);
            if (textureLoadInfo.hasLoadError) return null;
            return texture!;
        }

        return new Promise<Texture | null>((resolve) => {
            textureLoadInfo!.observable.addOnce((hasLoadError) => {
                this._decrementLeftLoadCount(model!);
                resolve(hasLoadError ? null : texture!);
            });
        });
    }

    public async loadTextureAsync(
        uniqueId: number,
        rootUrl: string,
        relativeTexturePathOrIndex: string | number,
        scene: Scene,
        assetContainer: AssetContainer | null
    ): Promise<Texture | null> {
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
    ): Promise<Texture | null> {
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
