---
sidebar_position: 2
sidebar_label: MMD モデルの読み込み
---

# MMD モデルの読み込み

ここでは**MMD モデル**をシーンに**読み込み**、**シャドウを追加**します。

## PMX モデルのダウンロード

まず、読み込むための **PMX モデル**が必要です。

この例では [**YYB Hatsune Miku 10th Anniversary**](https://www.deviantart.com/sanmuyyb/art/YYB-Hatsune-Miku-10th-DL-702119716) モデルを使用します。

**モデルをダウンロード**し、解凍して **`res/private_test/model/`** フォルダーに配置します。

![vscode-file-structure](@site/docs/get-started/load-mmd-model/vscode-file-structure.png) \
*モデルフォルダー構造の例*

## 必要なサイドエフェクトのインポート

まず、モデルを読み込むために必要な**サイドエフェクト**をインポートします。

```typescript title="src/sceneBuilder.ts"
//...
// highlight-start
import "babylon-mmd/esm/Loader/pmxLoader";
import "babylon-mmd/esm/Loader/mmdOutlineRenderer";
// highlight-end
//...
```

**babylon-mmd** は **Babylon.js の SceneLoader** を拡張して **PMX/PMD モデル**の読み込みを可能にします。

**PMD モデル**を読み込むには、**`babylon-mmd/esm/Loader/pmdLoader`** をインポートし、以下で説明する PMX モデルの読み込みと同じメソッドを使用します。

**`mmdOutlineRenderer`** は、MMD モデルの**アウトラインを描画する**機能を提供します。**アウトラインのレンダリングが不要**な場合は、インポートする必要はありません。

## PMX モデルの読み込み

**`LoadAssetContainerAsync`** ファンクションを使用してモデルを読み込みます。**`pluginOptions`** 内の **`mmdmodel`** オプションを指定することで、MMD モデルローダーに必要な設定を渡すことができます。

```typescript title="src/sceneBuilder.ts"
//...
// highlight-next-line
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
//...
// highlight-next-line
import { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder";
//...
// highlight-next-line
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
//...

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        // highlight-next-line
        const materialBuilder = new MmdStandardMaterialBuilder();
        const scene = new Scene(engine);
        // ...
        // highlight-start
        const modelMesh = await LoadAssetContainerAsync(
            "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
            scene,
            {
                pluginOptions: {
                    mmdmodel: {
                        loggingEnabled: true,
                        materialBuilder: materialBuilder
                    }
                }
            }).then(result => {
                result.addAllToScene();
                return result.rootNodes[0] as MmdMesh;
            });
        // highlight-end

        return scene;
    }
}
```

モデルの読み込み時に **`pluginOptions.mmdmodel`** オプションに渡す設定は以下の通りです:
- **`loggingEnabled`**: 読み込みプロセス中にログを出力するかどうか。**デバッグに便利**です。
- **`materialBuilder`**: MMD モデルのマーテリアルを作成するための実装を指定します。**`MmdStandardMaterialBuilder`** は、基本的な MMD マーテリアルを作成するためのデフォルト実装です。**カスタムマーテリアル**を使用したい場合は、**`IMmdMaterialBuilder`** インターフェースを実装して渡すことができます。

モデルが読み込まれると、**`AssetContainer`** が返されます。**`addAllToScene`** メソッドを呼び出してモデルをシーンに追加します。
モデルの**ルートノード**は、**`rootNodes`** 配列の**最初の要素**としてアクセスできます。**MMD モデル**の場合、最初のルートノードは常に **`MmdMesh`** を満たします。

## モデルへのシャドウの追加

モデルに**シャドウを追加**するには、先ほど作成した **`ShadowGenerator`** にモデルを追加します。

```typescript title="src/sceneBuilder.ts"
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);
        // highlight-end
        return scene;
    }
}
//...
```

**MMD モデル**は、マーテリアルによって分割された**複数のメッシュ**で構成されています。そのため、**`modelMesh.metadata.meshes`** 配列を反復処理し、各メッシュが**シャドウを受け取る**ように設定します。

## 結果

ブラウザで確認すると、**モデルが読み込まれている**ことが確認できます。

![result](@site/docs/get-started/load-mmd-model/result.png)

<details>
<summary>完全なコード</summary>
```typescript title="src/sceneBuilder.ts"
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
// highlight-start
import "babylon-mmd/esm/Loader/pmxLoader";
import "babylon-mmd/esm/Loader/mmdOutlineRenderer";
// highlight-end

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
// highlight-next-line
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { Scene } from "@babylonjs/core/scene";
// highlight-next-line
import { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder";
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";
// highlight-next-line
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        // highlight-next-line
        const materialBuilder = new MmdStandardMaterialBuilder();
        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);

        const mmdCamera = new MmdCamera("MmdCamera", new Vector3(0, 10, 0), scene);

        const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 1.0;
        directionalLight.autoCalcShadowZBounds = true;

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = CreateGround("ground1", { width: 100, height: 100, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;

        // highlight-start
        const modelMesh = await LoadAssetContainerAsync(
            "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
            scene,
            {
                pluginOptions: {
                    mmdmodel: {
                        loggingEnabled: true,
                        materialBuilder: materialBuilder
                    }
                }
            }).then(result => {
                result.addAllToScene();
                return result.rootNodes[0] as MmdMesh;
            });

        for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);
        // highlight-end

        return scene;
    }
}
```
</details>
