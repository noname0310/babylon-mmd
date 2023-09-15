# Changelog

## 0.27.0

- fix body offset computation in `PhysicsWithBone`

- clamp physics constraint angular limit for better result

- improve mmd runtime performance

- introduce `AnimationRetargeter` to retarget any humanoid animation to mmd model

## 0.26.0

- fix append transform position computation

- support non-PMX model append transform rotation

- `MmdPlayerControl` fix time display initialization

- #8 support babylon.js animation runtime

- some GC optimizations in animation runtime

- improve physics damping parameter import

## 0.25.0

- improve parse speed of PMX, BPMX and VMD

- big-endian device support

- introduce `MmdCameraAnimationGroup` and `MmdModelAnimationGroup` to use MMD animation runtime with babylon.js `Animation` container

## 0.24.0

- #11 shows the mesh when all texture loads and shaders are compiled

- fix constraints axis calculation

- #5 improve physics parameter import

- now you need import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation" and "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation" side effect to use MMD animation runtime

- **breaking change** BVMD format updated to 2.0.0. Files of version 1.0.0 are no longer compatible. Please re-convert VMD files

- `BvmdLoader.loadFromBufferAsync` is removed because it ended in less than 1 ms

## 0.23.0

- fix object freezing in place to set physics body linear damping to 6.0
    - this is a temporary fix until [this issue](https://forum.babylonjs.com/t/havok-physics-rigidbody-dont-move-when-the-damping-values-of-several-bodies-are-different/43072) is resolved

- fix animated rigidbody collision detection
    - use `PhysicsBody.setTargetTransform` which is added in @babylonjs/havok 1.1.2

- change 6DofSpringConstraint build method more similar to MMD

- now minimum required version of @babylonjs/core is 6.15.0 (was 6.14.0) and @babylonjs/havok is 1.1.2 (was 1.1.1)

- fix TGA texture loading
    - fix Image loading failure when using custom texture loader

- support custom texture format on alpha texture evaluation

- umd unoptimized bundle is now available
