---
sidebar_position: 4
sidebar_label: マテリアルビルダー
---

# マテリアルビルダー

MMDモデルを読み込む過程において、**テクスチャの読み込みとマテリアルの割り当ての作業は、完全にマテリアルビルダーに委任されています**。

`PmxLoader`と`PmdLoader`の`materialBuilder`はローダーオプションを通じて設定できます。

以下の理由からマテリアルの読み込み処理を分離しました：

- 測定によると、平均的に、MMDモデルの読み込みで最も時間がかかる部分は**テクスチャを読み込んでマテリアルを初期化する**ことです。しかし、ユースケースによっては、マテリアルの読み込みが必要ない場合があります。そのため、ユーザーが**選択的にマテリアルを読み込み、読み込み時間を短縮できるようにする**必要があります。

- さらに、ユーザーは読み込み時に**MMDのシェーディングモデルではなく、異なるマテリアルに基づいたシェーディングを適用できる**べきです。例えば、よりリアルな見た目のために**物理ベースレンダリング（PBR）マテリアル**を使用したい場合があります。

## マテリアルビルダーの紹介

すべてのMMDモデルローダーでは、**`loaderOptions.mmdmodel.materialBuilder: Nullable<IMaterialBuilder>`** を通じてマテリアルビルダーを設定できます。

このオプションのデフォルトは**`null`** ですが、babylon-mmdのインデックスをインポートすると、**`MmdStandardMaterialBuilder`がデフォルト**として設定されます。

:::info
この文脈でインデックスをインポートするとは、このようなコードを意味します：

```typescript
import { Something } from "babylon-mmd";
```

逆に、シンボルが定義されているファイルを直接インポートすることもできます：

```typescript
import { Something } from "babylon-mmd/esm/something";
```

ツリーシェイキングの目的で、`loaderOptions.mmdmodel.materialBuilder`のデフォルト値は`null`に設定されています。
しかし、初心者がライブラリを使いやすくするために、**インデックスをインポートすると`MmdStandardMaterialBuilder`がデフォルト**として設定されるように設計されています。
:::

マテリアルビルダーは次のように設定できます：

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: new MmdStandardMaterialBuilder()
        }
    }
});
```

単一のマテリアルで複数のモデルを読み込む場合は、**マテリアルビルダーを共有**できます。

この場合、マテリアルビルダーは**内部でテクスチャをキャッシュ**するため、特に同じモデルを複数回読み込む場合、読み込み時間を大幅に短縮できます。

```typescript
const pbrMaterialBuilder = new PBRMaterialBuilder();

const assetContainer1: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl1, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: pbrMaterialBuilder
        }
    }
});

const assetContainer2: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl2, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: pbrMaterialBuilder
        }
    }
});
```

## マテリアルビルダーの種類

**`IMmdMaterialBuilder`** インターフェースを実装することでマテリアルビルダーを作成できます。また、babylon-mmdが提供するマテリアルビルダーもこのインターフェースを実装しています。

babylon-mmdは3つのマテリアルビルダーを提供しています：

- **`MmdStandardMaterialBuilder`** - **`MmdStandardMaterial`** を使用してMMDの動作を再現するマテリアルビルダー。
- **`StandardMaterialBuilder`** - Babylon.jsの**`StandardMaterial`** を使用するマテリアルビルダー。
- **`PBRMaterialBuilder`** - Babylon.jsの**`PBRMaterial`** を使用するマテリアルビルダー。

### MmdStandardMaterialBuilder

**`MmdStandardMaterialBuilder`** は**`MmdStandardMaterial`** を使用してMMDマテリアルを読み込むマテリアルビルダーです。

このマテリアルビルダーは**babylon-mmdがサポートするすべてのMMDマテリアルプロパティを読み込み**、各カテゴリ用のメソッドが提供されています。

読み込み動作を変更したい場合は、`_setMeshesAlphaIndex`を除いて、**対応するメソッドをオーバーライド**できます。

**`MmdStandardMaterialBuilder._setMeshesAlphaIndex`によって設定されるプロパティ：**

- **`AbstractMesh.alphaIndex`** - マテリアルの順序に従ってマテリアルのアルファインデックスを設定します（下記のレンダーメソッドを参照）。

**`MmdStandardMaterialBuilder.loadGeneralScalarProperties`によって設定されるプロパティ：**

- **`StandardMaterial.diffuseColor`** - MMDマテリアルの「拡散色」(rgb)
- **`StandardMaterial.specularColor`** - MMDマテリアルの「光沢色」(rgb)
- **`StandardMaterial.ambientColor`** - MMDマテリアルの「環境色」(rgb)
- **`Material.alpha`** - MMDマテリアルの「拡散色」(a)
- **`AbstractMesh.isVisible`** - 「拡散色」(a)が0の場合はfalseに設定
- **`StandardMaterial.specularPower`** - MMDマテリアルの「反射率」

**`MmdStandardMaterialBuilder.loadDiffuseTexture`によって設定されるプロパティ：**

- **`Material.backFaceCulling`** - MMDマテリアルの「両面描画」
- **`StandardMaterial.diffuseTexture`** - MMDマテリアルの「テクスチャ」

**`MmdStandardMaterialBuilder.setAlphaBlendMode`によって設定されるプロパティ：**

- **`StandardMaterial.diffuseTexture.hasAlpha`** - MMDマテリアルの「テクスチャ」がアルファチャンネルを持つ場合はtrueに設定（下記のアルファ評価を参照）
- **`StandardMaterial.useAlphaFromDiffuseTexture`** - MMDマテリアルの「テクスチャ」がアルファチャンネルを持つ場合はtrueに設定
- **`Material.transparencyMode`** - レンダーメソッドによって決定（下記のレンダーメソッドを参照）
- **`Material.forceDepthWrite`** - レンダーメソッドによって決定（下記のレンダーメソッドを参照）

**`MmdStandardMaterialBuilder.loadSphereTexture`によって設定されるプロパティ：**

- **`MmdStandardMaterial.sphereTexture`** - MMDマテリアルの「スフィアテクスチャ」
- **`MmdStandardMaterial.sphereTextureBlendMode`** - MMDマテリアルの「スフィアテクスチャモード」

**`MmdStandardMaterialBuilder.loadToonTexture`によって設定されるプロパティ：**

- **`MmdStandardMaterial.toonTexture`** - MMDマテリアルの「トゥーンテクスチャ」

**`MmdStandardMaterialBuilder.loadOutlineRenderingProperties`によって設定されるプロパティ：**

- **`MmdStandardMaterial.renderOutline`** - アウトラインレンダリングを有効にするためにtrueに設定
- **`MmdStandardMaterial.outlineWidth`** - MMDマテリアルの「エッジサイズ」
- **`MmdStandardMaterial.outlineColor`** - MMDマテリアルの「エッジ色」(rgb)
- **`MmdStandardMaterial.outlineAlpha`** - MMDマテリアルの「エッジ色」(a)

### StandardMaterialBuilder

**`StandardMaterialBuilder`** は**`StandardMaterial`** を使用してMMDマテリアルを読み込むマテリアルビルダーです。

このマテリアルビルダーは**MMDマテリアルプロパティのサブセットのみを読み込む**ため、読み込み処理中にデータの損失が発生します。

読み込み動作を変更したい場合は、`_setMeshesAlphaIndex`を除いて、**対応するメソッドをオーバーライド**できます。

**`StandardMaterialBuilder._setMeshesAlphaIndex`によって設定されるプロパティ：**

- **`AbstractMesh.alphaIndex`** - マテリアルの順序に従ってマテリアルのアルファインデックスを設定します（下記のレンダーメソッドを参照）。

**`StandardMaterialBuilder.loadGeneralScalarProperties`によって設定されるプロパティ：**

- **`StandardMaterial.diffuseColor`** - MMDマテリアルの「拡散色」(rgb)
- **`StandardMaterial.specularColor`** - MMDマテリアルの「光沢色」(rgb)
- **`StandardMaterial.ambientColor`** - MMDマテリアルの「環境色」(rgb)
- **`Material.alpha`** - MMDマテリアルの「拡散色」(a)
- **`AbstractMesh.isVisible`** - 「拡散色」(a)が0の場合はfalseに設定
- **`StandardMaterial.specularPower`** - MMDマテリアルの「反射率」

**`StandardMaterialBuilder.loadDiffuseTexture`によって設定されるプロパティ：**

- **`Material.backFaceCulling`** - MMDマテリアルの「両面描画」
- **`StandardMaterial.diffuseTexture`** - MMDマテリアルの「テクスチャ」

**`StandardMaterialBuilder.setAlphaBlendMode`によって設定されるプロパティ：**

- **`StandardMaterial.diffuseTexture.hasAlpha`** - MMDマテリアルの「テクスチャ」がアルファチャンネルを持つ場合はtrueに設定（下記のアルファ評価を参照）
- **`StandardMaterial.useAlphaFromDiffuseTexture`** - MMDマテリアルの「テクスチャ」がアルファチャンネルを持つ場合はtrueに設定
- **`Material.transparencyMode`** - レンダーメソッドによって決定（下記のレンダーメソッドを参照）
- **`Material.forceDepthWrite`** - レンダーメソッドによって決定（下記のレンダーメソッドを参照）

**以下の3つのメソッドは空であり、オーバーライドすることで任意に実装できます：**

- `StandardMaterialBuilder.loadSphereTexture`
- `StandardMaterialBuilder.loadToonTexture`
- `StandardMaterialBuilder.loadOutlineRenderingProperties`

### PBRMaterialBuilder

**`PBRMaterialBuilder`** は**`PBRMaterial`** を使用してMMDマテリアルを読み込むマテリアルビルダーです。

このマテリアルビルダーは**MMDマテリアルプロパティのサブセットのみを読み込む**ため、読み込み処理中にデータの損失が発生します。
また、MMDマテリアルパラメータと1対1のマッピングがないプロパティについては、追加の変換による**データの歪み**が発生する可能性があります。

読み込み動作を変更したい場合は、`_setMeshesAlphaIndex`を除いて、**対応するメソッドをオーバーライド**できます。

**`PBRMaterialBuilder._setMeshesAlphaIndex`によって設定されるプロパティ：**

- **`AbstractMesh.alphaIndex`** - マテリアルの順序に従ってマテリアルのアルファインデックスを設定します（下記のレンダーメソッドを参照）。

**`PBRMaterialBuilder.loadGeneralScalarProperties`によって設定されるプロパティ：**

- **`PBRMaterial.albedoColor`** - MMDマテリアルの「拡散色」(rgb)
- **`PBRMaterial.reflectionColor`** - MMDマテリアルの「光沢色」(rgb)
- **`PBRMaterial.ambientColor`** - MMDマテリアルの「環境色」(rgb)
- **`Material.alpha`** - MMDマテリアルの「拡散色」(a)
- **`AbstractMesh.isVisible`** - 「拡散色」(a)が0の場合はfalseに設定
- **`PBRMaterial.roughness`** - MMDマテリアルの「反射率」

**`PBRMaterialBuilder.loadDiffuseTexture`によって設定されるプロパティ：**

- **`Material.backFaceCulling`** - MMDマテリアルの「両面描画」
- **`PBRMaterial.albedoTexture`** - MMDマテリアルの「テクスチャ」

**`PBRMaterialBuilder.setAlphaBlendMode`によって設定されるプロパティ：**

- **`PBRMaterial.albedoTexture.hasAlpha`** - MMDマテリアルの「テクスチャ」がアルファチャンネルを持つ場合はtrueに設定（下記のアルファ評価を参照）
- **`PBRMaterial.useAlphaFromAlbedoTexture`** - MMDマテリアルの「テクスチャ」がアルファチャンネルを持つ場合はtrueに設定
- **`Material.transparencyMode`** - レンダーメソッドによって決定（下記のレンダーメソッドを参照）
- **`Material.forceDepthWrite`** - レンダーメソッドによって決定（下記のレンダーメソッドを参照）

**以下の3つのメソッドは空であり、オーバーライドすることで任意に実装できます：**

- `PBRMaterialBuilder.loadSphereTexture`
- `PBRMaterialBuilder.loadToonTexture`
- `PBRMaterialBuilder.loadOutlineRenderingProperties`

## レンダーメソッド

MMDは**デプスライト**と**デプステスト**を有効にした**アルファブレンディング**を使用してメッシュをレンダリングします。
マテリアルビルダーは、この動作を実装しながら最適化された結果を得るためのいくつかのオプションを提供します。

メッシュが完全に**不透明**である場合、アルファブレンディングなしでレンダリングしても同じ結果が得られます。babylon-mmdはレンダリングの最適化のためにこれを自動的に実行するためのいくつかのオプションを提供しており、それはマテリアルビルダーの`renderMethod`によって制御されます。

### DepthWriteAlphaBlendingWithEvaluation

このレンダリングメソッドは**不透明なメッシュをアルファブレンディングなし**でレンダリングし、絶対に必要な場合にのみアルファブレンディングを使用します。

つまり、このメソッドでモデルを読み込むと、マテリアルの`transparencyMode`は**`Material.MATERIAL_ALPHABLEND`** または**`Material.MATERIAL_OPAQUE`** のいずれかになり、`forceDepthWrite`は**`true`** に設定されます。

これが**デフォルト**のメソッドです。

### DepthWriteAlphaBlending

このレンダリングメソッドは**すべてのメッシュをアルファブレンディング**を使用してレンダリングします。

つまり、このメソッドでモデルを読み込むと、マテリアルの`transparencyMode`は常に**`Material.MATERIAL_ALPHABLEND`** であり、`forceDepthWrite`は**`true`** に設定されます。

このメソッドは**MMDのレンダリングメソッドと同一**なので、レンダリングの問題が発生した場合は、このメソッドを試すことをお勧めします。

### AlphaEvaluation

このレンダリングメソッドは、メッシュを**アルファブレンディング、アルファテスト、または不透明**モードのいずれでレンダリングするかを決定し、**アルファブレンディングを使用する場合にはデプスライトを実行しません**。

つまり、このメソッドでモデルを読み込むと、マテリアルの`transparencyMode`は**`Material.MATERIAL_ALPHATEST`**、**`Material.MATERIAL_ALPHABLEND`**、または**`Material.MATERIAL_OPAQUE`** のいずれかになり、`forceDepthWrite`は**`false`** に設定されます。

このメソッドは**Babylon.jsのレンダリングパイプラインと最も互換性がある**方法です。デプスライトとアルファブレンドの併用は一般的な手法ではないためです。

## アルファ評価

上記のレンダリングメソッドのうち、**`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`** はメッシュが不透明かどうかを判断する必要があります。また、**`MmdMaterialRenderMethod.AlphaEvaluation`** はメッシュのアルファ値を評価して適切なレンダリングメソッドを選択する必要があります。

このプロセスを**アルファ評価**と呼びます。

### プロセス

1.  ジオメトリを**UVスペース**でレンダーターゲットにレンダリングします。この時、テクスチャをサンプリングして各ピクセルの**アルファ値のみ**をレンダリングします。
2.  **readPixels**関数を使用してレンダーターゲットのピクセルデータを読み取ります。
3.  読み取ったピクセルデータからアルファ値を評価して、適切なレンダリングメソッドを選択します。

-   **`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`** の場合、テクスチャ付きのジオメトリのフラグメントが1つでも`255`以外のアルファ値を持つ場合、マテリアルの`transparencyMode`は**`Material.MATERIAL_ALPHABLEND`** に設定されます。
-   **`MmdMaterialRenderMethod.AlphaEvaluation`** の場合、マテリアルのレンダリングメソッドはマテリアルビルダーの**`alphaThreshold`** と**`alphaBlendThreshold`** の値によって決定されます。

### 注意点

**アルファ評価は一部のエッジケースで正しく機能しない場合があります**。例えば、メッシュのUVトポロジーが異常な場合、アルファ評価は不正確な結果を生成する可能性があります。この場合、マテリアルビルダーの**`alphaEvaluationResolution`** を増やすことで問題が解決する場合があります。

アルファ評価を実行する場合、**すべてのマテリアルは読み込み時に一度レンダーターゲットにレンダリングされる必要があります**。これは無視できないコストです。そのため、マテリアルビルダーの**`forceDisableAlphaEvaluation`** オプションを使用してアルファ評価を無効にすることができます。
この場合、アルファ評価は実行されません。

また、**BPMXフォーマット**はアルファ評価の結果をフォーマット内に格納するため、それを使用して**読み込み時のアルファ評価プロセスをスキップ**することができます。

## 描画順序の設定

MMDは常にマテリアルの順序に従ってメッシュをレンダリングします。
しかし、Babylon.jsはレンダリング前にカメラからの距離に基づいてメッシュをソートします。

babylon-mmdはMMDと同じ描画順序を再現するために、2つのケースに対して別々のソリューションを提供します。

描画順序の再現は、`renderMethod`が`MmdMaterialRenderMethod.AlphaEvaluation`の場合には適用されないことに注意してください。

### 複数のメッシュの処理

MMDの描画順序は、**`Mesh.alphaIndex`** に適切な値を設定することで再現されます。

マテリアルビルダーの以下の2つのプロパティがこのために使用されます：

-   **`nextStartingAlphaIndex`** - 次のMMDモデルの開始アルファインデックス値
-   **`alphaIndexIncrementsPerModel`** - 各MMDモデルのアルファインデックスの増分値

**`nextStartingAlphaIndex`** は1つのMMDモデルを読み込んだ後に**`alphaIndexIncrementsPerModel`** だけ増加します。

したがって、以下の設定で：
- `nextStartingAlphaIndex`: 0
- `alphaIndexIncrementsPerModel`: 3

マテリアルが2つあるMMDモデルAとマテリアルが3つあるMMDモデルBを順番に読み込むと、**`nextStartingAlphaIndex`** は以下のように変化します：

1.  読み込み前、`nextStartingAlphaIndex`: 0
2.  モデルA読み込み後、`nextStartingAlphaIndex`: 3
3.  モデルB読み込み後、`nextStartingAlphaIndex`: 6

そして、読み込まれたモデルの**`Mesh.alphaIndex`** は以下のように設定されます：

```
Model A: {
    Mesh1: { alphaIndex: 0 }
    Mesh2: { alphaIndex: 1 }
}

Model B: {
    Mesh1: { alphaIndex: 3 }
    Mesh2: { alphaIndex: 4 }
    Mesh3: { alphaIndex: 5 }
}
```

ここで重要なのは、**`alphaIndexIncrementsPerModel`が十分に大きくない場合**、以前に読み込まれたモデルと新しく読み込まれたモデルの**`Mesh.alphaIndex`** が**重複する**可能性があることです。

例えば、前の例で**`alphaIndexIncrementsPerModel`** が1に設定されていた場合、各モデルの**`Mesh.alphaIndex`** は以下のようになります：

```
Model A: {
    Mesh1: { alphaIndex: 0 }
    Mesh2: { alphaIndex: 1 }
}

Model B: {
    Mesh1: { alphaIndex: 1 }
    Mesh2: { alphaIndex: 2 }
    Mesh3: { alphaIndex: 3 }
}
```

モデルAのMesh2とモデルBのMesh1は同じ**`alphaIndex`** を持つため、それらの描画順序はカメラからの距離によって決定されます。

この問題を防ぐために、**`alphaIndexIncrementsPerModel`** のデフォルト値は十分に大きな数に設定されています。

:::info
この方法を使用する場合、**描画順序はMMDモデルが読み込まれる順序によって決まる**ことに注意してください。

MMDモデル間の描画順序を厳密に再現する必要がある場合は、**`alphaIndexIncrementsPerModel`を0に設定**し、**`Mesh.alphaIndex`を手動で調整**することができます。
:::

### 複数のサブメッシュの処理

Babylon.jsでは、単一メッシュ内の**複数のサブメッシュ間の描画順序を制御する方法はありません**。

単一のメッシュが複数のサブメッシュを持つ場合、描画順序は各サブメッシュ自身の**境界球の中心**に基づいてカメラからの距離を計算することによって決定されます。

この動作を考慮して、babylon-mmdはMMDモデルを読み込む際に**すべてのサブメッシュに同じ`BoundingInfo`を適用**します。

この場合、すべてのサブメッシュはカメラからの距離が同じになり、**安定したソート**により**`Mesh.subMeshes`** の順序で描画されます。

これはMMDモデルローダーの**`loaderOptions.mmdmodel.optimizeSubmeshes`** オプションが**`false`** の場合、常に適用されます。
