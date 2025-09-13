---
sidebar_position: 6
sidebar_label: Bullet Physics
---

# Bullet Physics

This section explains how to use the **Bullet Physics** engine binding in babylon-mmd.

## Bullet Physics Overview

babylon-mmd uses the **Bullet Physics** engine for physics simulation of MMD models.

The Bullet Physics engine is an **open source physics engine** written in **C++** that supports collision detection and rigid body dynamics simulation.

Typically, to use this engine, you would use the Ammo.js library, which is the C++ code compiled to WebAssembly (WASM) using **emscripten**.

However, babylon-mmd takes a different approach by **not using emscripten**. Instead, it integrates the Bullet Physics engine into Rust source code through FFI, and then compiles it to WASM using wasm-bindgen.

In this process, all Bullet Physics binding code is **manually written**, providing **better performance** compared to Ammo.js.

## Bullet Physics Integration Forms

The Bullet Physics engine is integrated into babylon-mmd in **two main forms**.

### Bullet Physics JavaScript Binding

This binding allows the Bullet Physics engine to be called directly from JavaScript. The binding is located in the `babylon-mmd/esm/Runtime/Optimized/Physics/Bind` directory.

Here's the code to create an MMD runtime using this approach:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);

const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
```

In this case, the `MultiPhysicsRuntime` class is an object that **processes physics simulations for multiple models in parallel**, allowing you to control the simulation.

### Using MmdWasmPhysics

This approach calls the Bullet Physics engine from the `MmdWasmRuntime` written in Rust. This method **doesn't use bindings exposed to JavaScript**, but directly calls the Bullet Physics engine from Rust, **reducing FFI overhead**.

Here's the code to create an MMD runtime using this approach:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPR());
const mmdRuntime = new MmdWasmRuntime(scene, new MmdWasmPhysics(mmdWasmInstance));
```

In this case as well, you can control the physics simulation using the `MmdWasmPhysicsRuntimeImpl` class, which is similar to `MultiPhysicsRuntime`:

```typescript
const physicsRuntime = mmdRuntime.physics!.getImpl(MmdWasmPhysicsRuntimeImpl);
```

The main difference is that `MultiPhysicsRuntime` **directly owns the WASM resources**, whereas `MmdWasmPhysicsRuntimeImpl` **references the WASM resources** owned by `MmdWasmRuntime`.

## Memory Management of Bullet Physics Binding Objects

The Bullet Physics engine binding uses **FinalizationRegistry** to manage memory.

Therefore, when directly using the binding code in the `babylon-mmd/esm/Runtime/Optimized/Physics/Bind` directory, **memory is automatically released**.

If you want to manually control memory management, you can explicitly release memory by calling the `dispose()` method.

```typescript
const rigidBody = new RigidBody(physicsRuntime, rbInfo);
// Use rigidBody
rigidBody.dispose(); // Explicitly release memory
```

## Using the Bullet Physics API

The Bullet Physics binding code in the `babylon-mmd/esm/Runtime/Optimized/Physics/Bind` directory can also be used for **general physics simulations** that aren't related to MMD models.

Below is a simple example of using the Bullet Physics binding to make a cube fall to the ground:

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new NullPhysicsRuntime(mmdWasmInstance);
const physicsWorld = new PhysicsWorld(physicsRuntime);

// create ground mesh
const ground = CreatePlane("ground", { size: 120 }, scene);
ground.rotationQuaternion = Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI / 2);

// create ground rigid body with static plane shape
const groundShape = new PhysicsStaticPlaneShape(runtime, new Vector3(0, 0, -1), 0);
const groundRbInfo = new RigidBodyConstructionInfo(wasmInstance);
groundRbInfo.shape = groundShape;
groundRbInfo.setInitialTransform(ground.getWorldMatrix());
groundRbInfo.motionType = MotionType.Static;

const groundRigidBody = new RigidBody(runtime, groundRbInfo);
world.addRigidBody(groundRigidBody);

// create box mesh
const baseBox = CreateBox("box", { size: 2 }, scene);
baseBox.position = new Vector3(0, 20, 0);
baseBox.rotationQuaternion = Quaternion.Identity();

// create box rigid body with box shape
const boxShape = new PhysicsBoxShape(runtime, new Vector3(1, 1, 1));
const boxRbInfo = new RigidBodyConstructionInfo(wasmInstance);
boxRbInfo.shape = boxShape;
boxRbInfo.setInitialTransform(baseBox.getWorldMatrix());
boxRbInfo.motionType = MotionType.Dynamic;

// create box rigid body
const boxRigidBody = new RigidBody(runtime, boxRbInfo);
world.addRigidBody(boxRigidBody);

const matrix = new Matrix();

// register onBeforeRenderObservable to update physics simulation
scene.onBeforeRenderObservable.add(() => {
    world.stepSimulation(1 / 60, 10, 1 / 60);

    boxRigidBody.getTransformMatrixToRef(matrix);
    matrix.getTranslationToRef(baseBox.position);
    Quaternion.FromRotationMatrixToRef(matrix, baseBox.rotationQuaternion!);
});
```

The Bullet Physics binding consists of **several components**, and you can select and use only the components you need depending on the situation.

- `PhysicsShape`: A class representing collision shapes used in physics simulation.
  - Corresponds to Bullet Physics' `btCollisionShape`.
- `RigidBody`: A class representing rigid bodies used in physics simulation.
  - Corresponds to Bullet Physics' `btRigidBody`.
- `RigidBodyConstructionInfo`: A class containing information for creating rigid bodies.
  - Corresponds to Bullet Physics' `btRigidBody::btRigidBodyConstructionInfo`.
- `Constraint`: A class representing constraints used in physics simulation.
  - Corresponds to Bullet Physics' `btTypedConstraint`.
- `PhysicsWorld`: A class managing physics simulation.
  - Corresponds to Bullet Physics' `btDynamicsWorld`.
- `PhysicsRuntime`: A wrapper class for `PhysicsWorld` that includes logic for handling Buffered Evaluation.

### Physics Shape

Physics Shape is a class representing collision shapes used in physics simulation.

babylon-mmd provides the following Physics Shape classes:

- `PhysicsBoxShape`: A class representing box collision shapes.
  - Corresponds to Bullet Physics' `btBoxShape`.
- `PhysicsSphereShape`: A class representing sphere collision shapes.
  - Corresponds to Bullet Physics' `btSphereShape`.
- `PhysicsCapsuleShape`: A class representing capsule collision shapes.
  - Corresponds to Bullet Physics' `btCapsuleShape`.
- `PhysicsStaticPlaneShape`: A class representing infinite plane collision shapes.
  - Corresponds to Bullet Physics' `btStaticPlaneShape`.

While Bullet Physics supports many other Physics Shapes, babylon-mmd has implemented **only the collision shape bindings needed for MMD models**.

### Rigid Body

RigidBody represents rigid bodies used in physics simulation.

To create a RigidBody class, you must **initialize it using** a `RigidBodyConstructionInfo` object.

The RigidBody class is provided in **two types of implementations**:
- `RigidBody`: A class representing a single RigidBody object.
- `RigidBodyBundle`: A class that can handle multiple RigidBody objects bundled as a single object.

The `RigidBodyBundle` class provides **better performance** by improving Memory Locality between RigidBody objects when creating multiple RigidBody objects at once.

To efficiently initialize `RigidBodyBundle`, the `RigidBodyConstructionInfoList` class is also provided.

The `RigidBodyConstructionInfoList` class is a class that can handle multiple RigidBodyConstructionInfo objects bundled as a single object.

Here's an example of using `RigidBodyBundle`:

```typescript
const boxShape = new PhysicsBoxShape(runtime, new Vector3(1, 1, 1));

const rbCount = 10;
const rbInfoList = new RigidBodyConstructionInfoList(wasmInstance, rbCount);
for (let k = 0; k < rbCount; ++k) {
    rbInfoList.setShape(k, boxShape);
    const initialTransform = Matrix.TranslationToRef(xOffset, 1 + k * 2, zOffset, matrix);
    rbInfoList.setInitialTransform(k, initialTransform);
    rbInfoList.setFriction(k, 1.0);
    rbInfoList.setLinearDamping(k, 0.3);
    rbInfoList.setAngularDamping(k, 0.3);
}
const boxRigidBodyBundle = new RigidBodyBundle(runtime, rbInfoList);
world.addRigidBodyBundle(boxRigidBodyBundle, worldId);
```

### Constraint

Constraint represents constraints used in physics simulation.

babylon-mmd provides the following Constraint classes:

- `Generic6DofConstraint`: A class representing 6 degrees of freedom constraints.
  - Corresponds to Bullet Physics' `btGeneric6DofConstraint`.
- `Generic6DofSpringConstraint`: A class representing 6 degrees of freedom constraints with springs.
  - Corresponds to Bullet Physics' `btGeneric6DofSpringConstraint`.

While Bullet Physics supports many other Constraints, babylon-mmd has implemented **only the constraint bindings needed for MMD models**.

### Physics World

PhysicsWorld is a class that manages physics simulation.

The PhysicsWorld class is provided in **two types of implementations**:
- `PhysicsWorld`: A class representing a single physics simulation world.
- `MultiPhysicsWorld`: A class that processes multiple physics simulation worlds in parallel.
  - APIs are provided for interaction between each world.

RigidBody and Constraint objects **must be added** to a PhysicsWorld or MultiPhysicsWorld object to participate in physics simulation.

### Physics Runtime

PhysicsRuntime is a wrapper class for PhysicsWorld that includes logic for handling **Buffered Evaluation**.

The PhysicsRuntime class is provided in **three types of implementations**:

- `NullPhysicsRuntime`: A class for using PhysicsWorld without a runtime.
- `PhysicsRuntime`: A class that processes PhysicsWorld.
- `MultiPhysicsRuntime`: A class that processes MultiPhysicsWorld.

The `PhysicsRuntime` and `MultiPhysicsRuntime` classes support Buffered Evaluation, which means that if the `PhysicsRuntime.evaluationType` property is set to `PhysicsRuntimeEvaluationType.Buffered` in an environment where **multi-threading is possible**, physics simulation will be processed in a **separate worker thread**.

```typescript
physicsRuntime.evaluationType = PhysicsRuntimeEvaluationType.Buffered;
```

:::info
While the `PhysicsWorld` or `MultiPhysicsWorld` objects perform the task of properly handling synchronization using locks, implementing this directly is **very difficult**.

Therefore, controlling physics simulation using `NullPhysicsRuntime` without a runtime when using Buffered Evaluation is a **very complex task** and is not recommended.
:::

:::info
The Physics Runtime compatible with the MMD runtime is `MultiPhysicsRuntime`, and other Physics Runtimes are **not compatible** with the MMD runtime.
:::

## Additional Resources

The Bullet Physics binding was initially developed in the `babylon-bulletphysics` repository and later integrated into babylon-mmd.

Therefore, you can check out [more examples and test code](https://github.com/noname0310/babylon-bulletphysics/tree/main/src/Test/Scene) for the Bullet Physics binding in the `babylon-bulletphysics` repository.
