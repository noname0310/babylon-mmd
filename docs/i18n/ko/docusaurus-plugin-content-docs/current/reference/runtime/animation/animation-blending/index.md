---
sidebar_position: 4
sidebar_label: 애니메이션 블렌딩
---

# 애니메이션 블렌딩

babylon-mmd는 **frame-perfect 애니메이션 블렌딩**을 지원하는 애니메이션 컨테이너인 `MmdCompositeAnimation`을 제공합니다.

<blockquote class="twitter-tweet" data-media-max-width="10000">
<p lang="ja" dir="ltr">
    babylon-mmdはframe perfectなアニメーションブレンディングを提供するようになりました
    <br/>
    <br/>
    ユーザーの入力によってダンスの次の内容を変更することが可能で、正確なタイミングを決めることができるので、リズムゲームを取り入れたQTEアニメーションコンテンツを作ることができると思われます。
    <a href="https://t.co/ZCRZU9YVMW">pic.twitter.com/ZCRZU9YVMW</a>
</p>
&mdash; noname0310 (@noname20310)
<a href="https://twitter.com/noname20310/status/1724322704323756229?ref_src=twsrc%5Etfw">
November 14, 2023
</a>
</blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

*이 비디오는 Composite Animation을 사용하여 하나의 MMD 모델에서 두 명의 댄스 애니메이션을 **번갈아 재생**하는 예제를 보여줍니다.*

Credit:
- Model:
  - YYB Hatsune Miku_10th by YYB
  - YYB Miku Default edit by YYB / HB-Squiddy / FreezyChan-3Dreams
  - YYB miku Crown Knight by YYB / Pilou la baka
- Motion by srs / ATY
- Camara by 小紋
- Music: 
  - 君にとって by Wonder-K 

:::info
**Babylon.js의 `AnimationGroup`** 을 사용하여 MMD 애니메이션을 재생함으로써 Babylon.js의 애니메이션 블렌딩 기능을 사용할 수도 있습니다.

하지만 이 섹션에서는 **`AnimationGroup`에 대해 다루지 않습니다**. `AnimationGroup`을 사용하여 MMD 애니메이션을 재생하는 방법에 대한 정보는 **[Babylon.js 애니메이션 런타임 사용](../use-babylonjs-animation-runtime#babylonjs-animation-group)** 문서를 참조하세요.
:::

## MMD 컴포지트 애니메이션

`MmdCompositeAnimation`은 **여러 MMD 애니메이션을 하나로 묶어서 관리**하는 애니메이션 컨테이너입니다.

각 애니메이션은 **시작 프레임과 끝 프레임** 정보를 포함하는 `MmdAnimationSpan` 객체로 관리됩니다.

다음은 두 개의 `MmdAnimation` 객체를 하나의 `MmdCompositeAnimation`으로 묶는 예제 코드입니다:

```typescript
const compositeAnimation = new MmdCompositeAnimation("composite");
const duration = Math.max(mmdAnimation1.endFrame, mmdAnimation2.endFrame);
const animationSpan1 = new MmdAnimationSpan(mmdAnimation1, undefined, duration, 0, 1);
const animationSpan2 = new MmdAnimationSpan(mmdAnimation2, undefined, duration, 0, 1);
compositeAnimation.addSpan(animationSpan1);
compositeAnimation.addSpan(animationSpan2);
```

이 경우 **두 애니메이션 모두** 프레임 0부터 시작하여 `duration` 프레임까지 재생됩니다.

### MMD 애니메이션 스팬

`MmdAnimationSpan` 생성자는 다음과 같습니다:

```typescript
new MmdAnimationSpan(animation: MmdBindableAnimation, startFrame?: number, endFrame?: number, offset?: number, weight?: number): MmdAnimationSpan
```

- `animation`: `MmdAnimation` 또는 `MmdModelAnimationContainer`와 같이 카메라나 모델에 바인딩할 수 있는 애니메이션 컨테이너
- `startFrame`: 애니메이션이 시작되는 프레임 (**기본값**: animation.startFrame)
- `endFrame`: 애니메이션이 끝나는 프레임 (**기본값**: animation.endFrame)
- `offset`: 이 스팬이 컴포지트 애니메이션에서 시작되는 프레임 (**기본값**: 0)
- `weight`: 애니메이션 블렌딩에 사용되는 가중치 (**기본값**: 1)

`MmdCompositeAnimation`은 **여러 개의** `AnimationSpan` 객체를 관리하며, 각 `AnimationSpan`은 애니메이션 재생 중에 **동적으로 추가하거나 제거**할 수 있습니다.

### MMD 컴포지트 애니메이션 메서드

`MmdCompositeAnimation` 클래스는 다음 메서드를 제공합니다:

- `addSpan(span: MmdAnimationSpan): void`: `MmdAnimationSpan`을 **추가**합니다.
- `removeSpan(span: MmdAnimationSpan): void`: `MmdAnimationSpan`을 **제거**합니다.
- `removeSpanFromIndex(index: number): void`: 인덱스로 `MmdAnimationSpan`을 **제거**합니다.
- `get startFrame(): number`: 이 컴포지트 애니메이션의 시작 프레임을 **반환**합니다.
- `get endFrame(): number`: 이 컴포지트 애니메이션의 끝 프레임을 **반환**합니다.
- `get spans(): readonly MmdAnimationSpan[]`: 현재 등록된 모든 `MmdAnimationSpan` 객체를 **반환**합니다.

### MMD 애니메이션 스팬 트랜지션

`MmdAnimationSpan`은 `weight` 속성을 통해 애니메이션 블렌딩에 사용되는 가중치를 설정할 수 있습니다. 또한 `MmdAnimationSpan`의 시작과 끝에 `transition` 프레임을 설정하여 애니메이션이 시작될 때 가중치가 0에서 1로, 끝날 때 1에서 0으로 **부드럽게 변화하도록 제어**하는 **편의 기능**이 제공됩니다.

이를 위해 `MmdAnimationSpan` 클래스는 다음 속성들을 제공합니다:

- `MmdAnimationSpan.easeInFrameTime`: 애니메이션이 시작될 때 가중치가 **0에서 1로 변화**하는 프레임 수를 설정합니다.
- `MmdAnimationSpan.easeOutFrameTime`: 애니메이션이 끝날 때 가중치가 **1에서 0으로 변화**하는 프레임 수를 설정합니다.
- `MmdAnimationSpan.easingFunction`: 가중치 변화에 사용되는 이징 함수를 설정합니다. **기본값은** `null`이며, 이 경우 **선형 변화**가 적용됩니다.

예를 들어, MMD 애니메이션은 30fps로 재생되므로 `easeInFrameTime`과 `easeOutFrameTime`을 모두 30으로 설정하면 애니메이션이 시작되고 끝날 때 각각 **1초씩** 가중치가 변화합니다.

다음은 `easeInFrameTime`과 `easeOutFrameTime`을 모두 30으로 설정하여 전환을 적용하는 예제 코드입니다:

```typescript
const animationSpan = new MmdAnimationSpan(mmdAnimation1);
animationSpan.easeInFrameTime = 30;
animationSpan.easeOutFrameTime = 30;
const easingFunction = new BezierCurveEase(0.7, 0.01, 0.3, 0.99);
animationSpan.easingFunction = easingFunction;
compositeAnimation.addSpan(animationSpan);
```

## MMD 컴포지트 런타임 애니메이션

`MmdCompositeAnimation`도 다른 MMD 애니메이션 컨테이너와 마찬가지로 **`MmdCamera`나 `MmdModel`에 바인딩**하여 사용할 수 있습니다. 바인딩을 위해서는 애니메이션 평가 및 바인딩을 담당하는 **런타임을 가져와야** 합니다.

```typescript
import "babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeModelAnimation";
```

그 후 `MmdCamera`나 `MmdModel`의 `createRuntimeAnimation` 메서드를 사용하여 `MmdCompositeAnimation`을 **바인딩**할 수 있습니다.

```typescript
const camera: MmdCamera = ...;
const model: MmdModel = ...;

const compositeAnimationHandle: MmdRuntimeAnimationHandle = camera.createRuntimeAnimation(compositeAnimation);
const compositeAnimationHandle: MmdRuntimeAnimationHandle = model.createRuntimeAnimation(compositeAnimation);
```

## 제한사항

MMD 컴포지트 애니메이션은 여러 애니메이션을 블렌딩할 때 속성 경로에서 평가 결과를 **직접 접근**하여 읽고 씁니다.

따라서 `MmdWasmRuntime`에서 제공하는 WASM 측 애니메이션 평가와 같이 애니메이션 평가와 실제 속성 적용 사이에 지연이 있는 기능과는 **호환되지 않습니다**.

예를 들어, `MmdWasmRuntimeModelAnimation`을 사용하여 `MmdWasmAnimation`을 평가하여 WASM 측에서 애니메이션 평가를 수행할 때는 `MmdCompositeAnimation`과의 **블렌딩이 지원되지 않습니다**.

대신 `MmdRuntimeModelAnimation`을 사용하여 `MmdWasmAnimation`을 평가할 때는 `MmdCompositeAnimation`과의 **블렌딩이 가능합니다**.

## 예제 코드

예제 코드는 [compositeAnimationTestScene.ts](https://github.com/noname0310/babylon-mmd/blob/main/src/Test/Scene/compositeAnimationTestScene.ts)에서 찾을 수 있습니다.

이 예제 코드에서는 **UI를 통해 가중치를 조정**할 수 있으며, 정적으로 설정된 프레임 번호에 따라 두 애니메이션이 **번갈아 재생**되는 것을 볼 수 있습니다.
