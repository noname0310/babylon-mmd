---
sidebar_position: 3
sidebar_label: VMD 애니메이션 로드 및 재생
---

# VMD 애니메이션 로드 및 재생

이제 **VMD 애니메이션을 로드하고 재생**해 보겠습니다.

## VMD 애니메이션 다운로드

먼저 로드할 **VMD 애니메이션**이 필요합니다.

이 예제에서는 ほうき堂가 제작한 [**メランコリ・ナイト**](https://www.nicovideo.jp/watch/sm41164308) 영상과 함께 배포된 [**VMD 애니메이션**](https://bowlroll.net/file/286064)을 사용합니다.

애니메이션을 **다운로드**한 뒤 압축을 해제하고, **`res/private_test/motion/`** 폴더에 배치하세요.

![vscode-file-structure](@site/docs/get-started/load-and-play-vmd-animation/vscode-file-structure.png) \
*Motion 폴더 구조 예시*

## VMD 애니메이션 로드

VMD 애니메이션은 **`VmdLoader`** 클래스를 사용해 로드합니다.

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

**VMD 애니메이션**과 **PMX 모델** 모두 네트워크를 통해 로드되므로, **`Promise.all`**을 사용해 **병렬로 로드**할 수 있습니다.

따라서 **`vmdLoader.loadAsync`**와 **`LoadAssetContainerAsync`** 비동기 연산을 함께 실행합니다.

### loadAsync 메서드

**`loadAsync`** 메서드의 **첫 번째 인수**는 **애니메이션 이름**입니다. 이 이름은 이후 내부 식별용으로 사용됩니다.

**두 번째 인수**는 로드할 **VMD 파일 URL 배열** 또는 **단일 URL**입니다. **여러 개의 VMD 파일**을 지정하면 순서대로 **하나의 애니메이션으로 병합**됩니다.

:::info
이 예제는 **카메라 모션과 댄스 모션**을 하나의 애니메이션으로 병합합니다. 이는 MMD 애니메이션이 **모델 모션 데이터**와 **카메라 모션 데이터**를 별도로 관리하기 때문에 가능합니다.

**N명의 인원이 춤추는 애니메이션**을 재생하려면 모델마다 **개별 애니메이션**을 만들어야 합니다.
:::

## MMD 런타임 생성

**`VmdLoader`**로 로드한 애니메이션을 재생하려면 **`MmdRuntime`** 인스턴스가 제어하는 **`MmdModel`** 또는 **`MmdCamera`**가 필요합니다.

따라서 먼저 **`MmdRuntime`** 인스턴스를 생성합니다.

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

**`MmdRuntime`**은 **MMD 모델과 카메라**를 관리하고 **애니메이션 재생**을 담당합니다. **`register`** 메서드를 호출해 씬에 업데이트 로직을 등록하고, **`playAnimation`** 메서드를 호출해 애니메이션 재생을 시작합니다.

데이터가 전혀 없어도 재생이 가능하며, 이때는 애니메이션 재생 중에 **리소스를 동적으로 추가**할 수 있습니다.

## 애니메이션 바인딩

**`MmdRuntime`** 인스턴스를 만든 후 **`createRuntimeAnimation`** 메서드를 사용해 애니메이션을 **`MmdModel`**과 **`MmdCamera`**에 적용합니다.

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

**`createRuntimeAnimation`** 메서드를 사용하면 카메라나 모델에 **`MmdAnimation`**을 바인딩할 수 있습니다.

### 필요한 사이드 이펙트 임포트

애니메이션 재생에 필요한 **사이드 이펙트**를 임포트합니다.

```typescript title="src/sceneBuilder.ts"
//...
// highlight-start
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
// highlight-end
//...
```

**babylon-mmd**는 **MMD 모델과 카메라**에 애니메이션을 적용하는 다양한 구현을 제공합니다.

**`mmdRuntimeCameraAnimation`**과 **`mmdRuntimeModelAnimation`**은 가장 널리 사용되는 카메라 및 모델 애니메이션 구현입니다.

이러한 **사이드 이펙트**를 임포트하지 않으면 **`createRuntimeAnimation`** 메서드에서 **런타임 오류**가 발생합니다.

## 결과

씬을 실행하면 **애니메이션이 재생되는 모습**을 확인할 수 있습니다.

![result](@site/docs/get-started/load-and-play-vmd-animation/result.png)

<details>
<summary>전체 코드</summary>
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
