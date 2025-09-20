---
sidebar_position: 7
sidebar_label: Animation
---

# Animation

This section explains **how to play and evaluate MMD animation data**.

## **MMD Animation Storage Forms and Evaluation/Binding Components**

MMD animation data is **primarily represented** as an `MmdAnimation` object.

However, it can be **converted and stored in various forms**, with different methods for evaluation and binding depending on the form.

**Here are the various forms for storing MMD animation data:**

| Storage Form | Description |
|---|---|
| `MmdAnimation` | **Basic form** that stores MMD animation data as is |
| `MmdWasmAnimation` | Form of MMD animation data **for acceleration** in `MmdWasmRuntime` |
| `MmdAnimationCameraContainer` | Form that converts MMD animation data to Babylon.js `Animation` objects **(for cameras)** |
| `MmdAnimationModelContainer` | Form that converts MMD animation data to Babylon.js `Animation` objects **(for models)** |
| `AnimationGroup` | Form that converts MMD animation data to Babylon.js `AnimationGroup` objects |
| `MmdCompositeAnimation` | Form that **combines multiple MMD animation data** into one |

To apply the stored MMD animation data to models and cameras, **evaluation and binding processes** are required.

The animation application process can be divided into **two main steps**: evaluation and binding.
1. **Evaluation**: Evaluates MMD animation data for a specific time t, calculating transformation and weight values for each bone and morph target.
2. **Binding**: Applies the evaluated values to the bones and morph targets of the model.
   - The evaluated animation state is reflected in two elements:
     - Setting the `position` and `rotationQuaternion` properties of the model's `Bone` to the evaluated values
     - Appropriately calling the `setMorphWeightFromIndex` method of the model's `MmdMorphController` to set the morph target weights

The components that perform these evaluation and binding processes **differ depending on the storage form** of the animation.

**Components for evaluation and binding are as follows:**

| Storage Form | Evaluation Component | Binding Component |
|---|---|---|
| `MmdAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdRuntimeModelAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdRuntimeModelAnimation` |
| `MmdWasmAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdWasmRuntimeModelAnimation` or `MmdRuntimeModelAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdWasmRuntimeModelAnimation` or `MmdRuntimeModelAnimation` |
| `MmdAnimationCameraContainer` <br/><br/> `MmdAnimationModelContainer` | `MmdAnimationCameraContainer` <br/><br/> `MmdAnimationModelContainer` | `MmdRuntimeCameraAnimationContainer` <br/><br/> `MmdRuntimeModelAnimationContainer` |
| `AnimationGroup` | `AnimationGroup` | `AnimationGroup` |
| `MmdCompositeAnimation` | `MmdCompositeRuntimeCameraAnimation` <br/><br/> `MmdCompositeRuntimeModelAnimation` | `MmdCompositeRuntimeCameraAnimation` <br/><br/> `MmdCompositeRuntimeModelAnimation` |

### MMD Animation & MMD Runtime Animation

MMD Runtime Animation is the **basic functionality** for MMD animation evaluation and binding provided by babylon-mmd.

This class provides functionality to **evaluate** `MmdAnimation` and **bind** it to models and cameras.

It provides the following two classes for this purpose:
- `MmdRuntimeModelAnimation`: Class for applying animation to MMD models
- `MmdRuntimeCameraAnimation`: Class for applying animation to MMD cameras

This method is the **most fundamental way** to play MMD animations and provides **excellent performance**.

For more details, refer to the [MMD Animation](./mmd-animation) document.

### MMD WASM Animation & MMD WASM Runtime Animation

MMD WASM Runtime Animation is a functionality for MMD animation evaluation and binding **implemented in WebAssembly**.

This class provides functionality to evaluate `MmdWasmAnimation` and bind it to models.

This method provides the **highest performance** among the ways to play MMD animations.

For more details, refer to the [MMD Animation](./mmd-animation) document.

### MMD AnimationContainer & MMD Runtime AnimationContainer

MMD AnimationContainer provide functionality to **evaluate MMD animations using** Babylon.js's `Animation` and **bind them** to models and cameras.

Runtimes are provided for `MmdCameraAnimationContainer` and `MmdModelAnimationContainer` classes to enable binding:
- `MmdRuntimeModelAnimationContainer`: Class for applying animation to MMD models
- `MmdRuntimeCameraAnimationContainer`: Class for applying animation to MMD cameras

The **advantage** of this method is that it can utilize Babylon.js's animation container system.

For more details, refer to the [Use Babylon.js Animation Runtime](./use-babylonjs-animation-runtime) document.

### Babylon.js AnimationGroup

You can **handle all evaluation and binding** of MMD animations using Babylon.js's `AnimationGroup`.

For this purpose, babylon-mmd provides the `MmdModelAnimationContainer.createAnimationGroup` method that **converts** `MmdAnimation` to `AnimationGroup`.

The **advantage** of this method is that it can fully utilize Babylon.js's animation system.

For more details, refer to the [Use Babylon.js Animation Runtime](./use-babylonjs-animation-runtime) document.

### Animation Blending

babylon-mmd provides an animation runtime that supports **frame-perfect MMD animation blending**.

For this purpose, the `MmdCompositeAnimation` animation container class is provided, and the `MmdCompositeRuntimeCameraAnimation` and `MmdCompositeRuntimeModelAnimation` classes are provided to **evaluate and bind** it.

For more details, refer to the [Animation Blending](./animation-blending) document.
