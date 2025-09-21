---
sidebar_position: 6
sidebar_label: 불릿 피직스
---

# 불릿 피직스

이 섹션에서는 babylon-mmd에서 **Bullet Physics** 엔진 바인딩을 사용하는 방법을 설명합니다.

## Bullet Physics 개요

babylon-mmd는 MMD 모델의 물리 시뮬레이션을 위해 **Bullet Physics** 엔진을 사용합니다.

Bullet Physics 엔진은 충돌 감지와 강체 역학 시뮬레이션을 지원하는 **C++** 로 작성된 **오픈 소스 물리 엔진**입니다.

일반적으로 이 엔진을 사용하려면 **emscripten**을 사용하여 C++ 코드를 WebAssembly(WASM)로 컴파일한 Ammo.js 라이브러리를 사용합니다.

그러나 babylon-mmd는 **emscripten을 사용하지 않는** 다른 접근 방식을 사용합니다. 대신 FFI를 통해 Bullet Physics 엔진을 Rust 소스 코드에 통합한 다음, wasm-bindgen을 사용하여 WASM으로 컴파일합니다.

이 과정에서 모든 Bullet Physics 바인딩 코드는 **수동으로 작성**되어 Ammo.js에 비해 **더 나은 성능**을 제공합니다.

## Bullet Physics 통합 형태

Bullet Physics 엔진은 babylon-mmd에 **두 가지 주요 형태**로 통합됩니다.

### Bullet Physics JavaScript 바인딩

이 바인딩은 JavaScript에서 직접 Bullet Physics 엔진을 호출할 수 있게 해줍니다. 바인딩은 `babylon-mmd/esm/Runtime/Optimized/Physics/Bind` 디렉토리에 위치합니다.

이 방식을 사용하여 MMD 런타임을 생성하는 코드는 다음과 같습니다:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);

const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
```

이 경우 `MultiPhysicsRuntime` 클래스는 **여러 모델의 물리 시뮬레이션을 병렬로 처리**하는 객체로, 시뮬레이션을 제어할 수 있습니다.

### MmdWasmPhysics 사용

이 방식은 Rust로 작성된 `MmdWasmRuntime`에서 Bullet Physics 엔진을 호출합니다. 이 방법은 **JavaScript에 노출된 바인딩을 사용하지 않고** Rust에서 직접 Bullet Physics 엔진을 호출하여 **FFI 오버헤드를 줄입니다**.

이 방식을 사용하여 MMD 런타임을 생성하는 코드는 다음과 같습니다:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPR());
const mmdRuntime = new MmdWasmRuntime(scene, new MmdWasmPhysics(mmdWasmInstance));
```

이 경우에도 `MultiPhysicsRuntime`과 유사한 `MmdWasmPhysicsRuntimeImpl` 클래스를 사용하여 물리 시뮬레이션을 제어할 수 있습니다:

```typescript
const physicsRuntime = mmdRuntime.physics!.getImpl(MmdWasmPhysicsRuntimeImpl);
```

주요 차이점은 `MultiPhysicsRuntime`은 **WASM 리소스를 직접 소유**하는 반면, `MmdWasmPhysicsRuntimeImpl`은 `MmdWasmRuntime`이 소유한 **WASM 리소스를 참조**한다는 것입니다.

## Bullet Physics 바인딩 객체의 메모리 관리

Bullet Physics 엔진 바인딩은 메모리 관리를 위해 **FinalizationRegistry**를 사용합니다.

따라서 `babylon-mmd/esm/Runtime/Optimized/Physics/Bind` 디렉토리의 바인딩 코드를 직접 사용할 때 **메모리가 자동으로 해제됩니다**.

메모리 관리를 수동으로 제어하려면 `dispose()` 메서드를 호출하여 명시적으로 메모리를 해제할 수 있습니다.

```typescript
const rigidBody = new RigidBody(physicsRuntime, rbInfo);
// Use rigidBody
rigidBody.dispose(); // Explicitly release memory
```

## Bullet Physics API 사용하기

`babylon-mmd/esm/Runtime/Optimized/Physics/Bind` 디렉토리의 Bullet Physics 바인딩 코드는 MMD 모델과 관련이 없는 **일반적인 물리 시뮬레이션**에도 사용할 수 있습니다.

다음은 Bullet Physics 바인딩을 사용하여 큐브를 땅에 떨어뜨리는 간단한 예제입니다:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new NullPhysicsRuntime(mmdWasmInstance);
const physicsWorld = new PhysicsWorld(physicsRuntime);

// create ground mesh
const ground = CreatePlane("ground", { size: 120 }, scene);
ground.rotationQuaternion = Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI / 2);

// create ground rigid body with static plane shape
const groundShape = new PhysicsStaticPlaneShape(runtime, new Vector3(0, 0, -1), 0);
const groundRbInfo = new RigidBodyConstructionInfo(wasmInstance);
groundRbInfo.shape = groundShape;
groundRbInfo.setInitialTransform(ground.getWorldMatrix());
groundRbInfo.motionType = MotionType.Static;

const groundRigidBody = new RigidBody(runtime, groundRbInfo);
world.addRigidBody(groundRigidBody);

// create box mesh
const baseBox = CreateBox("box", { size: 2 }, scene);
baseBox.position = new Vector3(0, 20, 0);
baseBox.rotationQuaternion = Quaternion.Identity();

// create box rigid body with box shape
const boxShape = new PhysicsBoxShape(runtime, new Vector3(1, 1, 1));
const boxRbInfo = new RigidBodyConstructionInfo(wasmInstance);
boxRbInfo.shape = boxShape;
boxRbInfo.setInitialTransform(baseBox.getWorldMatrix());
boxRbInfo.motionType = MotionType.Dynamic;

// create box rigid body
const boxRigidBody = new RigidBody(runtime, boxRbInfo);
world.addRigidBody(boxRigidBody);

const matrix = new Matrix();

// register onBeforeRenderObservable to update physics simulation
scene.onBeforeRenderObservable.add(() => {
    world.stepSimulation(1 / 60, 10, 1 / 60);

    boxRigidBody.getTransformMatrixToRef(matrix);
    matrix.getTranslationToRef(baseBox.position);
    Quaternion.FromRotationMatrixToRef(matrix, baseBox.rotationQuaternion!);
});
```

Bullet Physics 바인딩은 **여러 컴포넌트**로 구성되어 있으며, 상황에 따라 필요한 컴포넌트만 선택하여 사용할 수 있습니다.

- `PhysicsShape`: 물리 시뮬레이션에서 사용되는 충돌 형태를 나타내는 클래스입니다.
  - Bullet Physics의 `btCollisionShape`에 해당합니다.
- `RigidBody`: 물리 시뮬레이션에서 사용되는 강체를 나타내는 클래스입니다.
  - Bullet Physics의 `btRigidBody`에 해당합니다.
- `RigidBodyConstructionInfo`: 강체 생성을 위한 정보를 포함하는 클래스입니다.
  - Bullet Physics의 `btRigidBody::btRigidBodyConstructionInfo`에 해당합니다.
- `Constraint`: 물리 시뮬레이션에서 사용되는 제약 조건을 나타내는 클래스입니다.
  - Bullet Physics의 `btTypedConstraint`에 해당합니다.
- `PhysicsWorld`: 물리 시뮬레이션을 관리하는 클래스입니다.
  - Bullet Physics의 `btDynamicsWorld`에 해당합니다.
- `PhysicsRuntime`: Buffered Evaluation 처리 로직이 포함된 `PhysicsWorld`의 래퍼 클래스입니다.

### Physics Shape

Physics Shape는 물리 시뮬레이션에서 사용되는 충돌 형태를 나타내는 클래스입니다.

babylon-mmd는 다음과 같은 Physics Shape 클래스들을 제공합니다:

- `PhysicsBoxShape`: 박스 충돌 형태를 나타내는 클래스입니다.
  - Bullet Physics의 `btBoxShape`에 해당합니다.
- `PhysicsSphereShape`: 구체 충돌 형태를 나타내는 클래스입니다.
  - Bullet Physics의 `btSphereShape`에 해당합니다.
- `PhysicsCapsuleShape`: 캡슐 충돌 형태를 나타내는 클래스입니다.
  - Bullet Physics의 `btCapsuleShape`에 해당합니다.
- `PhysicsStaticPlaneShape`: 무한 평면 충돌 형태를 나타내는 클래스입니다.
  - Bullet Physics의 `btStaticPlaneShape`에 해당합니다.

Bullet Physics는 다른 많은 Physics Shape를 지원하지만, babylon-mmd는 **MMD 모델에 필요한 충돌 형태 바인딩만** 구현했습니다.

### Rigid Body

RigidBody는 물리 시뮬레이션에서 사용되는 강체를 나타냅니다.

RigidBody 클래스를 생성하려면 `RigidBodyConstructionInfo` 객체를 **사용하여 초기화**해야 합니다.

RigidBody 클래스는 **두 가지 유형의 구현**으로 제공됩니다:
- `RigidBody`: 단일 RigidBody 객체를 나타내는 클래스입니다.
- `RigidBodyBundle`: 여러 RigidBody 객체를 하나의 객체로 묶어서 처리할 수 있는 클래스입니다.

`RigidBodyBundle` 클래스는 여러 RigidBody 객체를 한 번에 생성할 때 RigidBody 객체 간의 Memory Locality를 개선하여 **더 나은 성능**을 제공합니다.

`RigidBodyBundle`을 효율적으로 초기화하기 위해 `RigidBodyConstructionInfoList` 클래스도 제공됩니다.

`RigidBodyConstructionInfoList` 클래스는 여러 RigidBodyConstructionInfo 객체를 하나의 객체로 묶어서 처리할 수 있는 클래스입니다.

다음은 `RigidBodyBundle`을 사용하는 예제입니다:

```typescript
const boxShape = new PhysicsBoxShape(runtime, new Vector3(1, 1, 1));

const rbCount = 10;
const rbInfoList = new RigidBodyConstructionInfoList(wasmInstance, rbCount);
for (let k = 0; k < rbCount; ++k) {
    rbInfoList.setShape(k, boxShape);
    const initialTransform = Matrix.TranslationToRef(xOffset, 1 + k * 2, zOffset, matrix);
    rbInfoList.setInitialTransform(k, initialTransform);
    rbInfoList.setFriction(k, 1.0);
    rbInfoList.setLinearDamping(k, 0.3);
    rbInfoList.setAngularDamping(k, 0.3);
}
const boxRigidBodyBundle = new RigidBodyBundle(runtime, rbInfoList);
world.addRigidBodyBundle(boxRigidBodyBundle, worldId);
```

### Constraint

Constraint는 물리 시뮬레이션에서 사용되는 제약 조건을 나타냅니다.

babylon-mmd는 다음과 같은 Constraint 클래스들을 제공합니다:

- `Generic6DofConstraint`: 6자유도 제약 조건을 나타내는 클래스입니다.
  - Bullet Physics의 `btGeneric6DofConstraint`에 해당합니다.
- `Generic6DofSpringConstraint`: 스프링이 있는 6자유도 제약 조건을 나타내는 클래스입니다.
  - Bullet Physics의 `btGeneric6DofSpringConstraint`에 해당합니다.

Bullet Physics는 다른 많은 Constraint를 지원하지만, babylon-mmd는 **MMD 모델에 필요한 제약 조건 바인딩만** 구현했습니다.

### Physics World

PhysicsWorld는 물리 시뮬레이션을 관리하는 클래스입니다.

PhysicsWorld 클래스는 **두 가지 유형의 구현**으로 제공됩니다:
- `PhysicsWorld`: 단일 물리 시뮬레이션 월드를 나타내는 클래스입니다.
- `MultiPhysicsWorld`: 여러 물리 시뮬레이션 월드를 병렬로 처리하는 클래스입니다.
  - 각 월드 간의 상호작용을 위한 API가 제공됩니다.

RigidBody와 Constraint 객체는 물리 시뮬레이션에 참여하기 위해 PhysicsWorld 또는 MultiPhysicsWorld 객체에 **반드시 추가되어야** 합니다.

### Physics Runtime

PhysicsRuntime은 **Buffered Evaluation** 처리 로직이 포함된 PhysicsWorld의 래퍼 클래스입니다.

PhysicsRuntime 클래스는 **세 가지 유형의 구현**으로 제공됩니다:

- `NullPhysicsRuntime`: 런타임 없이 PhysicsWorld를 사용하기 위한 클래스입니다.
- `PhysicsRuntime`: PhysicsWorld를 처리하는 클래스입니다.
- `MultiPhysicsRuntime`: MultiPhysicsWorld를 처리하는 클래스입니다.

`PhysicsRuntime`과 `MultiPhysicsRuntime` 클래스는 Buffered Evaluation을 지원합니다. 이는 **멀티 스레딩이 가능한** 환경에서 `PhysicsRuntime.evaluationType` 속성을 `PhysicsRuntimeEvaluationType.Buffered`로 설정하면, 물리 시뮬레이션이 **별도의 워커 스레드**에서 처리된다는 의미입니다.

```typescript
physicsRuntime.evaluationType = PhysicsRuntimeEvaluationType.Buffered;
```

:::info
`PhysicsWorld` 또는 `MultiPhysicsWorld` 객체는 락을 사용하여 동기화를 적절히 처리하는 작업을 수행하지만, 이를 직접 구현하는 것은 **매우 어렵습니다**.

따라서 Buffered Evaluation을 사용할 때 런타임 없이 `NullPhysicsRuntime`을 사용하여 물리 시뮬레이션을 제어하는 것은 **매우 복잡한 작업**이므로 권장하지 않습니다.
:::

:::info
MMD 런타임과 호환되는 Physics Runtime은 `MultiPhysicsRuntime`이며, 다른 Physics Runtime은 MMD 런타임과 **호환되지 않습니다**.
:::

## 추가 리소스

Bullet Physics 바인딩은 처음에 `babylon-bulletphysics` 리포지토리에서 개발되었으며 나중에 babylon-mmd에 통합되었습니다.

따라서 `babylon-bulletphysics` 리포지토리에서 Bullet Physics 바인딩에 대한 [더 많은 예제와 테스트 코드](https://github.com/noname0310/babylon-bulletphysics/tree/main/src/Test/Scene)를 확인할 수 있습니다.
