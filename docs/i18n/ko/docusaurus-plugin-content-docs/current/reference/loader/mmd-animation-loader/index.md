---
sidebar_position: 2
sidebar_label: MMD 애니메이션 로더 (VmdLoader, VpdLoader)
---

# MMD 애니메이션 로더 (VmdLoader, VpdLoader)

이 섹션에서는 **MMD 애니메이션 파일**(**VMD**, **VPD**)을 로드하는 데 사용되는 컴포넌트에 대해 설명합니다.

**MMD 애니메이션**은 **`VmdLoader`**를 사용하여 로드할 수 있으며, 포즈 데이터도 **`VpdLoader`**를 사용하여 애니메이션으로 로드할 수 있습니다.

## VmdLoader

**`VmdLoader`**는 MMD 애니메이션 파일 형식인 **보컬로이드 모션 데이터(VMD)** 파일을 로드하는 데 사용됩니다. 이 로더는 VMD 파일에서 애니메이션 데이터를 읽고 babylon-mmd 런타임에 적용할 수 있는 방식으로 로드합니다.

**`VmdLoader`**는 VMD 파일을 파싱하고 **`MmdAnimation`** 인스턴스를 반환하는 여러 메서드를 제공하며, 가장 기본적인 메서드는 **`loadAsync`**입니다.

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = await vmdLoader.loadAsync("motion1", "path/to/motion1.vmd");
```

**`loadAsync`** 메서드가 받는 파라미터는 다음과 같습니다:

- **`name`**: 애니메이션의 이름.
- **`fileOrUrl`**: VMD 파일의 URL(`string` 또는 `string[]` 또는 `File` 또는 `File[]`).
- **`onProgress`**: 로딩 진행 상황에 따라 주기적으로 호출되는 콜백 함수.

여기서 주목할 중요한 점은 단일 **`MmdAnimation`** 인스턴스를 생성하기 위해 여러 애니메이션 소스를 받을 수 있다는 것입니다. 예를 들어, 여러 VMD 파일을 하나의 **`MmdAnimation`**으로 로드할 수 있습니다.

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = await vmdLoader.loadAsync("motion1", [
  "path/to/motion1.vmd",
  "path/to/motion2.vmd"
]);
```

이 경우, 두 모션이 결합되며, 배열에서 먼저 나타나는 모션이 우선됩니다. 즉, 두 모션 모두 동일한 프레임에 대한 키프레임을 가지고 있다면, 배열에서 먼저 나타나는 모션의 키프레임이 사용됩니다.

브라우저의 **File API**를 사용하여 로드할 수도 있습니다.

또한 다음과 같은 메서드도 제공됩니다:

- **`load`**: VMD 파일을 동기적으로 로드하며, onLoad 및 onError 콜백을 지원합니다.
- **`loadFromBufferAsync`**/**`loadFromBuffer`**: 여러 **`ArrayBuffer`** 인스턴스를 파싱하여 **`MmdAnimation`**을 로드합니다.
- **`loadFromVmdDataAsync`**/**`loadFromVmdData`**: 여러 **`VmdData`** 인스턴스에서 **`MmdAnimation`**을 로드합니다.
- **`loadFromVmdObjectAsync`**/**`loadFromVmdObject`**: 여러 **`VmdObject`** 인스턴스에서 **`MmdAnimation`**을 로드합니다.

이러한 모든 메서드를 정리하면, **`VmdLoader`**가 지원하는 입력 데이터 형식은 다음과 같습니다:

- VMD 파일 (**`File`** 또는 **`File[]`**, **`string`** 또는 **`string[]`**)
- ArrayBuffer (**`ArrayBuffer`** 또는 **`ArrayBuffer[]`**)
- VMD 데이터 (**`VmdData`** 또는 **`VmdData[]`**)
- VMD 객체 (**`VmdObject`** 또는 **`VmdObject[]`**)

여기서 **`VmdData`**와 **`VmdObject`**는 다음과 같은 타입입니다:

- **`VmdData`**: VMD 데이터가 있는 버퍼를 나타내는 컨테이너 타입
- **`VmdObject`**: 지연 파싱되는 VMD 데이터 객체

이를 사용하여 파싱 메서드를 명시적으로 호출하여 **`MmdAnimation`**을 생성할 수 있습니다:

```typescript
const arrayBuffer = await fetch("path/to/motion1.vmd")
    .then(response => response.arrayBuffer());

const vmdData = VmdData.CheckedCreate(arrayBuffer);
if (vmdData === null) {
    throw new Error("VMD data Validation failed");
}

const vmdObject = VmdObject.Parse(vmdData);

const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadFromVmdObjectAsync("motion1", vmdObject);
```

모든 프로세스를 이와 같이 명시적으로 호출하고 로드할 수 있도록 함으로써, babylon-mmd는 로딩 프로세스 중 수정을 가능하게 하거나 완전히 다른 컨테이너로 로드하는 새로운 로직을 작성할 수 있는 확장성을 제공합니다.

또한, **`VmdLoader`**는 다음과 같은 옵션을 제공합니다:

- **`VmdLoader.optimizeEmptyTracks`**: 애니메이션에 영향을 미치지 않는 트랙을 최적화하고 제거할지 여부를 설정합니다. 기본값은 `true`입니다.
- **`VmdLoader.loggingEnabled`**: 로딩 프로세스 중 로그 출력을 활성화합니다. 값이 `false`이면 발생하는 문제에 대한 로그가 생성되지 않습니다. 기본값은 `false`입니다.

## VpdLoader

**`VpdLoader`**는 MMD 포즈 데이터 파일 형식인 **보컬로이드 포즈 데이터(VPD)** 파일을 로드하는 데 사용됩니다. 이 로더는 VPD 파일에서 포즈 데이터를 읽고 babylon-mmd 런타임에 적용할 수 있는 방식으로 로드합니다.

**`VpdLoader`**도 **`VmdLoader`**와 유사한 방식으로 **`MmdAnimation`**을 반환하는 여러 메서드를 제공합니다. 가장 기본적인 메서드는 **`loadAsync`**입니다.

```typescript
const vpdLoader = new VpdLoader();
const mmdAnimation: MmdAnimation = await vpdLoader.loadAsync("pose1", "path/to/pose1.vpd");
```

이때 생성되는 애니메이션은 1프레임 애니메이션입니다.

제공되는 다른 로드 메서드는 다음과 같습니다:

- **`load`**: VPD 파일을 동기적으로 로드하며, onLoad 및 onError 콜백을 지원합니다.
- **`loadFromBufferAsync`**/**`loadFromBuffer`**: **`ArrayBuffer`** 인스턴스를 파싱하여 **`MmdAnimation`**을 로드합니다.
- **`loadFromVpdObjectAsync`**/**`loadFromVpdObject`**: **`VpdObject`** 인스턴스에서 **`MmdAnimation`**을 로드합니다.

**`VmdLoader`**와 달리, **`VpdLoader`**는 여러 VPD 파일을 한 번에 로드하는 것을 지원하지 않습니다.

**`VpdLoader`**가 지원하는 입력 데이터 형식은 다음과 같습니다:

- VPD 파일 (**`File`** 또는 **`string[]`**)
- ArrayBuffer (**`ArrayBuffer`**)
- VPD 객체 (**`VpdObject`**)

여기서 **`VpdObject`**는 VPD 파일에서 파싱된 데이터를 나타내는 객체입니다.

VMD와 달리 VPD 파일은 지연 파싱을 지원하지 않으므로 VpdObject는 클래스가 아닌 자바스크립트 객체로 표현됩니다.

이를 사용하여 다음과 같이 파싱 메서드를 명시적으로 호출하여 **`MmdAnimation`**을 생성할 수 있습니다:

```typescript
const arrayBuffer = await fetch("path/to/pose1.vpd")
    .then(response => response.arrayBuffer());

const textDecoder = new TextDecoder("shift_jis");

const text = textDecoder.decode(arrayBuffer);

const vpdObject = VpdReader.Parse(text);

const vpdLoader = new VpdLoader();
const mmdAnimation = await vpdLoader.loadFromVpdObjectAsync("pose1", vpdObject);
```

또한, **`VpdLoader.loggingEnabled`** 옵션을 통해 로딩 프로세스 중 로그 출력을 활성화할 수 있습니다. 이 옵션의 기본값은 `false`입니다.

## MmdAnimation

기본적으로, **MMD 애니메이션**은 Babylon.js 애니메이션 런타임과 별도의 애니메이션 런타임에서 실행됩니다. 이는 MMD 애니메이션과 Babylon.js 애니메이션 런타임 간의 사양 차이가 통합하기에는 너무 크기 때문입니다.

따라서, MMD 애니메이션을 저장하는 컨테이너도 기본적으로 Babylon.js의 **`Animation`**과 **`AnimationGroup`** 대신 babylon-mmd에서 제공하는 **`MmdAnimation`**을 사용합니다.

**`MmdAnimation`**의 속성은 다음과 같습니다:

|속성명|타입|설명|
|---|---|---|
|**`name`**|**`string`**|애니메이션 이름|
|**`boneTracks`**|**`MmdBoneAnimationTrack[]`**|본의 위치 및 회전 애니메이션 트랙 목록|
|**`movableBoneTracks`**|**`MmdMovableBoneAnimationTrack[]`**|본의 회전 애니메이션 트랙 목록|
|**`morphTracks`**|**`MmdMorphAnimationTrack[]`**|모프 애니메이션 트랙 목록|
|**`propertyTrack`**|**`MmdPropertyAnimationTrack`**|가시성 및 Ik 토글 애니메이션 트랙|
|**`cameraTrack`**|**`MmdCameraAnimationTrack`**|카메라 애니메이션 트랙|

:::info
모든 애니메이션 트랙은 TypedArrays로 표현되며 기본적으로 불변으로 간주됩니다.

이는 나중에 언급될 WebAssembly 관련 최적화를 용이하게 하기 위한 제약입니다. 데이터 수정이 안전하다는 것을 알고 있다면, 문제 없이 트랙 값을 수정할 수 있습니다.
:::

**`MmdAnimation`**의 주목할 만한 측면은 모델 애니메이션을 나타내는 네 가지 트랙 타입(**`boneTracks`**, **`movableBoneTracks`**, **`morphTracks`**, **`propertyTrack`**)과 카메라 애니메이션을 나타내는 **`cameraTrack`**이 분리되어 있다는 것입니다.

따라서, vmd 애니메이션을 로드할 때, 모델 애니메이션과 카메라 애니메이션을 단일 **`MmdAnimation`** 인스턴스로 로드할 수 있습니다.

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = await vmdLoader.loadAsync("motion1", [
    "path/to/model/anim.vmd",
    "path/to/camera/anim.vmd"
]);
```

이 경우, 애니메이션은 나중에 MMD 모델과 카메라 모두에 적용할 수 있습니다.
