---
sidebar_position: 5
sidebar_label: Apply Physics To MMD Models
---

# Apply Physics To MMD Models

This section explains how to apply **physics simulation** to MMD models.

MMD models support **physics simulation**, allowing you to apply physical effects to the model's bones using a physics engine.

babylon-mmd provides **various options** to implement this. You can review the characteristics of each option and choose the one that best fits your usage scenario.

## Physics Engine Options

babylon-mmd supports **three physics engines** to handle MMD physics simulation:

- **Bullet Physics**: The physics engine used by MMD. It is compiled to WebAssembly using Rust wasm-bindgen and included in the babylon-mmd package.
- **Ammo.js**: An Emscripten-based JavaScript port of Bullet Physics. It is provided as a WebAssembly binary compiled with Emscripten.
- **Havok Physics**: A commercial physics engine supported by Babylon.js. It is provided as a WebAssembly binary.

Here are the characteristics of each physics engine when applied to MMD models:

| Physics Engine   | Performance       | Stability        | Portability      | Ease of Use      |
|------------------|-------------------|------------------|------------------|------------------|
| Bullet Physics | ★★★★☆ - **Optimized binding** | ★★★★★ - **Excellent MMD behavior reproduction** | ★★★☆☆ - Available only in environments that support WebAssembly | ★★★☆☆ - Relatively less developer experience consideration in API |
| Ammo.js | ★★★☆☆ - Performance degradation due to auto-generated binding | ★★★☆☆ - Good MMD behavior reproduction, but relatively higher crash possibility | ★★★★★ - **Can be used in environments without WebAssembly support** when using asm.js build | ★★★★★ - **Good compatibility and convenience** with Babylon.js |
| Havok Physics | ★★★★★ - **Optimized binding, faster engine performance** | ★☆☆☆☆ - Poor MMD behavior reproduction, severe numerical instability | ★★★☆☆ - Available only in environments that support WebAssembly | ★★★★★ - **Good compatibility and convenience** with Babylon.js |

Below, we explain how to initialize each physics engine.

### Bullet Physics Implementation

You can use the Bullet Physics engine to process MMD physics simulation.

This Bullet Physics engine is compiled to WebAssembly after C++ to Rust **FFI binding** and is included as part of the babylon-mmd package.

It is a **completely independent binding** from Ammo.js, providing **better performance and stability**.

Below is an example code creating `MmdRuntime` using the Bullet Physics engine:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);

const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
```

To use the Bullet Physics engine, you must first **load the WebAssembly binary** provided by babylon-mmd. This can be done using the `getMmdWasmInstance()` function.

Here, you can choose one of **four WebAssembly instance types**:
- `MmdWasmInstanceTypeSPR`: **Single-threaded, Physics, Release Build**
- `MmdWasmInstanceTypeSPD`: **Single-threaded, Physics, Debug Build**
- `MmdWasmInstanceTypeMPR`: **Multi-threaded, Physics, Release Build**
- `MmdWasmInstanceTypeMPD`: **Multi-threaded, Physics, Debug Build**

The multi-threaded version only works in environments that support **`SharedArrayBuffer`**. Choose the appropriate binary depending on your environment.

In the example above, the **single-threaded release build** is used.
```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```

The `MultiPhysicsRuntime` class is a runtime class that processes physics simulation using the Bullet Physics engine. After creating an instance of `MultiPhysicsRuntime`, **set the gravity vector** and **register update callbacks** to the `Scene`.

```typescript
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);
```

You can use various methods provided by `MultiPhysicsRuntime` to control physics simulation, such as **setting gravity** or directly adding **RigidBody or Constraint**. For more details, see the [Bullet Physics](../bullet-physics) documentation.

:::info
If you're using `MmdWasmRuntime`, you can use `MmdWasmPhysics` instead.

This uses the same code internally, but it **eliminates the JavaScript-to-WASM binding** layer, providing **better performance**.

```typescript
const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance, scene, new MmdWasmPhysics(scene));

const physicsRuntime = mmdRuntime.physics!.getImpl(MmdWasmPhysicsRuntimeImpl);

// This code can be omitted as the gravity in physics worlds created
// by the MMD WASM runtime is set to (0, -9.8*10, 0) by default
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
```
:::

### Ammo.js Implementation

Ammo.js is a **JavaScript port** of the Bullet Physics engine compiled with Emscripten. You can use it to process MMD physics simulation.

Below is an example code creating `MmdRuntime` using Ammo.js:

```typescript
import ammo from "babylon-mmd/esm/Runtime/Physics/External/ammo.wasm";

const physicsInstance = await ammo();
const physicsPlugin = new MmdAmmoJSPlugin(true, physicsInstance);
scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), physicsPlugin);

const mmdRuntime = new MmdRuntime(scene, new MmdAmmoPhysics(scene));
```

The babylon-mmd package includes the **Bullet Physics 3.25 version** compiled with Emscripten as the `ammo.wasm` binary. You can import it from the path `"babylon-mmd/esm/Runtime/Physics/External/ammo.wasm"`.

:::info
Ammo.js has some **instability issues with constraints** for certain data, so it is recommended to use the Bullet Physics engine if possible.
:::

You can also use Babylon.js PhysicsPluginV1 interface to manage the Ammo.js physics engine. For more details, see the [Babylon.js Physics](https://doc.babylonjs.com/legacy/physics/) documentation.

### Havok Physics Implementation

You can use the **Havok Physics engine** to process MMD physics simulation.

Below is an example code creating `MmdRuntime` using the Havok Physics engine:

```typescript
import havok from "@babylonjs/havok";

const physicsInstance = await havok();
const physicsPlugin = new HavokPlugin(true, physicsInstance);
scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);

const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
```

:::info
The Havok Physics engine does not have **good numerical stability**, so it may **not be suitable** for MMD physics simulation. It is recommended to use the Bullet Physics engine if possible.
:::

You can also use Babylon.js PhysicsPluginV2 interface to manage the Havok Physics engine. For more details, see the [Babylon.js Physics V2](https://doc.babylonjs.com/features/featuresDeepDive/physics/usingPhysicsEngine) documentation.

## Build Physics Of MMD Model

After creating the `MmdRuntime` instance with one of the above physics engines, you can create an `MmdModel` instance with `buildPhysics` option set to `true` to **enable physics simulation** on the MMD model.

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    buildPhysics: true
});
```

When the `buildPhysics` option is set to `true`, the MMD runtime **automatically creates** RigidBody and Constraint for the MMD model based on the **physics data defined in the PMX file**.

## Build Physics Options

When creating an `MmdModel` instance with physics enabled, you can pass **additional options** to customize the physics simulation.

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    buildPhysics: {
        worldId: undefined,
        kinematicSharedWorldIds: [],
        disableOffsetForConstraintFrame: false
    }
});
```

The available options are as follows:
- `worldId`: You can specify a **custom world ID** for the physics simulation. If not specified, a new world ID is automatically assigned.
- `kinematicSharedWorldIds`: You can specify an array of world IDs to **share kinematic objects**. This is useful when you want to share kinematic objects between multiple MMD models.
- `disableOffsetForConstraintFrame`: You can specify whether to disable the offset for the constraint frame. If your model's constraint is **not working correctly**, try setting this option to `true`.

### Multi-World Physics Simulation

First, the `worldId` and `kinematicSharedWorldIds` options control the physics simulation world. These options are **only valid when using Bullet Physics** as the physics backend. The Bullet Physics API in babylon-mmd provides the ability to create **multiple physics worlds**, process them with multi-threading, and synchronize between worlds. 

By default, whenever an MMD model is created, each model gets its **own independent physics world**. However, if you specify a certain ID using the `worldId` option, it will reuse that world if a physics world with that ID already exists. This allows **multiple MMD models to share the same physics world**.

Additionally, if you want to share kinematic objects between different worlds, you can use the `kinematicSharedWorldIds` option to specify a list of world IDs to share. With this option, **kinematic bodies** of MMD models belonging to different worlds can **interact with each other** in their respective worlds.

### Fix Constraint Behavior

The `disableOffsetForConstraintFrame` option is used when constraints in the MMD model are **not working correctly**. By default, this option is set to `false`. 

MMD processes physics simulation using **Bullet Physics version 2.75**. However, in the newer Bullet Physics version 3.25, the behavior of constraints has changed, which can cause problems where constraints don't work correctly in some MMD models.

Setting this option to `true` makes the Constraint Solver work in the **same way as version 2.75**, which can solve these issues. If your MMD model's constraints aren't working as expected, try setting this option to `true`.

However, be aware that the older constraint solver tends to have **more severe numerical instability**.


