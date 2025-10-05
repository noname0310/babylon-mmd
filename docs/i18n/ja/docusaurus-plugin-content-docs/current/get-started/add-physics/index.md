---
sidebar_position: 5
sidebar_label: 物理演算の追加
---

# 物理演算の追加

ここでは**物理シミュレーションを追加**します。

## MMD WASM インスタンスの準備

まず、物理シミュレーションのために**物理エンジン実装**を含む **MMD WASM インスタンス**が必要です。

このオブジェクトは、**MMD ランタイム**と **Bullet Physics** エンジンのバインディングを提供する **WebAssembly モジュール**です。この例では、**物理エンジン機能**のみを使用します。

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

## MultiPhysicsRuntime の作成と登録

**MMD WASM インスタンス**を使用して **MultiPhysicsRuntime** オブジェクトを作成します。このオブジェクトは、**複数の物理ワールド**を同時に処理し、内部で **Bullet Physics** を使用する**シミュレーションランタイム**です。

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

ここでは **`setGravity`** メソッドを使用して**重力ベクトル**を設定します。重力は **-98** に設定されており、これは**実際の重力加速度の 10 倍**です。これは **MMD プログラムがこのように設定されている**ためです。(MultiPhysicsRuntime のデフォルト重力は (0, -9.8, 0) です。)

**`physicsRuntime.register(scene);`** を呼び出して、**物理シミュレーション**をシーンの**レンダリングループ**に統合します。

## MmdRuntime 作成時に物理エンジンを渡す

これで **`MultiPhysicsRuntime`** を使用して MMD モデルの**シミュレーションインスタンス**を作成できます。**`MmdRuntime`** オブジェクトを作成する際に、**`MmdBulletPhysics`** オブジェクトをコンストラクターに渡します。このオブジェクトは、**`MultiPhysicsRuntime`** を使用して MMD モデルの**物理シミュレーション**を処理するロジックを提供します。

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

## WASM インスタンス作成を Promise.all に含める

**`GetMmdWasmInstance`** は**非同期関数**なので、**`Promise.all`** に含めて他の非同期オペレーションと**並列に処理**します。

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

## グラウンドコライダーの追加

最後に、MMD モデルが**地面と衝突できる**ように**グラウンドコライダーを追加**しましょう。

これを行うために、**無限平面**を定義する **`PhysicsStaticPlaneShape`** オブジェクトを作成し、それを使用して **`RigidBody`** オブジェクトを作成します。この **`RigidBody`** オブジェクトが物理シミュレーション内の**地面**として機能します。

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

## 結果

![result](@site/docs/get-started/add-physics/result.png)

**物理シミュレーション**が追加されました。MMD モデルの**髪や衣服**が**自然に動いている**ことが確認できます。

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
