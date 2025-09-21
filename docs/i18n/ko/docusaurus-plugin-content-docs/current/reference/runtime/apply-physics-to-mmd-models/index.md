---
sidebar_position: 5
sidebar_label: MMD 모델에 물리 시뮬레이션 적용
---

# MMD 모델에 물리 시뮬레이션 적용

이 섹션에서는 MMD 모델에 **물리 시뮬레이션**을 적용하는 방법을 설명합니다.

MMD 모델은 **물리 시뮬레이션**을 지원하여 물리 엔진을 사용해 모델의 본에 물리적 효과를 적용할 수 있습니다.

babylon-mmd는 이를 구현하기 위한 **다양한 옵션**을 제공합니다. 각 옵션의 특성을 검토하고 사용 시나리오에 가장 적합한 것을 선택할 수 있습니다.

## 물리 엔진 옵션

babylon-mmd는 MMD 물리 시뮬레이션을 처리하기 위해 **세 가지 물리 엔진**을 지원합니다:

- **Bullet Physics**: MMD에서 사용하는 물리 엔진입니다. Rust wasm-bindgen을 사용하여 WebAssembly로 컴파일되어 babylon-mmd 패키지에 포함됩니다.
- **Ammo.js**: Bullet Physics의 Emscripten 기반 JavaScript 포트입니다. Emscripten으로 컴파일된 WebAssembly 바이너리로 제공됩니다.
- **Havok Physics**: Babylon.js에서 지원하는 상용 물리 엔진입니다. WebAssembly 바이너리로 제공됩니다.

MMD 모델에 적용할 때 각 물리 엔진의 특성은 다음과 같습니다:

| 물리 엔진   | 성능       | 안정성        | 이식성      | 사용 편의성      |
|------------------|-------------------|------------------|------------------|------------------|
| Bullet Physics | ★★★★☆ - **최적화된 바인딩** | ★★★★★ - **뛰어난 MMD 동작 재현** | ★★★☆☆ - WebAssembly를 지원하는 환경에서만 사용 가능 | ★★★☆☆ - API에서 개발자 경험 고려가 상대적으로 부족 |
| Ammo.js | ★★★☆☆ - 자동 생성된 바인딩으로 인한 성능 저하 | ★★★☆☆ - 좋은 MMD 동작 재현, 하지만 상대적으로 높은 충돌 가능성 | ★★★★★ - **asm.js 빌드 사용 시 WebAssembly 지원 없는 환경에서도 사용 가능** | ★★★★★ - **Babylon.js와 좋은 호환성과 편의성** |
| Havok Physics | ★★★★★ - **최적화된 바인딩, 더 빠른 엔진 성능** | ★☆☆☆☆ - 부족한 MMD 동작 재현, 심각한 수치적 불안정성 | ★★★☆☆ - WebAssembly를 지원하는 환경에서만 사용 가능 | ★★★★★ - **Babylon.js와 좋은 호환성과 편의성** |

아래에서는 각 물리 엔진을 초기화하는 방법을 설명합니다.

### Bullet Physics 구현

Bullet Physics 엔진을 사용하여 MMD 물리 시뮬레이션을 처리할 수 있습니다.

이 Bullet Physics 엔진은 C++에서 Rust **FFI 바인딩** 후 WebAssembly로 컴파일되어 babylon-mmd 패키지의 일부로 포함됩니다.

이는 Ammo.js와는 **완전히 독립적인 바인딩**으로 **더 나은 성능과 안정성**을 제공합니다.

다음은 Bullet Physics 엔진을 사용하여 `MmdRuntime`을 생성하는 예제 코드입니다:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);

const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
```

Bullet Physics 엔진을 사용하려면 먼저 babylon-mmd에서 제공하는 **WebAssembly 바이너리를 로드**해야 합니다. 이는 `getMmdWasmInstance()` 함수를 사용하여 수행할 수 있습니다.

여기서 **네 가지 WebAssembly 인스턴스 타입** 중 하나를 선택할 수 있습니다:
- `MmdWasmInstanceTypeSPR`: **단일 스레드, 물리, 릴리스 빌드**
- `MmdWasmInstanceTypeSPD`: **단일 스레드, 물리, 디버그 빌드**
- `MmdWasmInstanceTypeMPR`: **멀티 스레드, 물리, 릴리스 빌드**
- `MmdWasmInstanceTypeMPD`: **멀티 스레드, 물리, 디버그 빌드**

멀티 스레드 버전은 **`SharedArrayBuffer`**를 지원하는 환경에서만 작동합니다. 환경에 따라 적절한 바이너리를 선택하세요.

위 예제에서는 **단일 스레드 릴리스 빌드**를 사용합니다.
```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```

`MultiPhysicsRuntime` 클래스는 Bullet Physics 엔진을 사용하여 물리 시뮬레이션을 처리하는 런타임 클래스입니다. `MultiPhysicsRuntime` 인스턴스를 생성한 후, **중력 벡터를 설정**하고 `Scene`에 **업데이트 콜백을 등록**합니다.

```typescript
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);
```

`MultiPhysicsRuntime`에서 제공하는 다양한 메서드를 사용하여 **중력 설정**이나 **RigidBody 또는 Constraint 직접 추가** 등으로 물리 시뮬레이션을 제어할 수 있습니다. 자세한 내용은 [Bullet Physics](../bullet-physics) 문서를 참조하세요.

:::info
`MmdWasmRuntime`을 사용하는 경우, 대신 `MmdWasmPhysics`를 사용할 수 있습니다.

이는 내부적으로 동일한 코드를 사용하지만, **JavaScript-to-WASM 바인딩** 레이어를 제거하여 **더 나은 성능**을 제공합니다.

```typescript
const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance, scene, new MmdWasmPhysics(scene));

const physicsRuntime = mmdRuntime.physics!.getImpl(MmdWasmPhysicsRuntimeImpl);

// MMD WASM 런타임에서 생성한 물리 월드의 중력은
// 기본적으로 (0, -9.8*10, 0)으로 설정되므로 이 코드는 생략할 수 있습니다
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
```
:::

### Ammo.js 구현

Ammo.js는 Emscripten으로 컴파일된 Bullet Physics 엔진의 **JavaScript 포트**입니다. 이를 사용하여 MMD 물리 시뮬레이션을 처리할 수 있습니다.

다음은 Ammo.js를 사용하여 `MmdRuntime`을 생성하는 예제 코드입니다:

```typescript
import ammo from "babylon-mmd/esm/Runtime/Physics/External/ammo.wasm";

const physicsInstance = await ammo();
const physicsPlugin = new MmdAmmoJSPlugin(true, physicsInstance);
scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), physicsPlugin);

const mmdRuntime = new MmdRuntime(scene, new MmdAmmoPhysics(scene));
```

babylon-mmd 패키지에는 Emscripten으로 컴파일된 **Bullet Physics 3.25 버전**이 `ammo.wasm` 바이너리로 포함되어 있습니다. `"babylon-mmd/esm/Runtime/Physics/External/ammo.wasm"` 경로에서 가져올 수 있습니다.

:::info
Ammo.js는 특정 데이터에 대해 **컨스트레인트의 불안정성 문제**가 있으므로, 가능하다면 Bullet Physics 엔진을 사용하는 것이 권장됩니다.
:::

Babylon.js PhysicsPluginV1 인터페이스를 사용하여 Ammo.js 물리 엔진을 관리할 수도 있습니다. 자세한 내용은 [Babylon.js Physics](https://doc.babylonjs.com/legacy/physics/) 문서를 참조하세요.

### Havok Physics 구현

**Havok Physics 엔진**을 사용하여 MMD 물리 시뮬레이션을 처리할 수 있습니다.

다음은 Havok Physics 엔진을 사용하여 `MmdRuntime`을 생성하는 예제 코드입니다:

```typescript
import havok from "@babylonjs/havok";

const physicsInstance = await havok();
const physicsPlugin = new HavokPlugin(true, physicsInstance);
scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);

const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
```

:::info
Havok Physics 엔진은 **좋은 수치적 안정성**을 갖지 않아 MMD 물리 시뮬레이션에 **적합하지 않을 수 있습니다**. 가능하다면 Bullet Physics 엔진을 사용하는 것이 권장됩니다.
:::

Babylon.js PhysicsPluginV2 인터페이스를 사용하여 Havok Physics 엔진을 관리할 수도 있습니다. 자세한 내용은 [Babylon.js Physics V2](https://doc.babylonjs.com/features/featuresDeepDive/physics/usingPhysicsEngine) 문서를 참조하세요.

## MMD 모델의 물리 시뮬레이션 구축

위의 물리 엔진 중 하나로 `MmdRuntime` 인스턴스를 생성한 후, `buildPhysics` 옵션을 `true`로 설정하여 `MmdModel` 인스턴스를 생성하면 MMD 모델에서 **물리 시뮬레이션을 활성화**할 수 있습니다.

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    buildPhysics: true
});
```

`buildPhysics` 옵션이 `true`로 설정되면, MMD 런타임은 **PMX 파일에 정의된 물리 데이터**를 기반으로 MMD 모델용 RigidBody와 Constraint를 **자동으로 생성**합니다.

## 물리 시뮬레이션 구축 옵션

물리 시뮬레이션이 활성화된 `MmdModel` 인스턴스를 생성할 때, 물리 시뮬레이션을 사용자 정의하기 위해 **추가 옵션**을 전달할 수 있습니다.

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    buildPhysics: {
        worldId: undefined,
        kinematicSharedWorldIds: [],
        disableOffsetForConstraintFrame: false
    }
});
```

사용 가능한 옵션은 다음과 같습니다:
- `worldId`: 물리 시뮬레이션을 위한 **사용자 정의 월드 ID**를 지정할 수 있습니다. 지정하지 않으면 새 월드 ID가 자동으로 할당됩니다.
- `kinematicSharedWorldIds`: **키네마틱 객체를 공유**할 월드 ID 배열을 지정할 수 있습니다. 이는 여러 MMD 모델 간에 키네마틱 객체를 공유하려는 경우 유용합니다.
- `disableOffsetForConstraintFrame`: 컨스트레인트 프레임의 오프셋을 비활성화할지 여부를 지정할 수 있습니다. 모델의 컨스트레인트가 **올바르게 작동하지 않는 경우**, 이 옵션을 `true`로 설정해 보세요.

### 멀티 월드 물리 시뮬레이션

먼저, `worldId`와 `kinematicSharedWorldIds` 옵션은 물리 시뮬레이션 월드를 제어합니다. 이러한 옵션은 **Bullet Physics를 물리 백엔드로 사용할 때만 유효**합니다. babylon-mmd의 Bullet Physics API는 **여러 물리 월드를 생성**하고, 멀티 스레딩으로 처리하며, 월드 간 동기화하는 기능을 제공합니다.

기본적으로 MMD 모델이 생성될 때마다 각 모델은 **자체 독립적인 물리 월드**를 갖습니다. 그러나 `worldId` 옵션을 사용하여 특정 ID를 지정하면, 해당 ID를 가진 물리 월드가 이미 존재하는 경우 해당 월드를 재사용합니다. 이를 통해 **여러 MMD 모델이 동일한 물리 월드를 공유**할 수 있습니다.

또한 서로 다른 월드 간에 키네마틱 객체를 공유하려는 경우, `kinematicSharedWorldIds` 옵션을 사용하여 공유할 월드 ID 목록을 지정할 수 있습니다. 이 옵션을 사용하면 서로 다른 월드에 속한 MMD 모델의 **키네마틱 바디**가 각자의 월드에서 **서로 상호작용**할 수 있습니다.

### 컨스트레인트 동작 수정

`disableOffsetForConstraintFrame` 옵션은 MMD 모델의 컨스트레인트가 **올바르게 작동하지 않을 때** 사용됩니다. 기본적으로 이 옵션은 `false`로 설정됩니다.

MMD는 **Bullet Physics 버전 2.75**를 사용하여 물리 시뮬레이션을 처리합니다. 그러나 더 새로운 Bullet Physics 버전 3.25에서는 컨스트레인트의 동작이 변경되어 일부 MMD 모델에서 컨스트레인트가 올바르게 작동하지 않는 문제가 발생할 수 있습니다.

이 옵션을 `true`로 설정하면 Constraint Solver가 **버전 2.75와 동일한 방식**으로 작동하게 되어 이러한 문제를 해결할 수 있습니다. MMD 모델의 컨스트레인트가 예상대로 작동하지 않는다면 이 옵션을 `true`로 설정해 보세요.

하지만 이전 컨스트레인트 솔버는 **더 심각한 수치적 불안정성**을 가지는 경향이 있다는 점을 유의하세요.
