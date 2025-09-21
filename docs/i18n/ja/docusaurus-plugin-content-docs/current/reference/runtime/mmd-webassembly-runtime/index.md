---
sidebar_position: 3
sidebar_label: MMD WebAssembly Runtime
---

# MMD WebAssembly Runtime

This section explains how to use the MMD runtime implemented with **WebAssembly** (WASM).

babylon-mmd provides an MMD runtime implemented with **WASM**.

<!-- ![WebAssembly Architecture](./wasm-architecture.png) -->

import WebAssemblyArchitecture from "@site/docs/reference/runtime/mmd-webassembly-runtime/wasm-architecture.png";

<img src={WebAssemblyArchitecture} style={{width: 400}} />

*This figure shows the architecture of babylon-mmd's WebAssembly runtime.*

This WASM runtime is a **complete rewrite** of the original `MmdRuntime` class's JavaScript implementation in **Rust**, compiled to WASM.

The WASM runtime provides **better performance** than the JavaScript runtime by applying various optimization techniques.

The optimization techniques applied are as follows:

- Processing all operations except IK Solver with **float32**.
- Using **128-bit SIMD** instructions to process vector operations in parallel.
- Employing **worker-based multi-threading** to perform parallel processing for each model.
- Binding the **Bullet Physics** engine with FFI to handle physics simulation (without using emscripten).

## MmdWasmInstance

To use the WASM runtime, you first need to **load the WASM binary** provided by babylon-mmd. This can be done using the `getMmdWasmInstance()` function.

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```

The `getMmdWasmInstance()` function **asynchronously loads** the WASM binary and returns a WASM Module instance.

babylon-mmd provides **three options** when selecting a binary:

- **Single-threaded** or **Multi-threaded**: S / M
- **Bullet Physics** Included or Not Included: P / (None)
- **Release Build** or **Debug Build**: R / D

Therefore, we can choose one of **eight WASM instance types**:

- `MmdWasmInstanceTypeSR`: Single-threaded, Release Build
- `MmdWasmInstanceTypeSD`: Single-threaded, Debug Build
- `MmdWasmInstanceTypeMR`: Multi-threaded, Release Build
- `MmdWasmInstanceTypeMD`: Multi-threaded, Debug Build
- `MmdWasmInstanceTypeSPR`: Single-threaded, Physics, Release Build
- `MmdWasmInstanceTypeSPD`: Single-threaded, Physics, Debug Build
- `MmdWasmInstanceTypeMPR`: Multi-threaded, Physics, Release Build
- `MmdWasmInstanceTypeMPD`: Multi-threaded, Physics, Debug Build

You can choose the appropriate binary for your usage scenario.

Theoretically, the binary with the **best performance** is `MmdWasmInstanceTypeMPR` (Multi-threaded, Physics, Release Build).

However, if you're in an environment that doesn't support `SharedArrayBuffer`, **multi-threading won't work**, so you'll need to use the single-threaded version.

If you don't need physics simulation, you can choose a binary **without the physics engine** to reduce loading time.

Also, during development, it's recommended to use the **Debug Build** to track errors occurring inside the runtime. Release Builds make it difficult to diagnose errors when panics occur.

:::info
Even if you choose a binary without a physics engine, you can still handle physics simulation using the `MmdPhysics`, `MmdAmmoPhysics`, or `MmdBulletPhysics` classes. However, the performance may be lower compared to using a binary with the physics engine included.
:::

## MmdWasmRuntime class

The `MmdWasmRuntime` class is an MMD runtime class implemented with WASM that provides **almost the same API** as the `MmdRuntime` class.

To use it, you simply use the `MmdWasmRuntime` class instead of the original `MmdRuntime` class and **pass the `MmdWasmInstance`** to the constructor.

```typescript
const mmdWasmRuntime = new MmdWasmRuntime(mmdWasmInstance, scene);
```

Then the type will be propagated automatically, and the return type of the `createMmdModel` function will also become the `MmdWasmModel` type.

## MmdWasmAnimation class

To process data in the WASM runtime, the data needs to be **copied to the WASM memory space**.

However, the `MmdAnimation` container stores data in an ArrayBuffer instance on the **JavaScript side**.

Therefore, animation data stored in `MmdAnimation` **cannot be evaluated** on the WASM side. In this case, **Animation Evaluation** is handled on the JavaScript side, and then **Solve IK**, **Append Transform**, **Bone Morph**, and **Physics Simulation** are processed on the WASM side.

<!-- https://play.d2lang.com/?script=tJHPavMwEMTveoph758_2mMPBQea0pZAwYGcFWfdCPTHrCRDKHn3Upk2TnBKL71ptbszP3aozSLs01K047VxTPh3D3rWg25aMX2iihbcBWG87g_RtBFN0m-MG1JqOnaHdwVcmx27ANXeOJ1M8HgYtM3lSQo4qqNStOFtHSO7rT38KHh7EnyUkHusgvR7_McieB4LGttNsAPj6eWsrPue_Q5r0T52QdwIUNyytZy-3E4u3_bGZTuB_typu8RyDvhnePPHKJFdoJe_ObRy6N_kWxSmiVTX_C-Sq2Z9i9zSeG2xCWJ3WOkkpuVI6iMAAP__&layout=elk& -->
<!-- ![MmdAnimation Pipeline](mmdanimation-pipeline.png) -->

import MmdAnimationPipeline from "@site/docs/reference/runtime/mmd-webassembly-runtime/mmdanimation-pipeline.png";

<img src={MmdAnimationPipeline} style={{width: 600}} />

*This figure shows how animation evaluation is processed when MmdAnimation data is not copied to the WASM memory space.*

babylon-mmd provides the `MmdWasmAnimation` class to support **copying animation data** to the WASM memory space. This allows **almost all animation calculations**, including animation evaluation, to be processed on the **WASM side**.

<!-- https://play.d2lang.com/?script=rJBBSwMxEIXv-RWPuVvvHoQtWBEpCC30nG5nbSDJLJOkUKT_XcxqpUu8ecvke8N8POqLKse8Uht46wIT7h5BO953KXHY-zMtaMmDKOPteE6uT9hk-85kzE3qAR8GaEcnBlAXXbDZScTTyfpSnzShZ5UyYi06HnGPpUSehm-8EX9ivLzejN04cjxgqzamQTR8wYupGsV7zj8avwJXLxeKv56fdrohs_5l_s96rZZq8TPx-tcSM5dZ_4tmrO6vXLQeO1F_wNpmdT0nMp8BAAD__w%3D%3D&layout=elk&theme=0& -->
<!-- ![MMD Wasm Animation Pipeline](mmdwasmanimation-pipeline.png) -->

import MmdWasmAnimationPipeline from "@site/docs/reference/runtime/mmd-webassembly-runtime/mmdwasmanimation-pipeline.png";

<img src={MmdWasmAnimationPipeline} style={{width: 600}} />

*This figure shows how animation evaluation is processed when MmdWasmAnimation data is copied to the WASM memory space.*

To do this, simply create a `MmdWasmAnimation` instance and bind it to the MMD model.

```typescript
const mmdWasmAnimation = new MmdWasmAnimation(mmdAnimation, mmdWasmInstance, scene);

const runtimeAnimationHandle = mmdWasmModel.createRuntimeAnimation(mmdWasmAnimation);
mmdWasmModel.setRuntimeAnimation(runtimeAnimationHandle);
```

This way, animation evaluation is processed on the WASM side, ensuring that **all possible animation calculations** are handled on the WASM side.

:::info
Unlike `MmdAnimation`, `MmdWasmAnimation` requires **manual memory deallocation**.

If you no longer need it, call the `MmdWasmAnimation.dispose()` method to **free the memory**.
:::

## Buffered Evaluation

The WASM runtime supports **Buffered Evaluation**, a feature that processes animation calculations in a **separate thread** from rendering when using multi-threading runtimes (e.g., MR, MPD).

This feature is **disabled by default**. To enable it, set the `MmdWasmRuntime.evaluationType` property to `MmdWasmRuntimeAnimationEvaluationType.Buffered`.

```typescript
mmdWasmRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Buffered;
```

When Buffered Evaluation is enabled, animation calculations are processed with a **1-frame delay**, and the rendering thread uses the results calculated from the **previous frame**. This is a form of **pipelining technique** that allows the rendering thread to perform rendering immediately without waiting for animation calculations.

Below is an image showing the difference between Buffered Evaluation and Immediate Evaluation:

<!-- ![Buffered Evaluation VS Immediate Evaluation](buffered-vs-immediate.png) -->

import BufferedVsImmediate from "@site/docs/reference/runtime/mmd-webassembly-runtime/buffered-vs-immediate.jpg";

<img src={BufferedVsImmediate} style={{width: 600}} />

*This figure shows the difference between Buffered Evaluation and Immediate Evaluation.*

## Limitations

Code compiled to WebAssembly, unlike JavaScript code, **cannot modify prototypes** or change behavior through **inheritance**.

Therefore, if a **high level of customization** is needed, it is recommended to use the JavaScript runtime instead of the WebAssembly runtime.

## More Information

[Enhancing Browser Physics Simulations: WebAssembly and Multithreading Strategies](https://ieeexplore.ieee.org/document/11071666)

This paper explains **various techniques** applied to optimize babylon-mmd's WebAssembly runtime, and some of the images used in this page are also excerpted from this paper.

The paper provides **detailed explanations** about the optimization techniques used and how much **performance improvement** was achieved as a result.
