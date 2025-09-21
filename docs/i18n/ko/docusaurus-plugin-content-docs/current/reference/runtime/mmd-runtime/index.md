---
sidebar_position: 2
sidebar_label: MMD 런타임
---

# MMD 런타임

## MmdRuntime 클래스

`MmdRuntime`은 **babylon-mmd 런타임 컴포넌트의 핵심 클래스**입니다.
`MmdRuntime`은 다른 모든 런타임 컴포넌트를 참조하고 제어하여 MMD 모델에 애니메이션을 적용합니다.

`MmdRuntime`은 다음과 같은 기능을 제공합니다:
- **여러 MMD 모델**을 동시에 제어
- **여러 MMD 카메라**를 동시에 제어
- **카메라 애니메이션** 적용
- **물리 시뮬레이션** 제어

다음은 `MmdRuntime`을 생성하는 코드입니다:

```typescript
const mmdRuntime = new MmdRuntime(scene, null);
```

`MmdRuntime`의 생성자는 두 개의 인수를 받습니다:
- `scene`: `Scene` 객체가 제공되면 `MmdRuntime`의 생명주기가 `Scene` 객체와 연결됩니다. 즉, `Scene`이 해제되면 `MmdRuntime`도 **자동으로 해제**됩니다. `null`이 제공되면 `MmdRuntime`의 `dispose()` 메서드를 **수동으로 호출**해야 하며, 그렇지 않으면 **메모리 누수**가 발생할 수 있습니다.
- `physics`: 물리 시뮬레이션 구현을 제공합니다. `null`이 제공되면 **물리 시뮬레이션이 비활성화**됩니다. 물리 시뮬레이션을 활성화하려면 `MmdBulletPhysics`, `MmdAmmoPhysics`, `MmdPhysics`와 같은 `IMmdPhysics` 인터페이스를 구현하는 클래스의 인스턴스를 제공해야 합니다.

물리 시뮬레이션을 처리하는 로직은 `MmdRuntime`에 **포함되지 않고** **외부에서 주입**됩니다.

이러한 설계를 통해 물리 엔진 구현을 **쉽게 교체**하고, 자신만의 **커스텀 물리 엔진**을 구현하며, 사용하는 구현만 번들에 포함하여 **번들 크기를 줄일** 수 있습니다.

### 프레임 업데이트

애니메이션을 처리하려면 **매 프레임마다** `MmdRuntime.beforePhysics()`와 `MmdRuntime.afterPhysics()` 업데이트 함수를 호출해야 합니다.

이 두 메서드는 각각 물리 시뮬레이션이 실행되기 **전과 후에** 호출되어야 합니다.

따라서 `MmdRuntime`을 사용하는 애플리케이션은 다음과 같은 프레임 루프를 가져야 합니다:

```typescript
// 프레임 루프를 위한 의사 코드
for (; ;) {
    mmdRuntime.beforePhysics();
    simulatePhysics();
    mmdRuntime.afterPhysics();
    render();
}
```

매 프레임마다 이 두 메서드를 호출하는 가장 쉬운 방법은 `Scene`의 `onBeforeAnimationsObservable`과 `onBeforeRenderObservable` 이벤트에 콜백을 등록하는 것입니다.

`MmdRuntime.register()` 메서드는 `Scene` 객체를 인수로 받아 내부적으로 이 두 이벤트에 콜백을 등록하여 `beforePhysics()`와 `afterPhysics()`가 **자동으로 호출**되도록 합니다.

```typescript
mmdRuntime.register(scene);
```

`MmdRuntime` 업데이트를 일시적으로 중단하려면 `MmdRuntime.unregister()` 메서드를 호출하여 등록된 콜백을 제거할 수 있습니다.

```typescript
mmdRuntime.unregister(scene);
```

### 재생 제어

`MmdRuntime`의 핵심 기능 중 하나는 MMD 애니메이션 재생을 제어하는 것입니다.

`MmdRuntime`은 애니메이션을 제어하기 위해 다음과 같은 메서드를 제공합니다:
- `playAnimation(): Promise<void>`: 애니메이션 재생을 **시작**합니다.
- `pauseAnimation(): void`: 애니메이션 재생을 **일시 정지**합니다.
- `seekAnimation(frameTime: number, forceEvaluate: boolean = false): Promise<void>`: **애니메이션을 특정 프레임으로 이동**합니다. `forceEvaluate`가 `true`로 설정되면 이동 후 즉시 애니메이션이 평가됩니다. 그렇지 않으면 다음 `beforePhysics(): void` 호출 시 평가됩니다.
- `setManualAnimationDuration(frameTimeDuration: Nullable<number>): void`: **애니메이션의 총 프레임 시간을 수동으로 설정**합니다. 기본적으로 애니메이션의 총 길이는 평가에 참여하는 모든 MMD 애니메이션 중 가장 긴 것으로 자동 설정됩니다. 이 메서드는 여러 애니메이션 클립이 있거나 애니메이션 클립이 없을 때 유용합니다. `null`이 제공되면 자동 모드로 돌아갑니다.

`MmdRuntime`은 애니메이션 상태를 확인하기 위해 다음과 같은 속성을 제공합니다:
- `isAnimationPlaying: boolean`: 애니메이션이 **현재 재생 중**인지 나타내는 불린 값입니다.
- `timeScale: number`: **애니메이션 재생 속도**를 제어하는 숫자 값입니다. 기본값은 `1.0`입니다.
- `currentFrameTime: number`: 애니메이션의 **현재 프레임 시간**을 나타내는 숫자 값입니다.
- `currentTime: number`: 애니메이션의 **현재 시간**을 초 단위로 나타내는 숫자 값입니다.
- `animationFrameTimeDuration: number`: 애니메이션의 **총 프레임 시간 길이**를 나타내는 숫자 값입니다.
- `animationDuration: number`: 애니메이션의 **총 길이**를 초 단위로 나타내는 숫자 값입니다.

:::info
`MmdRuntime`은 내부적으로 시간을 나타내기 위해 **프레임 시간**을 사용합니다. MMD 애니메이션은 **초당 30프레임**으로 재생되므로 1초는 30 프레임 시간에 해당합니다. 예를 들어, `currentFrameTime`이 `60`이면 애니메이션이 2초 동안 재생되었음을 의미합니다.
:::

### Animatable

`MmdRuntime`은 **임의의 애니메이션 가능한 객체**를 제어하는 기능을 제공합니다.

MMD 모델의 경우 `MmdRuntime`이 **직접 애니메이션 계산을 처리**하지만, MMD 모델이 아닌 객체의 경우 각 객체가 자신의 애니메이션을 계산하도록 **위임**됩니다.

이러한 객체들은 `IMmdRuntimeAnimatable` 인터페이스를 구현해야 하며, `MmdRuntime`의 `addAnimatable()` 메서드를 통해 등록할 수 있습니다.

`IMmdRuntimeAnimatable` 인터페이스를 구현하는 대표적인 예시는 `MmdCamera` 클래스입니다.

다음은 `MmdCamera` 객체를 `MmdRuntime`에 등록하고 애니메이션을 재생하는 예시 코드입니다:

```typescript
// MmdRuntime 초기화
const mmdRuntime = new MmdRuntime(scene, null);
mmdRuntime.register(scene);

// VMD 애니메이션 로드
const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadAsync("motion", "path/to/motion.vmd");

// MmdCamera 생성 및 애니메이션 설정
const camera = new MmdCamera();
const runtimeAnimation = camera.createRuntimeAnimation(mmdAnimation);
camera.setRuntimeAnimation(runtimeAnimation);

// MmdCamera를 MmdRuntime에 추가하고 애니메이션 재생
mmdRuntime.addAnimatable(camera);
mmdRuntime.playAnimation();
```

## MmdModel 클래스

`MmdModel`은 MMD 모델을 나타내는 클래스입니다. `MmdModel`은 MMD 모델의 **루트 메시**(일명 MMD 메시)를 래핑하고 모델의 **본, 모프, 물리 시뮬레이션** 등을 제어하는 인터페이스를 제공합니다.

`MmdModel`은 기본적으로 `MmdRuntime`에 의해 제어되며, `MmdRuntime`의 `createMmdModel()` 또는 `createMmdModelFromSkeleton()` 메서드를 통해서**만 생성**할 수 있습니다.

다음은 PMX 모델을 로드하고 `MmdModel`을 생성하는 예시 코드입니다:

```typescript
// MmdRuntime 초기화
const mmdRuntime = new MmdRuntime(scene, null);
mmdRuntime.register(scene);

// VMD 애니메이션 로드
const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadAsync("motion", "path/to/motion.vmd");

// PMX 모델 로드
const assetContainer = await LoadAssetContainerAsync("path/to/model.pmx", scene)
assetContainer.addAllToScene();
const rootMesh = assetContainer.meshes[0] as Mesh;

// MmdModel 생성 및 애니메이션 설정
const mmdModel = mmdRuntime.createMmdModel(rootMesh);
const runtimeAnimation = mmdModel.createRuntimeAnimation(mmdAnimation);
mmdModel.setRuntimeAnimation(runtimeAnimation);

// 애니메이션 재생
mmdRuntime.playAnimation();
```

`MmdModel` 인스턴스가 생성되는 순간부터 MMD 메시의 **다양한 리소스**가 `MmdModel`에 의해 관리됩니다. 여기에는 `Mesh`, `Skeleton`, `Bone`, `Morph Target`, `Material` 등이 포함됩니다.

:::warning
`MmdModel`에서 관리하는 리소스에 **직접 접근하거나 수정**하는 것은 **권장되지 않습니다**.
특히 `Skeleton`의 경우 `MmdModel`이 내부적으로 계산 방법을 재정의하므로, `MmdModel`에서 관리하는 `Skeleton`이나 `Bone` 객체의 메서드를 직접 호출하면 **예상치 못한 동작**이 발생할 수 있습니다.
:::

`MmdModel`을 파괴하면 해당 MMD 메시가 런타임에서 제거되고 모델에서 관리하던 모든 리소스가 해제됩니다.

```typescript
mmdRuntime.destroyMmdModel(mmdModel);
```

`MmdModel` 객체의 주요 속성은 다음과 같습니다:

- `mesh: MmdSkinnedMesh | TrimmedMmdSkinnedMesh`: MMD 모델의 **루트 메시**입니다.
- `skeleton: IMmdLinkedBoneContainer`: MMD 모델의 **스켈레톤**입니다.
- `worldTransformMatrices: Float32Array`: MMD 모델의 **월드 변환 행렬 배열**입니다. 각 본의 월드 변환 행렬을 포함합니다.
- `ikSolverStates: Uint8Array`: MMD 모델의 **IK 솔버 상태 배열**입니다. 각 IK 본의 활성화 상태를 포함합니다.
- `rigidBodyStates: Uint8Array`: MMD 모델의 **강체 상태 배열**입니다. 각 강체의 활성화 상태를 포함합니다.
- `runtimeBones: readonly IMmdRuntimeBone[]` : MMD 모델의 **본**을 나타내는 `MmdRuntimeBone` 객체의 배열입니다.
- `morph: MmdMorphController`: MMD 모델의 **모프**를 제어하는 `MmdMorphController` 객체입니다.

### MmdModel 생성 옵션

`MmdRuntime`의 `createMmdModel()` 메서드를 사용하여 `MmdModel`을 생성할 때, 두 번째 인수로 **옵션 객체**를 전달하여 모델의 동작을 사용자 정의할 수 있습니다.

```typescript
const mmdModel = mmdRuntime.createMmdModel(rootMesh, {
    materialProxyConstructor: null,
    buildPhysics: true,
    trimMetadata: true
});
```

옵션 객체는 다음과 같은 속성을 가집니다:

- `materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<TMaterial>>`: 머티리얼 프록시의 생성자 함수입니다. 제공되면 MMD 모델의 각 머티리얼에 대해 머티리얼 프록시가 생성되고 머티리얼 매개변수를 조작하는 데 사용됩니다. 이를 통해 **머티리얼 모프**를 지원할 수 있습니다. 자세한 내용은 [머티리얼 모프 활성화](../enable-material-morphing) 문서를 참조하세요. 기본값은 `null`입니다.
- `buildPhysics: IMmdModelPhysicsCreationOptions | boolean`: 물리 시뮬레이션 생성 옵션입니다. `true`가 제공되면 MMD 모델의 메타데이터를 기반으로 **강체와 제약 조건**이 생성됩니다. `IMmdModelPhysicsCreationOptions` 타입의 객체가 제공되면 강체와 제약 조건 생성에 대한 옵션을 설정할 수 있습니다. 자세한 내용은 [MMD 모델에 물리 적용](../apply-physics-to-mmd-models) 문서를 참조하세요. 기본값은 `true`입니다.
- `trimMetadata: boolean`: `true`가 제공되면 MMD 모델 생성 중에만 사용되는 불필요한 메타데이터가 모델 생성 후 **MMD 메시에서 제거**됩니다. 이를 통해 **메모리 사용량을 줄일** 수 있습니다. 그러나 나중에 같은 MMD 메시에서 `MmdModel`을 다시 생성하려면 이 옵션을 `false`로 설정해야 합니다. 기본값은 `true`입니다.

### MmdRuntimeBone 클래스

`MmdRuntimeBone`은 **MMD 모델의 본**을 나타내는 클래스입니다. Babylon.js `Bone` 클래스를 래핑하고 본의 **모프, IK, Append Transform** 등을 제어하는 인터페이스를 제공합니다.

`MmdModel.runtimeBones` 속성을 통해 `MmdRuntimeBone` 객체에 접근할 수 있습니다.

`MmdRuntimeBone` 객체의 주요 속성은 다음과 같습니다:

- `linkedBone: Bone`: `MmdRuntimeBone`에 의해 래핑된 Babylon.js `Bone` 객체입니다.
- `name: string`: 본의 이름입니다.
- `parentBone: Nullable<MmdRuntimeBone>`: 부모 본입니다. 루트 본인 경우 `null`입니다.
- `childBones: readonly MmdRuntimeBone[]`: 자식 본의 배열입니다.
- `transformOrder: number`: 본의 변환 순서입니다.
- `flag: number`: PMX 본 플래그 값입니다.
- `transformAfterPhysics: boolean`: 물리 시뮬레이션 후에 변환이 적용되는지 여부입니다.
- `worldMatrix: Float32Array`: 본의 월드 변환 행렬입니다. `MmdModel.worldTransformMatrices` 배열의 일부를 참조합니다.
- `ikSolverIndex: number`: 본의 IK 솔버 인덱스입니다. IK 본이 아닌 경우 `-1`입니다. `MmdModel.ikSolverStates` 배열을 통해 본의 IK 활성화 상태를 확인할 수 있습니다.
- `rigidBodyIndices: readonly number[]`: 본에 연결된 강체의 인덱스 배열입니다. `MmdModel.rigidBodyStates` 배열을 통해 각 강체의 활성화 상태를 확인할 수 있습니다.

`MmdRuntimeBone`은 또한 다음과 같은 메서드를 제공합니다:

- `getWorldMatrixToRef(target: Matrix): Matrix`: 본의 **월드 변환 행렬**을 `target` 행렬에 복사합니다.
- `getWorldTranslationToRef(target: Vector3): Vector3`: 본의 **월드 위치**를 `target` 벡터에 복사합니다.
- `setWorldTranslation(source: DeepImmutable<Vector3>): void`: 본의 **월드 위치**를 `source` 벡터로 설정합니다.

`MmdRuntimeBone`의 이러한 속성과 메서드는 본의 상태를 **읽거나 설정**하는 데 사용할 수 있습니다.

다음은 `MmdRuntimeBone`의 메서드를 사용하여 MMD 모델의 センター (Center) 본의 월드 위치를 출력하는 예시 코드입니다:

```typescript
const meshWorldMatrix = mmdModel.mesh.getWorldMatrix();
const boneWorldMatrix = new Matrix();

const centerBone = mmdModel.runtimeBones.find(bone => bone.name === "センター")!;

// 본 월드 행렬은 모델 공간을 기준으로 하므로 메시 월드 행렬을 곱해야 합니다.
centerBone.getWorldMatrixToRef(boneWorldMatrix).multiplyToRef(meshWorldMatrix, boneWorldMatrix);

const centerPosition = new Vector3();
boneWorldMatrix.getTranslationToRef(centerPosition);

console.log(`Center bone world position: ${centerPosition.toString()}`);
```

### MmdMorphController 클래스

`MmdMorphController`는 **MMD 모델의 모프**를 제어하는 클래스입니다.
`MmdMorphController`는 **버텍스 모프, 본 모프, UV 모프, 머티리얼 모프** 등을 제어하는 인터페이스를 제공합니다.

`MmdModel.morph` 속성을 통해 `MmdMorphController` 객체에 접근할 수 있습니다.

`MmdMorphController` 객체의 주요 메서드는 다음과 같습니다:

- `setMorphWeight(morphName: string, weight: number): void`: 이름이 `morphName`인 모프의 **가중치를 설정**합니다. 주어진 이름의 모프가 존재하지 않으면 아무 일도 일어나지 않습니다.
- `getMorphWeight(morphName: string): number`: 이름이 `morphName`인 모프의 **현재 가중치**를 반환합니다. 주어진 이름의 모프가 존재하지 않으면 `0`을 반환합니다.
- `getMorphIndices(morphName: string): readonly number[] | undefined`: 이름이 `morphName`인 모프의 **인덱스 배열**을 반환합니다. 주어진 이름의 모프가 존재하지 않으면 `undefined`를 반환합니다.
- `setMorphWeightFromIndex(morphIndex: number, weight: number): void`: **인덱스**가 `morphIndex`인 모프의 가중치를 `weight`로 설정합니다. 주어진 인덱스의 모프가 존재하지 않으면 아무 일도 일어나지 않습니다.
- `getMorphWeightFromIndex(morphIndex: number): number`: **인덱스**가 `morphIndex`인 모프의 현재 가중치를 반환합니다. 주어진 인덱스의 모프가 존재하지 않으면 `undefined`를 반환합니다.
- `getMorphWeights(): Readonly<ArrayLike<number>>`: 모든 모프의 **가중치 배열**을 반환합니다.
- `resetMorphWeights(): void`: 모든 모프의 가중치를 `0`으로 **초기화**합니다.
- `update(): void`: 모프의 **상태를 업데이트**합니다. 일반적으로 `MmdRuntime`에 의해 자동으로 호출되므로 직접 호출할 필요가 없습니다.

:::info
기본적으로 `MmdMorphController`는 모프를 제어하기 위해 **내부적으로 인덱스를 사용**합니다. 따라서 모프 이름을 사용하여 가중치를 설정하거나 가져오는 메서드는 내부적으로 이름을 인덱스로 변환하므로, **성능에 민감한 상황**에서는 **인덱스를 직접 사용**하는 메서드를 사용하는 것이 좋습니다.
:::

## 물리 시뮬레이션

`MmdRuntime`은 물리 시뮬레이션을 위해 주입된 **외부 물리 엔진** 구현을 사용합니다. babylon-mmd는 **세 가지 물리 엔진 구현**을 제공합니다:
- `MmdBulletPhysics`: **Bullet Physics** 엔진을 사용합니다. Bullet Physics는 C++로 작성된 물리 엔진이며, babylon-mmd는 최적화된 **WebAssembly로 컴파일된 버전**을 제공합니다.
- `MmdAmmoPhysics`: **Ammo.js** 엔진을 사용합니다.
- `MmdPhysics`: **Havok Physics** 엔진을 사용합니다.

`MmdRuntime`에서 물리 시뮬레이션을 활성화하려면 `MmdRuntime`을 생성할 때 이러한 클래스 중 하나의 인스턴스를 제공해야 합니다.

물리 시뮬레이션 설정 방법에 대한 자세한 내용은 [MMD 모델에 물리 적용](../apply-physics-to-mmd-models) 문서를 참조하세요.

## WebAssembly 구현

`MmdRuntime`에서 IK 해결, Append Transform, 모프 처리는 모두 **TypeScript**로 구현되어 브라우저의 JavaScript 엔진에서 처리됩니다.

babylon-mmd는 또한 **더 빠른 성능**을 위해 **WebAssembly (WASM)**로 구현된 `MmdWasmRuntime`을 제공합니다. `MmdWasmRuntime`은 `MmdRuntime`과 거의 동일한 API를 제공하며, IK 해결, Append Transform, 모프, 물리 시뮬레이션을 WebAssembly에서 처리하여 **더 나은 성능**을 제공합니다.

그러나 WASM 구현은 **임의로 사용자 정의하기 어렵고** **특수한 런타임 환경**(예: React Native)에서는 **제한이 있을 수** 있습니다.

자세한 내용은 [MMD WebAssembly Runtime](../mmd-webassembly-runtime) 문서를 참조하세요.
