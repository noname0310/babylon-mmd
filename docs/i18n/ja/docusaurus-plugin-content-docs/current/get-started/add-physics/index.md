---
sidebar_position: 5
sidebar_label: Add Physics
---

# Add Physics

Now let's **add physics simulation**.

## Prepare MMD WASM Instance

First, we need an **MMD WASM instance** that includes the **physics engine implementation** for physics simulation.

This object is a **WebAssembly module** that provides **MMD runtime** and **Bullet Physics** engine bindings. In this example, we only use the **physics engine functionality**.

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import { MmdWasmInstanceTypeMPR } from "babylon-mmd/esm/Runtime/Optimized/InstanceType/multiPhysicsRelease";
import { GetMmdWasmInstance } from "babylon-mmd/esm/Runtime/Optimized/mmdWasmInstance";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const wasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeMPR());
        // highlight-end
        //...
    }
}
```

## Create and Register MultiPhysicsRuntime

Use the **MMD WASM instance** to create a **MultiPhysicsRuntime** object. This object is a **simulation runtime** that handles **multiple Physics Worlds** simultaneously and internally uses **Bullet Physics**.

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import { MultiPhysicsRuntime } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/Impl/multiPhysicsRuntime";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const physicsRuntime = new MultiPhysicsRuntime(wasmInstance);
        physicsRuntime.setGravity(new Vector3(0, -98, 0));
        physicsRuntime.register(scene);
        // highlight-end
        //...
    }
}
```

Here we use the **`setGravity`** method to set the **gravity vector**. Gravity is set to **-98**, which is **10 times the actual gravitational acceleration**. This is because **MMD programs are configured this way**. (The default gravity for MultiPhysicsRuntime is (0, -9.8, 0).)

Call **`physicsRuntime.register(scene);`** to integrate the **physics simulation** into the scene's **rendering loop**.

## Pass Physics Engine When Creating MmdRuntime

Now you can use **`MultiPhysicsRuntime`** to create **simulation instances** for MMD models. When creating an **`MmdRuntime`** object, pass an **`MmdBulletPhysics`** object to the constructor. This object provides the logic to handle **physics simulation** for MMD models using **`MultiPhysicsRuntime`**.

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import { MmdBulletPhysics } from "babylon-mmd/esm/Runtime/Optimized/Physics/mmdBulletPhysics";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
        // highlight-end
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);
        mmdRuntime.setAudioPlayer(audioPlayer);
        mmdRuntime.playAnimation();
        //...
    }
}
```

## Include WASM Instance Creation in Promise.all

Since **`GetMmdWasmInstance`** is an **asynchronous function**, we'll include it in **`Promise.all`** to process it **in parallel** with other asynchronous operations.

```typescript title="src/sceneBuilder.ts"
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const [[mmdRuntime, physicsRuntime], mmdAnimation, modelMesh] = await Promise.all([
            (async(): Promise<[MmdRuntime, MultiPhysicsRuntime]> => {
                const wasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeMPR());

                const physicsRuntime = new MultiPhysicsRuntime(wasmInstance);
                physicsRuntime.setGravity(new Vector3(0, -98, 0));
                physicsRuntime.register(scene);

                const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
        // highlight-end
                mmdRuntime.loggingEnabled = true;
                mmdRuntime.register(scene);
                mmdRuntime.setAudioPlayer(audioPlayer);
                mmdRuntime.playAnimation();
                // highlight-next-line
                return [mmdRuntime, physicsRuntime];
            })(),
            //...
        ]);
    }
}
```

## Add Ground Collider

Finally, let's **add a ground collider** so the MMD model can **collide with the ground**.

To do this, we create a **`PhysicsStaticPlaneShape`** object that defines an **infinite plane**, and use it to create a **`RigidBody`** object. This **`RigidBody`** object will serve as the **ground** in the physics simulation.

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import { MotionType } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/motionType";
import { PhysicsStaticPlaneShape } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/physicsShape";
import { RigidBody } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBody";
import { RigidBodyConstructionInfo } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBodyConstructionInfo";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        const info = new RigidBodyConstructionInfo(physicsRuntime.wasmInstance);
        info.motionType = MotionType.Static;
        info.shape = new PhysicsStaticPlaneShape(physicsRuntime, new Vector3(0, 1, 0), 0);
        const groundBody = new RigidBody(physicsRuntime, info);
        physicsRuntime.addRigidBodyToGlobal(groundBody);
        // highlight-end
        
        return scene;
    }
}
```

## Result

![result](@site/docs/get-started/add-physics/result.png)

**Physics simulation** has now been added. You can see the MMD model's **hair and clothing** moving **naturally**.

<details>
<summary>Full code</summary>
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
import { StreamAudioPlayer } from "babylon-mmd/esm/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime";
// highlight-start
import { MmdWasmInstanceTypeMPR } from "babylon-mmd/esm/Runtime/Optimized/InstanceType/multiPhysicsRelease";
import { GetMmdWasmInstance } from "babylon-mmd/esm/Runtime/Optimized/mmdWasmInstance";
import { MultiPhysicsRuntime } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/Impl/multiPhysicsRuntime";
import { MotionType } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/motionType";
import { PhysicsStaticPlaneShape } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/physicsShape";
import { RigidBody } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBody";
import { RigidBodyConstructionInfo } from "babylon-mmd/esm/Runtime/Optimized/Physics/Bind/rigidBodyConstructionInfo";
import { MmdBulletPhysics } from "babylon-mmd/esm/Runtime/Optimized/Physics/mmdBulletPhysics";
// highlight-end

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

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.source = "res/private_test/motion/メランコリ・ナイト/melancholy_night.mp3";

        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;

        // highlight-start
        const [[mmdRuntime, physicsRuntime], mmdAnimation, modelMesh] = await Promise.all([
            (async(): Promise<[MmdRuntime, MultiPhysicsRuntime]> => {
                const wasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeMPR());

                const physicsRuntime = new MultiPhysicsRuntime(wasmInstance);
                physicsRuntime.setGravity(new Vector3(0, -98, 0));
                physicsRuntime.register(scene);

                const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
        // highlight-end
                mmdRuntime.loggingEnabled = true;
                mmdRuntime.register(scene);
                mmdRuntime.setAudioPlayer(audioPlayer);
                mmdRuntime.playAnimation();
                // highlight-next-line
                return [mmdRuntime, physicsRuntime];
            })(),
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

        // highlight-start
        const info = new RigidBodyConstructionInfo(physicsRuntime.wasmInstance);
        info.motionType = MotionType.Static;
        info.shape = new PhysicsStaticPlaneShape(physicsRuntime, new Vector3(0, 1, 0), 0);
        const groundBody = new RigidBody(physicsRuntime, info);
        physicsRuntime.addRigidBodyToGlobal(groundBody);
        // highlight-end

        return scene;
    }
}
```
</details>
