---
sidebar_position: 4
sidebar_label: Animation Blending
---

# Animation Blending

babylon-mmd provides `MmdCompositeAnimation`, an animation container that supports **frame-perfect animation blending**.

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

*This video shows an example of using Composite Animation to **alternately play** two-person dance animations on a single MMD model.*

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
You can also use Babylon.js's animation blending features by playing MMD animations with Babylon.js's `AnimationGroup`.

However, this section **does not discuss** `AnimationGroup`. For information on how to play MMD animations using `AnimationGroup`, refer to the [Use Babylon.js Animation Runtime](../use-babylonjs-animation-runtime#babylonjs-animation-group) document.
:::

## MMD Composite Animation

`MmdCompositeAnimation` is an animation container that **bundles and manages** multiple MMD Animations as one.

Each animation is managed as an `MmdAnimationSpan` object that includes **start frame and end frame** information.

The following is example code for bundling two `MmdAnimation` objects into one `MmdCompositeAnimation`:

```typescript
const compositeAnimation = new MmdCompositeAnimation("composite");
const duration = Math.max(mmdAnimation1.endFrame, mmdAnimation2.endFrame);
const animationSpan1 = new MmdAnimationSpan(mmdAnimation1, undefined, duration, 0, 1);
const animationSpan2 = new MmdAnimationSpan(mmdAnimation2, undefined, duration, 0, 1);
compositeAnimation.addSpan(animationSpan1);
compositeAnimation.addSpan(animationSpan2);
```

In this case, **both animations** start from frame 0 and play until the `duration` frame.

### MMD Animation Span

The `MmdAnimationSpan` Constructor is as follows:

```typescript
new MmdAnimationSpan(animation: MmdBindableAnimation, startFrame?: number, endFrame?: number, offset?: number, weight?: number): MmdAnimationSpan
```

- `animation`: Animation container that can be bound to Camera or Model, such as `MmdAnimation` or `MmdModelAnimationContainer`
- `startFrame`: Frame where the animation starts (**default**: animation.startFrame)
- `endFrame`: Frame where the animation ends (**default**: animation.endFrame)
- `offset`: Frame where this Span starts in the Composite Animation (**default**: 0)
- `weight`: Weight used for Animation Blending (**default**: 1)

`MmdCompositeAnimation` **manages multiple** `AnimationSpan` objects, and each `AnimationSpan` can be **dynamically added or removed** during animation playback.

### MMD Composite Animation Methods

The `MmdCompositeAnimation` class provides the following methods:

- `addSpan(span: MmdAnimationSpan): void`: **Adds** an `MmdAnimationSpan`.
- `removeSpan(span: MmdAnimationSpan): void`: **Removes** an `MmdAnimationSpan`.
- `removeSpanFromIndex(index: number): void`: **Removes** an `MmdAnimationSpan` by index.
- `get startFrame(): number`: **Returns** the start frame of this Composite Animation.
- `get endFrame(): number`: **Returns** the end frame of this Composite Animation.
- `get spans(): readonly MmdAnimationSpan[]`: **Returns** all currently registered `MmdAnimationSpan` objects.

### MMD Animation Span Transition

`MmdAnimationSpan` can set weights used for animation blending through the `weight` property. Additionally, a **convenience feature** is provided that sets `transition` frames at the beginning and end of `MmdAnimationSpan` to **smoothly control** weight changes from 0 to 1 when animations start, or from 1 to 0 when they end.

For this purpose, the `MmdAnimationSpan` class provides the following properties:

- `MmdAnimationSpan.easeInFrameTime`: Sets the number of frames for weight to change **from 0 to 1** when the animation starts.
- `MmdAnimationSpan.easeOutFrameTime`: Sets the number of frames for weight to change **from 1 to 0** when the animation ends.
- `MmdAnimationSpan.easingFunction`: Sets the easing function used for weight changes. The **default is** `null`, in which case **linear change** is applied.

For example, since MMD animations play at 30fps, setting both `easeInFrameTime` and `easeOutFrameTime` to 30 will cause weights to change for **1 second each** when animations start and end.

The following is example code that applies transitions by setting both `easeInFrameTime` and `easeOutFrameTime` to 30:

```typescript
const animationSpan = new MmdAnimationSpan(mmdAnimation1);
animationSpan.easeInFrameTime = 30;
animationSpan.easeOutFrameTime = 30;
const easingFunction = new BezierCurveEase(0.7, 0.01, 0.3, 0.99);
animationSpan.easingFunction = easingFunction;
compositeAnimation.addSpan(animationSpan);
```

## MMD Composite Runtime Animation

`MmdCompositeAnimation` can also be used by **binding to** `MmdCamera` or `MmdModel` like other MMD animation containers. For binding, you need to **import the runtime** responsible for Animation Evaluation and Binding.

```typescript
import "babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeModelAnimation";
```

After that, you can **bind** `MmdCompositeAnimation` using the `createRuntimeAnimation` method of `MmdCamera` or `MmdModel`.

```typescript
const camera: MmdCamera = ...;
const model: MmdModel = ...;

const compositeAnimationHandle: MmdRuntimeAnimationHandle = camera.createRuntimeAnimation(compositeAnimation);
const compositeAnimationHandle: MmdRuntimeAnimationHandle = model.createRuntimeAnimation(compositeAnimation);
```

## Limitations

MMD Composite Animation **directly accesses** evaluation results from property paths when blending multiple animations to read and write them.

Therefore, it is **not compatible** with features like the WASM-side animation evaluation provided by `MmdWasmRuntime`, where there is a delay between animation evaluation and actual application to properties.

For example, when evaluating `MmdWasmAnimation` using `MmdWasmRuntimeModelAnimation` to perform animation evaluation on the WASM side, **blending with** `MmdCompositeAnimation` is **not supported**.

Instead, when evaluating `MmdWasmAnimation` using `MmdRuntimeModelAnimation`, **blending with** `MmdCompositeAnimation` **is possible**.

## Example Code

Example code can be found in [compositeAnimationTestScene.ts](https://github.com/noname0310/babylon-mmd/blob/main/src/Test/Scene/compositeAnimationTestScene.ts).

In this example code, you can **adjust weights through the UI**, and you can see two animations **alternately playing** according to statically set frame numbers.
