---
sidebar_position: 1
sidebar_label: 기본 씬 만들기
---

# 기본 씬 만들기

이제 **기본 씬**을 만들어 봅시다. 다음 요소들을 추가할 예정입니다.

- **카메라 생성**: 씬을 바라볼 시점을 제공합니다.
- **배경색과 앰비언트 컬러 설정**: 씬의 **클리어컬러(ClearColor)**와 **앰비언트컬러(AmbientColor)**를 설정합니다.
- **라이팅 추가**: 모델이 잘 보이도록 씬을 조명합니다.
- **그라운드 생성**: 모델이 설 수 있는 바닥을 만듭니다.

## 카메라 생성

먼저 **카메라를 생성**합니다.

렌더러가 정상 동작하려면 카메라가 **액티브카메라(activeCamera)**로 설정되어 있어야 합니다.

```typescript title="src/sceneBuilder.ts"
//...
// highlight-next-line
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        
        // highlight-next-line
        const mmdCamera = new MmdCamera("MmdCamera", new Vector3(0, 10, 0), scene);

        return scene;
    }
}
```

여기에서는 **`babylon-mmd`** 패키지가 제공하는 **`MmdCamera`**를 사용합니다.

이 카메라는 MMD 소프트웨어의 **카메라 동작을 재현**합니다.

## 배경색과 앰비언트 컬러 설정

**배경색**과 **앰비언트 라이팅**을 설정합니다. 배경색은 **`ClearColor`**, 앰비언트 라이팅은 **`AmbientColor`**로 지정합니다.

```typescript title="src/sceneBuilder.ts"
//...
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
//...
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
//...

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        // highlight-start
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        // highlight-end

        const mmdCamera = new MmdCamera("MmdCamera", new Vector3(0, 10, 0), scene);

        return scene;
    }
}
```

여기에서 **`scene.ambientColor`**는 모든 머티리얼의 **`ambientColor`** 속성에 영향을 줍니다.

**MMD 모델**의 경우 셰이딩을 정확히 재현하려면 ambientColor에 **0.5 스케일링**을 적용해야 하므로 이 **(0.5, 0.5, 0.5)** 값은 임의가 아니라 **의도적인 값**입니다.

## 라이트 생성

**MMD의 라이팅 모델**은 **단일 디렉셔널 라이트**로 정의됩니다.

따라서 다른 라이팅 구성을 사용하면 제대로 렌더링되지 않을 수 있습니다. 예를 들어 **헤미스페릭 라이트**를 함께 사용하면 MMD 소프트웨어와는 다른 셰이딩 결과가 나올 수 있습니다.

따라서 **`DirectionalLight`**를 만들고, 그림자를 렌더링하기 위해 **`ShadowGenerator`**도 생성합니다.

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
//...

import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
//...
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);

        const mmdCamera = new MmdCamera("MmdCamera", new Vector3(0, 10, 0), scene);

        // highlight-start
        const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 1.0;
        directionalLight.autoCalcShadowZBounds = true;

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;
        // highlight-end
        return scene;
    }
}
```

**`ShadowGenerator`** 설정은 **임의의 값**이므로 **필요에 따라 조정**할 수 있습니다.

## 그라운드 생성

**그라운드 플레인**을 생성합니다. 이는 씬을 **시각적으로 이해하는 데** 도움이 되며 **필수 사항은 아닙니다**.

```typescript title="src/sceneBuilder.ts"
//...
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        
        // ...

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        // highlight-start
        const ground = CreateGround("ground1", { width: 100, height: 100, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;
        // highlight-end
        return scene;
    }
}
```

## 결과

이제 씬을 실행하면 더 이상 **에러가 발생하지 않으며**, 아래와 같은 **하얀 화면**이 표시됩니다.

![result](@site/docs/get-started/create-basic-scene/result.png)

<details>
<summary>전체 코드</summary>
```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
// highlight-start
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
// highlight-end
import { Scene } from "@babylonjs/core/scene";
// highlight-next-line
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        // highlight-start
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
        // highlight-end

        return scene;
    }
}
```
</details>
