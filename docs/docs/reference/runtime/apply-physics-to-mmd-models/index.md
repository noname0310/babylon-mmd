---
sidebar_position: 5
sidebar_label: Apply Physics To MMD Models
---

# Apply Physics To MMD Models


### Bullet Implementation

You can use the Bullet Physics engine to process MMD physics simulation.

This Bullet Physics engine is compiled to WebAssembly after C++ to Rust FFI binding and is included as part of the babylon-mmd package.

It is a completely independent binding from Ammo.js, providing better performance and stability.

Below is an example code creating `MmdRuntime` using the Bullet Physics engine:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);

const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
```

To use the Bullet Physics engine, you must first load the WebAssembly binary provided by babylon-mmd. This can be done using the `getMmdWasmInstance()` function.

Here, you can choose one of four WebAssembly instance types:
- `MmdWasmInstanceTypeSPR`: Single-threaded, Physics, Release Build
- `MmdWasmInstanceTypeSPD`: Single-threaded, Physics, Debug Build
- `MmdWasmInstanceTypeMPR`: Multi-threaded, Physics, Release Build
- `MmdWasmInstanceTypeMPD`: Multi-threaded, Physics, Debug Build

The multi-threaded version only works in environments that support `SharedArrayBuffer`. Choose the appropriate binary depending on your environment.

In the example above, the single-threaded release build is used.
```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```

The `MultiPhysicsRuntime` class is a runtime class that processes physics simulation using the Bullet Physics engine. After creating an instance of `MultiPhysicsRuntime`, set the gravity vector and register update callbacks to the `Scene`.

```typescript
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);
```

You can use various methods provided by `MultiPhysicsRuntime` to control physics simulation, such as setting gravity or directly adding RigidBody or Constraint. For more details, see the [Bullet Physics](../bullet-physics) documentation.

### Ammo.js Implementation

Ammo.js is a JavaScript port of the Bullet Physics engine compiled with Emscripten. You can use it to process MMD physics simulation.

Below is an example code creating `MmdRuntime` using Ammo.js:

```typescript
import ammo from "babylon-mmd/esm/Runtime/Physics/External/ammo.wasm";

const physicsInstance = await ammo();
const physicsPlugin = new MmdAmmoJSPlugin(true, physicsInstance);
scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), physicsPlugin);

const mmdRuntime = new MmdRuntime(scene, new MmdAmmoPhysics(scene));
```

The babylon-mmd package includes the Bullet Physics 3.25 version compiled with Emscripten as the `ammo.wasm` binary. You can import it from the path `"babylon-mmd/esm/Runtime/Physics/External/ammo.wasm"`.

:::info
Ammo.js has some instability issues with constraints for certain data, so it is recommended to use the Bullet Physics engine if possible.
:::

### Havok Implementation

You can use the Havok Physics engine to process MMD physics simulation.

Below is an example code creating `MmdRuntime` using the Havok Physics engine:

```typescript
import havok from "@babylonjs/havok";

const physicsInstance = await havok();
const physicsPlugin = new HavokPlugin(true, physicsInstance);
scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);

const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
```

:::info
The Havok Physics engine does not have good numerical stability, so it may not be suitable for MMD physics simulation. It is recommended to use the Bullet Physics engine if possible.
:::
