---
sidebar_position: 1
sidebar_label: MMD 카메라
---

# MMD 카메라

이 섹션에서는 MMD의 카메라 동작을 재현하는 **`MmdCamera`** 클래스와 **`IMmdCamera`** 인터페이스에 대해 설명합니다.

## MmdCamera 클래스

![Orbit Camera](@site/docs/reference/runtime/mmd-camera/orbit-camera.png)
*MMD 카메라 궤도 경로의 시각적 표현*

MMD의 카메라는 중심 위치를 중심으로 회전하는 **오빗 카메라**입니다.
**`MmdCamera`** 클래스는 이를 재현하므로, 카메라를 제어하는 매개변수는 다음과 같습니다:

- **position** (Vector3) - 궤도 중심 위치
- **rotation** (Vector3) - Yaw Pitch Roll
- **distance** (number) - 궤도 중심으로부터의 거리
- **fov** (number) - 라디안 단위의 시야각

**`MmdCamera`** 클래스는 Babylon.js **`Camera`** 클래스를 상속합니다. 따라서 다른 Babylon.js 카메라와 마찬가지로 씬에 추가하여 사용할 수 있습니다.

## 카메라 생성하기

다음 코드로 **`MmdCamera`** 를 생성하고 씬에 추가할 수 있습니다:

```typescript
const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene, true);
```

각 매개변수는 순서대로 다음을 의미합니다:
- **name**: 카메라 이름
- **position**: 초기 궤도 중심값 (기본값: (0, 10, 0))
- **scene**: 카메라를 추가할 씬 (기본값: Engine.LastCreatedScene)
- **setActiveOnSceneIfNoneActive**: 생성 후 다른 카메라가 정의되지 않은 경우 이 카메라를 씬의 활성 카메라로 설정할지 여부 (기본값: true)

## 애니메이션 바인딩

**`MmdCamera`** 는 VMD 또는 BVMD 파일에서 생성된 **`MmdAnimation`** 을 바인딩하여 사용할 수 있습니다.

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadAsync("path/to/file.vmd");

const mmdCamera = new MmdCamera("camera", new Vector3(0, 10, 0), scene);
const animationHandle: MmdRuntimeAnimationHandle = mmdCamera.createRuntimeAnimation(mmdAnimation);
```

위 코드는 VMD 파일을 로드하여 **`MmdAnimation`** 을 생성하고 **`MmdCamera`** 에 바인딩하는 예제입니다.

**`MmdCamera.createRuntimeAnimation`** 메서드를 사용하여 바인딩된 "런타임 애니메이션"을 생성할 수 있습니다. 함수가 반환하는 결과는 실제 런타임 애니메이션 객체가 아니라 객체에 대한 핸들입니다.

### runtimeAnimations

생성된 런타임 애니메이션 객체는 **`MmdCamera.runtimeAnimations`** 에 추가됩니다.

이를 통해 프록시가 아닌 실제 런타임 애니메이션 객체에 접근하여 더 낮은 수준의 제어가 가능합니다.

## 애니메이션 사용하기

바인딩된 런타임 애니메이션을 사용하려면 **`MmdCamera.setRuntimeAnimation`** 메서드를 호출합니다:

```typescript
mmdCamera.setRuntimeAnimation(animationHandle);
```

기본적으로 **`MmdCamera`** 객체는 한 번에 하나의 애니메이션만 재생할 수 있습니다.

현재 설정된 애니메이션을 제거하려면 **`null`** 을 인수로 전달합니다:

```typescript
mmdCamera.setRuntimeAnimation(null);
```

현재 설정된 애니메이션은 **`MmdCamera.currentAnimation`** 속성을 통해 접근할 수 있습니다.

## 런타임 애니메이션 제거하기

**`MmdCamera`** 에 바인딩된 런타임 애니메이션을 제거하려면 **`destroyRuntimeAnimation`** 메서드를 호출합니다:

```typescript
mmdCamera.destroyRuntimeAnimation(animationHandle);
```

더 이상 사용되지 않는 카메라 런타임 애니메이션을 제거하지 않으면 메모리 누수는 발생하지 않지만, 일부 특수한 경우에 런타임 오류가 발생할 수 있습니다.

## 애니메이션 평가하기

**`MmdCamera.animate()`** 메서드를 사용하여 현재 설정된 애니메이션을 평가할 수 있습니다.

이 메서드는 **일반적으로 직접 호출되지 않고** MMD 런타임에 의해 호출됩니다.

MmdCamera를 수동으로 제어하는 경우, 이 메서드를 호출하여 애니메이션을 평가할 수 있습니다:

```typescript
let sec = 0;
scene.onBeforeRenderObservable.add(() => {
    const frameTime = sec * 30; // MMD는 30fps로 동작합니다
    mmdCamera.animate(frameTime); // 애니메이션을 평가합니다. 30프레임 단위로 스케일된 시간을 매개변수로 전달합니다
    sec += engine.getDeltaTime() / 1000;
});
```

## IMmdCamera 인터페이스

babylon-mmd는 사용자가 자신만의 MMD 카메라를 구현할 수 있도록 **`IMmdCamera`** 인터페이스를 제공합니다.

babylon-mmd의 모든 구성 요소는 MMD 카메라 객체를 참조하거나 전달할 때 **`MmdCamera`** 클래스 타입 대신 **`IMmdCamera`** 인터페이스를 사용합니다.
