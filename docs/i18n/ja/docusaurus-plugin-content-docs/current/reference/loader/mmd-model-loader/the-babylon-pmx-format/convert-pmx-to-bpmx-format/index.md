---
sidebar_position: 1
sidebar_label: PMX形式をBPMX形式に変換する
---

# PMX形式をBPMX形式に変換する

このセクションでは、**PMX**ファイルを**BPMX**ファイルに変換する方法について説明します。

**PMX**ファイルを**BPMX**ファイルに変換するには、以下の2つの方法があります：

- ウェブアプリケーションを使用して変換する方法
- プログラムを使用して変換する方法

それぞれの方法にはメリットとデメリットがありますので、ニーズに合わせて適切な方法を選択してください。

## コンバーターアプリケーションを使用する

**babylon-mmd**は**PMX/PMD**ファイルを**BPMX**ファイルに変換するためのウェブアプリケーションを提供しています。

以下のリンクからアプリケーションを使用できます。

[PMX to BPMX コンバーター](https://noname0310.github.io/babylon-mmd/pmx_converter/)

![コンバーターUI](@site/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format/bpmx-converter-ui.png)
***PMX to BPMX コンバーター**のスクリーンショット。モデル：[YYB Hatsune Miku_NT](https://bowlroll.net/file/284019)*

1. **PMX/PMDファイルを含むフォルダをドラッグアンドドロップします。**
    - MMDモデルを読み込むために必要なすべてのテクスチャファイルを含んでいる必要があります。

2. **ファイルリストから変換するPMX/PMDファイルを選択すると、右側のシーンにモデルが表示されます。**

3. **最適化オプションを設定します。各オプションは、変換したいモデルの特性に応じて異なる設定が可能です。**
    - ***シリアライゼーションデータの保存***: **babylon-mmd**が使用しない**PMX/PMD**ファイルからのシリアライゼーションデータを保存します。
      - **テクスチャパス**、**マテリアル英語名**、**表示枠**などが含まれます。
      - これは内部的に`loaderOptions.mmdmodel.preserveSerializationData`オプションによって制御されます。
    - ***サブメッシュの最適化***: **サブメッシュ**を個別の**メッシュ**に分離するかどうかを設定します。
      - これは内部的に`loaderOptions.mmdmodel.optimizeSubmeshes`オプションによって制御されます。
    - ***スケルトンの構築***: モデルの**スケルトン**データを保存するかどうかを設定します。
      - ステージのような、スケルトンを必要としないモデルではこのオプションをオフにできます。
    - ***モーフターゲットの構築***: モデルの**モーフターゲット**データを保存するかどうかを設定します。
      - ステージのような、モーフターゲットを必要としないモデルではこのオプションをオフにできます。

4. **マテリアルのレンダリングの問題を修正します。**
   - この手順はオプションです。モデルが正しくレンダリングされている場合は、このステップをスキップできます。
   - この作業については、下記の**マテリアルレンダリング方法の修正**セクションを参照してください。

5. **変換を実行します。**

:::info
名前は「PMX to BPMX コンバーター」ですが、**PMD**ファイルもサポートしています。
:::

![BPMXのダウンロード](@site/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format/bpmx-converter-download.png)
***BPMX**形式でダウンロードされた変換済みファイル。*

### マテリアルレンダリング方法の修正

**BPMX**ファイルは、マテリアルの**アルファ評価**結果をフォーマット内に保存します。

具体的には、**`MmdMaterialRenderMethod.AlphaEvaluation`**または**`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`**メソッドに必要な**アルファ評価**結果をそれぞれ保存します。

この結果は後でモデルを読み込む際に使用され、**アルファ評価**ステップをスキップすることでモデル読み込みプロセスを高速化します。また、アルゴリズムの欠陥により正しくレンダリングされない要素を手動で修正し変換することも可能です。

**Fix Material**タブでは、これらの**アルファ評価**結果を修正するためのUIを提供しています。

![Fix Material UI](@site/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format/bpmx-converter-fixmaterial1.png)
***Fix Material**のAlpha Modeタブ*

**Alpha Mode**は、**`MmdMaterialRenderMethod.AlphaEvaluation`**レンダリングメソッドでモデルがどのように見えるかを表示します。ここで、おかしく見えるマテリアルのレンダリング方法を変更できます。

YYB Hatsune Miku_NTモデルでは、B、B-L、sleeve05のレンダリング方法を**Alpha Blend**に変更すると、より良い結果が得られます。

![Fix Material UI 2](@site/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format/bpmx-converter-fixmaterial2.png)
***Fix Material**のForce Depth Write Modeタブ*

**Force Depth Write Mode**は、**`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`**レンダリングメソッドでモデルがどのように見えるかを表示します。ここで、おかしく見えるマテリアルのレンダリング方法を変更できます。

YYB Hatsune Miku_NTモデルでは、sleeve05のレンダリング方法を**Alpha Blend**に変更すると、より良い結果が得られます。

## プログラムによる変換

**BPMX**変換は、**`BpmxConverter`**によって実行されます。

**`BpmxConverter`**は**`MmdMesh`**を入力として受け取り、**BPMX**形式に変換します。

最も単純な使用例は次のとおりです：

```typescript
const materialBuilder = new MmdStandardMaterialBuilder();
materialBuilder.deleteTextureBufferAfterLoad = false; // 1
const assetContainer = await LoadAssetContainerAsync(
    fileOrUrl,
    scene,
    {
        pluginOptions: {
            mmdmodel: {
                materialBuilder: materialBuilder,
                loggingEnabled: true
            }
        }
    }
);
const mmdMesh = assetContainer.meshes[0] as MmdMesh;

const bpmxConverter = new BpmxConverter();
bpmxConverter.loggingEnabled = true;
const arrayBuffer = bpmxConverter.convert(mmdMesh); // 2
assetContainer.dispose(); // 3
```

1. デフォルトでは、マテリアルビルダーはテクスチャをGPUにアップロードした後にバッファを削除するように設定されています。ただし、これではテクスチャをシリアライズできなくなるため、マテリアルビルダーの**`deleteTextureBufferAfterLoad`**オプションを`false`に設定する必要があります。

2. **`BpmxConverter.convert`**を使用して変換を実行します。この関数は、2番目のパラメータとしてオプションを取ることができます。

3. **`assetContainer.dispose()`**を呼び出してリソースを解放します。**`assetContainer.addAllToScene()`**を使用した場合は、すべてのリソース（ジオメトリ、マテリアル、テクスチャ、モーフターゲットマネージャー、スケルトン）を手動で解放する必要があります。

ただし、上記の例では、**アルファ評価**結果が**BPMX**ファイルに保存されていません。**アルファ評価**結果を保存するには、**`TextureAlphaChecker`**を使用して手動で**アルファ評価**結果を生成し、**`BpmxConverter`**に渡す必要があります。

これらすべてを行う例を以下に示します：

```typescript
const settings = {
    preserveSerializationData: true,
    optimizeSubmeshes: true,
    buildSkeleton: true,
    buildMorph: true
};

const materialBuilder = new MmdStandardMaterialBuilder();
materialBuilder.deleteTextureBufferAfterLoad = false;
materialBuilder.renderMethod = MmdMaterialRenderMethod.AlphaEvaluation;
materialBuilder.forceDisableAlphaEvaluation = true;

const textureAlphaChecker = new TextureAlphaChecker(scene);

const assetContainer = await LoadAssetContainerAsync(
    fileOrUrl,
    scene,
    {
        pluginOptions: {
            mmdmodel: {
                materialBuilder: materialBuilder,
                preserveSerializationData: settings.preserveSerializationData,
                optimizeSubmeshes: settings.optimizeSubmeshes,
                loggingEnabled: true
            }
        }
    }
);
const mmdMesh = assetContainer.meshes[0] as MmdMesh;

const meshes = mmdMesh.metadata.meshes;
const materials = mmdMesh.metadata.materials;
const translucentMaterials: boolean[] = new Array(materials.length).fill(false);
const alphaEvaluateResults: number[] = new Array(materials.length).fill(-1);

for (let i = 0; i < materials.length; ++i) {
    const material = materials[i] as MmdStandardMaterial;

    // collect referenced meshes
    const referencedMeshes: ReferencedMesh[] = [];
    for (let meshIndex = 0; meshIndex < meshes.length; ++meshIndex) {
        const mesh = meshes[meshIndex];
        if ((mesh.material as MultiMaterial).subMaterials !== undefined) {
            const subMaterials = (mesh.material as MultiMaterial).subMaterials;
            for (let subMaterialIndex = 0; subMaterialIndex < subMaterials.length; ++subMaterialIndex) {
                const subMaterial = subMaterials[subMaterialIndex];
                if (subMaterial === material) {
                    referencedMeshes.push({
                        mesh,
                        subMeshIndex: subMaterialIndex
                    });
                }
            }
        } else {
            if (mesh.material === material) referencedMeshes.push(mesh);
        }
    }

    const diffuseTexture = material.diffuseTexture;

    // evaluate DepthWriteAlphaBlendingWithEvaluation renderMethod result manually
    if (material.alpha < 1) {
        translucentMaterials[i] = true;
    } else if (!diffuseTexture) {
        translucentMaterials[i] = false;
    } else {
        translucentMaterials[i] = true;
        for (let referencedMeshIndex = 0; referencedMeshIndex < referencedMeshes.length; ++referencedMeshIndex) {
            const referencedMesh = referencedMeshes[referencedMeshIndex];
            let isOpaque = false;
            if ((referencedMesh as { mesh: Mesh; subMeshIndex: number }).subMeshIndex !== undefined) {
                const { mesh, subMeshIndex } = referencedMesh as { mesh: Mesh; subMeshIndex: number };
                isOpaque = await textureAlphaChecker.hasFragmentsOnlyOpaqueOnGeometryAsync(diffuseTexture, mesh, subMeshIndex);
            } else {
                isOpaque = await textureAlphaChecker.hasFragmentsOnlyOpaqueOnGeometryAsync(diffuseTexture, referencedMesh as Mesh, null);
            }
            if (isOpaque) {
                translucentMaterials[i] = false;
                break;
            }
        }
    }

    // evaluate AlphaEvaluation renderMethod result manually
    if (diffuseTexture !== null) {
        let transparencyMode = Number.MIN_SAFE_INTEGER;
        for (let i = 0; i < referencedMeshes.length; ++i) {
            const referencedMesh = referencedMeshes[i];

            const newTransparencyMode = await textureAlphaChecker.hasTranslucentFragmentsOnGeometryAsync(
                diffuseTexture,
                (referencedMesh as { mesh: Mesh })?.mesh ?? referencedMesh as Mesh,
                (referencedMesh as { subMeshIndex: number })?.subMeshIndex !== undefined
                    ? (referencedMesh as { subMeshIndex: number }).subMeshIndex
                    : null,
                materialBuilder.alphaThreshold,
                materialBuilder.alphaBlendThreshold
            );

            if (transparencyMode < newTransparencyMode) {
                transparencyMode = newTransparencyMode;
            }
        }
        alphaEvaluateResults[i] = transparencyMode !== Number.MIN_SAFE_INTEGER
            ? transparencyMode
            : Material.MATERIAL_OPAQUE;
    } else {
        alphaEvaluateResults[i] = Material.MATERIAL_OPAQUE;
    }
}

const bpmxConverter = new BpmxConverter();
bpmxConverter.loggingEnabled = true;
const arrayBuffer = bpmxConverter.convert(mmdMesh, {
    buildSkeleton: settings.buildSkeleton,
    buildMorph: settings.buildMorph,
    translucentMaterials: translucentMaterials,
    alphaEvaluateResults: alphaEvaluateResults
});
assetContainer.dispose();
```

必要に応じて再利用できるよう、これに関する関数を作成することができます。

より詳細な実装の詳細については、**[PMX to BPMX コンバーターのソース](https://github.com/noname0310/babylon-mmd/blob/main/src/Test/Scene/pmxConverterScene.ts)を参照してください**。

**`BpmxConverter`** APIはさまざまなオプションをサポートしており、すべての仕様に完全に準拠するコードを書くのは非常に難しいですが、必要な機能のみを選択的に使用することで、有用な結果を得ることができます。
