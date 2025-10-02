---
sidebar_position: 6
sidebar_label: Scene Details
---

# Scene Details

Finally, we'll configure the **detailed scene settings**. In this step, we perform the following tasks:

- **Show Loading Screen**: Display a loading screen while models and animations are loading.
- **Add SDEF (Spherical Deformation) Support**: Add shader support to the engine for models that use SDEF.
- **Register BMP Texture Loader**: Register a BMP texture loader to properly load BMP textures from MMD models.
- **Show Player Control**: Display a player control UI to control animation playback.

## Show Loading Screen

Let's look at how to **display a loading screen** while the scene is loading and **update the loading status**.

First, import **`"@babylonjs/core/Loading/loadingScreen"`** to enable loading screen functionality.

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import "@babylonjs/core/Loading/loadingScreen";
//...
```

To **display the loading screen**, call **`engine.displayLoadingUI()`**, and when loading is complete, call **`engine.hideLoadingUI()`**.

It's best to set the timing to **hide the loading screen** after the scene's **first rendering is complete** using **`scene.onAfterRenderObservable`**.

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

### Loading Status Update

The **`loadAsync`** method of vmdLoader and the **`LoadAssetContainerAsync`** function support an **`onProgress`** callback that provides **loading progress information**.

You can use this to **update the loading status**.

However, since the **WebAssembly-implemented MMD physics engine** initialization has no way to track progress, we only update the status at **loading start and completion** points.

We'll use **`engine.loadingUIText`** to show the loading status.

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

## Add SDEF Support

**SDEF (Spherical Deformation)** is one of the **skinning methods** used in MMD models. To properly render models that use SDEF, **shader support for SDEF** is required.

**babylon-mmd** provides the **`SdefInjector`** utility that adds SDEF support by **overriding shader compilation functions**. This is a **very tricky method**, but it's necessary to ensure **MMD behavior is properly reproduced**.

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

## Register BMP Texture Loader

Due to **differences in BMP texture loader implementations** between MMD and browsers, you need to **register a separate BMP texture loader** to properly load BMP textures from MMD models in Babylon.js.

The **"YYB Hatsune Miku_10th"** model currently used in this example **doesn't use BMP textures**, so you can skip this step and the model will still display correctly. However, when loading **models that use BMP textures**, textures may not display correctly if you don't perform this step.

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

## Show Player Control

**babylon-mmd** provides the **`MmdPlayerControl`** utility for **controlling MMD animation playback**. You can use this utility to display a **control UI similar to a video player**.

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

**`MmdPlayerControl`** is **not a production-ready UI component** and is provided simply for **testing MMD animation playback**. Therefore, it's recommended to **implement your own UI** for production environments.

## Result

import ResultVideo from "./2025-10-02 21-18-26.mp4";

<video src={ResultVideo} controls width="100%"></video>

Now a **loading screen is displayed** while the scene loads, and the **player control UI** appears.

<details>
<summary>Full code</summary>
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

## What's Next?

You've now learned all the **basic usage of babylon-mmd**! Next, take a look at the [**Reference**](../../reference/) section. This section provides detailed explanations of **various options and advanced features**.
