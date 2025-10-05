---
sidebar_position: 6
sidebar_label: シーンの詳細設定
---

# シーンの詳細設定

最後に、**シーンの詳細設定**を構成します。このステップでは、以下のタスクを実行します:

- **ローディングスクリーンの表示**: モデルとアニメーションの読み込み中にローディングスクリーンを表示します。
- **SDEF (球面変形) サポートの追加**: SDEF を使用するモデルのためにエンジンにシェーダーサポートを追加します。
- **BMP テクスチャローダーの登録**: MMD モデルから BMP テクスチャを正しく読み込むために BMP テクスチャローダーを登録します。
- **プレイヤーコントロールの表示**: アニメーション再生を制御するためのプレイヤーコントロール UI を表示します。

## ローディングスクリーンの表示

シーンの読み込み中に**ローディングスクリーンを表示**し、**読み込みステータスを更新**する方法を見てみましょう。

まず、**`"@babylonjs/core/Loading/loadingScreen"`** をインポートしてローディングスクリーン機能を有効にします。

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import "@babylonjs/core/Loading/loadingScreen";
//...
```

**ローディングスクリーンを表示**するには **`engine.displayLoadingUI()`** を呼び出し、読み込みが完了したら **`engine.hideLoadingUI()`** を呼び出します。

**ローディングスクリーンを非表示にするタイミング**は、**`scene.onAfterRenderObservable`** を使用してシーンの**最初のレンダリングが完了した後**に設定するのが最適です。

```typescript title="src/sceneBuilder.ts"
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        // highlight-next-line
        engine.displayLoadingUI();

        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;

        const [[mmdRuntime, physicsRuntime], mmdAnimation, modelMesh] = await Promise.all([
            //...
        ]);

        // highlight-start
        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());
        // highlight-end
        //...
    }
}
```

### ローディングステータスの更新

vmdLoader の **`loadAsync`** メソッドと **`LoadAssetContainerAsync`** 関数は、**読み込み進捗情報**を提供する **`onProgress`** コールバックをサポートしています。

これを使用して**ローディングステータスを更新**できます。

ただし、**WebAssembly 実装の MMD 物理エンジン**の初期化には進捗を追跡する方法がないため、**読み込み開始と完了**のポイントでのみステータスを更新します。

ローディングステータスを表示するために **`engine.loadingUIText`** を使用します。

```typescript title="src/sceneBuilder.ts"
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        const loadingTexts: string[] = [];
        const updateLoadingText = (updateIndex: number, text: string): void => {
            loadingTexts[updateIndex] = text;
            engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
        };
        // highlight-end

        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;

        const [[mmdRuntime, physicsRuntime], mmdAnimation, modelMesh] = await Promise.all([
            (async(): Promise<[MmdRuntime, MultiPhysicsRuntime]> => {
                // highlight-next-line
                updateLoadingText(0, "Loading mmd runtime...");
                const wasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeMPR());
                // highlight-next-line
                updateLoadingText(0, "Loading mmd runtime... Done");

                const physicsRuntime = new MultiPhysicsRuntime(wasmInstance);
                physicsRuntime.setGravity(new Vector3(0, -98, 0));
                physicsRuntime.register(scene);

                const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
                mmdRuntime.loggingEnabled = true;
                mmdRuntime.register(scene);
                mmdRuntime.setAudioPlayer(audioPlayer);
                mmdRuntime.playAnimation();
                return [mmdRuntime, physicsRuntime];
            })(),
            vmdLoader.loadAsync("motion",
                [
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_カメラ.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_表情モーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_リップモーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト.vmd"
                ],
                // highlight-next-line
                (event) => updateLoadingText(0, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)),
            LoadAssetContainerAsync(
                "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
                scene,
                {
                    // highlight-next-line
                    onProgress: (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`),
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
        ]);
        //...
    }
}
```

## SDEF サポートの追加

**SDEF (球面変形)** は、MMD モデルで使用される**スキニングメソッド**の 1 つです。SDEF を使用するモデルを適切にレンダリングするには、**SDEF のシェーダーサポート**が必要です。

**babylon-mmd** は、**シェーダーコンパイル関数をオーバーライド**することで SDEF サポートを追加する **`SdefInjector`** ユーティリティを提供しています。これは**非常にトリッキーな方法**ですが、**MMD の動作を適切に再現**するために必要です。

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import { SdefInjector } from "babylon-mmd/esm/Loader/sdefInjector";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        // highlight-start
        SdefInjector.OverrideEngineCreateEffect(engine);
        // highlight-end
        //...
    }
}
```

## BMP テクスチャローダーの登録

MMD とブラウザ間の **BMP テクスチャローダー実装の違い**のため、Babylon.js で MMD モデルから BMP テクスチャを正しく読み込むには、**個別の BMP テクスチャローダーを登録**する必要があります。

この例で現在使用している **"YYB Hatsune Miku_10th"** モデルは **BMP テクスチャを使用していない**ため、このステップをスキップしてもモデルは正しく表示されます。しかし、**BMP テクスチャを使用するモデル**を読み込む場合、このステップを実行しないとテクスチャが正しく表示されない可能性があります。

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import { RegisterDxBmpTextureLoader } from "babylon-mmd/esm/Loader/registerDxBmpTextureLoader";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        RegisterDxBmpTextureLoader();
        // highlight-end
        //...
    }
}
```

## プレイヤーコントロールの表示

**babylon-mmd** は、**MMD アニメーションの再生を制御**するための **`MmdPlayerControl`** ユーティリティを提供しています。このユーティリティを使用して、**ビデオプレイヤーに似たコントロール UI** を表示できます。

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import { MmdPlayerControl } from "babylon-mmd/esm/Runtime/Util/mmdPlayerControl";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();
        // highlight-end
        //...
    }
}
```

**`MmdPlayerControl`** は**プロダクション対応の UI コンポーネントではなく**、単に **MMD アニメーションの再生をテストするため**に提供されています。そのため、プロダクション環境では**独自の UI を実装**することをお勧めします。

## 結果

import ResultVideo from "@site/docs/get-started/scene-details/2025-10-02 21-18-26.mp4";

<video src={ResultVideo} controls width="100%"></video>

シーンの読み込み中に**ローディングスクリーンが表示され**、**プレイヤーコントロール UI** が表示されるようになりました。

<details>
<summary>完全なコード</summary>
```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "babylon-mmd/esm/Loader/pmxLoader";
import "babylon-mmd/esm/Loader/mmdOutlineRenderer";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { Scene } from "@babylonjs/core/scene";
import { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder";
// highlight-start
import { RegisterDxBmpTextureLoader } from "babylon-mmd/esm/Loader/registerDxBmpTextureLoader";
import { SdefInjector } from "babylon-mmd/esm/Loader/sdefInjector";
// highlight-end
import { VmdLoader } from "babylon-mmd/esm/Loader/vmdLoader";
import { StreamAudioPlayer } from "babylon-mmd/esm/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime";
import { MmdWasmInstanceTypeMPR } from "babylon-mmd/esm/Runtime/Optimized/InstanceType/multiPhysicsRelease";
import { GetMmdWasmInstance } from "babylon-mmd/esm/Runtime/Optimized/mmdWasmInstance";
import { MultiPhysicsRuntime } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/Impl/multiPhysicsRuntime";
import { MotionType } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/motionType";
import { PhysicsStaticPlaneShape } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/physicsShape";
import { RigidBody } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBody";
import { RigidBodyConstructionInfo } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBodyConstructionInfo";
import { MmdBulletPhysics } from "babylon-mmd/esm/Runtime/Optimized/Physics/mmdBulletPhysics";
// highlight-next-line
import { MmdPlayerControl } from "babylon-mmd/esm/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        // highlight-start
        SdefInjector.OverrideEngineCreateEffect(engine);
        RegisterDxBmpTextureLoader();
        // highlight-end

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

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.source = "res/private_test/motion/メランコリ・ナイト/melancholy_night.mp3";

        // highlight-start
        // show loading screen
        engine.displayLoadingUI();

        const loadingTexts: string[] = [];
        const updateLoadingText = (updateIndex: number, text: string): void => {
            loadingTexts[updateIndex] = text;
            engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
        };
        // highlight-end

        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;

        const [[mmdRuntime, physicsRuntime], mmdAnimation, modelMesh] = await Promise.all([
            (async(): Promise<[MmdRuntime, MultiPhysicsRuntime]> => {
                // highlight-next-line
                updateLoadingText(0, "Loading mmd runtime...");
                const wasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeMPR());
                // highlight-next-line
                updateLoadingText(0, "Loading mmd runtime... Done");

                const physicsRuntime = new MultiPhysicsRuntime(wasmInstance);
                physicsRuntime.setGravity(new Vector3(0, -98, 0));
                physicsRuntime.register(scene);

                const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
                mmdRuntime.loggingEnabled = true;
                mmdRuntime.register(scene);
                mmdRuntime.setAudioPlayer(audioPlayer);
                mmdRuntime.playAnimation();
                return [mmdRuntime, physicsRuntime];
            })(),
            vmdLoader.loadAsync("motion",
                [
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_カメラ.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_表情モーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_リップモーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト.vmd"
                ],
                // highlight-next-line
                (event) => updateLoadingText(0, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)),
            LoadAssetContainerAsync(
                "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
                scene,
                {
                    // highlight-next-line
                    onProgress: (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`),
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
        ]);

        // highlight-start
        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();
        // highlight-end

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

        const info = new RigidBodyConstructionInfo(physicsRuntime.wasmInstance);
        info.motionType = MotionType.Static;
        info.shape = new PhysicsStaticPlaneShape(physicsRuntime, new Vector3(0, 1, 0), 0);
        const groundBody = new RigidBody(physicsRuntime, info);
        physicsRuntime.addRigidBodyToGlobal(groundBody);

        return scene;
    }
}
```
</details>

## 次のステップ

**babylon-mmd の基本的な使い方**をすべて学習しました！次に、[**リファレンス**](../../reference/) セクションをご覧ください。このセクションでは、**さまざまなオプションや高度な機能**の詳細な説明が提供されています。
