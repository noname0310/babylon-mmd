---
sidebar_position: 4
sidebar_label: 머티리얼 빌더
---

# 머티리얼 빌더

MMD 모델을 로드하는 과정에서 **텍스처 로드 및 머티리얼 할당 작업은 전적으로 머티리얼 빌더에 위임됩니다**.

로더 옵션을 통해 `PmxLoader`와 `PmdLoader`의 `materialBuilder`를 설정할 수 있습니다.

다음과 같은 이유로 머티리얼 로딩 프로세스를 분리했습니다:

- 측정 결과, 평균적으로 MMD 모델을 로드하는 데 가장 많은 시간이 소요되는 부분은 **텍스처를 로드하여 머티리얼을 초기화하는 것**입니다. 그러나 사용 사례에 따라 머티리얼 로딩이 필요하지 않을 수 있습니다. 따라서 사용자가 **로딩 시간을 단축하기 위해 선택적으로 머티리얼을 로드할 수 있도록** 해야 합니다.

- 또한 사용자는 **로드 시 MMD 셰이딩 모델 대신 다른 머티리얼 기반 셰이딩을 적용할 수 있어야 합니다**. 예를 들어, 사용자는 더 사실적인 표현을 위해 **물리 기반 렌더링(PBR) 머티리얼**을 사용하고 싶을 수 있습니다.

## 머티리얼 빌더 소개

모든 MMD 모델 로더는 **`loaderOptions.mmdmodel.materialBuilder: Nullable<IMaterialBuilder>`** 를 통해 머티리얼 빌더를 설정할 수 있습니다.

이 옵션은 기본적으로 **`null`** 이지만, babylon-mmd 인덱스를 임포트하면 **`MmdStandardMaterialBuilder`가 기본값으로 설정**됩니다.

:::info
여기서 인덱스를 임포트한다는 것은 다음과 같은 코드를 의미합니다:

```typescript
import { Something } from "babylon-mmd";
```

반대로, 심볼이 정의된 파일을 직접 임포트할 수도 있습니다:

```typescript
import { Something } from "babylon-mmd/esm/something";
```

트리 셰이킹(tree-shaking)을 위해 `loaderOptions.mmdmodel.materialBuilder`의 기본값은 `null`로 설정되어 있습니다.
그러나 초보자가 라이브러리를 더 쉽게 사용할 수 있도록, **인덱스를 임포트하면 `MmdStandardMaterialBuilder`가 기본값으로 설정**되도록 설계되었습니다.
:::

다음과 같이 머티리얼 빌더를 설정할 수 있습니다:

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: new MmdStandardMaterialBuilder()
        }
    }
});
```

단일 머티리얼로 여러 모델을 로드하는 경우, **머티리얼 빌더를 공유**할 수 있습니다.

이 경우, 머티리얼 빌더는 **내부적으로 텍스처를 캐싱**하므로, 특히 동일한 모델을 여러 번 로드할 때 로딩 시간을 크게 줄일 수 있습니다.

```typescript
const pbrMaterialBuilder = new PBRMaterialBuilder();

const assetContainer1: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl1, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: pbrMaterialBuilder
        }
    }
});

const assetContainer2: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl2, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: pbrMaterialBuilder
        }
    }
});
```

## 머티리얼 빌더의 종류

**`IMmdMaterialBuilder`** 인터페이스를 구현하여 머티리얼 빌더를 만들 수 있으며, babylon-mmd에서 제공하는 머티리얼 빌더도 이 인터페이스를 구현합니다.

babylon-mmd는 세 가지 머티리얼 빌더를 제공합니다:

- **`MmdStandardMaterialBuilder`** - MMD의 동작을 재현하기 위해 **`MmdStandardMaterial`** 을 사용하는 머티리얼 빌더입니다.
- **`StandardMaterialBuilder`** - Babylon.js의 **`StandardMaterial`** 을 사용하는 머티리얼 빌더입니다.
- **`PBRMaterialBuilder`** - Babylon.js의 **`PBRMaterial`** 을 사용하는 머티리얼 빌더입니다.

### MmdStandardMaterialBuilder

**`MmdStandardMaterialBuilder`** 는 **`MmdStandardMaterial`** 을 사용하여 MMD 머티리얼을 로드하는 머티리얼 빌더입니다.

이 머티리얼 빌더는 **babylon-mmd에서 지원하는 모든 MMD 머티리얼 속성을 로드**하며, 각 카테고리별 메서드가 제공됩니다.

로딩 동작을 변경하고 싶다면, `_setMeshesAlphaIndex`를 제외한 **해당 메서드를 오버라이드**할 수 있습니다.

**`MmdStandardMaterialBuilder._setMeshesAlphaIndex`에 의해 설정되는 속성:**

- **`AbstractMesh.alphaIndex`** - 머티리얼 순서에 따라 머티리얼의 알파 인덱스를 설정합니다(아래 렌더 메서드 참조).

**`MmdStandardMaterialBuilder.loadGeneralScalarProperties`에 의해 설정되는 속성:**

- **`StandardMaterial.diffuseColor`** - MMD 머티리얼 "diffuse" (rgb)
- **`StandardMaterial.specularColor`** - MMD 머티리얼 "specular" (rgb)
- **`StandardMaterial.ambientColor`** - MMD 머티리얼 "ambient" (rgb)
- **`Material.alpha`** - MMD 머티리얼 "diffuse" (a)
- **`AbstractMesh.isVisible`** - "diffuse" (a)가 0인 경우 false로 설정
- **`StandardMaterial.specularPower`** - MMD 머티리얼 "reflect"

**`MmdStandardMaterialBuilder.loadDiffuseTexture`에 의해 설정되는 속성:**

- **`Material.backFaceCulling`** - MMD 머티리얼 "is double sided"
- **`StandardMaterial.diffuseTexture`** - MMD 머티리얼 "texture"

**`MmdStandardMaterialBuilder.setAlphaBlendMode`에 의해 설정되는 속성:**

- **`StandardMaterial.diffuseTexture.hasAlpha`** - MMD 머티리얼 "texture"에 알파 채널이 있으면 true로 설정(아래 알파 평가 참조)
- **`StandardMaterial.useAlphaFromDiffuseTexture`** - MMD 머티리얼 "texture"에 알파 채널이 있으면 true로 설정
- **`Material.transparencyMode`** - 렌더 메서드에 의해 결정(아래 렌더 메서드 참조)
- **`Material.forceDepthWrite`** - 렌더 메서드에 의해 결정(아래 렌더 메서드 참조)

**`MmdStandardMaterialBuilder.loadSphereTexture`에 의해 설정되는 속성:**

- **`MmdStandardMaterial.sphereTexture`** - MMD 머티리얼 "sphere texture"
- **`MmdStandardMaterial.sphereTextureBlendMode`** - MMD 머티리얼 "sphere texture mode"

**`MmdStandardMaterialBuilder.loadToonTexture`에 의해 설정되는 속성:**

- **`MmdStandardMaterial.toonTexture`** - MMD 머티리얼 "toon texture"

**`MmdStandardMaterialBuilder.loadOutlineRenderingProperties`에 의해 설정되는 속성:**

- **`MmdStandardMaterial.renderOutline`** - 아웃라인 렌더링을 활성화하려면 true로 설정
- **`MmdStandardMaterial.outlineWidth`** - MMD 머티리얼 "edge size"
- **`MmdStandardMaterial.outlineColor`** - MMD 머티리얼 "edge color" (rgb)
- **`MmdStandardMaterial.outlineAlpha`** - MMD 머티리얼 "edge color" (a)

### StandardMaterialBuilder

**`StandardMaterialBuilder`** 는 Babylon.js의 **`StandardMaterial`** 을 사용하여 MMD 머티리얼을 로드하는 머티리얼 빌더입니다.

이 머티리얼 빌더는 **MMD 머티리얼 속성의 일부만 로드**하므로, 로딩 과정에서 데이터 손실이 발생합니다.

로딩 동작을 변경하고 싶다면, `_setMeshesAlphaIndex`를 제외한 **해당 메서드를 오버라이드**할 수 있습니다.

**`StandardMaterialBuilder._setMeshesAlphaIndex`에 의해 설정되는 속성:**

- **`AbstractMesh.alphaIndex`** - 머티리얼 순서에 따라 머티리얼의 알파 인덱스를 설정합니다(아래 렌더 메서드 참조).

**`StandardMaterialBuilder.loadGeneralScalarProperties`에 의해 설정되는 속성:**

- **`StandardMaterial.diffuseColor`** - MMD 머티리얼 "diffuse" (rgb)
- **`StandardMaterial.specularColor`** - MMD 머티리얼 "specular" (rgb)
- **`StandardMaterial.ambientColor`** - MMD 머티리얼 "ambient" (rgb)
- **`Material.alpha`** - MMD 머티리얼 "diffuse" (a)
- **`AbstractMesh.isVisible`** - "diffuse" (a)가 0인 경우 false로 설정
- **`StandardMaterial.specularPower`** - MMD 머티리얼 "reflect"

**`StandardMaterialBuilder.loadDiffuseTexture`에 의해 설정되는 속성:**

- **`Material.backFaceCulling`** - MMD 머티리얼 "is double sided"
- **`StandardMaterial.diffuseTexture`** - MMD 머티리얼 "texture"

**`StandardMaterialBuilder.setAlphaBlendMode`에 의해 설정되는 속성:**

- **`StandardMaterial.diffuseTexture.hasAlpha`** - MMD 머티리얼 "texture"에 알파 채널이 있으면 true로 설정(아래 알파 평가 참조)
- **`StandardMaterial.useAlphaFromDiffuseTexture`** - MMD 머티리얼 "texture"에 알파 채널이 있으면 true로 설정
- **`Material.transparencyMode`** - 렌더 메서드에 의해 결정(아래 렌더 메서드 참조)
- **`Material.forceDepthWrite`** - 렌더 메서드에 의해 결정(아래 렌더 메서드 참조)

**다음 세 가지 메서드는 비어 있으며, 오버라이딩하여 선택적으로 구현할 수 있습니다:**

- `StandardMaterialBuilder.loadSphereTexture`
- `StandardMaterialBuilder.loadToonTexture`
- `StandardMaterialBuilder.loadOutlineRenderingProperties`

### PBRMaterialBuilder

**`PBRMaterialBuilder`** 는 Babylon.js의 **`PBRMaterial`** 을 사용하여 MMD 머티리얼을 로드하는 머티리얼 빌더입니다.

이 머티리얼 빌더는 **MMD 머티리얼 속성의 일부만 로드**하므로, 로딩 과정에서 데이터 손실이 발생합니다.
또한, MMD 머티리얼 파라미터와 1:1 매핑이 되지 않는 속성의 경우, 추가적인 변환으로 인해 **데이터 왜곡이 발생**할 수 있습니다.

로딩 동작을 변경하고 싶다면, `_setMeshesAlphaIndex`를 제외한 **해당 메서드를 오버라이드**할 수 있습니다.

**`PBRMaterialBuilder._setMeshesAlphaIndex`에 의해 설정되는 속성:**

- **`AbstractMesh.alphaIndex`** - 머티리얼 순서에 따라 머티리얼의 알파 인덱스를 설정합니다(아래 렌더 메서드 참조).

**`PBRMaterialBuilder.loadGeneralScalarProperties`에 의해 설정되는 속성:**

- **`PBRMaterial.albedoColor`** - MMD 머티리얼 "diffuse" (rgb)
- **`PBRMaterial.reflectionColor`** - MMD 머티리얼 "specular" (rgb)
- **`PBRMaterial.ambientColor`** - MMD 머티리얼 "ambient" (rgb)
- **`Material.alpha`** - MMD 머티리얼 "diffuse" (a)
- **`AbstractMesh.isVisible`** - "diffuse" (a)가 0인 경우 false로 설정
- **`PBRMaterial.roughness`** - MMD 머티리얼 "reflect"

**`PBRMaterialBuilder.loadDiffuseTexture`에 의해 설정되는 속성:**

- **`Material.backFaceCulling`** - MMD 머티리얼 "is double sided"
- **`PBRMaterial.albedoTexture`** - MMD 머티리얼 "texture"

**`PBRMaterialBuilder.setAlphaBlendMode`에 의해 설정되는 속성:**

- **`PBRMaterial.albedoTexture.hasAlpha`** - MMD 머티리얼 "texture"에 알파 채널이 있으면 true로 설정(아래 알파 평가 참조)
- **`PBRMaterial.useAlphaFromAlbedoTexture`** - MMD 머티리얼 "texture"에 알파 채널이 있으면 true로 설정
- **`Material.transparencyMode`** - 렌더 메서드에 의해 결정(아래 렌더 메서드 참조)
- **`Material.forceDepthWrite`** - 렌더 메서드에 의해 결정(아래 렌더 메서드 참조)

**다음 세 가지 메서드는 비어 있으며, 오버라이딩하여 선택적으로 구현할 수 있습니다:**

- `PBRMaterialBuilder.loadSphereTexture`
- `PBRMaterialBuilder.loadToonTexture`
- `PBRMaterialBuilder.loadOutlineRenderingProperties`

## 렌더 메서드

MMD는 **Depth Write**와 **Depth Test**가 활성화된 **알파 블렌딩**을 사용하여 메시를 렌더링합니다.
머티리얼 빌더는 최적화된 결과를 얻으면서 이 동작을 구현하기 위한 여러 옵션을 제공합니다.

메시가 완전히 **불투명(Opaque)**한 경우, 알파 블렌딩 없이 렌더링해도 동일한 결과를 얻을 수 있습니다. babylon-mmd는 렌더링 최적화를 위해 이를 자동으로 수행하는 여러 옵션을 제공하며, 이는 머티리얼 빌더의 `renderMethod`로 제어됩니다.

### DepthWriteAlphaBlendingWithEvaluation

이 렌더링 메서드는 **불투명 메시를 알파 블렌딩 없이 렌더링**하고, 절대적으로 필요한 경우에만 알파 블렌딩을 사용합니다.

다시 말해, 이 메서드로 모델을 로드할 때 머티리얼의 `transparencyMode`는 **`Material.MATERIAL_ALPHABLEND`** 또는 **`Material.MATERIAL_OPAQUE`** 가 될 수 있으며, `forceDepthWrite`는 **`true`** 로 설정됩니다.

이것이 **기본** 메서드입니다.

### DepthWriteAlphaBlending

이 렌더링 메서드는 **모든 메시를 알파 블렌딩을 사용하여 렌더링**합니다.

다시 말해, 이 메서드로 모델을 로드할 때 머티리얼의 `transparencyMode`는 항상 **`Material.MATERIAL_ALPHABLEND`** 이며, `forceDepthWrite`는 **`true`** 로 설정됩니다.

이 메서드는 **MMD의 렌더링 메서드와 동일**하므로, 렌더링 문제가 발생하면 이 메서드를 시도해 보는 것이 좋습니다.

### AlphaEvaluation

이 렌더링 메서드는 메시를 **알파 블렌딩, 알파 테스트, 또는 불투명** 모드로 렌더링할지 결정하고, **알파 블렌딩을 사용할 때는 Depth Write를 수행하지 않습니다**.

다시 말해, 이 메서드로 모델을 로드할 때 머티리얼의 `transparencyMode`는 **`Material.MATERIAL_ALPHATEST`**, **`Material.MATERIAL_ALPHABLEND`**, 또는 **`Material.MATERIAL_OPAQUE`** 가 될 수 있으며, `forceDepthWrite`는 **`false`** 로 설정됩니다.

이 메서드는 Depth Write와 함께 알파 블렌드를 사용하는 것이 일반적인 관행이 아니기 때문에 **Babylon.js의 렌더링 파이프라인과 가장 호환성이 높습니다**.

## 알파 평가

위에서 설명한 렌더링 메서드 중, **`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`** 은 메시가 불투명한지 판단해야 합니다. 또한, **`MmdMaterialRenderMethod.AlphaEvaluation`** 은 적절한 렌더링 메서드를 선택하기 위해 메시의 알파 값을 평가해야 합니다.

이 과정을 **알파 평가**라고 합니다.

### 과정

1.  Render Target에 **UV 공간**에서 지오메트리를 렌더링합니다. 이때, 텍스처를 샘플링하여 각 픽셀의 **알파 값**만 렌더링됩니다.
2.  **readPixels** 함수를 사용하여 Render Target의 픽셀 데이터를 읽습니다.
3.  읽은 픽셀 데이터의 알파 값을 평가하여 적절한 렌더링 메서드를 선택합니다.

-   **`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`** 의 경우, 텍스처가 적용된 지오메트리의 한 프래그먼트라도 알파 값이 `255`가 아니면 머티리얼의 `transparencyMode`는 **`Material.MATERIAL_ALPHABLEND`** 로 설정됩니다.
-   **`MmdMaterialRenderMethod.AlphaEvaluation`** 의 경우, 머티리얼의 렌더링 메서드는 머티리얼 빌더의 **`alphaThreshold`** 와 **`alphaBlendThreshold`** 값에 의해 결정됩니다.

### 주의사항

**알파 평가는 일부 엣지 케이스에서 제대로 작동하지 않을 수 있습니다**. 예를 들어, 메시의 UV 토폴로지가 비정상적인 경우, 알파 평가가 잘못된 결과를 생성할 수 있습니다. 이 경우, 머티리얼 빌더의 **`alphaEvaluationResolution`** 을 증가시키는 것이 문제를 해결할 수 있습니다.

알파 평가를 수행할 때, **모든 머티리얼은 로드 시 한 번 Render Target에 렌더링**되어야 합니다. 이는 무시할 수 없는 비용입니다. 따라서 머티리얼 빌더의 **`forceDisableAlphaEvaluation`** 옵션을 사용하여 알파 평가를 비활성화할 수 있습니다.
이 경우, 알파 평가는 수행되지 않습니다.

또한, **BPMX 포맷**은 알파 평가 결과를 포맷에 저장하므로, 이를 사용하여 **로드 시 알파 평가 과정을 건너뛸 수 있습니다**.

## 드로우 오더 설정

MMD는 항상 머티리얼의 순서에 따라 메시를 렌더링합니다.
그러나 Babylon.js는 반대로, 렌더링하기 전에 카메라와의 거리를 기준으로 메시를 정렬합니다.

babylon-mmd는 MMD와 동일한 드로우 오더를 재현하기 위해 두 가지 경우에 대해 별도의 솔루션을 제공합니다.

`renderMethod`가 `MmdMaterialRenderMethod.AlphaEvaluation`인 경우에는 드로우 오더 재현이 적용되지 않습니다.

### 여러 메시 처리

MMD의 드로우 오더는 **`Mesh.alphaIndex`** 에 적절한 값을 설정하여 재현됩니다.

머티리얼 빌더의 다음 두 속성이 이를 위해 사용됩니다:

-   **`nextStartingAlphaIndex`** - 다음 MMD 모델의 시작 알파 인덱스 값
-   **`alphaIndexIncrementsPerModel`** - 각 MMD 모델의 알파 인덱스 증가값

**`nextStartingAlphaIndex`** 는 하나의 MMD 모델을 로드한 후 **`alphaIndexIncrementsPerModel`** 만큼 증가합니다.

따라서 다음과 같은 설정으로:
- `nextStartingAlphaIndex`: 0
- `alphaIndexIncrementsPerModel`: 3

머티리얼이 2개인 MMD 모델 A와 머티리얼이 3개인 MMD 모델 B를 순서대로 로드하면, **`nextStartingAlphaIndex`** 는 다음과 같이 변경됩니다:

1.  로드하기 전, `nextStartingAlphaIndex`: 0
2.  모델 A를 로드한 후, `nextStartingAlphaIndex`: 3
3.  모델 B를 로드한 후, `nextStartingAlphaIndex`: 6

그리고 로드된 모델의 **`Mesh.alphaIndex`** 는 다음과 같이 설정됩니다:

```
Model A: {
    Mesh1: { alphaIndex: 0 }
    Mesh2: { alphaIndex: 1 }
}

Model B: {
    Mesh1: { alphaIndex: 3 }
    Mesh2: { alphaIndex: 4 }
    Mesh3: { alphaIndex: 5 }
}
```

여기서 중요한 점은 **`alphaIndexIncrementsPerModel`이 충분히 크지 않으면**, 이전에 로드된 모델과 새로 로드된 모델의 **`Mesh.alphaIndex`** 가 **겹칠 수 있다**는 것입니다.

예를 들어, 이전 예제에서 **`alphaIndexIncrementsPerModel`** 가 1로 설정되었다면, 각 모델의 **`Mesh.alphaIndex`** 는 다음과 같을 것입니다:

```
Model A: {
    Mesh1: { alphaIndex: 0 }
    Mesh2: { alphaIndex: 1 }
}

Model B: {
    Mesh1: { alphaIndex: 1 }
    Mesh2: { alphaIndex: 2 }
    Mesh3: { alphaIndex: 3 }
}
```

모델 A의 Mesh2와 모델 B의 Mesh1은 동일한 **`alphaIndex`** 를 갖게 되므로, 그들의 드로잉 순서는 카메라로부터의 거리에 의해 결정됩니다.

이 문제를 방지하기 위해, **`alphaIndexIncrementsPerModel`** 의 기본값은 충분히 큰 숫자로 설정되어 있습니다.

:::info
이 메서드를 사용할 때, **드로우 오더는 MMD 모델이 로드되는 순서에 의해 결정**된다는 점에 유의하세요.

MMD 모델 간의 드로우 오더를 엄격하게 재현해야 하는 경우, **`alphaIndexIncrementsPerModel`을 0으로 설정**하고 **`Mesh.alphaIndex`를 수동으로 조정**할 수 있습니다.
:::

### 여러 서브메시 처리

Babylon.js에서는 **단일 메시 내의 여러 서브메시 간의 드로우 오더를 제어할 수 있는 방법이 없습니다**.

단일 메시에 여러 서브메시가 있는 경우, 드로잉 순서는 각 서브메시 자체의 **바운딩 스피어 센터**를 기반으로 카메라로부터의 거리를 계산하여 결정됩니다.

이러한 동작을 고려하여, babylon-mmd는 MMD 모델을 로드할 때 **모든 서브메시에 동일한 `BoundingInfo`를 적용**합니다.

이 경우, 모든 서브메시는 카메라로부터 동일한 거리를 갖게 되며, **안정적인 정렬**로 인해 **`Mesh.subMeshes`** 의 순서대로 그려집니다.

이는 MMD 모델 로더의 **`loaderOptions.mmdmodel.optimizeSubmeshes`** 옵션이 **`false`** 일 때 항상 적용됩니다.
