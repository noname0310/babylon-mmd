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

To keep the example concise, import statements except for side effects have been omitted.

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

You can try it in Babylon.js Playground. https://www.babylonjs-playground.com/#S7XDNP

Let's examine the functionality provided by each element.

- [**Line 1-6**](#side-effects-line-1-6): Register side effects required for scene loading.

- [**Line 9-17**](#scene-creation-line-9-17): Create a scene and set up camera and lighting.

- [**Line 19-34**](#mmd-runtime-creation-line-19-34): Create MMD runtime and set up physics engine. Also configure audio player to synchronize animations with audio.

- [**Line 36-37**](#mmd-player-control-creation-line-36-37): Create MMD player control.

- [**Line 39-44**](#vmd-loader-line-39-44): Use VMD loader to load camera animation and set runtime animation on the camera.

- [**Line 46-53**](#pmx-loader-line-46-53): Use PMX loader to load MMD model and VMD loader to load model animations. Then set up runtime animation.

## Side Effects (Line 1-6)

```typescript
// side effects that register the loader
import "babylon-mmd/esm/Loader/pmxLoader";

// side effects that register the animation runtime
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
```

This code registers babylon-mmd's PMX loader and animation runtime with Babylon.js SceneLoader. This enables loading PMX files and playing camera and model animations.

Not only PMX loader but also other MMD model loaders can be used in the same way. For example, to use the PMD loader, you can add the following:

```typescript
import "babylon-mmd/esm/Loader/pmdLoader";
```

Or to use the BPMX loader, you can add the following:
```typescript
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader";
```

:::warning

If even one symbol is imported from the "babylon-mmd" path, all possible side effects will be applied.

This follows Babylon.js conventions.
Therefore, for tree shaking to work properly, all imports must be written with full paths.

To perform tree shaking properly, refer to [this Babylon.js documentation](https://doc.babylonjs.com/setup/frameworkPackages/es6Support#side-effects).

:::

## Scene Creation (Line 9-17)

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

## MMD Runtime Creation (Line 19-34)

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

## MMD Player Control Creation (Line 36-37)

```typescript
// create a youtube-like player control
new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
```

This code creates an MMD player control. This control provides a UI for playing, pausing, and adjusting audio of MMD animations.

This code is provided for quick testing purposes, and it's recommended to implement your own for production use.

## VMD Loader (Line 39-44)

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

## PMX Loader (Line 46-53)

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

Since we previously registered the PMX loader with `import "babylon-mmd/esm/Loader/pmxLoader";`, the `LoadAssetContainerAsync` function can correctly load PMX files.

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
