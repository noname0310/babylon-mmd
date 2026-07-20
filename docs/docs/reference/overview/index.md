---
sidebar_position: 0
sidebar_label: Overview
---

# Overview

This section provides an overview of the features that babylon-mmd offers.

## Library Overview

babylon-mmd is a library written in TypeScript that provides Babylon.js loaders and runtime for MikuMikuDance (MMD) models and animations. It is currently distributed as an npm package.

This library can be used as either ESM or UMD modules. The UMD build can be used in environments like Babylon.js Playground.

This documentation is written based on usage in ESM module-based projects that use bundlers like webpack.

## Hello World of babylon-mmd

In this section, we'll explore an overview of babylon-mmd through a simple example.
This example shows how to load MMD models, set up camera and lighting, and play animations with audio.

:::info

To keep the example concise, imports other than the registration functions have been omitted.

:::

```typescript showLineNumbers
// Register the loader
import { RegisterPmxLoader } from "babylon-mmd/esm/Loader/pmxLoader.pure";

// Register the animation runtimes
import { RegisterMmdRuntimeCameraAnimation } from "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation.pure";
import { RegisterMmdRuntimeModelAnimation } from "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation.pure";

RegisterPmxLoader();
RegisterMmdRuntimeCameraAnimation();
RegisterMmdRuntimeModelAnimation();

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

You can try it in Babylon.js Playground. https://www.babylonjs-playground.com/#S7XDNP

Let's examine the functionality provided by each element.

- [**Lines 1-10**](#registration-lines-1-10): Register the components required for scene loading.

- [**Lines 13-21**](#scene-creation-lines-13-21): Create a scene and set up camera and lighting.

- [**Lines 23-38**](#mmd-runtime-creation-lines-23-38): Create MMD runtime and set up physics engine. Also configure audio player to synchronize animations with audio.

- [**Lines 40-41**](#mmd-player-control-creation-lines-40-41): Create MMD player control.

- [**Lines 43-48**](#vmd-loader-lines-43-48): Use VMD loader to load camera animation and set runtime animation on the camera.

- [**Lines 50-57**](#pmx-loader-lines-50-57): Use PMX loader to load MMD model and VMD loader to load model animations. Then set up runtime animation.

## Registration (Lines 1-10)

```typescript
// Register the loader
import { RegisterPmxLoader } from "babylon-mmd/esm/Loader/pmxLoader.pure";

// Register the animation runtimes
import { RegisterMmdRuntimeCameraAnimation } from "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation.pure";
import { RegisterMmdRuntimeModelAnimation } from "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation.pure";

RegisterPmxLoader();
RegisterMmdRuntimeCameraAnimation();
RegisterMmdRuntimeModelAnimation();
```

This code explicitly registers babylon-mmd's PMX loader and animation runtimes with Babylon.js. This enables loading PMX files and playing camera and model animations.

Not only PMX loader but also other MMD model loaders can be used in the same way. For example, to use the PMD loader, you can add the following:

```typescript
import { RegisterPmdLoader } from "babylon-mmd/esm/Loader/pmdLoader.pure";

RegisterPmdLoader();
```

Or to use the BPMX loader, you can add the following:
```typescript
import { RegisterBpmxLoader } from "babylon-mmd/esm/Loader/Optimized/bpmxLoader.pure";

RegisterBpmxLoader();
```

:::warning

Importing from the "babylon-mmd" root uses the side-effect entry point and registers every available component.

For tree-shakable ESM builds, import symbols from their individual full module paths. For components that require registration, import the matching `.pure` module and call its `Register…()` function.

The `babylon-mmd/esm/pure` root barrel mirrors Babylon.js's pure-import and pure-barrel design. For details about this model and tree shaking, see [Babylon.js: Tree-Shaking with Pure Imports](https://doc.babylonjs.com/setup/frameworkPackages/es6Support/treeShaking/).

:::

## Scene Creation (Lines 13-21)

```typescript
const scene = new Scene(engine);
scene.ambientColor = new Color3(0.5, 0.5, 0.5);

const camera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);

const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
directionalLight.intensity = 1.0;

CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
```

This code creates a Babylon.js Scene and sets up basic lighting and camera.

Here, the scene's ambientColor is set to rgb(0.5, 0.5, 0.5). **This is not an arbitrary value**, but is set to reproduce the same behavior as MMD material implementation, which maps ambient color to the 0-0.5 range.

The reason for using directionalLight is also to reproduce MMD material's Lighting Model and is not an arbitrary setting.

## MMD Runtime Creation (Lines 23-38)

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

This code creates MMD runtime and sets up the physics engine. It also configures an audio player to synchronize animations with audio.

### WebAssembly Binary

The `GetMmdWasmInstance` function at the top loads babylon-mmd's WASM binary.

babylon-mmd provides some functionality written in Rust and compiled to WASM binary to improve processing performance.
Since TypeScript implementations corresponding to the WebAssembly parts exist, they can be used optionally.

For example, there is a WASM runtime called `MmdWasmRuntime` that provides the same functionality as the TypeScript-written MMD runtime `MmdRuntime`.

WebAssembly binary primarily provides MMD model animation processing logic and additionally provides Bullet Physics engine.

```typescript
const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```
In this example, we use `MmdWasmInstanceTypeSPR` to determine the WASM binary type. SPR stands for Single threaded, Physics Engine Included, and Release Build respectively.

In other words, the binary we're using is a single-threaded release build that includes the physics engine.

Other WASM binary types include `SR`, `SPD`, etc. `SR` means Single threaded, Release Build and is a binary without the physics engine included. `SPD` means Single threaded, Physics Engine Included, Debug Build.

```typescript
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -98, 0));
physicsRuntime.register(scene);
```

We create a physics engine instance using the Bullet Physics engine provided by babylon-mmd's WASM binary.

Here we set the gravity acceleration to -98 m/s² instead of the typical Earth gravity acceleration of -9.8 m/s². This value is set to match MMD's physics engine settings. 

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

Then we create the MMD runtime.

The MMD runtime synchronizes and orchestrates elements participating in MMD animations.

```typescript
// You can also run the animation before it loads. This will allow the audio to run first.
mmdRuntime.playAnimation();
```

Since loading 3D models and animations takes time, you can call `MmdRuntime.playAnimation()` to start playing audio in advance while waiting.

You can dynamically add models, cameras, and animations to `MmdRuntime` while animations are playing.

## MMD Player Control Creation (Lines 40-41)

```typescript
// create a youtube-like player control
new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
```

This code creates an MMD player control. This control provides a UI for playing, pausing, and adjusting audio of MMD animations.

This code is provided for quick testing purposes, and it's recommended to implement your own for production use.

## VMD Loader (Lines 43-48)

```typescript
const vmdLoader = new VmdLoader(scene);

const cameraAnimation = await vmdLoader.loadAsync("camera_motion", "your_camera_motion_path.vmd");
const cameraRuntimeAnimationHandle = camera.createRuntimeAnimation(cameraAnimation);
camera.setRuntimeAnimation(cameraRuntimeAnimationHandle);
mmdRuntime.addAnimatable(camera);
```

This code uses the VMD loader to load camera animation and bind the animation to the camera.

### babylon-mmd's Animation System

babylon-mmd does not use Babylon.js's Animation system by default and implements its own animation system.

This is because Babylon.js's Animation system is not optimized for processing large animation data and cannot fully support MMD's animation runtime specifications.

The animation system provided by babylon-mmd manages animation data with `MmdAnimation` containers. And animations must be bound to specific objects to be played.

```typescript
const cameraRuntimeAnimationHandle = camera.createRuntimeAnimation(cameraAnimation);
```

Bound animations are called `MmdRuntimeAnimation`. These objects are generally not recommended for direct access, so `MmdCamera.createRuntimeAnimation` returns a handle to access them.

## PMX Loader (Lines 50-57)

```typescript
const assetContainer = await LoadAssetContainerAsync("path/to/your_file.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;

const mmdModel = mmdRuntime.createMmdModel(mmdMesh);
const modelMotion = await vmdLoader.loadAsync("model_motion", "your_model_motion_path.vmd");
const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(modelMotion);
mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);
```

This code uses the PMX loader to load MMD model and VMD loader to load model animations. Then set up runtime animation.

### MMD Model Loader

babylon-mmd supports various MMD model formats such as PMX, PMD, BPMX. In this example, we're using the PMX loader to load the model.

```typescript
const assetContainer = await LoadAssetContainerAsync("path/to/your_file.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

This code loads a PMX file using Babylon.js's SceneLoader.

Since we previously called `RegisterPmxLoader()`, the `LoadAssetContainerAsync` function can correctly load PMX files.

We then cast the first mesh from the loaded meshes in assetContainer to `MmdMesh` type for use.

MMD model loaders always place the MMD model root mesh at `meshes[0]`, so this casting is always valid.

### Adding MMD Model to Runtime

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh);
const modelMotion = await vmdLoader.loadAsync("model_motion", "your_model_motion_path.vmd");
const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(modelMotion);
mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);
```

You can create an MMD model controlled by the runtime from an MMD mesh using the `MmdRuntime.createMmdModel` function.
Once MmdModel is created, all meshes and materials under the MMD root mesh are controlled by the MMD runtime.

The way to bind animations to MmdModel is the same as camera animations.

## Conclusion

In this section, we've looked at the basic usage of babylon-mmd.

The newly introduced concepts are as follows:

- **MmdRuntime**: A runtime that processes MMD animations. It manages MMD models and animations, integrating physics engine and audio player.
- **MmdWasmInstance**: A WebAssembly instance for processing MMD animations. It improves performance using WASM binaries. Using this is optional.
- **MmdAnimation**: A container that manages MMD animation data. You can create and bind runtime animations.
- **MmdMesh**: An object representing the mesh of an MMD model. It supports various MMD model formats such as PMX, PMD, BPMX.
- **MmdModel**: An object that adds MMD models to runtime and binds animations. It controls all meshes and materials under the MMD model's root mesh.
- **MmdPlayerControl**: A UI control for controlling MMD animations. You can play, pause, adjust audio, etc.
