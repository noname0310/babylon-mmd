---
sidebar_position: 1
sidebar_label: MMD Animation
---

# MMD Animation

`MmdAnimation` is a **container for storing** MMD model or camera animations.

You can **play animations** by binding this to an MMD model or camera.

## Animation Runtime

The animation runtime is the **entity responsible for evaluating** animation data at time t and **binding it** to MMD models or cameras.

There are several types of runtimes, and you can use the following two runtime implementations to bind `MmdAnimation`:

- `MmdRuntimeModelAnimation`: Runtime for binding MMD model animations
- `MmdRuntimeCameraAnimation`: Runtime for binding MMD camera animations

The reason camera and model animation runtimes are provided separately is for **efficient tree-shaking**.

If you only need MMD model animations, you can import just `MmdRuntimeModelAnimation`, and if you only need camera animations, you can import just `MmdRuntimeCameraAnimation`.

Animation runtimes basically operate by **executing side-effects** that add binding methods to the animation container's (`MmdAnimation`) prototype.

Therefore, to use a runtime, you must **import the runtime** to execute its side-effects.

```ts
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
```

## Create Runtime Animation

Runtime animations are created by the target to which they will be bound, such as `MmdCamera` or `MmdModel`.

This is because runtime animations have **characteristics dependent on their binding target**.

You can create runtime animations by calling the `createRuntimeAnimation` method of `MmdCamera` or `MmdModel` as follows:

```ts
const camera: MmdCamera = ...;
const model: MmdModel = ...;

const cameraAnimationHandle: MmdRuntimeAnimationHandle = camera.createRuntimeAnimation(animation);
const modelAnimationHandle: MmdRuntimeAnimationHandle = model.createRuntimeAnimation(animation);
```

The `createRuntimeAnimation` method takes an animation container as an argument and **returns a runtime animation handle**.

It's important to note that it returns a **handle** rather than the Runtime Animation object itself.

## MMD Runtime Animation Handle

A runtime animation is an object that contains binding information along with the animation container.

Accessing the properties of this object is generally **only necessary when reading or modifying bindings**, and typically you don't need to modify these values directly.

Therefore, runtime animations are **controlled through Handle objects** by default.

If you need to access the runtime animation object, you can access it using the handle as a key in the `runtimeAnimations` map of `MmdCamera` or `MmdModel`.

```ts
const cameraRuntimeAnimation = camera.runtimeAnimations.get(cameraAnimationHandle);
const modelRuntimeAnimation = model.runtimeAnimations.get(modelAnimationHandle);
```

## Lifecycle of Runtime Animations

Since runtime animations are objects dependent on `MmdCamera` or `MmdModel`, when the binding target is destroyed, **the runtime animation is also destroyed**.

However, if you no longer need a runtime animation, you can **explicitly destroy it** by calling the `destroyRuntimeAnimation` method of `MmdCamera` or `MmdModel`.

```ts
camera.destroyRuntimeAnimation(cameraAnimationHandle);
model.destroyRuntimeAnimation(modelAnimationHandle);
```

## Playing Runtime Animations

`MmdCamera` or `MmdModel` can **only play one runtime animation at a time**.
Therefore, to play a new runtime animation, you need to call the `setRuntimeAnimation` method to **replace the currently playing runtime animation**.

```ts
camera.setRuntimeAnimation(cameraAnimationHandle);
model.setRuntimeAnimation(modelAnimationHandle);
```

If you want to stop playing an animation, you can pass `null` as an argument to the `setRuntimeAnimation` method.

```ts
camera.setRuntimeAnimation(null);
model.setRuntimeAnimation(null);
```

Runtime animations are **always evaluated and bound at the same time** by the MMD Runtime.

Therefore, if you want to play multiple animations at different times, you need to **create a separate MMD Runtime for each animation**.

:::info
There is also ways to play multiple animations simultaneously using Composite Animation, but in this case only one runtime animation is playing internally.
:::

## MMD WASM Animation

If you're using `MmdWasmRuntime`, you can also play MMD animations using MMD animation evaluation and binding functionality **implemented in WebAssembly (WASM)**.

In this case, **all animation calculations except setting Morph Target weights** are processed in WASM, so you can expect **high performance**.

To use MMD WASM animation, you need to import the `MmdWasmRuntimeModelAnimation` runtime to execute its side-effects.

```ts
import "babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation";
``` 

:::info
WASM implementation is **not provided for camera animations**. This is because camera animations have much less computation compared to model animations, so there wouldn't be significant performance improvement even if implemented in WASM.
:::

After that, you create an Animation container as `MmdWasmAnimation` and **bind it to** `MmdWasmModel`.

```ts
const wasmModel: MmdWasmModel = ...;
const wasmAnimation = new MmdWasmAnimation(mmdAnimation);
const wasmModelAnimationHandle = wasmModel.createRuntimeAnimation(wasmAnimation);
```

:::warning

To directly access animation data on the WASM side, `MmdWasmAnimation` **internally copies and stores** `MmdAnimation` data in WASM memory.

Therefore, all `TypedArray` data that `MmdWasmAnimation` has **references the memory buffer** of the `WebAssembly.Memory` object.

As a result, accessing this `TypedArray` data in multi-threading scenarios is **very dangerous**.

:::

### Precautions When Using MMD WASM Animation

An important point to note is that memory management for `MmdWasmAnimation` is **not automatically handled by the GC**, so if you are no longer using it, you **must explicitly free the memory** by calling the `dispose` method.

```ts
wasmAnimation.dispose();
```
