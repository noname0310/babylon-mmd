# Changelog

## 0.41.0

- replace animation when the same name animation is added to `MmdModel` or `MmdWasmModel`

- fix wrong alpha accumulation in `MmdStandardMaterial` when using sphere texture

- backface culling is no longer affected by a material's transparency (same as MMD's behavior)

- fix `BpmxLoader` alpha evaluation not working with asset which created from non-PMX model

- use RGB texture format instead of RGBA for sphere and toon texture

- fix material morph color accumulation method as same as MMD

- mesh with 0 alpha value is now automatically hidden by `MmdRuntime`

- refactor `MmdOutlineRenderer` to have the same behavior as MMD's outline

- introduce `transferAmbientToDiffuse` utility function to transfer ambient color to diffuse color in `MmdStandardMaterial` for get same result as MMD
    - this method makes loss of material information, so do not use it when you need serlialize material

## 0.40.0

- fix shader compilation error when using WebGPU with non SDEF model

- give unique name to `MmdOutlineRenderer` to prevent name collision with `OutlineRenderer`

## 0.39.0

- fix alpha texture evaluation for uv coordinate out of range (0, 1)

- fix group morph not working on wasm runtime

## 0.38.0

- support Babylon.js 6.46.0

- add missing uv morph y axis inversion

## 0.37.2

- wasm runtime stabilization

## 0.37.1

- wasm buffered evaluate stabilization

- fix animation duration update when camera animation is changed

## 0.37.0

- improve mmd model state reset method
    - now, mmd models morph and ik solver state are reset when animation is change and start playing

- morph target recompliation problem fixed
    - see https://github.com/BabylonJS/Babylon.js/issues/14008

- introduce WASM threaded runtime `MmdWasmInstanceTypeMD` / `MmdWasmInstanceTypeMR`

- fix issues with `PhysicsBody` sleeping. now, `PhysicsBody` is always active (which is the same as MMD)

## 0.36.6

- remove rust bound check in `MmdWasmRuntime` for better performance

- introduce `MmdWasmInstanceType` to specify WASM binary type. for now, debug and release are available

## 0.36.5

- add missing PMD toon texture remapping

## 0.36.4

- export missing new types

- fix wrong shared toon texture loading

- fix `BpmxConverter` does not serialize shared toon texture index

## 0.36.0

- introduce `MmdWasmRuntime` for WASM driven MMD animation runtime (experimental)

- **breaking change** `MmdRuntime` now requires `Scene` instance to be passed to constructor

## 0.35.0

- apply typed array on ik solver state for better performance
    - now, for toggling the ik solver, you need to use `MmdModel.ikSolverStates` instead of `MmdModel.sortedBones[i].ikSolver.enabled`

- typed array optimization on world matrix computation
    - recommended to use `MmdModel.finalTransformMatrices` or `MmdModel.runtimeBones[i].getWorldMatrixToRef()` instead of `MmdModel.mesh.skeleton.bones[i].getFinalMatrix()`

- optimize to split the SubMesh into individual meshes at load time.
    - Because of this, to receiveShadows, you now need to change `mmdMesh.receiveShadows = true;` to `for (const mesh of mmdMesh.metadata.meshes) mesh.receiveShadows = true;`

- fixed a bug where textures were not evaluated properly in texture alpha evaluation by `TextureAlphaChecker`

- improve `TextureAlphaChecker` performance by using `RenderTargetTexture`

- apply the changes made to the Animation in Babylon.js to the Bezier Animation
    - see https://github.com/BabylonJS/Babylon.js/pull/14584

- add `MmdModelLoader.preserveSerializationData` option for serialize model in bpmx 2.0.0 format

- **breaking change** BPMX format updated to 2.0.0. Files of version 1.0.x are no longer compatible. Please re-convert PMX files

## 0.34.0

- remove dead code

- more strict bound check in `MmdRuntime` to prevent crash by invalid data

## 0.33.0

- fix `MmdCompositeAnimation` Quaternion animation biending not working with weight which is smaller than 1.0

- fix `IkSolver` wrong rotation computation

## 0.32.0

- introduce `MmdCompositeAnimation` to blend multiple animations frame perfectly

- fix `MmdPlayerControl` time formatting

- improve model loading shader compilation performance

## 0.31.3

- fix animation not playing at start on audio player with zero duration

- fix invalid body dispose null check

- fix `MmdModel.removeAnimation` missing pose reset

## 0.31.2

- fix wrong camera view matrix computation when distance is zero or positive value

## 0.31.1

- ignore collision with zero volume body

## 0.31.0

- fix signature validation
    - some PMX files have "PMXP" signature instead of "PMX " (with space)

- fix `PmxLoader` / `PmdLoader` load texture from file edge case

## 0.30.0

- fix `MmdStandardMaterial` not affected by light intensity

- fix application of linked transform nodes being applied one frame late in `HumanoidMmd`

## 0.29.0

- support old vmd format

- introduce `HumanoidMmd` to support MMD on generic humanoid model

## 0.28.0

- auto pose initialization in mmd runtime for play multiple animations in single model

- introduce `VpdLoader` to load VPD file

- introduce `PmdLoader` to load PMD file

- improve physics `PhysicsWithBone` behaviour

- make angular limit clamp adjustable
    - try increase `MmdPhysics.angularLimitClampThreshold` for fix odd bended constraints

- pmx converter now supports pmd file format

- fix pmx converter tail bone type mismatch (bpmx format updated to 1.1.0)
    - `tailPosition` is not currently in use at runtime, so there is no need to update existing bpmx files

- fix crash when loading model with no vertices

## 0.27.1

- improve performance of `MmdPlayerControl` by minimizing time display updates

- fix rigidbody bouncing glitch
    - There seems to be a problem with the algorithm by which babylon js bone updates the local matrix. Bypass it and perform the optimal operation

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
