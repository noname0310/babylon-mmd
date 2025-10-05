---
sidebar_position: 4
sidebar_label: オーディオの読み込みと再生
---

# オーディオの読み込みと再生

アニメーションと**同期したオーディオ**を再生します。

## MP3 オーディオファイルのダウンロード

まず、**オーディオファイル**が必要です。使用しているアニメーションのオーディオは [**higma - メランコリ・ナイト / melancholy night feat.初音ミク**](https://www.youtube.com/watch?v=y__uZETTuL8) です。

YouTube to MP3 コンバーターなどのツールを使用して、**MP3 ファイルとしてダウンロード**できます。

**ダウンロードした MP3 ファイル**を **"res/private_test/motion/メランコリ・ナイト/"** フォルダーに配置します。

![vscode-file-structure](@site/docs/get-started/load-and-play-audio/vscode-file-structure.png) \
*フォルダー構造の例*

## ストリームオーディオプレイヤーの作成

**ストリームオーディオプレイヤー**を作成します。このプレイヤーは **HTMLAudioElement** を使用して**ストリーミング方式**でオーディオを再生します。

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import { StreamAudioPlayer } from "babylon-mmd/esm/Runtime/Audio/streamAudioPlayer";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.source = "res/private_test/motion/メランコリ・ナイト/melancholy_night.mp3";
        // highlight-end
        //...
    }
}
```

次に、**オーディオプレイヤー**をランタイムに**設定**します。

```typescript title="src/sceneBuilder.ts"
//...
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        const mmdRuntime = new MmdRuntime(scene);
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);
        // highlight-next-line
        mmdRuntime.setAudioPlayer(audioPlayer);
        mmdRuntime.playAnimation();
        //...
    }
}
```

アニメーションがスムーズに再生されるためには、オーディオを **`playAnimation` を呼び出す前に**設定する必要があります。

**アニメーション再生開始後**にオーディオプレイヤーを設定すると、オーディオと同期する際に**短い不具合**が発生する可能性があります。

<details>
<summary>完全なコード</summary>
```typescript title="src/sceneBuilder.ts"
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
import { VmdLoader } from "babylon-mmd/esm/Loader/vmdLoader";
// highlight-next-line
import { StreamAudioPlayer } from "babylon-mmd/esm/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
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
        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.source = "res/private_test/motion/メランコリ・ナイト/melancholy_night.mp3";
        // highlight-end

        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;
        
        const mmdRuntime = new MmdRuntime(scene);
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);
        // highlight-next-line
        mmdRuntime.setAudioPlayer(audioPlayer);
        mmdRuntime.playAnimation();

        const [mmdAnimation, modelMesh] = await Promise.all([
            vmdLoader.loadAsync("motion",
                [
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_カメラ.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_表情モーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト_リップモーション.vmd",
                    "res/private_test/motion/メランコリ・ナイト/メランコリ・ナイト.vmd"
                ]),
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
        ]);

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

        return scene;
    }
}
```
</details>
