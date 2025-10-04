---
sidebar_position: 5
sidebar_label: 물리 시뮬레이션 추가
---

# 물리 시뮬레이션 추가

이제 **물리 시뮬레이션을 추가**해 보겠습니다.

## MMD WASM 인스턴스 준비

먼저 물리 시뮬레이션을 위해 **물리 엔진 구현**이 포함된 **MMD WASM 인스턴스**가 필요합니다.

이 오브젝트는 **MMD 런타임**과 **Bullet Physics** 엔진 바인딩을 제공하는 **WebAssembly 모듈**입니다. 이 예제에서는 **물리 엔진 기능**만 사용합니다.

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

## MultiPhysicsRuntime 생성 및 등록

**MMD WASM 인스턴스**를 사용하여 **MultiPhysicsRuntime** 오브젝트를 생성합니다. 이 오브젝트는 **여러 Physics World**를 동시에 처리하는 **시뮬레이션 런타임**이며 내부적으로 **Bullet Physics**를 사용합니다.

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

여기서는 **`setGravity`** 메서드를 사용하여 **중력 벡터**를 설정합니다. 중력은 **-98**로 설정되며, 이는 **실제 중력 가속도의 10배**입니다. 이는 **MMD 프로그램이 이렇게 구성**되어 있기 때문입니다. (MultiPhysicsRuntime의 기본 중력은 (0, -9.8, 0)입니다.)

**`physicsRuntime.register(scene);`**을 호출하여 **물리 시뮬레이션**을 씬의 **렌더링 루프**에 통합합니다.

## MmdRuntime 생성 시 물리 엔진 전달

이제 **`MultiPhysicsRuntime`**을 사용하여 MMD 모델용 **시뮬레이션 인스턴스**를 생성할 수 있습니다. **`MmdRuntime`** 오브젝트를 생성할 때 생성자에 **`MmdBulletPhysics`** 오브젝트를 전달합니다. 이 오브젝트는 **`MultiPhysicsRuntime`**을 사용하여 MMD 모델의 **물리 시뮬레이션**을 처리하는 로직을 제공합니다.

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

## Promise.all에 WASM 인스턴스 생성 포함

**`GetMmdWasmInstance`**는 **비동기 함수**이므로 다른 비동기 연산과 **병렬로 처리**하기 위해 **`Promise.all`**에 포함시킵니다.

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

## 지면 콜라이더 추가

마지막으로 MMD 모델이 **지면과 충돌**할 수 있도록 **지면 콜라이더를 추가**하겠습니다.

이를 위해 **무한 평면**을 정의하는 **`PhysicsStaticPlaneShape`** 오브젝트를 생성하고, 이를 사용하여 **`RigidBody`** 오브젝트를 만듭니다. 이 **`RigidBody`** 오브젝트는 물리 시뮬레이션에서 **지면** 역할을 합니다.

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

## 결과

![result](@site/docs/get-started/add-physics/result.png)

이제 **물리 시뮬레이션**이 추가되었습니다. MMD 모델의 **머리카락과 의상**이 **자연스럽게** 움직이는 것을 확인할 수 있습니다.

<details>
<summary>전체 코드</summary>
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
