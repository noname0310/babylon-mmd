---
sidebar_position: 2
sidebar_label: BPMXローダー
---

# BPMXローダー

このセクションでは、**PMX**ファイルのバリエーションである**Babylon PMX (BPMX)**ファイルをロードする方法について説明します。

**BPMX**フォーマットは**MMD**モデルを格納するためのフォーマットであり、**PMX/PMD**とは異なり、単一のバイナリフォーマットです。

**BPMX**ファイルをロードするには、**`BpmxLoader`**を使用します。このローダーは**`PmxLoader`**と**`PmdLoader`**とほぼ同じ方法で動作します。

## SceneLoaderへの登録

まず、**`BpmxLoader`**を**Babylon.js SceneLoader**に登録する必要があります。これはサイドエフェクトのためにインポートすることで行われます。

```typescript
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader";
```

このインポートステートメントは、暗黙的に次のサイドエフェクトを実行します：

```typescript
RegisterSceneLoaderPlugin(new BpmxLoader());
```

## BPMXファイルのロード

**BPMX**ファイルは、**PMX/PMD**ファイルと同様に、**Babylon.js SceneLoader API**を使用してロードできます。

以下は、SceneLoader APIメソッドの1つである**`LoadAssetContainerAsync`**を使用して**BPMX**ファイルをロードする例です。

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync("path/to/mmdModel.bpmx", scene);
assetContainer.addAllToScene(); 
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

**BPMX**ファイルをロードするために**`ImportMeshAsync`**や**`AppendSceneAsync`**を使用することもできます。

:::info
**BPMX**ファイルはテクスチャを含むすべてのアセットを単一のファイルに格納するため、**テクスチャ解決**に関連する問題がなく、すべてのアセットを単一のネットワークリクエストでロードできます。
:::

## ブラウザのファイルAPIの使用

ブラウザの**ファイルAPI**を使用してファイルをロードすることもできます。

以下は、[showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) APIを使用して**BPMX**ファイルを選択しロードする例です。

```typescript
const [fileHandle] = await window.showOpenFilePicker({
    types: [{
        description: "BPMX File",
        accept: {
            "application/octet-stream": [".bpmx"],
        },
    }],
    excludeAcceptAllOption: true,
    multiple: false,
});
const file = await fileHandle.getFile();

const assetContainer: AssetContainer = await LoadAssetContainerAsync(file, scene);
assetContainer.addAllToScene(); 
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

:::warning
showOpenFilePickerブラウザAPIは、FirefoxおよびSafariではサポートされていません。
:::

## ローダーオプション

**PMX/PMD**ローダーとは異なり、**BPMX**ローダーはいくつかの最適化関連オプションをサポートしていません。これは、**BPMX**ファイルが変換プロセス中に既に最適化されているためです。

以下は、**`pluginOptions`**を使用して**BPMX**ローダーでサポートされているすべてのオプションを設定する例です。

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync(
    modelFileOrUrl,
    scene,
    {
        pluginOptions: {
            mmdmodel: {
                materialBuilder: null,
                useSdef: true,
                buildSkeleton: true,
                buildMorph: true,
                boundingBoxMargin: 10,
                alwaysSetSubMeshesBoundingInfo: true,
                preserveSerializationData: false,
                loggingEnabled: false,

                useSingleMeshForSingleGeometryModel: true
            }
        }
    }
);
```

**`useSingleMeshForSingleGeometryModel`**を除いて、他のオプションは**PMX/PMD**ローダーと同じです。各オプションの説明については、[PMX/PMDローダーオプション](../../#loader-options)のドキュメントを参照してください。

### useSingleMeshForSingleGeometryModel

**`BpmxLoader`**はNつのジオメトリを持つモデルをロードするために空の**ルートメッシュ**を作成し、その下にジオメトリを持つNつのメッシュを作成します。したがって、3つのジオメトリを持つ3Dモデルの構造は次のように構成されます。

```
RootMesh {
    children: [
        Mesh1
        Mesh2
        Mesh3
    ]
}
```

ただし、モデルが単一のジオメトリを持つ場合、**ルートメッシュ**は不要です。したがって、**`useSingleMeshForSingleGeometryModel`**が`true`の場合、単一のジオメトリを持つモデルは**ルートメッシュ**なしの1つのメッシュのみで構成され、階層は次のように構成されます。

```
Mesh1
```

**`useSingleMeshForSingleGeometryModel`**が`false`の場合、単一のジオメトリを持つモデルでも**ルートメッシュ**が存在し、階層は次のように構成されます。

```
RootMesh {
    children: [
        Mesh1
    ]
}
```

**`useSingleMeshForSingleGeometryModel`**のデフォルト値は`true`です。
