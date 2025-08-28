---
sidebar_position: 1
sidebar_label: 独自のMMDマテリアルビルダーを構築する
---

# 独自のMMDマテリアルビルダーを構築する

このセクションでは、独自の**マテリアルビルダー**の実装方法について説明します。

MMDモデルローダー（**`PmxLoader`**、**`PmdLoader`**、**`BpmxLoader`**）は、MMDモデルの読み込みプロセス中にテクスチャとマテリアルの読み込みの全責任を**マテリアルビルダー**に委託しています。

したがって、**マテリアルビルダー**は、**リソース解決**から**アルファ評価**、**描画順序**設定まで、プロセス全体を担当します。

マテリアルビルダーをゼロから実装するのは簡単なタスクではありません。これらの側面すべてを考慮する必要があるためです。

## `MaterialBuilderBase`を使った実装

**`MaterialBuilderBase`**クラスは、マテリアルビルダーを作成する際に必要な共通の実装を提供します。

このクラスは以下の実装を提供します：

- **アルファ評価**
- **描画順序**設定

このクラスは以下のメソッドの実装を必要とします：

- **`_buildTextureNameMap`** - テクスチャ名マップを構築するメソッド
- **`loadGeneralScalarProperties`** - 拡散光、鏡面光、環境光、光沢度プロパティを読み込むメソッド
- **`loadDiffuseTexture`** - 拡散テクスチャを読み込むメソッド
- **`setAlphaBlendMode`** - 拡散テクスチャのアルファブレンドモードを設定するメソッド
- **`loadSphereTexture`** - スフィアテクスチャを読み込むメソッド
- **`loadToonTexture`** - トゥーンテクスチャを読み込むメソッド
- **`loadOutlineRenderingProperties`** - エッジサイズとエッジカラーのプロパティを読み込むメソッド

マテリアルに機能に対応する実装がない場合は、メソッド本体を空にしておくことができます。

例えば、**`PBRMaterialBuilder`**では**`loadSphereTexture`**、**`loadToonTexture`**、および**`loadOutlineRenderingProperties`**のメソッド本体は空です。

まずは**`MaterialBuilderBase`**を継承し、ジェネリックパラメータを設定し、コンストラクターを実装します：
```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public constructor() {
        super(MyMaterial);
    }
}
```

### `_buildTextureNameMap`の実装

これは、MMDモデルをシリアライズする際にテクスチャ名を損失なく保存するためのマッピングを構築するメソッドです。

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    protected override _buildTextureNameMap(
        materialsInfo: readonly MaterialInfo[],
        materials: MmdStandardMaterial[],
        imagePathTable: readonly string[],
        texturesInfo: readonly TextureInfo[],
        textureNameMap: Map<BaseTexture, string>
    ): void {
        for (let i = 0; i < materialsInfo.length; ++i) {
            const materialInfo = materialsInfo[i];
            const material = materials[i];

            const diffuseTexturePath = imagePathTable[texturesInfo[materialInfo.textureIndex]?.imagePathIndex];
            if (diffuseTexturePath !== undefined) {
                const diffuseTexture = material.diffuseTexture;
                if (diffuseTexture !== null) {
                    textureNameMap.set(diffuseTexture, diffuseTexturePath);
                }
            }

            const sphereTexturePath = imagePathTable[texturesInfo[materialInfo.sphereTextureIndex]?.imagePathIndex];
            if (sphereTexturePath !== undefined) {
                const sphereTexture = material.sphereTexture;
                if (sphereTexture !== null) {
                    textureNameMap.set(sphereTexture, sphereTexturePath);
                }
            }

            const toonTexturePath = imagePathTable[texturesInfo[materialInfo.toonTextureIndex]?.imagePathIndex];
            if (toonTexturePath !== undefined) {
                const toonTexture = material.toonTexture;
                if (toonTexture !== null) {
                    textureNameMap.set(toonTexture, toonTexturePath);
                }
            }
        }
    }
}
```

**`textureNameMap`**は読み込み後に**`MmdMesh.metadata.textureNameMap`**に保存されます。

### `loadGeneralScalarProperties`の実装

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override loadGeneralScalarProperties(
        material: MyMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[]
    ): void {
        const diffuse = materialInfo.diffuse;
        material.diffuseColor = new Color3(
            diffuse[0],
            diffuse[1],
            diffuse[2]
        );

        const specular = materialInfo.specular;
        material.specularColor = new Color3(
            specular[0],
            specular[1],
            specular[2]
        );

        const ambient = materialInfo.ambient;
        material.ambientColor = new Color3(
            ambient[0],
            ambient[1],
            ambient[2]
        );

        const alpha = materialInfo.diffuse[3];
        material.alpha = alpha;
        if (alpha === 0) {
            for (let i = 0; i < meshes.length; ++i) {
                const mesh = meshes[i];
                if ((mesh as Mesh).isVisible !== undefined) {
                    (mesh as Mesh).isVisible = false;
                } else {
                    // TODO: サブメッシュの可視性を個別に処理する
                }
            }
        }

        material.specularPower = materialInfo.shininess;
    }
}
```

各マテリアルは**`diffuseColor`**、**`specularColor`**、**`ambientColor`**、**`alpha`**、および**`specularPower`**に対応するプロパティを持つ場合と持たない場合があります。存在するプロパティについてのみマッピングを行えばよいです。

### BMPローダーサポート

babylon-mmdのカスタムBMPテクスチャローダーを適用している場合、マテリアルビルダーも変更する必要があります。

そのために、マテリアルビルダーに以下のメソッドを追加できます：

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    protected _getForcedExtension(texturePath: string): string | undefined {
        if (texturePath.substring(texturePath.length - 4).toLowerCase() === ".bmp") {
            if (_GetCompatibleTextureLoader(".dxbmp") !== null) {
                return ".dxbmp";
            }
        }
        return undefined;
    }
}
```

### `loadDiffuseTexture`の実装

**`imagePathTable`**、**`referenceFileResolver`**、**`_textureLoader`**、**`uniqueId`**、および**`rootUrl`**を使用して**テクスチャ解決**を実行します。これは、ブラウザのFile API、URL、またはArrayBufferを使用するケースを処理するように実装する必要があります。

テクスチャの読み込みが成功したか失敗したかに関わらず、**`onTextureLoadComplete`**を呼び出す必要があります。このコールバックが呼び出されないと、マテリアルビルダーはテクスチャが読み込まれるのを無期限に待ちます。

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override async loadDiffuseTexture(
        uniqueId: number,
        material: MyMaterial,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        textureInfo: Nullable<TextureInfo>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        referenceFileResolver: ReferenceFileResolver,
        logger: ILogger,
        onTextureLoadComplete?: () => void
    ): Promise<void> {
        material.backFaceCulling = (materialInfo.flag & PmxObject.Material.Flag.IsDoubleSided) ? false : true;

        const diffuseTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
        if (diffuseTexturePath !== undefined) {
            const diffuseTextureFileFullPath = referenceFileResolver.createFullPath(diffuseTexturePath);

            let texture: Nullable<Texture>;
            const file = referenceFileResolver.resolve(diffuseTextureFileFullPath);
            if (file !== undefined) {
                texture = await this._textureLoader.loadTextureFromBufferAsync(
                    uniqueId,
                    diffuseTextureFileFullPath,
                    file instanceof File ? file : file.data,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: Constants.TEXTUREFORMAT_RGBA,
                        mimeType: file instanceof File ? file.type : file.mimeType,
                        forcedExtension: this._getForcedExtension(diffuseTexturePath)
                    }
                );
            } else {
                texture = await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    diffuseTexturePath,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: Constants.TEXTUREFORMAT_RGBA,
                        forcedExtension: this._getForcedExtension(diffuseTexturePath)
                    }
                );
            }

            const diffuseTexture = texture;

            if (diffuseTexture !== null) {
                material.diffuseTexture = diffuseTexture;
            } else {
                logger.error(`拡散テクスチャの読み込みに失敗しました: ${diffuseTextureFileFullPath}`);
            }
            onTextureLoadComplete?.();
        } else {
            onTextureLoadComplete?.();
        }
    };
}
```

### `setAlphaBlendMode`の実装

このメソッドでは、**アルファ評価**を実行し、その結果をマテリアルに適用します。

ここでは、各**`MmdMaterialRenderMethod`**に対して異なる処理が必要です。

また、BPMXフォーマットにはすでにアルファ評価の結果が含まれている可能性があるため、**`evaluatedTransparency`**をチェックする必要があります。

プロセスを少し簡略化するために、**`MaterialBuilderBase._evaluateDiffuseTextureTransparencyModeAsync`**メソッドが提供されています。

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override async setAlphaBlendMode(
        material: MyMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[],
        logger: ILogger,
        getTextureAlphaChecker: () => Nullable<TextureAlphaChecker>
    ): Promise<void> {
        if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlending) {
            if (material.diffuseTexture) {
                material.diffuseTexture.hasAlpha = true;
                material.useAlphaFromDiffuseTexture = true;
            }
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;
            material.forceDepthWrite = true;

            return;
        }

        if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
            if (material.alpha < 1) {
                if (material.diffuseTexture) {
                    material.diffuseTexture.hasAlpha = true;
                    material.useAlphaFromDiffuseTexture = true;
                }
                material.transparencyMode = Material.MATERIAL_ALPHABLEND;
                material.forceDepthWrite = true;

                return;
            }
        }

        const diffuseTexture = material.diffuseTexture;
        const evaluatedTransparency = (materialInfo as Partial<BpmxObject.Material>).evaluatedTransparency ?? -1;
        if (diffuseTexture !== null) {
            const transparencyMode = await this._evaluateDiffuseTextureTransparencyModeAsync(
                diffuseTexture,
                evaluatedTransparency,
                meshes,
                logger,
                getTextureAlphaChecker
            );
            if (transparencyMode !== null) {
                const hasAlpha = transparencyMode !== Material.MATERIAL_OPAQUE;

                if (hasAlpha) diffuseTexture.hasAlpha = true;
                material.useAlphaFromDiffuseTexture = hasAlpha;
                material.transparencyMode = transparencyMode;
                if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
                    material.forceDepthWrite = hasAlpha;
                }
            }
        } else {
            if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
                let etIsNotOpaque = (evaluatedTransparency >> 4) & 0x03;
                if ((etIsNotOpaque ^ 0x03) === 0) { // 11: 評価されていない
                    etIsNotOpaque = 0; // 不透明にフォールバック
                }

                material.transparencyMode = etIsNotOpaque === 0 ? Material.MATERIAL_OPAQUE : Material.MATERIAL_ALPHABLEND;
            } else /* if (this.renderMethod === MmdStandardMaterialRenderMethod.AlphaEvaluation) */ {
                let etAlphaEvaluateResult = evaluatedTransparency & 0x0F;
                if ((etAlphaEvaluateResult ^ 0x0F) === 0) { // 1111: 評価されていない
                    etAlphaEvaluateResult = 0; // 不透明にフォールバック
                }

                material.transparencyMode = Material.MATERIAL_OPAQUE;
            }
        }
    }
}
```

### `loadSphereTexture`の実装

このメソッドは**スフィアテクスチャ**を読み込みます。テクスチャ解決方法は**`loadDiffuseTexture`**と似ています。

さらに、スフィアテクスチャをマテリアルに適用する方法は**`materialInfo.sphereTextureMode`**によって異なります。

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override async loadSphereTexture(
        uniqueId: number,
        material: MyMaterial,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        textureInfo: Nullable<TextureInfo>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        referenceFileResolver: ReferenceFileResolver,
        logger: ILogger,
        onTextureLoadComplete?: () => void
    ): Promise<void> {
        if (materialInfo.sphereTextureMode !== PmxObject.Material.SphereTextureMode.Off) {
            const sphereTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
            if (sphereTexturePath !== undefined) {
                const format = scene.getEngine().isWebGPU || materialInfo.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply
                    ? Constants.TEXTUREFORMAT_RGBA
                    : Constants.TEXTUREFORMAT_RGB; // パフォーマンス上の理由でRGBフォーマットを使用しないほうが良いかもしれません

                const sphereTextureFileFullPath = referenceFileResolver.createFullPath(sphereTexturePath);

                let sphereTexture: Nullable<Texture>;
                const file = referenceFileResolver.resolve(sphereTextureFileFullPath);
                if (file !== undefined) {
                    sphereTexture = (await this._textureLoader.loadTextureFromBufferAsync(
                        uniqueId,
                        sphereTextureFileFullPath,
                        file instanceof File ? file : file.data,
                        scene,
                        assetContainer,
                        {
                            ...textureInfo,
                            deleteBuffer: this.deleteTextureBufferAfterLoad,
                            format: format,
                            mimeType: file instanceof File ? file.type : file.mimeType,
                            forcedExtension: this._getForcedExtension(sphereTexturePath)
                        }
                    ));
                } else {
                    sphereTexture = (await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        sphereTexturePath,
                        scene,
                        assetContainer,
                        {
                            ...textureInfo,
                            deleteBuffer: this.deleteTextureBufferAfterLoad,
                            format: format,
                            forcedExtension: this._getForcedExtension(sphereTexturePath)
                        }
                    ));
                }

                if (sphereTexture !== null) {
                    material.sphereTexture = sphereTexture;
                    material.sphereTextureBlendMode = materialInfo.sphereTextureMode as number;
                } else {
                    logger.error(`スフィアテクスチャの読み込みに失敗しました: ${sphereTextureFileFullPath}`);
                }

                onTextureLoadComplete?.();
            } else {
                onTextureLoadComplete?.();
            }
        } else {
            onTextureLoadComplete?.();
        }
    }
}
```

### `loadToonTexture`の実装

このメソッドは**トゥーンテクスチャ**を読み込みます。テクスチャ解決方法は**`loadDiffuseTexture`**と似ています。

トゥーンテクスチャのテクスチャ解決プロセス中に、**`isSharedToonTexture`**がtrueの場合、あらかじめ提供されている11の共有テクスチャの1つが使用されます。この場合、**`imagePathTable`**からテクスチャパスを見つける代わりに、どの共有テクスチャを使用するかを指定するために**`materialInfo.toonTextureIndex`**が**`_textureLoader`**に渡されます。この動作はMMDの実装を模倣しています。

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override async loadToonTexture(
        uniqueId: number,
        material: MyMaterial,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        textureInfo: Nullable<TextureInfo>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        referenceFileResolver: ReferenceFileResolver,
        logger: ILogger,
        onTextureLoadComplete?: () => void
    ): Promise<void> {
        let toonTexturePath;
        if (materialInfo.isSharedToonTexture) {
            toonTexturePath = materialInfo.toonTextureIndex;
        } else {
            toonTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
        }
        if (toonTexturePath !== undefined) {
            const toonTextureFileFullPath = referenceFileResolver.createFullPath(toonTexturePath.toString());

            let toonTexture: Nullable<Texture>;
            const file = typeof toonTexturePath === "string" ? referenceFileResolver.resolve(toonTextureFileFullPath) : undefined;
            if
                toonTexture = (await this._textureLoader.loadTextureFromBufferAsync(
                    uniqueId,
                    toonTextureFileFullPath,
                    file instanceof File ? file : file.data,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: scene.getEngine().isWebGPU ? Constants.TEXTUREFORMAT_RGBA : Constants.TEXTUREFORMAT_RGB,
                        mimeType: file instanceof File ? file.type : file.mimeType
                    }
                ));
            } else {
                toonTexture = (await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    toonTexturePath,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: scene.getEngine().isWebGPU ? Constants.TEXTUREFORMAT_RGBA : Constants.TEXTUREFORMAT_RGB
                    }
                ));
            }

            if (toonTexture !== null) {
                material.toonTexture = toonTexture;
            } else {
                logger.error(`Failed to load toon texture: ${toonTextureFileFullPath}`);
            }

            onTextureLoadComplete?.();
        } else {
            onTextureLoadComplete?.();
        }
    }
}
```

### Implementing `loadOutlineRenderingProperties`

The implementation for loading properties for outline rendering is as follows:

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override loadOutlineRenderingProperties(
        material: MyMaterial,
        materialInfo: MaterialInfo,
        logger: ILogger
    ): void {
        if (materialInfo.flag & PmxObject.Material.Flag.EnabledToonEdge) {
            if (Scene.prototype.getMmdOutlineRenderer === undefined) {
                logger.warn("MMD Outline Renderer is not available. Please import \"babylon-mmd/esm/Loader/mmdOutlineRenderer\".");
            }

            material.renderOutline = true;
            material.outlineWidth = materialInfo.edgeSize;
            const edgeColor = materialInfo.edgeColor;
            material.outlineColor = new Color3(
                edgeColor[0], edgeColor[1], edgeColor[2]
            );
            material.outlineAlpha = edgeColor[3];
        }
    }
}
```

## Finally

Please refer to [pbrMaterialBuilder.ts](https://github.com/noname0310/babylon-mmd/blob/main/src/Loader/pbrMaterialBuilder.ts). You can check the elements mentioned above there.
