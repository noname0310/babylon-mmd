---
sidebar_position: 1
sidebar_label: MMD モデルローダー (PmxLoader, PmdLoader)
---

# MMD モデルローダー (PmxLoader, PmdLoader)

このセクションでは、**MMD モデルファイル (PMX, PMD) を読み込む**ために使用されるコンポーネントについて説明します。

MMD モデルは **`PmxLoader`** または **`PmdLoader`** を使用して読み込むことができます。

## PmxLoader/PmdLoader

**`PmxLoader`** と **`PmdLoader`** は、それぞれ **PMX と PMD ファイル**を読み込むために使用されるローダーです。

## Babylon.js SceneLoader へのローダーの登録

これらは **Babylon.js SceneLoader API** と統合されています。

したがって、使用する前に、まず **`PmxLoader` または `PmdLoader` を Babylon.js SceneLoader に登録**する必要があります。

これは、**"babylon-mmd/esm/Loader/pmxLoader"** または **"babylon-mmd/esm/Loader/pmdLoader"** をインポートすることで実行できます。

```typescript
// .pmx ファイルを読み込むために、`PmxLoader` インスタンスをグローバル SceneLoader 状態に登録します。
import "babylon-mmd/esm/Loader/pmxLoader"; 

// .pmd ファイルを読み込むために、`PmdLoader` インスタンスをグローバル SceneLoader 状態に登録します。
import "babylon-mmd/esm/Loader/pmdLoader"; 
```

これは暗黙的に以下のコードを実行します：

```typescript
RegisterSceneLoaderPlugin(new PmxLoader()); // "babylon-mmd/esm/Loader/pmxLoader" をインポートする場合
RegisterSceneLoaderPlugin(new PmdLoader()); // "babylon-mmd/esm/Loader/pmdLoader" をインポートする場合
```

:::info
**UMD パッケージ**を使用している場合、これらのサイドエフェクトはスクリプトがロードされるときに自動的に適用されます。したがって、それらを個別にインポートする必要はありません。
:::

:::info
**`import "babylon-mmd";`** のようにルートからシンボルをインポートすると、すべてのサイドエフェクトが自動的に適用されます。したがって、それらを個別にインポートする必要はありません。

ただし、この場合、**ツリーシェイキングが適用されない**ため、プロダクション環境では推奨されません。
:::

## MMD モデルの読み込み

**Babylon.js SceneLoader API** は、シーンに 3D アセットを追加するためのいくつかのファンクションを提供します。

これらのファンクションのいずれかを使用して、**MMD モデルを読み込む**ことができます。

### ImportMeshAsync

**`ImportMeshAsync`** ファンクションは、MMD モデルをシーンに追加し、読み込まれた要素を **`ISceneLoaderAsyncResult`** 形式で返します。

戻り値から MMD のルートノードである **`MmdMesh`** を取得できます。

```typescript
const result: ISceneLoaderAsyncResult = await ImportMeshAsync("path/to/mmdModel.pmx", scene);
const mmdMesh = result.meshes[0] as MmdMesh;
```

上記の例では、**`result.meshes[0]`** を **`MmdMesh`** にキャストしています。これは、MMD モデルを読み込む場合、常に有効です。

MMD モデルを読み込む場合、**`ISceneLoaderAsyncResult.meshes`** 配列の **最初の要素**は常に MMD モデルの **ルートメッシュ**です。

### AppendSceneAsync

**`AppendSceneAsync`** ファンクションは、MMD モデルをシーンに追加します。ただし、戻り値がないため、シーンの **`meshes`** プロパティを使用して、読み込まれた要素を取得する必要があります。

したがって、このメソッドは **一般的には使用されません**。

```typescript
await AppendSceneAsync("path/to/mmdModel.pmx", scene);
```

### LoadAssetContainerAsync

**`LoadAssetContainerAsync`** ファンクションは、MMD モデルを読み込み、MMD モデルを構成するすべてのリソースを含む **`AssetContainer`** を返します。
この **`AssetContainer`** には、読み込まれたメッシュ、マテリアル、テクスチャなどが含まれています。

**`ImportMeshAsync`** と同様に、返された **`AssetContainer`** から MMD モデルの **ルートメッシュ**を取得できます。

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync("path/to/mmdModel.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

上記の例では、**`assetContainer.meshes[0]`** を **`MmdMesh`** にキャストしています。これは、MMD モデルを読み込む場合、常に有効です。

MMD モデルを読み込む場合、**`AssetContainer.meshes`** 配列の **最初の要素**は常に MMD モデルの **ルートメッシュ**です。

**`LoadAssetContainerAsync`** ファンクションは、MMD モデルが完全に読み込まれた後にすべてをシーンに一度に追加しますが、**`ImportMeshAsync`** ファンクションは、MMD モデルの読み込みプロセス中にメッシュ、マテリアル、テクスチャなどを非同期でシーンに追加します。非同期処理によって引き起こされる可能性のある問題を避けるために、MMD モデルを読み込むには **`LoadAssetContainerAsync` ファンクションを使用することをお勧めします**。

## ブラウザの File API を使用する

上記では、**モデルの URL を使用して MMD モデルを読み込む**方法を学びました。
しかし、**URL ベースの読み込み方法には問題があり**、これらは **ブラウザの File API** を使用することで解決できます。

**ユーザーから受け取ったファイルを読み込む**ために File API を使用することもできます。

### URL ベースの読み込みの問題点

URL を使用する場合、ローダーは **PMX/PMD ファイルをフェッチ**し、その後、3D モデルに必要な **テクスチャファイルを再度フェッチ**します。

**PMX/PMD フォーマットには、ファイルの場所を基準にした相対パスとしてテクスチャファイルパスが含まれています**。

例えば、以下のようなファイル構造の場合：

```
file1
├── model.pmx
├── texture1.png
├── texture2.png
└── file2
    ├── texture3.png
    └── texture4.png
```

テクスチャファイルパスは通常、PMX/PMD ファイルに以下のような文字列として格納されています：

```
texture1.png
texture2.png
file2/texture3.png
file2/texture4.png
```

しかし、**Windows ファイルシステムはファイルやフォルダの大文字と小文字を区別しない**ため、以下のようなデータも有効です：

```
Texture1.png
Texture2.png
File2/Texture3.png
File2/Texture4.png
```

対照的に、**ブラウザ環境でフェッチする場合、大文字と小文字が区別される**ため、大文字と小文字が完全に一致しない場合、テクスチャは見つかりません。

この問題を解決するために、フェッチの代わりに **File API ベースの読み込み方法**を使用できます。

### MMD モデルファイルを含むフォルダの選択

まず、**File API を使用してローカルファイルを選択して読み込む**方法を実装する必要があります。

ここでは、**.pmx/.pmd ファイル**だけでなく、モデルによって使用される**テクスチャファイルも読み込む**必要があります。

したがって、ユーザーが MMD モデルの読み込みに必要な**すべてのリソースを含むフォルダを選択できるようにする**必要があります。

例えば、以下のようなファイル構造の場合：

```
file1
├── model.pmx
├── texture1.png
├── texture2.png
└── file2
    ├── texture3.png
    └── texture4.png
```

ユーザーが **`file1` フォルダを選択できるようにする**必要があります。

理想的には、**[showDirectoryPicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) API** を使用してフォルダを選択できますが、この機能は **Firefox と Safari ではサポートされていません**。

したがって、このドキュメントでは、**HTML のファイル入力を使用してフォルダを選択する**方法について説明します。

まず、HTML のファイル入力を作成し、**`directory` および `webkitdirectory`** 属性を使用してディレクトリ選択を有効にします。

```html
<input type="file" id="folderInput" directory webkitdirectory />
```

その後、ユーザーがフォルダを選択すると、**フォルダ内のすべてのファイルを読み込む**ことができます。

```typescript
const fileInput = document.getElementById("folderInput") as HTMLInputElement;
fileInput.onchange = (): void => {
    if (fileInput.files === null) return;
    const files = Array.from(fileInput.files);

    // 読み込むモデルファイルを見つける（複数の PMX/PMD ファイルからユーザーが選択できるような UI を実装することもできます）
    let modelFile: File | null = null;
    for (const file of files) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".pmx") || name.endsWith(".pmd")) {
            modelFile = file;
            break;
        }
    }
    if (modelFile === null) {
        console.error("PMX/PMD モデルファイルが見つかりません。");
        return;
    }

    // これで、フォルダ内のすべてのファイルを含む files と、読み込むターゲットとしての modelFile が取得できました。
};
```

または、フォルダ選択のために**ドラッグ＆ドロップ機能**を実装することもできます。これについては、[babylon-mmd-viewer fileDropControlBuilder.ts](https://github.com/noname0310/babylon-mmd-viewer/blob/main/src/Viewer/fileDropControlBuilder.ts) を参照してください。

### URL の代わりに File を使用する

上記で URL を使用して読み込んだコードで、**URL をファイルに置き換える**だけです。ここでも、テクスチャを読み込むために、**フォルダから読み込まれたすべてのファイルのリスト**を渡す必要があります。

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync(
    modelFile,
    scene,
    {
        rootUrl: modelFile.webkitRelativePath.substring(0, modelFile.webkitRelativePath.lastIndexOf("/") + 1),
        pluginOptions: {
            mmdmodel: {
                referenceFiles: files // 潜在的にテクスチャである可能性のあるすべてのファイルを渡す
            }
        }
    }
);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

この方法で読み込む場合、ローダーは **`files.webkitRelativePath` を使用してテクスチャを検索**します。これにより、**Windows ファイルシステムのパス解決方法をエミュレート**して、テクスチャファイルを正確に見つけることができます。

**rootUrl** は、`modelFile.webkitRelativePath` から最後の `/` までのパスを抽出したものです。
このパスは、**MMD モデルが配置されているフォルダのパス**を表し、ローダーはこのパスを基準に相対パスを計算してテクスチャファイルを検索します。

## URL テクスチャパスの解決

**サーバーから MMD モデルを提供する**場合、URL フェッチメソッドを使用する必要があるため、File API アプローチを使用できません。この場合、テクスチャ読み込みの問題を解決するために**2つの方法**を使用できます：

1. **モデル修正** - **[PMXEditor](https://www.deviantart.com/johnwithlenon/art/PmxEditor-v0273-English-Version-unofficial-trans-925125044)** を使用して、モデルのテクスチャパスの大文字小文字の誤りを修正します。
2. **BPMX への変換** - PMX/PMD フォーマットから BPMX フォーマットに変換する際、変換プロセス中にテクスチャパスの問題が解決されます。詳細については、**[The Babylon PMX Format](./the-babylon-pmx-format)** のドキュメントを参照してください。

## ローダーオプション

**MMD モデルローダーは、MMD モデルを読み込む際に複数のシナリオで最良の結果を得るためのさまざまなオプション**を提供しています。

これらのオプションは **`pluginOptions`** を通して渡されます。

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

                referenceFiles: [],
                optimizeSubmeshes: true,
                optimizeSingleMaterialModel: true
            }
        }
    }
);
```

各オプションは以下の目的を果たします：

### materialBuilder

MMD モデルにマテリアルを割り当てる方法を定義する **`IMmdMaterialBuilder`** インスタンスを設定します。\
デフォルト値は **`null`** です。**デフォルト値が `null` の場合、MMD モデルはマテリアルなしで読み込まれます。**

詳細については、**[Material Builder](./material-builder)** のドキュメントを参照してください。

### useSdef

モデルが **SDEF（球状変形）** をサポートするかどうかを設定します。\
デフォルト値は **`true`** です。

詳細については、**[SDEF Support](./sdef-support)** のドキュメントを参照してください。

### buildSkeleton

**スケルトンを読み込むかどうか**を設定します。\
デフォルト値は **`true`** です。

例えば、ステージを読み込む場合、スケルトンを作成する必要はないため、これを **`false`** に設定できます。**スケルトンなしの `MmdMesh` は MMD ランタイムに登録できません**。

### buildMorph

**モーフを読み込むかどうか**を設定します。\
デフォルト値は **`true`** です。

例えば、ステージを読み込む場合、モーフを作成する必要はないため、これを **`false`** に設定できます。

### boundingBoxMargin

**バウンディングボックスのマージン**を設定します。\
デフォルト値は **`10`** です。

**Babylon.js は、スケルトンによる変形が発生したときにバウンディングボックスを更新しません**。バウンディングボックスは、明示的に **[BoundingInfoHelper](https://forum.babylonjs.com/t/new-feature-boundinginfohelper/51469)** を使用する場合にのみ更新されます。

したがって、**MMD モデルにアニメーションが適用される**と、バウンディングボックスとメッシュが一致しなくなり、**カメラフラスタム内にあるメッシュがカリングされる**可能性があります。
これを防ぐために、**バウンディングボックスにマージンを設定する**ことをお勧めします。

この値は、**MMD アニメーションが MMD モデルを原点からどれだけ遠くに移動させるか**に基づいて調整する必要があります。
MMD アニメーションが MMD モデルを原点から遠くに移動させる場合は、**より大きな値を設定する**ことをお勧めします。

例えば、ステージには動きがないため、**`boundingBoxMargin` を 0 に設定しても問題ありません**。

MMD モデルメッシュの **`alwaysSelectAsActiveMesh` プロパティが `true` に設定**されている場合、そのメッシュには **フラスタムカリングが適用されません**。この場合も、`boundingBoxMargin` の値を設定する必要はありません。

### alwaysSetSubMeshesBoundingInfo

**常にサブメッシュにバウンディング情報を設定するかどうか**を設定します。\
デフォルト値は **`true`** です。

**optimizeSubmeshes が false の場合**

**optimizeSubmeshes** が `false` に設定されている場合、このオプションは無視され、**`Mesh` のすべての `SubMesh` BoundingInfo は常に Mesh の BoundingInfo と一致するように設定**されます。

これは、**MMD モデルのマテリアルのレンダリング順序を設定する**ためです。

**MMD モデルは、マテリアルをレンダリングする際に常に同じ順序でレンダリングする必要があります**。
サブメッシュがすべて独立した `Mesh` に分割されている場合、**`Mesh.alphaIndex` を使用してレンダリング順序を設定**できます。

ただし、**1つの `Mesh` に複数の `SubMesh` が存在する**場合、各 `SubMesh` の描画順序を通常の方法で設定することはできず、**Babylon.js は各 `SubMesh` の `BoundingInfo` に基づいてソートしてレンダリング順序を設定**します。
これを解決するために、**すべての `SubMesh` BoundingInfo は同じに設定**されます。Babylon.js はこの場合、**レンダリング順序をソートする際に安定ソートを使用する**ため、レンダリングは `Mesh.subMeshes` の順序で実行されます。

**optimizeSubmeshes が true の場合**

この場合、**`Mesh` あたり 1つの `SubMesh` しか存在しない**ため、`Mesh` の BoundingInfo を `SubMesh` にコピーすることは意味がないように思えるかもしれません。
**`Mesh` あたり 1つの `SubMesh` が存在する**場合、Babylon.js は BoundingInfo を `SubMesh` に保存せず、`SubMesh.getBoundingInfo()` を呼び出す際に `Mesh` の BoundingInfo を返します。

ただし、**`scene.clearCachedVertexData()` を実行して**、既に GPU にアップロードされた VertexData を削除した場合、
`SubMesh.getBoundingInfo()` を呼び出すと、`SubMesh` は **`Mesh` の BoundingInfo の代わりに undefined を返します**。

その理由は、`SubMesh.getBoundingInfo()` で **`this.IsGlobal` が実際とは異なり `false` を返すため**です。**これはバグ**です。

```typescript
// https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Meshes/subMesh.ts#L230-L249
class SubMesh {
    // ...

    /**
     * Returns true if this submesh covers the entire parent mesh
     * @ignorenaming
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public get IsGlobal(): boolean {
        return this.verticesStart === 0 && this.verticesCount === this._mesh.getTotalVertices() && this.indexStart === 0 && this.indexCount === this._mesh.getTotalIndices();
    }

    /**
     * Returns the submesh BoundingInfo object
     * @returns current bounding info (or mesh's one if the submesh is global)
     */
    public getBoundingInfo(): BoundingInfo {
        if (this.IsGlobal || this._mesh.hasThinInstances) {
            return this._mesh.getBoundingInfo();
        }

        return this._boundingInfo;
    }

    // ...
}
```

このため、**レンダリングプロセス中のソートが失敗し**、**レンダリング中にエラーがスローされる**可能性があります。

この問題は、**`Mesh` の `BoundingInfo` を `SubMesh` にコピーする**ことで解決されます。

### preserveSerializationData

**再シリアル化のためのデータを保存するかどうか**を設定します。\
デフォルト値は **`false`** です。

babylon-mmd で使用されない MMD モデル内のデータを保存するには、`preserveSerializationData` を **`true`** に設定する必要があります。
この場合、**ボーンの tailPosition やマテリアルの英語名など、追加情報を保存**できます。

**PMX/PMD モデルを読み込んで BPMX に変換**する場合は、`BpmxConverter` を使用して、このオプションを **`true`** に設定して、損失なく BPMX に変換する必要があります。

### loggingEnabled

**ロギングを有効にするかどうか**を設定します。\
デフォルト値は **`false`** です。

**開発中はロギングを有効にする**ことをお勧めします。これは、無効な PMX/PMD ファイルを読み込む際の問題を診断するのに役立ちます。

この値が **`false`** の場合、ローダーは読み込みプロセス中に発生する問題に関する**警告を出力しません**。

### referenceFiles

**参照ファイルのリスト**を設定します。\
デフォルト値は **`[]`** です。

**参照ファイルは MMD モデルのテクスチャを読み込む**ために使用されます。

### optimizeSubmeshes

**サブメッシュの最適化を有効にするかどうか**を設定します。\
デフォルト値は **`true`** です。

この値が **`false`** の場合、MMD モデルは **1つの `Mesh` に複数の `SubMesh`** として読み込まれます。

例えば、MMD モデルに 3つのマテリアルがある場合、このモデルは **1つの `Mesh` に 3つの `SubMesh`** として読み込まれ、**`MultiMaterial` が使用**され、各 `SubMesh` に別々の `Material` が割り当てられます。

```typescript
// マテリアルに基づいて複数の SubMeshes で読み込まれた MMD モデル
Mesh1 {
    subMeshes: [
        SubMesh1,
        SubMesh2,
        SubMesh3
    ],
    material: MultiMaterial {
        materials: [
            Material1,
            Material2,
            Material3
        ]
    }
}
```

この値が **`true`** の場合、MMD モデルはマテリアルの数に基づいて **複数の `Mesh` に分割**されます。**各 `Mesh` には 1つの `SubMesh` しかありません**。

```typescript
// マテリアルに基づいて複数の Meshes に分割された MMD モデル
Mesh1 {
    children: [
        Mesh2 {
            subMeshes: [ SubMesh1 ],
            material: Material1
        },
        Mesh3 {
            subMeshes: [ SubMesh2 ],
            material: Material2
        },
        Mesh4 {
            subMeshes: [ SubMesh3 ],
            material: Material3
        }
    ]
}
```

この場合、1つのジオメトリを複数の部分に分割するプロセスで**情報損失が発生する可能性があります**。

状況によっては、**このオプションを `false` に設定する方が良いパフォーマンスを提供する**場合があります。

### optimizeSingleMaterialModel

**シングルマテリアルモデルの最適化を有効にするかどうか**を設定します。\
デフォルト値は **`true`** です。

**optimizeSubmeshes が `true`** の場合、MMD モデルが単一のマテリアルを使用する場合でも、**ルートメッシュの下に 1つのメッシュ**として読み込まれます。
この場合、ジオメトリをルートメッシュに含めることで **1つの `Mesh` インスタンスに最適化**することができ、この最適化は **optimizeSingleMaterialModel が `true`** の場合に適用されます。

```typescript
// optimizeSingleMaterialModel: false, optimizeSubmeshes: true で読み込まれた 1つのマテリアルを使用する MMD モデル
Mesh1 {
    children: [
        Mesh2 {
            subMeshes: [ SubMesh1 ],
            material: Material1
        }
    ]
}
```

```typescript
// optimizeSingleMaterialModel: true, optimizeSubmeshes: true で読み込まれた 1つのマテリアルを使用する MMD モデル
Mesh1 {
    subMeshes: [ SubMesh1 ]
}
```

**optimizeSubmeshes が `false`** の場合、このオプションは **無視**されます。

## さらに進む

babylon-mmd は、複数のユースケースをサポートするための **様々な読み込みオプション**と、**MMD の動作を再現するためのいくつかの機能**を提供しています。

- **BMP テクスチャの読み込みの問題** - **BMP テクスチャが正しく読み込まれない問題**については、**[Fix BMP Texture Loader](./fix-bmp-texture-loader)** を参照してください。
- **モデル変形の問題** - **モデルの変形が MMD と異なる問題**については、**[SDEF Support](./sdef-support)** を参照してください。
- **マテリアルビルダー** - **マテリアルビルダー**に関する詳細情報については、**[Material Builder](./material-builder)** を参照してください。
- **MMD スタンダードマテリアル** - **MMD シェーダーを再現する MMD スタンダードマテリアル**に関する詳細情報については、**[MMD Standard Material](./mmd-standard-material)** を参照してください。
- **BPMX** - **PMX/PMD ファイルの変換と最適化**に関する詳細情報については、**[The Babylon PMX Format](./the-babylon-pmx-format)** を参照してください。
