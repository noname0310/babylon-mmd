---
sidebar_position: 1
sidebar_label: MMD 애니메이션
---

# MMD 애니메이션

`MmdAnimation`은 MMD 모델이나 카메라 애니메이션을 **저장하는 컨테이너**입니다.

이를 MMD 모델이나 카메라에 바인딩하여 **애니메이션을 재생**할 수 있습니다.

## 애니메이션 런타임

애니메이션 런타임은 시간 t에서 애니메이션 데이터를 **평가하고** 이를 MMD 모델이나 카메라에 **바인딩하는 역할을 담당하는 엔티티**입니다.

여러 종류의 런타임이 있으며, `MmdAnimation`을 바인딩하기 위해 다음 두 런타임 구현을 사용할 수 있습니다:

- `MmdRuntimeModelAnimation`: MMD 모델 애니메이션을 바인딩하기 위한 런타임
- `MmdRuntimeCameraAnimation`: MMD 카메라 애니메이션을 바인딩하기 위한 런타임

카메라와 모델 애니메이션 런타임이 별도로 제공되는 이유는 **효율적인 트리 셰이킹**을 위해서입니다.

MMD 모델 애니메이션만 필요한 경우 `MmdRuntimeModelAnimation`만 가져올 수 있고, 카메라 애니메이션만 필요한 경우 `MmdRuntimeCameraAnimation`만 가져올 수 있습니다.

애니메이션 런타임은 기본적으로 애니메이션 컨테이너(`MmdAnimation`)의 프로토타입에 바인딩 메서드를 추가하는 **사이드 이펙트를 실행**하여 작동합니다.

따라서 런타임을 사용하려면 해당 사이드 이펙트를 실행하기 위해 **런타임을 가져와야** 합니다.

```ts
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
```

## 런타임 애니메이션 생성

런타임 애니메이션은 `MmdCamera`나 `MmdModel`과 같이 바인딩될 대상에 의해 생성됩니다.

이는 런타임 애니메이션이 **바인딩 대상에 의존적인 특성**을 가지기 때문입니다.

다음과 같이 `MmdCamera`나 `MmdModel`의 `createRuntimeAnimation` 메서드를 호출하여 런타임 애니메이션을 생성할 수 있습니다:

```ts
const camera: MmdCamera = ...;
const model: MmdModel = ...;

const cameraAnimationHandle: MmdRuntimeAnimationHandle = camera.createRuntimeAnimation(animation);
const modelAnimationHandle: MmdRuntimeAnimationHandle = model.createRuntimeAnimation(animation);
```

`createRuntimeAnimation` 메서드는 애니메이션 컨테이너를 인수로 받아 **런타임 애니메이션 핸들을 반환**합니다.

런타임 애니메이션 객체 자체가 아닌 **핸들**을 반환한다는 점을 주목하는 것이 중요합니다.

## MMD 런타임 애니메이션 핸들

런타임 애니메이션은 애니메이션 컨테이너와 함께 바인딩 정보를 포함하는 객체입니다.

이 객체의 속성에 접근하는 것은 일반적으로 **바인딩을 읽거나 수정할 때만 필요**하며, 일반적으로 이러한 값을 직접 수정할 필요는 없습니다.

따라서 런타임 애니메이션은 기본적으로 **핸들 객체를 통해 제어**됩니다.

런타임 애니메이션 객체에 접근해야 하는 경우, `MmdCamera`나 `MmdModel`의 `runtimeAnimations` 맵에서 핸들을 키로 사용하여 접근할 수 있습니다.

```ts
const cameraRuntimeAnimation = camera.runtimeAnimations.get(cameraAnimationHandle);
const modelRuntimeAnimation = model.runtimeAnimations.get(modelAnimationHandle);
```

## 런타임 애니메이션의 생명주기

런타임 애니메이션은 `MmdCamera`나 `MmdModel`에 의존적인 객체이므로, 바인딩 대상이 파괴되면 **런타임 애니메이션도 함께 파괴됩니다**.

하지만 런타임 애니메이션이 더 이상 필요하지 않다면, `MmdCamera`나 `MmdModel`의 `destroyRuntimeAnimation` 메서드를 호출하여 **명시적으로 파괴**할 수 있습니다.

```ts
camera.destroyRuntimeAnimation(cameraAnimationHandle);
model.destroyRuntimeAnimation(modelAnimationHandle);
```

## 런타임 애니메이션 재생

`MmdCamera`나 `MmdModel`은 **한 번에 하나의 런타임 애니메이션만 재생**할 수 있습니다.
따라서 새로운 런타임 애니메이션을 재생하려면 `setRuntimeAnimation` 메서드를 호출하여 **현재 재생 중인 런타임 애니메이션을 교체**해야 합니다.

```ts
camera.setRuntimeAnimation(cameraAnimationHandle);
model.setRuntimeAnimation(modelAnimationHandle);
```

애니메이션 재생을 중지하려면 `setRuntimeAnimation` 메서드의 인수로 `null`을 전달할 수 있습니다.

```ts
camera.setRuntimeAnimation(null);
model.setRuntimeAnimation(null);
```

런타임 애니메이션은 MMD 런타임에 의해 **항상 동시에 평가되고 바인딩**됩니다.

따라서 여러 애니메이션을 서로 다른 시간에 재생하려면 **각 애니메이션마다 별도의 MMD 런타임을 생성**해야 합니다.

:::info
컴포지트 애니메이션을 사용하여 여러 애니메이션을 동시에 재생하는 방법도 있지만, 이 경우 내부적으로는 하나의 런타임 애니메이션만 재생됩니다.
:::

## MMD WASM 애니메이션

`MmdWasmRuntime`을 사용하는 경우, **WebAssembly(WASM)로 구현된** MMD 애니메이션 평가 및 바인딩 기능을 사용하여 MMD 애니메이션을 재생할 수도 있습니다.

이 경우 **모프 타겟 가중치 설정을 제외한 모든 애니메이션 계산**이 WASM에서 처리되므로 **높은 성능**을 기대할 수 있습니다.

MMD WASM 애니메이션을 사용하려면 `MmdWasmRuntimeModelAnimation` 런타임을 가져와서 해당 사이드 이펙트를 실행해야 합니다.

```ts
import "babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation";
``` 

:::info
**카메라 애니메이션에는 WASM 구현이 제공되지 않습니다**. 이는 카메라 애니메이션이 모델 애니메이션에 비해 계산량이 훨씬 적기 때문에 WASM으로 구현하더라도 성능 향상이 크지 않기 때문입니다.
:::

그 후 애니메이션 컨테이너를 `MmdWasmAnimation`으로 생성하고 이를 `MmdWasmModel`에 **바인딩**합니다.

```ts
const wasmModel: MmdWasmModel = ...;
const wasmAnimation = new MmdWasmAnimation(mmdAnimation);
const wasmModelAnimationHandle = wasmModel.createRuntimeAnimation(wasmAnimation);
```

:::warning

WASM 측에서 애니메이션 데이터에 직접 접근하기 위해 `MmdWasmAnimation`은 **내부적으로 `MmdAnimation` 데이터를 WASM 메모리에 복사하여 저장**합니다.

따라서 `MmdWasmAnimation`이 가진 모든 `TypedArray` 데이터는 **`WebAssembly.Memory` 객체의 메모리 버퍼를 참조**합니다.

결과적으로 멀티스레딩 시나리오에서 이 `TypedArray` 데이터에 접근하는 것은 **매우 위험**합니다.

:::

### MMD WASM 애니메이션 사용 시 주의사항

주목해야 할 중요한 점은 `MmdWasmAnimation`의 메모리 관리는 **GC에 의해 자동으로 처리되지 않으므로**, 더 이상 사용하지 않는 경우 `dispose` 메서드를 호출하여 **명시적으로 메모리를 해제**해야 한다는 것입니다.

```ts
wasmAnimation.dispose();
```
