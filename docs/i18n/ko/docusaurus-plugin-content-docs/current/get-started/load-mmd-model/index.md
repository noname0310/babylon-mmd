---
sidebar_position: 2
sidebar_label: MMD 모델 로드
---

# MMD 모델 로드

이제 씬에 **MMD 모델을 로드**하고 **그림자를 추가**합니다.

## PMX 모델 다운로드

먼저 로드할 **PMX 모델**이 필요합니다.

이 예제에서는 [**YYB 하츠네 미쿠 10th 애니버서리**](https://www.deviantart.com/sanmuyyb/art/YYB-Hatsune-Miku-10th-DL-702119716) 모델을 사용합니다.

모델을 **다운로드**하여 압축을 풀고 **`res/private_test/model/`** 폴더에 배치하세요.

![vscode-file-structure](@site/docs/get-started/load-mmd-model/vscode-file-structure.png) \
*모델 폴더 구조 예시*

## 사이드 이펙트 임포트

먼저 모델을 로드하는 데 필요한 **사이드 이펙트**를 임포트합니다.

```typescript title="src/sceneBuilder.ts"
//...
// highlight-start
import "babylon-mmd/esm/Loader/pmxLoader";
import "babylon-mmd/esm/Loader/mmdOutlineRenderer";
// highlight-end
//...
```

**babylon-mmd**는 **Babylon.js의 SceneLoader**를 확장하여 **PMX/PMD 모델**을 로드할 수 있게 합니다.

**PMD 모델**을 로드하려면 **`babylon-mmd/esm/Loader/pmdLoader`**를 임포트하고 아래에서 설명하는 PMX 모델 로드 방식과 동일하게 사용하면 됩니다.

**`mmdOutlineRenderer`**는 MMD 모델의 **아웃라인을 그리는 기능**을 제공합니다. **아웃라인 렌더링이 필요 없다면** 임포트하지 않아도 됩니다.

## PMX 모델 로드

모델을 로드하려면 **`LoadAssetContainerAsync`** 함수를 사용합니다. **`pluginOptions`**의 **`mmdmodel`** 옵션을 지정하여 MMD 모델 로더에 필요한 설정을 전달할 수 있습니다.

```typescript title="src/sceneBuilder.ts"
//...
// highlight-next-line
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
//...
// highlight-next-line
import { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder";
//...
// highlight-next-line
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        // highlight-next-line
        const materialBuilder = new MmdStandardMaterialBuilder();
        const scene = new Scene(engine);
        // ...
        // highlight-start
        const modelMesh = await LoadAssetContainerAsync(
            "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
            scene,
            {
                pluginOptions: {
                    mmdmodel: {
                        loggingEnabled: true,
                        materialBuilder: materialBuilder
                    }
                }
            }).then(result => {
                result.addAllToScene();
                return result.rootNodes[0] as MmdMesh;
            });
        // highlight-end

        return scene;
    }
}
```

모델을 로드할 때 **`pluginOptions.mmdmodel`** 옵션으로 전달하는 설정은 다음과 같습니다.
- **`loggingEnabled`**: 로드 과정에서 로그를 출력할지 여부입니다. **디버깅에 유용**합니다.
- **`materialBuilder`**: MMD 모델 머티리얼을 생성할 구현체를 지정합니다. **`MmdStandardMaterialBuilder`**는 기본적인 MMD 머티리얼을 생성하는 기본 구현체입니다. **커스텀 머티리얼**을 사용하고 싶다면 **`IMmdMaterialBuilder`** 인터페이스를 구현해 전달할 수 있습니다.

모델이 로드되면 **`AssetContainer`**가 반환됩니다. **`addAllToScene`** 메서드를 호출해서 모델을 씬에 추가하세요.
모델의 **루트 노드**는 **`rootNodes`** 배열의 **첫 번째 요소**로 접근할 수 있습니다. **MMD 모델**의 경우 첫 번째 루트 노드는 항상 **`MmdMesh`** 타입을 만족합니다.

## 모델에 그림자 추가

모델에 **그림자를 추가**하려면 앞서 생성한 **`ShadowGenerator`**에 모델을 등록합니다.

```typescript title="src/sceneBuilder.ts"
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        //...
        // highlight-start
        for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);
        // highlight-end
        return scene;
    }
}
//...
```

**MMD 모델**은 머티리얼별로 분할된 **여러 메시에 의해 구성**됩니다. 따라서 **`modelMesh.metadata.meshes`** 배열을 순회하며 각 메시에 **receiveShadows**를 설정합니다.

## 결과

이제 브라우저를 확인하면 **모델이 로드된 모습**을 볼 수 있습니다.

![result](@site/docs/get-started/load-mmd-model/result.png)

<details>
<summary>전체 코드</summary>
```typescript title="src/sceneBuilder.ts"
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
// highlight-start
import "babylon-mmd/esm/Loader/pmxLoader";
import "babylon-mmd/esm/Loader/mmdOutlineRenderer";
// highlight-end

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
// highlight-next-line
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { Scene } from "@babylonjs/core/scene";
// highlight-next-line
import { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder";
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";
// highlight-next-line
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        // highlight-next-line
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
        const modelMesh = await LoadAssetContainerAsync(
            "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
            scene,
            {
                pluginOptions: {
                    mmdmodel: {
                        loggingEnabled: true,
                        materialBuilder: materialBuilder
                    }
                }
            }).then(result => {
                result.addAllToScene();
                return result.rootNodes[0] as MmdMesh;
            });

        for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);
        // highlight-end

        return scene;
    }
}
```
</details>
