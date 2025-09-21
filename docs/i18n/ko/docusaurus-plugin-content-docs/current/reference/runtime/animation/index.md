---
sidebar_position: 7
sidebar_label: 애니메이션
---

# 애니메이션

이 섹션에서는 **MMD 애니메이션 데이터를 재생하고 평가하는 방법**을 설명합니다.

## **MMD 애니메이션 저장 형태와 평가/바인딩 컴포넌트**

MMD 애니메이션 데이터는 **주로** `MmdAnimation` 객체로 **표현됩니다**.

하지만 **다양한 형태로 변환되어 저장**될 수 있으며, 형태에 따라 평가와 바인딩 방법이 달라집니다.

**MMD 애니메이션 데이터를 저장하는 다양한 형태는 다음과 같습니다:**

| 저장 형태 | 설명 |
|---|---|
| `MmdAnimation` | MMD 애니메이션 데이터를 그대로 저장하는 **기본 형태** |
| `MmdWasmAnimation` | `MmdWasmRuntime`에서 **가속을 위한** MMD 애니메이션 데이터 형태 |
| `MmdAnimationCameraContainer` | MMD 애니메이션 데이터를 Babylon.js `Animation` 객체로 변환한 형태 **(카메라용)** |
| `MmdAnimationModelContainer` | MMD 애니메이션 데이터를 Babylon.js `Animation` 객체로 변환한 형태 **(모델용)** |
| `AnimationGroup` | MMD 애니메이션 데이터를 Babylon.js `AnimationGroup` 객체로 변환한 형태 |
| `MmdCompositeAnimation` | **여러 MMD 애니메이션 데이터를 하나로 결합**한 형태 |

저장된 MMD 애니메이션 데이터를 모델과 카메라에 적용하려면 **평가와 바인딩 과정**이 필요합니다.

애니메이션 적용 과정은 **두 가지 주요 단계**로 나눌 수 있습니다: 평가와 바인딩.
1. **평가**: 특정 시간 t에 대해 MMD 애니메이션 데이터를 평가하여 각 본과 모프 타겟에 대한 변형과 가중치 값을 계산합니다.
2. **바인딩**: 평가된 값을 모델의 본과 모프 타겟에 적용합니다.
   - 평가된 애니메이션 상태는 두 가지 요소에 반영됩니다:
     - 모델의 `Bone`의 `position`과 `rotationQuaternion` 속성을 평가된 값으로 설정
     - 모델의 `MmdMorphController`의 `setMorphWeightFromIndex` 메서드를 적절히 호출하여 모프 타겟 가중치를 설정

이러한 평가와 바인딩 과정을 수행하는 컴포넌트는 **애니메이션의 저장 형태에 따라 달라집니다**.

**평가와 바인딩을 위한 컴포넌트는 다음과 같습니다:**

| 저장 형태 | 평가 컴포넌트 | 바인딩 컴포넌트 |
|---|---|---|
| `MmdAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdRuntimeModelAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdRuntimeModelAnimation` |
| `MmdWasmAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdWasmRuntimeModelAnimation` 또는 `MmdRuntimeModelAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdWasmRuntimeModelAnimation` 또는 `MmdRuntimeModelAnimation` |
| `MmdAnimationCameraContainer` <br/><br/> `MmdAnimationModelContainer` | `MmdAnimationCameraContainer` <br/><br/> `MmdAnimationModelContainer` | `MmdRuntimeCameraAnimationContainer` <br/><br/> `MmdRuntimeModelAnimationContainer` |
| `AnimationGroup` | `AnimationGroup` | `AnimationGroup` |
| `MmdCompositeAnimation` | `MmdCompositeRuntimeCameraAnimation` <br/><br/> `MmdCompositeRuntimeModelAnimation` | `MmdCompositeRuntimeCameraAnimation` <br/><br/> `MmdCompositeRuntimeModelAnimation` |

### MMD Animation & MMD Runtime Animation

MMD Runtime Animation은 babylon-mmd에서 제공하는 MMD 애니메이션 평가와 바인딩을 위한 **기본 기능**입니다.

이 클래스는 `MmdAnimation`을 **평가**하고 모델과 카메라에 **바인딩**하는 기능을 제공합니다.

이를 위해 다음 두 클래스를 제공합니다:
- `MmdRuntimeModelAnimation`: MMD 모델에 애니메이션을 적용하는 클래스
- `MmdRuntimeCameraAnimation`: MMD 카메라에 애니메이션을 적용하는 클래스

이 방법은 MMD 애니메이션을 재생하는 **가장 기본적인 방법**이며 **뛰어난 성능**을 제공합니다.

자세한 내용은 [MMD Animation](./mmd-animation) 문서를 참조하세요.

### MMD WASM Animation & MMD WASM Runtime Animation

MMD WASM Runtime Animation은 **WebAssembly로 구현된** MMD 애니메이션 평가와 바인딩 기능입니다.

이 클래스는 `MmdWasmAnimation`을 평가하고 모델에 바인딩하는 기능을 제공합니다.

이 방법은 MMD 애니메이션을 재생하는 방법 중에서 **가장 높은 성능**을 제공합니다.

자세한 내용은 [MMD Animation](./mmd-animation) 문서를 참조하세요.

### MMD AnimationContainer & MMD Runtime AnimationContainer

MMD AnimationContainer는 Babylon.js의 `Animation`을 **사용하여 MMD 애니메이션을 평가**하고 모델과 카메라에 **바인딩**하는 기능을 제공합니다.

바인딩을 활성화하기 위해 `MmdCameraAnimationContainer`와 `MmdModelAnimationContainer` 클래스에 대한 런타임이 제공됩니다:
- `MmdRuntimeModelAnimationContainer`: MMD 모델에 애니메이션을 적용하는 클래스
- `MmdRuntimeCameraAnimationContainer`: MMD 카메라에 애니메이션을 적용하는 클래스

이 방법의 **장점**은 Babylon.js의 애니메이션 컨테이너 시스템을 활용할 수 있다는 것입니다.

자세한 내용은 [Use Babylon.js Animation Runtime](./use-babylonjs-animation-runtime) 문서를 참조하세요.

### Babylon.js AnimationGroup

Babylon.js의 `AnimationGroup`을 사용하여 MMD 애니메이션의 **모든 평가와 바인딩을 처리**할 수 있습니다.

이를 위해 babylon-mmd는 `MmdAnimation`을 `AnimationGroup`으로 **변환**하는 `MmdModelAnimationContainer.createAnimationGroup` 메서드를 제공합니다.

이 방법의 **장점**은 Babylon.js의 애니메이션 시스템을 완전히 활용할 수 있다는 것입니다.

자세한 내용은 [Use Babylon.js Animation Runtime](./use-babylonjs-animation-runtime) 문서를 참조하세요.

### Animation Blending

babylon-mmd는 **프레임 단위로 정확한 MMD 애니메이션 블렌딩**을 지원하는 애니메이션 런타임을 제공합니다.

이를 위해 `MmdCompositeAnimation` 애니메이션 컨테이너 클래스가 제공되며, 이를 **평가하고 바인딩**하기 위해 `MmdCompositeRuntimeCameraAnimation`과 `MmdCompositeRuntimeModelAnimation` 클래스가 제공됩니다.

자세한 내용은 [Animation Blending](./animation-blending) 문서를 참조하세요.
