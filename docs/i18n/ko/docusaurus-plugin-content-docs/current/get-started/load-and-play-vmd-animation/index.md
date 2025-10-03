---
sidebar_position: 3
sidebar_label: Load and Play VMD Animation
---

# Load and Play VMD Animation

Now let's **load and play VMD animations**.

## Download VMD Animation

First, we need a **VMD animation** to load.

This example uses the [**VMD animation**](https://bowlroll.net/file/286064) distributed with the [**メランコリ・ナイト**](https://www.nicovideo.jp/watch/sm41164308) video by ほうき堂.

**Download the animation**, extract it, and place it in the **`res/private_test/motion/`** folder.

![vscode-file-structure](@site/docs/get-started/load-and-play-vmd-animation/vscode-file-structure.png) \
*Motion folder structure example*

## Load VMD Animation

Use the **`VmdLoader`** class to load VMD animations.

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

Since both **VMD animations** and **PMX models** are loaded over the network, we can use **`Promise.all`** to load them **in parallel**.

Therefore, we execute the **`vmdLoader.loadAsync`** and **`LoadAssetContainerAsync`** asynchronous operations together.

### loadAsync Method

The **first argument** of the **`loadAsync`** method is the **animation name**. This name is used internally for identification later.

The **second argument** is either an **array of VMD file URLs** or a **single URL** to load. If you specify **multiple VMD files**, they are **merged into one animation** in the specified order.

:::info
This example **merges camera motion and dance motion** into a single animation. This is possible because MMD animations manage **model motion data** and **camera motion data** separately.

If you want to play animations with **N people dancing**, you need to create **separate animations** for each model.
:::

## Create MMD Runtime

To play animations loaded with **`VmdLoader`**, you need **`MmdModel`** or **`MmdCamera`** controlled by an **`MmdRuntime`** instance.

Therefore, first create an **`MmdRuntime`** instance.

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

**`MmdRuntime`** manages **MMD models and cameras** and handles **animation playback**. Call the **`register`** method to register update logic to the scene, and call the **`playAnimation`** method to start animation playback.

It's possible to play even **without any data**, and in this case, you can **dynamically add resources** during animation playback.

## Bind Animation

After creating the **`MmdRuntime`** instance, use the **`createRuntimeAnimation`** method to apply animations to **`MmdModel`** and **`MmdCamera`**.

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

You can **bind `MmdAnimation`** to cameras or models using the **`createRuntimeAnimation`** method.

### Import Required Side Effects

Import the **side effects** needed to play animations.

```typescript title="src/sceneBuilder.ts"
//...
// highlight-start
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
// highlight-end
//...
```

**babylon-mmd** provides various implementations for applying animations to **MMD models and cameras**.

**`mmdRuntimeCameraAnimation`** and **`mmdRuntimeModelAnimation`** are the **most commonly used** camera and model animation implementations.

If you don't import these **side effects**, the **`createRuntimeAnimation`** method will cause a **runtime error**.

## Result

Now when you run the scene, you can see the **animation playing**.

![result](@site/docs/get-started/load-and-play-vmd-animation/result.png)

<details>
<summary>Full code</summary>
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
