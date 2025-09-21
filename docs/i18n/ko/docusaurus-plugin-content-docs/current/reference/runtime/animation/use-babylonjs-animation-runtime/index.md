---
sidebar_position: 2
sidebar_label: Babylon.js 애니메이션 런타임 사용
---

# Babylon.js 애니메이션 런타임 사용

Babylon.js의 애니메이션 시스템을 사용하여 MMD 애니메이션을 재생하면 다음과 같은 **장점**을 제공합니다:
- **Babylon.js Animation Curve Editor** 지원
- **애니메이션 블렌딩** 지원
- **보다 일반화된** 애니메이션 관리

따라서 babylon-mmd는 Babylon.js의 애니메이션 시스템을 사용하여 MMD 애니메이션을 재생하는 방법을 제공합니다.

## Babylon.js 애니메이션 시스템 아키텍처

먼저 Babylon.js 애니메이션 시스템 아키텍처의 **기능**을 이해하는 것이 필요합니다.

<!-- https://play.d2lang.com/?script=UnLMy8xNLMnMzzNU4kJwjJA5xkpcMF5iUk6qoZKVQjWXgoJSUGleSWZuKrIJWESNsIoaK3HVciFbrmCjq4BiiR4285FdSIQONG8QoWMg_GpEsl-NSParETF-xeYMBV07BaWQxKL01BJDDaf8vFSF_CIF3_yiggyIoCaqIUaEDDHCZQggAAD__w%3D%3D&layout=elk& -->

### Babylon.js Animation

Babylon.js에서 애니메이션은 **주로** `Animation` 객체를 사용하여 **표현됩니다**.

`Animation` 객체는 특정 속성에 대한 **애니메이션 키프레임을 저장하는 컨테이너**입니다.

애니메이션으로 제어할 수 있는 **8가지 타입**이 있습니다:

- `Float` (숫자)
- `Vector3`
- `Quaternion`
- `Matrix`
- `Color3`
- `Color4`
- `Vector2`
- `Size`

각 타입은 **서로 다른 보간 방법**을 사용합니다.

예를 들어, `Float` 타입은 **선형 보간**을 사용하고, `Quaternion` 타입은 **구면 선형 보간(SLERP)**을 사용합니다.

`Animation` 객체는 시간 t에 대해 **값을 평가**하는 `_interpolate` 메서드를 제공합니다.

하지만 바인딩 대상에 애니메이션을 적용하는 로직은 **포함되지 않습니다**.

### Babylon.js Runtime Animation

`RuntimeAnimation`은 `Animation` 객체를 **실제로 평가**하고 이를 대상에 **바인딩**하는 역할을 담당합니다.

애니메이션 평가 로직의 일부와 **바인딩 경로 해결**을 위한 로직이 `RuntimeAnimation` 객체에 구현되어 있습니다.

### Babylon.js Animatable

`Animatable`은 **여러 개의** `RuntimeAnimation` 객체를 **관리**하고 씬의 렌더링 루프와 동기화하여 **애니메이션을 업데이트**하는 역할을 담당합니다.

**복잡한 애니메이션 블렌딩 로직**도 여기서 처리됩니다. (Babylon.js는 애니메이션 블렌딩을 지원합니다.)

따라서 다음과 같이 `Animatable` 객체를 사용하여 **여러 개의** `RuntimeAnimation` 객체를 동시에 재생하여 MMD 모델 애니메이션을 재생할 수 있습니다:

<!-- https://play.d2lang.com/?script=UnLMy8xNLElMykk1VLJSqOZSUFAKKs0rycxNhchk5ufBJBQUlJDEuBQUarGpNsKi2ginamMsqo0hqmu5uFBcp4fFYQq6dgpKIYlF6aklhhpO-XmpmkpWCkmZeSmEtBohazXS8M0vKsiAcIg1wRjZBGMN39TiDIWwzOLEpMyczJJKuCmAAAAA__8%3D&layout=elk& -->

![Animatable Diagram](@site/docs/reference/runtime/animation/use-babylonjs-animation-runtime/animatable-diagram.png)
*이 다이어그램은 `Animatable`, `RuntimeAnimation`, `Animation` 객체와 바인딩 대상 간의 **참조 관계**를 보여줍니다.*

babylon-mmd는 `Animatable` 객체 접근 방식을 **직접 사용하지 않으므로**, 실제 다이어그램은 다소 다릅니다.

### Babylon.js Animation Group

`AnimationGroup`은 `Animation` 객체와 바인딩 대상을 **쌍으로 관리**하는 컨테이너입니다.

![Animation Group Diagram](@site/docs/reference/runtime/animation/use-babylonjs-animation-runtime/animation-group-diagram.png)
*이 다이어그램은 `AnimationGroup`이 `Animation` 객체와 바인딩 대상을 쌍으로 **관리**하는 방법을 보여줍니다.*

`AnimationGroup`은 애니메이션을 재생하기 위해 **내부적으로** `Animatable` 객체를 **사용합니다**. 사용을 더 쉽게 하기 위해 **더 높은 수준의 API**를 제공합니다.

<!-- https://play.d2lang.com/?script=jNCxCsJADAbg_Z4i3G7BjB0EJ3fxBa40SMCmUtNJ-u5Cz6vXI1XHJvnTL-ePwl1Q7uU09ON972t4OgB_CcOVlNqlnToAPqvFQhyevyZnptFI4yqNMT05954IzY0WznkU5Y5-a_INn6Mq6x7YHaD4F8tDgygHpcJRGYR5Qbq9hoaldasYbvE3n-NvPpZ8_MJHg485HxP_FQAA__8%3D&layout=elk& -->
![Animation Group With Animatable Diagram](@site/docs/reference/runtime/animation/use-babylonjs-animation-runtime/animation-group-with-animatable-diagram.png)
*이 다이어그램은 `AnimationGroup`이 애니메이션을 재생하기 위해 **내부적으로** `Animatable` 객체를 **사용**하는 방법을 보여줍니다.*

## Babylon.js 애니메이션 시스템을 사용하여 MMD 애니메이션 재생하기

Babylon.js의 애니메이션 시스템을 사용하여 MMD 애니메이션을 재생하기 위해 제공되는 **주요 방법은 두 가지**입니다:

1. `Animation` 객체의 `_interpolate` 메서드를 사용한 애니메이션 평가 후 **직접 바인딩**
2. `AnimationGroup` 객체를 사용한 **애니메이션 평가 및 바인딩**

각 방법의 **장단점**은 다음과 같습니다:

| 방법 | 장점 | 단점 |
|---|---|---|
| 방법 1 <br/> (`Animation` 사용) | **Babylon.js Animation Curve Editor** 지원 | `MmdAnimation`에 비해 **성능 저하** 및 **메모리 사용량 증가** |
| 방법 2 <br/> (`AnimationGroup` 사용) | Babylon.js 애니메이션 시스템의 **모든 기능** 사용 가능 | 방법 1에 비해 **더 큰 성능 저하** 및 **더 많은 메모리 사용량** |

이제 이 두 방법을 사용하여 MMD 애니메이션을 재생하는 방법을 살펴보겠습니다.

### 애니메이션 컨테이너 클래스

`Animation` 객체는 단일 속성에 대한 **애니메이션 키프레임을 저장하는 컨테이너**입니다.

하지만 우리가 다루는 MMD 애니메이션은 **여러 속성에 대한 애니메이션 키프레임**을 포함합니다.

따라서 babylon-mmd는 **여러 개의** `Animation` 객체를 함께 **관리**하는 컨테이너 클래스 `MmdCameraAnimationContainer`와 `MmdModelAnimationContainer`를 제공합니다.

`MmdCameraAnimationContainer`와 `MmdModelAnimationContainer`는 각각 `MmdCamera`와 `MmdModel`에 적용되도록 설계된 `Animation` 객체의 **컬렉션을 관리**합니다.

이들은 다음과 같이 생성됩니다:

```typescript
const modelBezierBuilder = new MmdModelAnimationContainerBezierBuilder();
const cameraBezierBuilder = new MmdCameraAnimationContainerBezierBuilder();

const mmdModelAnimationContainer = new MmdModelAnimationContainer(mmdAnimation, modelBezierBuilder);
const mmdCameraAnimationContainer = new MmdCameraAnimationContainer(mmdAnimation, cameraBezierBuilder);
```

애니메이션 컨테이너를 생성할 때 **빌더가 함께 전달된다는 점**을 **주목**하세요.

이는 Babylon.js의 애니메이션 시스템이 MMD 애니메이션의 보간 방법을 **완전히 지원하지 않기** 때문입니다.

Babylon.js는 키프레임 간의 베지어 보간을 **지원하지 않으며**, 기본적으로 제공되는 **세 가지 주요 보간 방법**은 다음과 같습니다:
- Linear
- Step
- Hermite

Hermite 보간은 inTangent와 outTangent를 사용하여 **Cubic Spline 보간**을 구현하는데, 이는 베지어 보간보다 **자유도가 낮습니다**.

따라서 babylon-mmd는 베지어 보간을 지원하기 위해 **세 가지 옵션**을 제공합니다:

- `Mmd(Model/Camera)AnimationContainerHermiteBuilder`: **Hermite 보간**을 사용하여 `Mmd(Model/Camera)AnimationContainer`를 생성합니다.
  - 이 방법은 베지어 보간 탄젠트를 Hermite 보간 탄젠트로 **근사**합니다. 이 방법은 **정확도가 낮으며** 특히 카메라 애니메이션에서 상당한 차이를 보일 수 있습니다.
- `Mmd(Model/Camera)AnimationContainerSampleBuilder`: 베지어 보간을 선형 보간으로 **근사**합니다.
  - 이 방법은 베지어 곡선을 30프레임 간격으로 **샘플링**하고 선형 보간으로 근사합니다. 이 방법은 **높은 정확도**를 가지지만 **메모리 사용량이 증가**합니다. 또한 애니메이션이 **편집 불가능**하게 된다는 단점이 있습니다.
- `Mmd(Model/Camera)lAnimationContainerBezierBuilder`: 베지어 보간을 **정확하게 구현**합니다.
  - 이 방법은 `Animation` 객체의 `_interpolate` 메서드를 **오버라이드**하여 베지어 보간을 정확하게 구현합니다. 이는 **가장 정확한** 방법이지만, `Animation` 객체의 `_interpolate` 메서드를 오버라이드하여 존재하지 않는 보간 방법을 강제로 추가하므로 **Animation Curve Editor와 같은 도구가 제대로 작동하지 않을 수** 있습니다.


생성된 `MmdModelAnimationContainer`와 `MmdCameraAnimationContainer`는 각각 `MmdModel`과 `MmdCamera`에 **바인딩**될 수 있습니다. 바인딩 방법에 따라 `Animation` 객체의 `_interpolate` 메서드만 **사용할지**, 아니면 `AnimationGroup`을 통해 `RuntimeAnimation`과 `Animatable` 객체를 사용할지가 결정됩니다.

### 방법 1: `Animation` 객체 사용

babylon-mmd는 `MmdModelAnimationContainer`와 `MmdCameraAnimationContainer`를 **직접 바인딩**하는 런타임 구현을 제공합니다.

이는 `"babylon-mmd/esm//Runtime/Animation/mmdRuntimeCameraAnimationContainer"`와 `"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationContainer"` 모듈을 가져옴으로써 사용할 수 있습니다.

```typescript
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimationContainer";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationContainer";
```

이를 통해 `MmdAnimation`을 바인딩하는 것과 **동일한 방법**으로 `MmdCamera`와 `MmdModel` 객체의 `createRuntimeAnimation` 메서드를 사용하여 `Mmd(Camera/Model)AnimationContainer`를 바인딩할 수 있습니다.

```typescript
const camera: MmdCamera = ...;
const model: MmdModel = ...;

const cameraAnimationHandle = camera.createRuntimeAnimation(mmdCameraAnimationContainer);
const modelAnimationHandle = model.createRuntimeAnimation(mmdModelAnimationContainer);
```

### 방법 2: `AnimationGroup` 객체 사용

`MmdModelAnimationContainer`와 `MmdCameraAnimationContainer`는 `AnimationGroup` 객체를 **생성**하기 위한 `createAnimationGroup` 메서드를 제공합니다.

```typescript
const modelAnimationGroup = mmdModelAnimationContainer.createAnimationGroup("modelAnimation", mmdModel);
const cameraAnimationGroup = mmdCameraAnimationContainer.createAnimationGroup("cameraAnimation", mmdCamera);
```

이제 `AnimationGroup` API를 사용하여 **애니메이션을 재생**할 수 있습니다.

```typescript
modelAnimationGroup.play(true);
cameraAnimationGroup.play(true);
```

`AnimationGroup` 객체는 재생뿐만 아니라 여러 애니메이션의 블렌딩을 포함한 **여러 기능**을 제공합니다. 자세한 내용은 [Babylon.js 공식 문서](https://doc.babylonjs.com/features/featuresDeepDive/animation/groupAnimations/)를 참조하세요.

:::info
`AnimationGroup` 객체를 사용하여 애니메이션을 재생할 때는 **MMD 런타임이 더 이상** 애니메이션의 실행 주체가 아니므로, MMD 런타임에 오디오를 추가하더라도 **오디오와 애니메이션이 동기화되지 않습니다**.
:::
