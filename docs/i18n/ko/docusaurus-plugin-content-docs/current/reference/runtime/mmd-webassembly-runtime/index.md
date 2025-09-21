---
sidebar_position: 3
sidebar_label: MMD 웹어셈블리 런타임
---

# MMD 웹어셈블리 런타임

이 섹션에서는 **WebAssembly** (WASM)로 구현된 MMD 런타임을 사용하는 방법에 대해 설명합니다.

babylon-mmd는 **WASM**으로 구현된 MMD 런타임을 제공합니다.

<!-- ![WebAssembly Architecture](./wasm-architecture.png) -->

import WebAssemblyArchitecture from "@site/docs/reference/runtime/mmd-webassembly-runtime/wasm-architecture.png";

<img src={WebAssemblyArchitecture} style={{width: 400}} />

*이 그림은 babylon-mmd의 WebAssembly 런타임 아키텍처를 보여줍니다.*

이 WASM 런타임은 기존 `MmdRuntime` 클래스의 JavaScript 구현을 **Rust**로 **완전히 다시 작성**하여 WASM으로 컴파일한 것입니다.

WASM 런타임은 다양한 최적화 기법을 적용하여 JavaScript 런타임보다 **더 나은 성능**을 제공합니다.

적용된 최적화 기법은 다음과 같습니다:

- IK Solver를 제외한 모든 작업을 **float32**로 처리.
- **128비트 SIMD** 명령어를 사용하여 벡터 연산을 병렬로 처리.
- 각 모델에 대해 병렬 처리를 수행하기 위해 **워커 기반 멀티스레딩** 사용.
- 물리 시뮬레이션을 처리하기 위해 **Bullet Physics** 엔진을 FFI로 바인딩 (emscripten 사용하지 않음).

## MmdWasmInstance

WASM 런타임을 사용하려면 먼저 babylon-mmd에서 제공하는 **WASM 바이너리를 로드**해야 합니다. 이는 `getMmdWasmInstance()` 함수를 사용하여 수행할 수 있습니다.

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```

`getMmdWasmInstance()` 함수는 WASM 바이너리를 **비동기적으로 로드**하고 WASM 모듈 인스턴스를 반환합니다.

babylon-mmd는 바이너리를 선택할 때 **세 가지 옵션**을 제공합니다:

- **싱글스레드** 또는 **멀티스레드**: S / M
- **Bullet Physics** 포함 또는 미포함: P / (없음)
- **릴리즈 빌드** 또는 **디버그 빌드**: R / D

따라서 **8가지 WASM 인스턴스 타입** 중 하나를 선택할 수 있습니다:

- `MmdWasmInstanceTypeSR`: 싱글스레드, 릴리즈 빌드
- `MmdWasmInstanceTypeSD`: 싱글스레드, 디버그 빌드
- `MmdWasmInstanceTypeMR`: 멀티스레드, 릴리즈 빌드
- `MmdWasmInstanceTypeMD`: 멀티스레드, 디버그 빌드
- `MmdWasmInstanceTypeSPR`: 싱글스레드, 물리, 릴리즈 빌드
- `MmdWasmInstanceTypeSPD`: 싱글스레드, 물리, 디버그 빌드
- `MmdWasmInstanceTypeMPR`: 멀티스레드, 물리, 릴리즈 빌드
- `MmdWasmInstanceTypeMPD`: 멀티스레드, 물리, 디버그 빌드

사용 시나리오에 적합한 바이너리를 선택할 수 있습니다.

이론적으로, **최고의 성능**을 제공하는 바이너리는 `MmdWasmInstanceTypeMPR` (멀티스레드, 물리, 릴리즈 빌드)입니다.

그러나 `SharedArrayBuffer`를 지원하지 않는 환경에서는 **멀티스레딩이 작동하지 않으므로** 싱글스레드 버전을 사용해야 합니다.

물리 시뮬레이션이 필요하지 않다면 로딩 시간을 줄이기 위해 **물리 엔진이 없는** 바이너리를 선택할 수 있습니다.

또한 개발 중에는 런타임 내부에서 발생하는 오류를 추적하기 위해 **디버그 빌드**를 사용하는 것이 좋습니다. 릴리즈 빌드는 패닉이 발생할 때 오류를 진단하기 어렵게 만듭니다.

:::info
물리 엔진이 없는 바이너리를 선택하더라도 `MmdPhysics`, `MmdAmmoPhysics`, 또는 `MmdBulletPhysics` 클래스를 사용하여 물리 시뮬레이션을 처리할 수 있습니다. 하지만 물리 엔진이 포함된 바이너리를 사용하는 것에 비해 성능이 낮을 수 있습니다.
:::

## MmdWasmRuntime 클래스

`MmdWasmRuntime` 클래스는 WASM으로 구현된 MMD 런타임 클래스로 `MmdRuntime` 클래스와 **거의 동일한 API**를 제공합니다.

사용하려면 기존의 `MmdRuntime` 클래스 대신 `MmdWasmRuntime` 클래스를 사용하고 생성자에 **`MmdWasmInstance`를 전달**하기만 하면 됩니다.

```typescript
const mmdWasmRuntime = new MmdWasmRuntime(mmdWasmInstance, scene);
```

그러면 타입이 자동으로 전파되고, `createMmdModel` 함수의 반환 타입도 `MmdWasmModel` 타입이 됩니다.

## MmdWasmAnimation 클래스

WASM 런타임에서 데이터를 처리하려면 데이터를 **WASM 메모리 공간으로 복사**해야 합니다.

그러나 `MmdAnimation` 컨테이너는 **JavaScript 쪽**의 ArrayBuffer 인스턴스에 데이터를 저장합니다.

따라서 `MmdAnimation`에 저장된 애니메이션 데이터는 WASM 쪽에서 **평가할 수 없습니다**. 이 경우 **Animation Evaluation**은 JavaScript 쪽에서 처리되고, 그 다음 **Solve IK**, **Append Transform**, **Bone Morph**, **Physics Simulation**은 WASM 쪽에서 처리됩니다.

<!-- https://play.d2lang.com/?script=tJHPavMwEMTveoph758_2mMPBQea0pZAwYGcFWfdCPTHrCRDKHn3Upk2TnBKL71ptbszP3aozSLs01K047VxTPh3D3rWg25aMX2iihbcBWG87g_RtBFN0m-MG1JqOnaHdwVcmx27ANXeOJ1M8HgYtM3lSQo4qqNStOFtHSO7rT38KHh7EnyUkHusgvR7_McieB4LGttNsAPj6eWsrPue_Q5r0T52QdwIUNyytZy-3E4u3_bGZTuB_typu8RyDvhnePPHKJFdoJe_ObRy6N_kWxSmiVTX_C-Sq2Z9i9zSeG2xCWJ3WOkkpuVI6iMAAP__&layout=elk& -->
<!-- ![MmdAnimation Pipeline](mmdanimation-pipeline.png) -->

import MmdAnimationPipeline from "@site/docs/reference/runtime/mmd-webassembly-runtime/mmdanimation-pipeline.png";

<img src={MmdAnimationPipeline} style={{width: 600}} />

*이 그림은 MmdAnimation 데이터가 WASM 메모리 공간에 복사되지 않았을 때 애니메이션 평가가 어떻게 처리되는지 보여줍니다.*

babylon-mmd는 **애니메이션 데이터를 복사**하여 WASM 메모리 공간으로 지원하는 `MmdWasmAnimation` 클래스를 제공합니다. 이를 통해 애니메이션 평가를 포함한 **거의 모든 애니메이션 계산**을 **WASM 쪽**에서 처리할 수 있습니다.

<!-- https://play.d2lang.com/?script=rJBBSwMxEIXv-RWPuVvvHoQtWBEpCC30nG5nbSDJLJOkUKT_XcxqpUu8ecvke8N8POqLKse8Uht46wIT7h5BO953KXHY-zMtaMmDKOPteE6uT9hk-85kzE3qAR8GaEcnBlAXXbDZScTTyfpSnzShZ5UyYi06HnGPpUSehm-8EX9ivLzejN04cjxgqzamQTR8wYupGsV7zj8avwJXLxeKv56fdrohs_5l_s96rZZq8TPx-tcSM5dZ_4tmrO6vXLQeO1F_wNpmdT0nMp8BAAD__w%3D%3D&layout=elk&theme=0& -->
<!-- ![MMD Wasm Animation Pipeline](mmdwasmanimation-pipeline.png) -->

import MmdWasmAnimationPipeline from "@site/docs/reference/runtime/mmd-webassembly-runtime/mmdwasmanimation-pipeline.png";

<img src={MmdWasmAnimationPipeline} style={{width: 600}} />

*이 그림은 MmdWasmAnimation 데이터가 WASM 메모리 공간에 복사되었을 때 애니메이션 평가가 어떻게 처리되는지 보여줍니다.*

이를 위해 간단히 `MmdWasmAnimation` 인스턴스를 생성하고 MMD 모델에 바인딩하면 됩니다.

```typescript
const mmdWasmAnimation = new MmdWasmAnimation(mmdAnimation, mmdWasmInstance, scene);

const runtimeAnimationHandle = mmdWasmModel.createRuntimeAnimation(mmdWasmAnimation);
mmdWasmModel.setRuntimeAnimation(runtimeAnimationHandle);
```

이렇게 하면 애니메이션 평가가 WASM 쪽에서 처리되어 **가능한 모든 애니메이션 계산**이 WASM 쪽에서 처리되도록 할 수 있습니다.

:::info
`MmdAnimation`과 달리 `MmdWasmAnimation`은 **수동 메모리 할당 해제**가 필요합니다.

더 이상 필요하지 않다면 `MmdWasmAnimation.dispose()` 메서드를 호출하여 **메모리를 해제**하세요.
:::

## 버퍼링된 평가

WASM 런타임은 **버퍼링된 평가**를 지원합니다. 이는 멀티스레딩 런타임(예: MR, MPD)을 사용할 때 렌더링과 **별도의 스레드**에서 애니메이션 계산을 처리하는 기능입니다.

이 기능은 **기본적으로 비활성화**되어 있습니다. 활성화하려면 `MmdWasmRuntime.evaluationType` 속성을 `MmdWasmRuntimeAnimationEvaluationType.Buffered`로 설정하세요.

```typescript
mmdWasmRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Buffered;
```

버퍼링된 평가가 활성화되면 애니메이션 계산은 **1프레임 지연**으로 처리되며, 렌더링 스레드는 **이전 프레임**에서 계산된 결과를 사용합니다. 이는 렌더링 스레드가 애니메이션 계산을 기다리지 않고 즉시 렌더링을 수행할 수 있게 하는 **파이프라이닝 기법**의 한 형태입니다.

다음은 버퍼링된 평가와 즉시 평가 간의 차이점을 보여주는 이미지입니다:

<!-- ![Buffered Evaluation VS Immediate Evaluation](buffered-vs-immediate.png) -->

import BufferedVsImmediate from "@site/docs/reference/runtime/mmd-webassembly-runtime/buffered-vs-immediate.jpg";

<img src={BufferedVsImmediate} style={{width: 600}} />

*이 그림은 버퍼링된 평가와 즉시 평가 간의 차이점을 보여줍니다.*

## 제한사항

WebAssembly로 컴파일된 코드는 JavaScript 코드와 달리 **프로토타입을 수정**하거나 **상속**을 통해 동작을 변경할 수 없습니다.

따라서 **높은 수준의 커스터마이징**이 필요한 경우에는 WebAssembly 런타임 대신 JavaScript 런타임을 사용하는 것이 좋습니다.

## 더 많은 정보

[Enhancing Browser Physics Simulations: WebAssembly and Multithreading Strategies](https://ieeexplore.ieee.org/document/11071666)

이 논문은 babylon-mmd의 WebAssembly 런타임을 최적화하기 위해 적용된 **다양한 기법**들을 설명하며, 이 페이지에서 사용된 일부 이미지도 이 논문에서 발췌되었습니다.

이 논문은 사용된 최적화 기법과 그 결과로 달성된 **성능 향상**에 대한 **자세한 설명**을 제공합니다.
