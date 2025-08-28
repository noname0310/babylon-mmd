---
sidebar_position: 0
sidebar_label: Overview
---

# 오버뷰

이 섹션에서는 babylon-mmd가 제공하는 기능들에 대한 개요를 설명합니다.

## 라이브러리 개요

babylon-mmd는 미쿠미쿠댄스(MMD) 모델과 애니메이션을 위한 Babylon.js 로더와 런타임을 제공하는 타입스크립트로 작성된 라이브러리입니다. 현재 npm 패키지로 배포되고 있습니다.

이 라이브러리는 ESM 또는 UMD 모듈로 사용할 수 있습니다. UMD 빌드는 Babylon.js 플레이그라운드와 같은 환경에서 사용할 수 있습니다.

이 문서는 웹팩과 같은 번들러를 사용하는 ESM 모듈 기반 프로젝트에서의 사용법을 기준으로 작성되었습니다.

## babylon-mmd의 Hello World

이 섹션에서는 간단한 예제를 통해 babylon-mmd의 개요를 살펴보겠습니다.
이 예제는 MMD 모델을 로드하고, 카메라와 라이팅을 설정하고, 오디오와 함께 애니메이션을 재생하는 방법을 보여줍니다.

:::info

예제를 간결하게 유지하기 위해 사이드 이펙트를 제외한 임포트 문은 생략되었습니다.

:::

```typescript showLineNumbers
// side effects that register the loader
import "babylon-mmd/esm/Loader/pmxLoader";

// side effects that register the animation runtime
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";

async function build(canvas: HTMLCanvasElement, engine: Engine): Scene {
    const scene = new Scene(engine);
    scene.ambientColor = new Color3(0.5, 0.5, 0.5);

    const camera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);

    const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
    directionalLight.intensity = 1.0;
    
    const ground = CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
    
    const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
    const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
    physicsRuntime.setGravity(new Vector3(0, -98, 0));
    physicsRuntime.register(scene);
    
    // MMD runtime for solving morph, append transform, IK, animation, physics
    const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
    mmdRuntime.register(scene);
    
    // For synced audio playback
    const audioPlayer = new StreamAudioPlayer(scene);
    audioPlayer.source = "your_audio_path.mp3";
    mmdRuntime.setAudioPlayer(audioPlayer);
    
    // You can also run the animation before it loads. This will allow the audio to run first.
    mmdRuntime.playAnimation();

    // create a youtube-like player control
    new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
    
    const vmdLoader = new VmdLoader(scene);

    const cameraAnimation = await vmdLoader.loadAsync("camera_motion", "your_camera_motion_path.vmd");
    const cameraRuntimeAnimationHandle = camera.createRuntimeAnimation(cameraAnimation);
    camera.setRuntimeAnimation(cameraRuntimeAnimationHandle);
    mmdRuntime.addAnimatable(camera);

    const assetContainer = await LoadAssetContainerAsync("path/to/your_file.pmx", scene);
    assetContainer.addAllToScene();
    const mmdMesh = assetContainer.meshes[0] as MmdMesh;

    const mmdModel = mmdRuntime.createMmdModel(mmdMesh);
    const modelMotion = await vmdLoader.loadAsync("model_motion", "your_model_motion_path.vmd");
    const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(modelMotion);
    mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);

    return scene;
}
```

Babylon.js 플레이그라운드에서 시도해 볼 수 있습니다. https://www.babylonjs-playground.com/#S7XDNP

각 요소가 제공하는 기능을 살펴보겠습니다.

- [**1-6줄**](#사이드-이펙트-1-6줄): 씬 로딩에 필요한 사이드 이펙트를 등록합니다.

- [**9-17줄**](#씬-생성-9-17줄): 씬을 생성하고 카메라와 라이팅을 설정합니다.

- [**19-34줄**](#mmd-런타임-생성-19-34줄): MMD 런타임을 생성하고 피직스 엔진을 설정합니다. 또한 오디오와 애니메이션을 동기화하기 위한 오디오 플레이어를 구성합니다.

- [**36-37줄**](#mmd-플레이어-컨트롤-생성-36-37줄): MMD 플레이어 컨트롤을 생성합니다.

- [**39-44줄**](#vmd-로더-39-44줄): VMD 로더를 사용하여 카메라 애니메이션을 로드하고 카메라에 런타임 애니메이션을 설정합니다.

- [**46-53줄**](#pmx-로더-46-53줄): PMX 로더를 사용하여 MMD 모델을 로드하고 VMD 로더를 사용하여 모델 애니메이션을 로드합니다. 그리고 런타임 애니메이션을 설정합니다.

## 사이드 이펙트 (1-6줄)

```typescript
// side effects that register the loader
import "babylon-mmd/esm/Loader/pmxLoader";

// side effects that register the animation runtime
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
```

이 코드는 babylon-mmd의 PMX 로더와 애니메이션 런타임을 Babylon.js SceneLoader에 등록합니다. 이를 통해 PMX 파일을 로드하고 카메라 및 모델 애니메이션을 재생할 수 있습니다.

PMX 로더뿐만 아니라 다른 MMD 모델 로더도 동일한 방식으로 사용할 수 있습니다. 예를 들어, PMD 로더를 사용하려면 다음과 같이 추가할 수 있습니다:

```typescript
import "babylon-mmd/esm/Loader/pmdLoader";
```

또는 BPMX 로더를 사용하려면 다음과 같이 추가할 수 있습니다:
```typescript
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader";
```

:::warning

"babylon-mmd" 경로에서 하나의 심볼이라도 임포트되면, 모든 가능한 사이드 이펙트가 적용됩니다.

이것은 Babylon.js 규칙을 따릅니다.
따라서 트리 쉐이킹이 제대로 작동하려면 모든 임포트는 전체 경로로 작성되어야 합니다.

트리 쉐이킹을 올바르게 수행하려면 [이 Babylon.js 문서](https://doc.babylonjs.com/setup/frameworkPackages/es6Support#side-effects)를 참조하세요.

:::

## 씬 생성 (9-17줄)

```typescript
const scene = new Scene(engine);
scene.ambientColor = new Color3(0.5, 0.5, 0.5);

const camera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);

const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
directionalLight.intensity = 1.0;

CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
```

이 코드는 Babylon.js 씬을 생성하고 기본 라이팅과 카메라를 설정합니다.

여기서 씬의 ambientColor는 rgb(0.5, 0.5, 0.5)로 설정됩니다. **이것은 임의의 값이 아니라**, MMD 머티리얼 구현과 동일한 동작을 재현하기 위해 앰비언트 컬러를 0-0.5 범위로 매핑하기 위해 설정된 값입니다.

디렉셔널 라이트를 사용하는 이유도 MMD 머티리얼의 라이팅 모델을 재현하기 위한 것이며 임의의 설정이 아닙니다.

## MMD 런타임 생성 (19-34줄)

```typescript
const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -98, 0));
physicsRuntime.register(scene);

// MMD runtime for solving morph, append transform, IK, animation, physics
const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
mmdRuntime.register(scene);

// For synced audio playback
const audioPlayer = new StreamAudioPlayer(scene);
audioPlayer.source = "your_audio_path.mp3";
mmdRuntime.setAudioPlayer(audioPlayer);

// You can also run the animation before it loads. This will allow the audio to run first.
mmdRuntime.playAnimation();
```

이 코드는 MMD 런타임을 생성하고 피직스 엔진을 설정합니다. 또한 오디오와 애니메이션을 동기화하기 위한 오디오 플레이어를 구성합니다.

### 웹어셈블리 바이너리

상단의 `GetMmdWasmInstance` 함수는 babylon-mmd의 WASM 바이너리를 로드합니다.

babylon-mmd는 처리 성능을 향상시키기 위해 Rust로 작성되고 WASM 바이너리로 컴파일된 일부 기능을 제공합니다.
웹어셈블리 부분에 해당하는 타입스크립트 구현이 존재하기 때문에 선택적으로 사용할 수 있습니다.

예를 들어, 타입스크립트로 작성된 MMD 런타임 `MmdRuntime`과 동일한 기능을 제공하는 `MmdWasmRuntime`이라는 WASM 런타임이 있습니다.

웹어셈블리 바이너리는 주로 MMD 모델 애니메이션 처리 로직을 제공하고 추가적으로 불릿 피직스 엔진을 제공합니다.

```typescript
const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```
이 예제에서는 WASM 바이너리 타입을 결정하기 위해 `MmdWasmInstanceTypeSPR`을 사용합니다. SPR은 각각 Single threaded(싱글 스레드), Physics Engine Included(피직스 엔진 포함), Release Build(릴리즈 빌드)를 의미합니다.

즉, 우리가 사용하는 바이너리는 피직스 엔진이 포함된 싱글 스레드 릴리즈 빌드입니다.

다른 WASM 바이너리 타입으로는 `SR`, `SPD` 등이 있습니다. `SR`은 Single threaded, Release Build를 의미하며 피직스 엔진이 포함되지 않은 바이너리입니다. `SPD`는 Single threaded, Physics Engine Included, Debug Build를 의미합니다.

```typescript
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -98, 0));
physicsRuntime.register(scene);
```

babylon-mmd의 WASM 바이너리가 제공하는 불릿 피직스 엔진을 사용하여 피직스 엔진 인스턴스를 생성합니다.

여기서 중력 가속도를 일반적인 지구 중력 가속도인 -9.8 m/s² 대신 -98 m/s²로 설정합니다. 이 값은 MMD의 피직스 엔진 설정과 일치하도록 설정된 것입니다.

```typescript
// MMD runtime for solving morph, append transform, IK, animation, physics
const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
mmdRuntime.register(scene);

// For synced audio playback
const audioPlayer = new StreamAudioPlayer(scene);
audioPlayer.source = "your_audio_path.mp3";
mmdRuntime.setAudioPlayer(audioPlayer);

// You can also run the animation before it loads. This will allow the audio to run first.
mmdRuntime.playAnimation();
```

그런 다음 MMD 런타임을 생성합니다.

MMD 런타임은 MMD 애니메이션에 참여하는 요소들을 동기화하고 조율합니다.

```typescript
// You can also run the animation before it loads. This will allow the audio to run first.
mmdRuntime.playAnimation();
```

3D 모델과 애니메이션을 로드하는 데 시간이 걸리므로, `MmdRuntime.playAnimation()`을 호출하여 기다리는 동안 오디오를 미리 재생할 수 있습니다.

애니메이션이 재생되는 동안에도 모델, 카메라, 애니메이션을 `MmdRuntime`에 동적으로 추가할 수 있습니다.

## MMD 플레이어 컨트롤 생성 (36-37줄)

```typescript
// create a youtube-like player control
new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
```

이 코드는 MMD 플레이어 컨트롤을 생성합니다. 이 컨트롤은 MMD 애니메이션을 재생, 일시 정지, 오디오 조정 등을 위한 UI를 제공합니다.

이 코드는 빠른 테스트 목적으로 제공되며, 실제 사용을 위해서는 자체 구현을 권장합니다.

## VMD 로더 (39-44줄)

```typescript
const vmdLoader = new VmdLoader(scene);

const cameraAnimation = await vmdLoader.loadAsync("camera_motion", "your_camera_motion_path.vmd");
const cameraRuntimeAnimationHandle = camera.createRuntimeAnimation(cameraAnimation);
camera.setRuntimeAnimation(cameraRuntimeAnimationHandle);
mmdRuntime.addAnimatable(camera);
```

이 코드는 VMD 로더를 사용하여 카메라 애니메이션을 로드하고 애니메이션을 카메라에 바인딩합니다.

### babylon-mmd의 애니메이션 시스템

babylon-mmd는 기본적으로 Babylon.js의 애니메이션 시스템을 사용하지 않고 자체 애니메이션 시스템을 구현합니다.

이는 Babylon.js의 애니메이션 시스템이 대규모 애니메이션 데이터 처리에 최적화되어 있지 않고 MMD의 애니메이션 런타임 사양을 완전히 지원할 수 없기 때문입니다.

babylon-mmd가 제공하는 애니메이션 시스템은 `MmdAnimation` 컨테이너로 애니메이션 데이터를 관리합니다. 그리고 애니메이션이 재생되려면 특정 객체에 바인딩되어야 합니다.

```typescript
const cameraRuntimeAnimationHandle = camera.createRuntimeAnimation(cameraAnimation);
```

바인딩된 애니메이션은 `MmdRuntimeAnimation`이라고 합니다. 이러한 객체는 일반적으로 직접 접근하는 것이 권장되지 않으므로, `MmdCamera.createRuntimeAnimation`은 이들에 접근하기 위한 핸들을 반환합니다.

## PMX 로더 (46-53줄)

```typescript
const assetContainer = await LoadAssetContainerAsync("path/to/your_file.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;

const mmdModel = mmdRuntime.createMmdModel(mmdMesh);
const modelMotion = await vmdLoader.loadAsync("model_motion", "your_model_motion_path.vmd");
const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(modelMotion);
mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);
```

이 코드는 PMX 로더를 사용하여 MMD 모델을 로드하고 VMD 로더를 사용하여 모델 애니메이션을 로드합니다. 그런 다음 런타임 애니메이션을 설정합니다.

### MMD 모델 로더

babylon-mmd는 PMX, PMD, BPMX와 같은 다양한 MMD 모델 포맷을 지원합니다. 이 예제에서는 PMX 로더를 사용하여 모델을 로드합니다.

```typescript
const assetContainer = await LoadAssetContainerAsync("path/to/your_file.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

이 코드는 Babylon.js의 SceneLoader를 사용하여 PMX 파일을 로드합니다.

이전에 `import "babylon-mmd/esm/Loader/pmxLoader";`로 PMX 로더를 등록했기 때문에, `LoadAssetContainerAsync` 함수가 PMX 파일을 올바르게 로드할 수 있습니다.

그런 다음 assetContainer의 로드된 메시들 중 첫 번째 메시를 사용하기 위해 `MmdMesh` 타입으로 캐스팅합니다.

MMD 모델 로더는 항상 MMD 모델 루트 메시를 `meshes[0]`에 배치하므로, 이 캐스팅은 항상 유효합니다.

### MMD 모델을 런타임에 추가하기

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh);
const modelMotion = await vmdLoader.loadAsync("model_motion", "your_model_motion_path.vmd");
const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(modelMotion);
mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);
```

`MmdRuntime.createMmdModel` 함수를 사용하여 MMD 메시에서 런타임에 의해 제어되는 MMD 모델을 생성할 수 있습니다.
MmdModel이 생성되면 MMD 루트 메시 아래의 모든 메시와 머티리얼은 MMD 런타임에 의해 제어됩니다.

MmdModel에 애니메이션을 바인딩하는 방법은 카메라 애니메이션과 동일합니다.

## 결론

이 섹션에서는 babylon-mmd의 기본 사용법을 살펴보았습니다.

새롭게 소개된 개념은 다음과 같습니다:

- **MmdRuntime**: MMD 애니메이션을 처리하는 런타임입니다. MMD 모델과 애니메이션을 관리하고, 피직스 엔진과 오디오 플레이어를 통합합니다.
- **MmdWasmInstance**: MMD 애니메이션을 처리하기 위한 웹어셈블리 인스턴스입니다. WASM 바이너리를 사용하여 성능을 향상시킵니다. 이 사용은 선택 사항입니다.
- **MmdAnimation**: MMD 애니메이션 데이터를 관리하는 컨테이너입니다. 런타임 애니메이션을 생성하고 바인딩할 수 있습니다.
- **MmdMesh**: MMD 모델의 메시를 나타내는 객체입니다. PMX, PMD, BPMX와 같은 다양한 MMD 모델 포맷을 지원합니다.
- **MmdModel**: MMD 모델을 런타임에 추가하고 애니메이션을 바인딩하는 객체입니다. MMD 모델의 루트 메시 아래의 모든 메시와 머티리얼을 제어합니다.
- **MmdPlayerControl**: MMD 애니메이션을 제어하기 위한 UI 컨트롤입니다. 재생, 일시 정지, 오디오 조정 등을 할 수 있습니다.
