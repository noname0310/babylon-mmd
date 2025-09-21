---
sidebar_position: 2
sidebar_label: MMD Runtime
---

# MMD Runtime

## MmdRuntime class

`MmdRuntime` is the **core class** of the babylon-mmd runtime component.
`MmdRuntime` references and controls all other runtime components to apply animation to MMD models.

`MmdRuntime` provides the following features:
- Control **multiple MMD models** simultaneously
- Control **multiple MMD cameras** simultaneously
- Apply **camera animation**
- Control **physics simulation**

Here is the code to create an `MmdRuntime`:

```typescript
const mmdRuntime = new MmdRuntime(scene, null);
```

The constructor of `MmdRuntime` takes two arguments:
- `scene`: If a `Scene` object is provided, the lifetime of `MmdRuntime` is tied to the `Scene` object. That is, when the `Scene` is disposed, `MmdRuntime` is also **automatically disposed**. If `null` is provided, you must **manually call** the `dispose()` method of `MmdRuntime`, otherwise a **memory leak** may occur.
- `physics`: Provides a physics simulation implementation. If `null` is provided, **physics simulation is disabled**. To enable physics simulation, you must provide an instance of a class implementing the `IMmdPhysics` interface, such as `MmdBulletPhysics`, `MmdAmmoPhysics`, or `MmdPhysics`.

Note that the logic for handling physics simulation is **not included** in `MmdRuntime` but is **injected from outside**.

This design allows you to **easily swap** out the physics engine implementation, implement your own **custom physics engine**, and bundle only the implementation you use to **reduce bundle size**.

### Frame Update

To process animation, you must call the update functions `MmdRuntime.beforePhysics()` and `MmdRuntime.afterPhysics()` **every frame**.

These two methods should be called **before and after** the physics simulation is executed, respectively.

Therefore, an application using `MmdRuntime` should have a frame loop like this:

```typescript
// sudo code for frame loop
for (; ;) {
    mmdRuntime.beforePhysics();
    simulatePhysics();
    mmdRuntime.afterPhysics();
    render();
}
```

The easiest way to call these two methods every frame is to register callbacks to the `onBeforeAnimationsObservable` and `onBeforeRenderObservable` events of the `Scene`.

The `MmdRuntime.register()` method takes a `Scene` object as an argument and internally registers callbacks to these two events so that `beforePhysics()` and `afterPhysics()` are **automatically called** every render.

```typescript
mmdRuntime.register(scene);
```

If you want to temporarily stop updating `MmdRuntime`, you can call the `MmdRuntime.unregister()` method to remove the registered callbacks.

```typescript
mmdRuntime.unregister(scene);
```

### Playback Control

One of the core features of `MmdRuntime` is controlling MMD animation playback.

`MmdRuntime` provides the following methods to control animation:
- `playAnimation(): Promise<void>`: **Starts** animation playback.
- `pauseAnimation(): void`: **Pauses** animation playback.
- `seekAnimation(frameTime: number, forceEvaluate: boolean = false): Promise<void>`: **Moves the animation** to a specific frame. If `forceEvaluate` is set to `true`, the animation is evaluated immediately after moving. Otherwise, it is evaluated on the next `beforePhysics(): void` call.
- `setManualAnimationDuration(frameTimeDuration: Nullable<number>): void`: **Manually sets** the total frame time of the animation. By default, the total length of the animation is automatically set to the longest among all MMD animations participating in evaluation. This method is useful when there are multiple animation clips or no animation clips. If `null` is provided, it returns to automatic mode.

`MmdRuntime` provides the following properties to check the animation state:
- `isAnimationPlaying: boolean`: Boolean value indicating whether the animation is **currently playing**.
- `timeScale: number`: Numeric value controlling the **animation playback speed**. Default is `1.0`.
- `currentFrameTime: number`: Numeric value indicating the **current frame time** of the animation.
- `currentTime: number`: Numeric value indicating the **current time** of the animation in seconds.
- `animationFrameTimeDuration: number`: Numeric value indicating the **total frame time length** of the animation.
- `animationDuration: number`: Numeric value indicating the **total length** of the animation in seconds.

:::info
`MmdRuntime` internally uses **frame time** to represent time. MMD animation plays at **30 frames per second**, so 1 second corresponds to 30 frame time. For example, if `currentFrameTime` is `60`, it means the animation has played for 2 seconds.
:::

### Animatable

`MmdRuntime` provides the ability to control **arbitrary animatable objects**.

For MMD models, `MmdRuntime` **directly processes** animation calculation, but for objects other than MMD models, each object is **delegated** to calculate its own animation.

These objects must implement the `IMmdRuntimeAnimatable` interface and can be registered via the `addAnimatable()` method of `MmdRuntime`.

A typical example implementing the `IMmdRuntimeAnimatable` interface is the `MmdCamera` class.

Here is an example code registering an `MmdCamera` object to `MmdRuntime` and playing animation:

```typescript
// initialize MmdRuntime
const mmdRuntime = new MmdRuntime(scene, null);
mmdRuntime.register(scene);

// load VMD animation
const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadAsync("motion", "path/to/motion.vmd");

// create MmdCamera and set animation
const camera = new MmdCamera();
const runtimeAnimation = camera.createRuntimeAnimation(mmdAnimation);
camera.setRuntimeAnimation(runtimeAnimation);

// add MmdCamera to MmdRuntime and play animation
mmdRuntime.addAnimatable(camera);
mmdRuntime.playAnimation();
```

## MmdModel class

`MmdModel` is a class representing an MMD model. `MmdModel` wraps the **root mesh** (a.k.a MMD Mesh) of the MMD model and provides interfaces to control the model's **bones, morphs, physics simulation**, etc.

`MmdModel` is basically controlled by `MmdRuntime` and can **only be created** via the `createMmdModel()` or `createMmdModelFromSkeleton()` methods of `MmdRuntime`.

Here is an example code loading a PMX model and creating an `MmdModel`:

```typescript
// initialize MmdRuntime
const mmdRuntime = new MmdRuntime(scene, null);
mmdRuntime.register(scene);

// load VMD animation
const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadAsync("motion", "path/to/motion.vmd");

// load PMX model
const assetContainer = await LoadAssetContainerAsync("path/to/model.pmx", scene)
assetContainer.addAllToScene();
const rootMesh = assetContainer.meshes[0] as Mesh;

// create MmdModel and set animation
const mmdModel = mmdRuntime.createMmdModel(rootMesh);
const runtimeAnimation = mmdModel.createRuntimeAnimation(mmdAnimation);
mmdModel.setRuntimeAnimation(runtimeAnimation);

// play animation
mmdRuntime.playAnimation();
```

From the moment the `MmdModel` instance is created, **various resources** of the MMD Mesh are managed by `MmdModel`. This includes `Mesh`, `Skeleton`, `Bone`, `Morph Target`, `Material`, etc.

:::warning
**Directly accessing or modifying** resources managed by `MmdModel` is **not recommended**.
Especially for `Skeleton`, since `MmdModel` overrides the calculation method internally, directly calling methods of the `Skeleton` or `Bone` objects managed by `MmdModel` may cause **unexpected behavior**.
:::

Destroying an `MmdModel` removes the corresponding MMD Mesh from the runtime and releases all resources managed by the model.

```typescript
mmdRuntime.destroyMmdModel(mmdModel);
```

The main properties of the `MmdModel` object are as follows:

- `mesh: MmdSkinnedMesh | TrimmedMmdSkinnedMesh`: The **root mesh** of the MMD model.
- `skeleton: IMmdLinkedBoneContainer`: The **skeleton** of the MMD model.
- `worldTransformMatrices: Float32Array`: Array of **world transform matrices** of the MMD model. Contains the world transform matrix of each bone.
- `ikSolverStates: Uint8Array`: Array of **IK solver states** of the MMD model. Contains the activation state of each IK bone.
- `rigidBodyStates: Uint8Array`: Array of **rigid body states** of the MMD model. Contains the activation state of each rigid body.
- `runtimeBones: readonly IMmdRuntimeBone[]` : Array of `MmdRuntimeBone` objects representing the **bones** of the MMD model.
- `morph: MmdMorphController`: The `MmdMorphController` object controlling the **morphs** of the MMD model.

### MmdModel Creation Options

When creating an `MmdModel` using the `createMmdModel()` method of `MmdRuntime`, you can pass an **options object** as the second argument to customize the behavior of the model.

```typescript
const mmdModel = mmdRuntime.createMmdModel(rootMesh, {
    materialProxyConstructor: null,
    buildPhysics: true,
    trimMetadata: true
});
```

The options object has the following properties:

- `materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<TMaterial>>`: A constructor function for a material proxy. If provided, the material proxy is created for each material of the MMD model and used to manipulate material parameters. This enables support for **material morphing**. For more details, see the [Enable Material Morphing](../enable-material-morphing) documentation. Default is `null`.
- `buildPhysics: IMmdModelPhysicsCreationOptions | boolean`: Options for creating physics simulation. If `true` is provided, **Rigid Bodies and Constraints** are created based on the metadata of the MMD model. If an object of type `IMmdModelPhysicsCreationOptions` is provided, you can set options for creating Rigid Bodies and Constraints. for more details, see the [Apply Physics To MMD Models](../apply-physics-to-mmd-models) documentation. Default is `true`.
- `trimMetadata: boolean`: If `true` is provided, unnecessary metadata used only during the creation of the MMD model is **removed from the MMD Mesh** after the creation of the model. This can **reduce memory usage**. However, if you want to recreate `MmdModel` from the same MMD Mesh later, you need to set this option to `false`. Default is `true`.

### MmdRuntimeBone class

`MmdRuntimeBone` is a class representing a **bone of an MMD model**. It wraps the Babylon.js `Bone` class and provides interfaces to control the bone's **Morph, IK, Append Transform**, etc.

You can access the `MmdRuntimeBone` object via the `MmdModel.runtimeBones` property.

The main properties of the `MmdRuntimeBone` object are as follows:

- `linkedBone: Bone`: The Babylon.js `Bone` object wrapped by `MmdRuntimeBone`.
- `name: string`: The name of the bone.
- `parentBone: Nullable<MmdRuntimeBone>`: The parent bone. If it is the root bone, it is `null`.
- `childBones: readonly MmdRuntimeBone[]`: Array of child bones.
- `transformOrder: number`: The transform order of the bone.
- `flag: number`: PMX bone flag value.
- `transformAfterPhysics: boolean`: Whether the transform is applied after physics simulation.
- `worldMatrix: Float32Array`: The world transform matrix of the bone. This refers to part of the `MmdModel.worldTransformMatrices` array.
- `ikSolverIndex: number`: The IK solver index of the bone. If it is not an IK bone, it is `-1`. You can check the IK activation state of the bone via the `MmdModel.ikSolverStates` array.
- `rigidBodyIndices: readonly number[]`: Array of indices of rigid bodies connected to the bone. You can check the activation state of each rigid body via the `MmdModel.rigidBodyStates` array.

`MmdRuntimeBone` also provides the following methods:

- `getWorldMatrixToRef(target: Matrix): Matrix`: Copies the **world transform matrix** of the bone to the `target` matrix.
- `getWorldTranslationToRef(target: Vector3): Vector3`: Copies the **world position** of the bone to the `target` vector.
- `setWorldTranslation(source: DeepImmutable<Vector3>): void`: Sets the **world position** of the bone to the `source` vector.

These properties and methods of `MmdRuntimeBone` can be used to **read or set** the state of the bone.

Here is an example code printing the world position of the センター (Center) bone of an MMD model using the methods of `MmdRuntimeBone`:

```typescript
const meshWorldMatrix = mmdModel.mesh.getWorldMatrix();
const boneWorldMatrix = new Matrix();

const centerBone = mmdModel.runtimeBones.find(bone => bone.name === "センター")!;

// The bone world matrix is based on model space, so you need to multiply the mesh world matrix.
centerBone.getWorldMatrixToRef(boneWorldMatrix).multiplyToRef(meshWorldMatrix, boneWorldMatrix);

const centerPosition = new Vector3();
boneWorldMatrix.getTranslationToRef(centerPosition);

console.log(`Center bone world position: ${centerPosition.toString()}`);
```

### MmdMorphController class

`MmdMorphController` is a class that controls the **morphs of an MMD model**.
`MmdMorphController` provides interfaces to control **Vertex Morph, Bone Morph, UV Morph, Material Morph**, etc.

You can access the `MmdMorphController` object via the `MmdModel.morph` property.

The main methods of the `MmdMorphController` object are as follows:

- `setMorphWeight(morphName: string, weight: number): void`: **Sets the weight** of the morph with the name `morphName` to `weight`. If the morph with the given name does not exist, nothing happens.
- `getMorphWeight(morphName: string): number`: Returns the **current weight** of the morph with the name `morphName`. If the morph with the given name does not exist, returns `0`.
- `getMorphIndices(morphName: string): readonly number[] | undefined`: Returns the **index array** of the morph with the name `morphName`. If the morph with the given name does not exist, returns `undefined`.
- `setMorphWeightFromIndex(morphIndex: number, weight: number): void`: Sets the weight of the morph with the **index** `morphIndex` to `weight`. If the morph with the given index does not exist, nothing happens.
- `getMorphWeightFromIndex(morphIndex: number): number`: Returns the current weight of the morph with the **index** `morphIndex`. If the morph with the given index does not exist, returns `undefined`.
- `getMorphWeights(): Readonly<ArrayLike<number>>`: Returns the **weight array** of all morphs.
- `resetMorphWeights(): void`: **Initializes** the weight of all morphs to `0`.
- `update(): void`: **Updates the state** of the morphs. Usually called automatically by `MmdRuntime`, so you don't need to call it directly.

:::info
By default, `MmdMorphController` uses **indices internally** to control morphs. Therefore, methods that set or get weights using morph names internally convert names to indices, so in **performance-sensitive situations**, it is better to use methods that use **indices directly**.
:::

## Physics

`MmdRuntime` uses an **external physics engine** implementation injected for physics simulation. babylon-mmd provides **three physics engine implementations**:
- `MmdBulletPhysics`: Uses the **Bullet Physics** engine. Bullet Physics is a physics engine written in C++, and babylon-mmd provides an optimized **WebAssembly-compiled version**.
- `MmdAmmoPhysics`: Uses the **Ammo.js** engine.
- `MmdPhysics`: Uses the **Havok Physics** engine.

To enable physics simulation in `MmdRuntime`, you need to provide an instance of one of these classes when creating `MmdRuntime`.

For more details on how to set up physics simulation, see the [Apply Physics To MMD Models](../apply-physics-to-mmd-models) documentation.

## WebAssembly Implementation

Solve IK, Append Transform, and Morph processing in `MmdRuntime` are all implemented in **TypeScript** and handled by the browser's JavaScript engine.

babylon-mmd also provides `MmdWasmRuntime` implemented in **WebAssembly (WASM)** for **faster performance**. `MmdWasmRuntime` provides almost the same API as `MmdRuntime` and processes Solve IK, Append Transform, Morph, and Physics simulation in WebAssembly for **better performance**.

However, the WASM implementation is **difficult to customize** arbitrarily and may be **limited in special runtime environments** (e.g., React Native).

For more details, see the [MMD WebAssembly Runtime](../mmd-webassembly-runtime) documentation.
