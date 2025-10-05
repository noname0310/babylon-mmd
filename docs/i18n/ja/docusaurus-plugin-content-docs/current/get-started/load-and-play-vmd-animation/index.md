---
sidebar_position: 3
sidebar_label: VMD アニメーションの読み込みと再生
---

# VMD アニメーションの読み込みと再生

ここでは **VMD アニメーションを読み込んで再生**します。

## VMD アニメーションのダウンロード

まず、読み込むための **VMD アニメーション**が必要です。

この例では、ほうき堂による [**メランコリ・ナイト**](https://www.nicovideo.jp/watch/sm41164308) の動画と一緒に配布されている [**VMD アニメーション**](https://bowlroll.net/file/286064)を使用します。

**アニメーションをダウンロード**し、解凍して **`res/private_test/motion/`** フォルダーに配置します。

![vscode-file-structure](@site/docs/get-started/load-and-play-vmd-animation/vscode-file-structure.png) \
*モーションフォルダー構造の例*

## VMD アニメーションの読み込み

**`VmdLoader`** クラスを使用して VMD アニメーションを読み込みます。

```typescript title="src/sceneBuilder.ts"
//...
// highlight-next-line
import { VmdLoader } from "babylon-mmd/esm/Loader/vmdLoader";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;

        const [mmdAnimation, modelMesh] = await Promise.all([
            vmdLoader.loadAsync("motion",
                [
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_カメラ.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_表情モーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_リップモーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト.vmd"
                ]),
        // highlight-end
            LoadAssetContainerAsync(
                "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
                scene,
                {
                    pluginOptions: {
                        mmdmodel: {
                            loggingEnabled: true,
                            materialBuilder: materialBuilder
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.rootNodes[0] as MmdMesh;
            })
        // highlight-start
        ]);
        // highlight-end
        //...

        return scene;
    }
```

**VMD アニメーション**と **PMX モデル**の両方がネットワーク経由で読み込まれるため、**`Promise.all`** を使用して**並列に読み込む**ことができます。

そのため、**`vmdLoader.loadAsync`** と **`LoadAssetContainerAsync`** の非同期オペレーションを一緒に実行します。

### loadAsync メソッド

**`loadAsync`** メソッドの**最初の引数**は**アニメーション名**です。この名前は後で内部的に識別に使用されます。

**2番目の引数**は、読み込む **VMD ファイル URL の配列**または**単一の URL** です。**複数の VMD ファイル**を指定すると、指定された順序で**1つのアニメーションにマージ**されます。

:::info
この例では、**カメラモーションとダンスモーション**を1つのアニメーションに**マージ**しています。これは、MMD アニメーションが**モデルモーションデータ**と**カメラモーションデータ**を別々に管理しているため可能です。

**N人が踊る**アニメーションを再生したい場合は、各モデルに対して**個別のアニメーション**を作成する必要があります。
:::

## MMD ランタイムの作成

**`VmdLoader`** で読み込んだアニメーションを再生するには、**`MmdRuntime`** インスタンスによって制御される **`MmdModel`** または **`MmdCamera`** が必要です。

そのため、まず **`MmdRuntime`** インスタンスを作成します。

```typescript title="src/sceneBuilder.ts"
//...
// highlight-next-line
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const mmdRuntime = new MmdRuntime(scene);
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);
        mmdRuntime.playAnimation();
        // highlight-end
        //...
        return scene;
    }
}
```

**`MmdRuntime`** は **MMD モデルとカメラ**を管理し、**アニメーションの再生**を処理します。**`register`** メソッドを呼び出してシーンに更新ロジックを登録し、**`playAnimation`** メソッドを呼び出してアニメーションの再生を開始します。

**データがなくても**再生することが可能で、この場合、アニメーション再生中に**リソースを動的に追加**することができます。

## アニメーションのバインド

**`MmdRuntime`** インスタンスを作成した後、**`createRuntimeAnimation`** メソッドを使用して **`MmdModel`** と **`MmdCamera`** にアニメーションを適用します。

```typescript title="src/sceneBuilder.ts"
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        const [mmdAnimation, modelMesh] = await Promise.all([
            //...
        ]);

        // highlight-start
        const cameraAnimationHandle = mmdCamera.createRuntimeAnimation(mmdAnimation);
        mmdCamera.setRuntimeAnimation(cameraAnimationHandle);
        mmdRuntime.addAnimatable(mmdCamera);    

        {
            for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(modelMesh);

            const mmdModel = mmdRuntime.createMmdModel(modelMesh);
            const modelAnimationHandle = mmdModel.createRuntimeAnimation(mmdAnimation);
            mmdModel.setRuntimeAnimation(modelAnimationHandle);
        }
        // highlight-end
        
        return scene;
    }
}
```

**`createRuntimeAnimation`** メソッドを使用して、**`MmdAnimation`** をカメラやモデルに**バインド**できます。

### 必要なサイドエフェクトのインポート

アニメーションを再生するために必要な**サイドエフェクト**をインポートします。

```typescript title="src/sceneBuilder.ts"
//...
// highlight-start
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
// highlight-end
//...
```

**babylon-mmd** は、**MMD モデルとカメラ**にアニメーションを適用するためのさまざまな実装を提供しています。

**`mmdRuntimeCameraAnimation`** と **`mmdRuntimeModelAnimation`** は、**最もよく使われる**カメラとモデルのアニメーション実装です。

これらの**サイドエフェクト**をインポートしないと、**`createRuntimeAnimation`** メソッドが**ランタイムエラー**を引き起こします。

## 結果

シーンを実行すると、**アニメーションが再生されている**ことが確認できます。

![result](@site/docs/get-started/load-and-play-vmd-animation/result.png)

<details>
<summary>完全なコード</summary>
```typescript title="src/sceneBuilder.ts"
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "babylon-mmd/esm/Loader/pmxLoader";
import "babylon-mmd/esm/Loader/mmdOutlineRenderer";
// highlight-start
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
// highlight-end

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { Scene } from "@babylonjs/core/scene";
import { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder";
// highlight-next-line
import { VmdLoader } from "babylon-mmd/esm/Loader/vmdLoader";
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
// highlight-next-line
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
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
        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;

        const mmdRuntime = new MmdRuntime(scene);
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);
        mmdRuntime.playAnimation();

        const [mmdAnimation, modelMesh] = await Promise.all([
            vmdLoader.loadAsync("motion",
                [
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_カメラ.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_表情モーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_リップモーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト.vmd"
                ]),
        // highlight-end
            LoadAssetContainerAsync(
                "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
                scene,
                {
                    pluginOptions: {
                        mmdmodel: {
                            loggingEnabled: true,
                            materialBuilder: materialBuilder
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.rootNodes[0] as MmdMesh;
            })
        // highlight-start
        ]);

        const cameraAnimationHandle = mmdCamera.createRuntimeAnimation(mmdAnimation);
        mmdCamera.setRuntimeAnimation(cameraAnimationHandle);
        mmdRuntime.addAnimatable(mmdCamera);

        {
        // highlight-end
            for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(modelMesh);
        // highlight-start
            const mmdModel = mmdRuntime.createMmdModel(modelMesh);
            const modelAnimationHandle = mmdModel.createRuntimeAnimation(mmdAnimation);
            mmdModel.setRuntimeAnimation(modelAnimationHandle);
        }
        // highlight-end

        return scene;
    }
}
```
</details>
