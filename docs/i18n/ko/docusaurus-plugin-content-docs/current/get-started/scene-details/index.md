---
sidebar_position: 6
sidebar_label: 씬 세부 설정
---

# 씬 세부 설정

마지막으로 **씬의 세부 설정**을 구성하겠습니다. 이 단계에서는 다음 작업을 수행합니다:

- **로딩 스크린 표시**: 모델과 애니메이션이 로드되는 동안 로딩 스크린을 표시합니다.
- **SDEF (Spherical Deformation) 지원 추가**: SDEF를 사용하는 모델을 위해 엔진에 셰이더 지원을 추가합니다.
- **BMP 텍스처 로더 등록**: MMD 모델의 BMP 텍스처를 올바르게 로드하기 위해 BMP 텍스처 로더를 등록합니다.
- **플레이어 컨트롤 표시**: 애니메이션 재생을 제어할 수 있는 플레이어 컨트롤 UI를 표시합니다.

## 로딩 스크린 표시

씬이 로드되는 동안 **로딩 스크린을 표시**하고 **로딩 상태를 업데이트**하는 방법을 살펴보겠습니다.

먼저 로딩 스크린 기능을 활성화하기 위해 **`"@babylonjs/core/Loading/loadingScreen"`**을 임포트합니다.

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import "@babylonjs/core/Loading/loadingScreen";
//...
```

**로딩 스크린을 표시**하려면 **`engine.displayLoadingUI()`**를 호출하고, 로딩이 완료되면 **`engine.hideLoadingUI()`**를 호출합니다.

**로딩 스크린을 숨기는** 타이밍은 **`scene.onAfterRenderObservable`**을 사용하여 씬의 **첫 렌더링이 완료된 후**로 설정하는 것이 가장 좋습니다.

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

### 로딩 상태 업데이트

vmdLoader의 **`loadAsync`** 메서드와 **`LoadAssetContainerAsync`** 함수는 **로딩 진행 정보**를 제공하는 **`onProgress`** 콜백을 지원합니다.

이를 사용하여 **로딩 상태를 업데이트**할 수 있습니다.

하지만 **WebAssembly로 구현된 MMD 물리 엔진** 초기화는 진행 상황을 추적할 방법이 없으므로, **로딩 시작과 완료** 시점에만 상태를 업데이트합니다.

로딩 상태를 표시하기 위해 **`engine.loadingUIText`**를 사용하겠습니다.

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

## SDEF 지원 추가

**SDEF (Spherical Deformation)**는 MMD 모델에서 사용되는 **스키닝 메서드** 중 하나입니다. SDEF를 사용하는 모델을 올바르게 렌더링하려면 **SDEF에 대한 셰이더 지원**이 필요합니다.

**babylon-mmd**는 **셰이더 컴파일 함수를 오버라이드**하여 SDEF 지원을 추가하는 **`SdefInjector`** 유틸리티를 제공합니다. 이는 **매우 까다로운 메서드**이지만 **MMD 동작을 올바르게 재현**하기 위해 필요합니다.

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

## BMP 텍스처 로더 등록

MMD와 브라우저 간의 **BMP 텍스처 로더 구현 차이**로 인해 Babylon.js에서 MMD 모델의 BMP 텍스처를 올바르게 로드하려면 **별도의 BMP 텍스처 로더를 등록**해야 합니다.

이 예제에서 현재 사용 중인 **"YYB Hatsune Miku_10th"** 모델은 **BMP 텍스처를 사용하지 않으므로** 이 단계를 건너뛰어도 모델이 올바르게 표시됩니다. 하지만 **BMP 텍스처를 사용하는 모델**을 로드할 때는 이 단계를 수행하지 않으면 텍스처가 올바르게 표시되지 않을 수 있습니다.

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

## 플레이어 컨트롤 표시

**babylon-mmd**는 **MMD 애니메이션 재생을 제어**하기 위한 **`MmdPlayerControl`** 유틸리티를 제공합니다. 이 유틸리티를 사용하여 **비디오 플레이어와 유사한 컨트롤 UI**를 표시할 수 있습니다.

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

**`MmdPlayerControl`**은 **프로덕션 수준의 UI 컴포넌트가 아니며** 단순히 **MMD 애니메이션 재생을 테스트**하기 위해 제공됩니다. 따라서 프로덕션 환경에서는 **자체 UI를 구현**하는 것이 권장됩니다.

## 결과

import ResultVideo from "@site/docs/get-started/scene-details/2025-10-02 21-18-26.mp4";

<video src={ResultVideo} controls width="100%"></video>

이제 씬이 로드되는 동안 **로딩 스크린이 표시**되고 **플레이어 컨트롤 UI**가 나타납니다.

<details>
<summary>전체 코드</summary>
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

## 다음 단계는?

이제 **babylon-mmd의 기본 사용법**을 모두 배웠습니다! 다음으로 [**레퍼런스**](../../reference/) 섹션을 살펴보세요. 이 섹션에서는 **다양한 옵션과 고급 기능**에 대한 자세한 설명을 제공합니다.
