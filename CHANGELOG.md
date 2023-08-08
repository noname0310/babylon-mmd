# Changelog

## 0.24.0

- Shows the mesh when all texture loads and shaders are compiled

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
