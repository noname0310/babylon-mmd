# Changelog

## 1.0.0 (scheduled)

- rename `MmdXXXAnimationGroup` to `MmdXXXAnimationContainer`
  - rename `MmdCameraAnimationGroup` to `MmdCameraAnimationContainer`
  - rename `MmdModelAnimationGroup` to `MmdModelAnimationContainer`
  - rename `MmdRuntimeCameraAnimationGroup` to `MmdRuntimeCameraAnimationContainer`
  - rename `MmdRuntimeModelAnimationGroup` to `MmdRuntimeModelAnimationContainer`

- change `MmdModelLoader` default material builder to null for better tree shaking
  - you can pass `IMmdMaterialBuilder` implementation to mmdModel model loader options to build materials
  - or you can import `babylon-mmd/esm/Loader/mmdModelLoader.default.ts` to register default `MmdStandardMaterialBuilder` as shared material builder

- add multiple MMD camera support
  - you can add multiple `IMmdCamera` to `MmdRuntime`
  - `MmdRuntime.setCamera` is no longer available, instead use `MmdRuntime.addAnimatable` to add a new camera

- remove `NullMaterialProxy`

- change default value of `IMmdModelCreationOptions.materialProxyConstructor` to null
  - you must pass `MmdStandardMaterialProxy` or `StandardMaterialProxy` to `IMmdModelCreationOptions.materialProxyConstructor` to use material morphing features

- change camera animation binding api (applied to `MmdCamera` and `IMmdCamera`)
  - `MmdCamera.addAnimation`, `MmdCamera.removeAnimation`, `MmdCamera.setAnimation` are removed
  - use `MmdCamera.createRuntimeAnimation` to create a new animation and `MmdCamera.setRuntimeAnimation` to set the animation
  - `MmdCamera.createRuntimeAnimation` returns `MmdRuntimeAnimationHandle` which can be used to manage the animation
  - `MmdCamera.runtimeAnimations` is now a `ReadonlyMap<MmdRuntimeAnimationHandle, RuntimeModelAnimation>` instead of an array

- change model animation binding api (applied to `MmdModel` and `MmdWasmModel`)
  - `MmdModel.addAnimation`, `MmdModel.removeAnimation`, `MmdModel.setAnimation` are removed
  - use `MmdModel.createRuntimeAnimation` to create a new animation and `MmdModel.setRuntimeAnimation` to set the animation
  - `MmdModel.createRuntimeAnimation` returns `MmdRuntimeAnimationHandle` which can be used to manage the animation
  - `MmdModel.runtimeAnimations` is now a `ReadonlyMap<MmdRuntimeAnimationHandle, RuntimeModelAnimation>` instead of an array

- introduce `IMmdModelCreationOptions.trimMetadata` option to disable metadata trimming
  - this is useful when you want to re initialize the model with the same metadata

## 0.68.0 (2025-07-16)

- BPMX format updated to 3.0.0. 2.X files are no longer supported
  - use `"babylon-mmd/esm/Loader/Optimized/Legacy/bpmxLoader"` to load 2.X files
  - you can use [bpmx migration tool](https://noname0310.github.io/babylon-mmd/bpmx_migration_tool) to convert 2.X files to 3.0.0 format

- BVMD format updated to 3.0.0. 2.X files are no longer supported
  - use `"babylon-mmd/esm/Loader/Optimized/Legacy/bvmdLoader"` to load 2.X files
  - you can use [bvmd migration tool](https://noname0310.github.io/babylon-mmd/bvmd_migration_tool) to convert 2.X files to 3.0.0 format

## 0.67.2 (2025-07-10)

- fix `MmdOutlineRenderer` not working on babylon.js 8.16.0

## 0.67.1 (2025-07-09)

- fix crash when load model with orphan rigidbody

## 0.67.0 (2025-07-06)

- add `MultiMaterial` support
  - see new loader options `PmLoader.optimizeSubmeshes`, `PmLoader.optimizeSingleMaterialModel` and `BpmxLoader.useSingleMeshForSingleGeometryModel`

- introduce `StandardMaterialProxy` for support `StandardMaterial` in mmd runtime

- introduce `NullMaterialProxy` for support any material in mmd runtime

## 0.66.0 (2025-06-27)

- introduce `IMmdCamera` interface for allowing custom camera implementation in MMD runtime

- fix `MmdBulletPhysics` model transform not applied to physics body

- support MMD physics toggle specification

- BVMD format updated to 2.1.0. Files of version 2.0.0 is still compatible
  - physics toggle data is now stored in BVMD file

## 0.65.0 (2025-05-08)

- introduce `StandardMaterialBuilder`/`PBRMaterialBuilder` for build mmd model with `StandardMaterial`/`PBRMaterial` instead of `MmdStandardMaterial`

- rename `MmdStandardMaterialRenderMethod` to `MmdMaterialRenderMethod`

- align with Babylon.js 8.6.0 method name change, see [#16455](https://github.com/BabylonJS/Babylon.js/pull/16455)

- apply new naming convention

## 0.64.1 (2025-04-16)

- fix `MmdWasmPhysics` crash on debug build due to wrong drop order of physics resources

## 0.64.0 (2025-04-15)

- fix `MmdBulletPhysics` and `MmdWasmPhysics` constraint stability on `disableOffsetForConstraintFrame` mode by [Lunuy](https://github.com/Lunuy)

## 0.63.0 (2025-04-14)

- now support Bullet Physics Interface with `MmdRuntime.physics.getImpl()`
  - bullet physics can also be used standalone using `MultiPhysicsRuntime` or `PhysicsRuntime`

- improve MMD behavior reproduction for `MmdAmmoPhysics` and `MmdWasmPhysics` physics runtime
  - you can set `MmdModelPhysicsCreationOptions.disableOffsetForConstraintFrame` to `true` for reproduce MMD behavior

- introduce `MmdBulletPhysics` for use custom bullet physics build implementation on `MmdRuntime`

- enable handling of texture files that are not contained in hierarchies below the pmx file - by [neguse](https://github.com/neguse) ([#36](https://github.com/noname0310/babylon-mmd/pull/36))

## 0.62.0 (2025-02-25)

- fix `TextureAlphaChecker` not working on first few frames for waiting shader compilation
  - 0.58.0 fix is not working properly

## 0.61.0 (2025-02-23)

- align `MmdOutlineRenderer` with Babylon.js changes
  - support Babylon.js 7.48.3 alpha test method
  - support Babylon.js 7.50.0 `PrepareDefinesAndAttributesForMorphTargets` function change

## 0.60.2 (2025-01-20)

- fix Babylon.js npm peer dependency version

## 0.60.1 (2025-01-09)

- fix crash when using disposed `StreamAudioPlayer` in runtime

## 0.60.0 (2025-01-09)

- outline shader uv2 morph support. see Babylon.js [#15602](https://github.com/BabylonJS/Babylon.js/pull/15602)

- change clang optimization level from 'Ofast' to 'O3'.
  - improve the performance of the wasm runtime physics simulation by 2.5x to 3x

- improve morph target performance for Babylon.js 7.41.1 changes
  - see Babylon.js [#16014](https://github.com/BabylonJS/Babylon.js/pull/16014)

- minimum required version of Babylon.js is now 7.43.0

- fix `TextureAlphaChecker` not working after Babylon.js 7.43.0 changes

## 0.59.1 (2024-12-02)

- fix bmp texture creation error when texture dimension is not power of 2

## 0.59.0 (2024-12-02)

- fix alpha channel of bmp textures not loading due to different bmp texture loader behavior between DirectX9 and browser

## 0.58.0 (2024-11-29)

- fix `TextureAlphaChecker` not working on first few frames for waiting shader compilation

## 0.57.0 (2024-10-29)

- fixed crash caused by models without IK solver or morphtarget in WASM single-threaded runtime

- fix WGSL minification not applied to esm package

## 0.56.2 (2024-10-08)

- make motion load exception catchable

- add `AudioElementPool` for better html audio resource management

## 0.56.1 (2024-10-05)

- fix `MmdCamera` animation loading error

- fix `MmdCamera.onCurrentAnimationChangedObservable` not triggered when animation is removed

- fix `onCurrentAnimationChangedObservable` not triggered when animation is overwrited by `MmdModel.addAnimation`, `MmdWasmModel.addAnimation`, `MmdCamera.addAnimation`

## 0.56.0 (2024-10-03)

- change orphan body constraint creation behaviour in `MmdPhysics`, `MmdAmmoPhysics`, `MmdWasmPhysics`

- fix crash when remove animation from `MmdModel`, `MmdWasmModel`, `MmdCamera`

## 0.55.0 (2024-09-27)

- update rust dependencies (might affect wasm runtime)

- fix wasm runtime diagnostic logging not showing up

- fix orphan rigidbody creation behavior in `MmdPhysics`, `MmdAmmoPhysics`, `MmdWasmPhysics`

## 0.54.3 (2024-09-20)

- fix mmd wasm instance initialization on browser native module loading

## 0.54.2 (2024-09-18)

- add `MmdOutlineRenderer.zOffset`, `MmdOutlineRenderer.zOffsetUnits` for resolve outline z-fighting issue

## 0.54.1 (2024-09-18)

- fix wrong return value when unmute

- fix animation duration not updated when audio player is changed to null

## 0.54.0 (2024-09-16)

- dynamic loader import support for better chunk splitting and lazy loading see Babylon.js [Async/dynamic loader factories](https://github.com/BabylonJS/Babylon.js/pull/15499)

- handle empty animation data

- add `VmdLoader.optimizeEmptyTracks` option for disable empty track optimization

- umd output disable chunk splitting for prevent script loading error

## 0.53.0 (2024-08-26)

- `TextureAlphaChecker`, `MmdStandardMaterial`, `MmdOutlineRenderer` now supports WebGPU wgsl shader

- Support Babylon.js 7.20.1 SceneLoader Options see [SceneLoader Options](https://github.com/BabylonJS/Babylon.js/pull/15344)

- Support Babylon.js 7.21.0 WebGPU PluginMaterial API Changes

- fix `MmdOutlineRenderer` not work properly when using [WebGPU Non Compatibility Mode](https://doc.babylonjs.com/setup/support/webGPU/webGPUOptimization/webGPUNonCompatibilityMode)

- `MmdOutlineRenderer` now supports baked vertex animation

- handle zero scale matrix in WASM integrated physics runtime

## 0.52.0 (2024-08-02)

- fix BPMX converter does not serialize model with shared toon texture correctly

- cache key infomation is omitted from mmd texture name

## 0.51.0 (2024-07-16)

- fix BPMX sdef parameter serialization

- sdef r0 and r0 parameters are now preserved in geometry vertex data

## 0.50.0 (2024-07-15)

- mark `MmdModel.dispose` as internal
  
- add `MmdRuntime.initializeMmdModelPhysics` and `MmdRuntime.initializeAllMmdModelsPhysics` for manual physics initialization

- add `MmdRuntime.autoPhysicsInitialization` option to turn off automatic physics initialization which is enabled by default

## 0.49.0 (2024-06-27)

- prevents infinite loops when validating bones

- fix `BpmxConverter` serialize incorrect bone metadata when bone name is not unique

- support babylon.js serialization for following classes
  - `MmdStandardMaterial`
  - `MmdPluginMaterial`
  - `MmdCamera`

- support cloning for following classes
  - `SdefMesh`
  - `BezierAnimation`

## 0.48.0 (2024-06-21)

- implement wasm diagnostic logging

- fix wasm physics initialization when using buffered evaluation mode

- clamp `MmdStandardMaterial.alpha` value to 0.0 .. 1.0 for better result
  - you can disable this behavior by setting `MmdStandardMaterial.clampAlpha` to `false`

- handle zero vector limit axis

- introduce WASM integrated physics runtime `MmdWasmInstanceTypeMPD` / `MmdWasmInstanceTypeMPR` / `MmdWasmInstanceTypeSPD` / `MmdWasmInstanceTypeSPR` 

## 0.47.1 (2024-06-14)

- package.json update for npm publish

## 0.47.0 (2024-06-14)

- include wasm version of ammo.js in the package
  - you can find the wasm version of ammo.js in `babylon-mmd/esm/Runtime/Physics/External/ammo.wasm`
  - this distribution of ammo.js has been modified to work with bundlers like Webpack

- BPMX format updated to 2.2.0. Files of version 2.1.0 and 2.0.0 are still compatible
  - fix bpmx converter does not serialize bone flags correctly

- handle axis limit in mmd runtime for reproduce mmd twist bone behavior

## 0.46.0 (2024-06-08)

- improve CreateMmdModelOptions parameter type

- improve wasm runtime multi-threading stability

- fix wasm runtime physics memory leak

- fix an issue with body being disposed twice

## 0.45.2 (2024-06-06)

- use double precision on wasm runtime ik solver computation for jitter free result

## 0.45.1 (2024-06-02)

- fix wasm runtime ik solver computation

## 0.45.0 (2024-06-01)

- refactor runtime behavior to be more similar to MMD
  - sub group morph is now ignored when resolving morph target

  - completly rework the world matrix computation

- introduce `OiComputeTransformInjector` to update the transform matrix of an mmd model with an unsorted skeleton, without mmd runtime

## 0.44.0 (2024-05-20)

- handle zero volume rigidbody in `MmdAmmoPhysics`

## 0.43.0 (2024-05-16)

- fix pmd model sphere texture loading

- fix rigidbody bone index resolution when the bone index is out of range

## 0.42.4 (2024-05-11)

- fix `MmdAmmoPhysics` rigidbody collision mask not applied when the mask value is zero

- fix bpmx evaluated transparency not applied to the material when the material does not have a diffuse texture

## 0.42.3 (2024-05-11)

- fix multiply mode sphere texture with alpha not rendered correctly

## 0.42.2 (2024-05-11)

- fix `MmdAmmoPhysics` rigidbody initialization

- fix uv morph load error

## 0.42.1 (2024-05-11)

- fix physics body transform not applied to bone when models bone are not sorted by index

## 0.42.0 (2024-05-10)

- fix mmdOutline not rendered as alpha blended on opaque material

- havok physics improve spring constraint initialization

- introduce `MmdAmmoPhysics` for Ammo.js driven MMD physics simulation

## 0.41.2 (2024-05-06)

- mmdOutline now supports `MirrorTexture` for rendering outline on mirror reflection

## 0.41.1 (2024-05-06)

- fix SDEF shader injection on `ShaderMaterial`

- fix mmdOutline shader compilation error when use with clipping plane

## 0.41.0 (2024-05-06)

- replace animation when the same name animation is added to `MmdModel` or `MmdWasmModel`

- fix wrong alpha accumulation in `MmdStandardMaterial` when using sphere texture

- fix `BpmxLoader` alpha evaluation not working with asset which created from non-PMX model

- backface culling is no longer affected by a material's transparency (same as MMD's behavior)

- fix material morph color accumulation method as same as MMD

- mesh with 0 alpha value is now automatically hidden by `MmdRuntime`

- refactor `MmdOutlineRenderer` to have the same behavior as MMD's outline

- apply ambient color to diffuse color when using `MmdStandardMaterial` for make it same as MMD

- use RGB texture format instead of RGBA for sphere and toon texture

- introduce `MmdStandardMaterialShadingMethod` to specify shading method for `MmdStandardMaterial`

- now all mmd model loaders are share the static `MmdStandardMaterialBuilder` instance by default

- BPMX format updated to 2.1.0. Files of version 2.0.0 are still compatible
  - evaluatedTransparency is now store that weather the material is completely opaque or not
  - multi-material support added

- [pmx converter](https://noname0310.github.io/babylon-mmd/pmx_converter/) now converts pmx file into bpmx 2.1.0 format

## 0.40.0 (2024-04-20)

- fix shader compilation error when using WebGPU with non SDEF model

- give unique name to `MmdOutlineRenderer` to prevent name collision with `OutlineRenderer`

## 0.39.0 (2024-04-13)

- fix alpha texture evaluation for uv coordinate out of range (0, 1)

- fix group morph not working on wasm runtime

## 0.38.0 (2024-03-19)

- support Babylon.js 6.46.0

- add missing uv morph y axis inversion

## 0.37.2 (2024-03-02)

- wasm runtime stabilization

## 0.37.1 (2024-03-01)

- wasm buffered evaluate stabilization

- fix animation duration update when camera animation is changed

## 0.37.0 (2024-03-01)

- improve mmd model state reset method
  - now, mmd models morph and ik solver state are reset when animation is change and start playing

- morph target recompliation problem fixed
  - see https://github.com/BabylonJS/Babylon.js/issues/14008

- introduce WASM threaded runtime `MmdWasmInstanceTypeMD` / `MmdWasmInstanceTypeMR`

- fix issues with `PhysicsBody` sleeping. now, `PhysicsBody` is always active (which is the same as MMD)

## 0.36.6 (2024-01-16)

- remove rust bound check in `MmdWasmRuntime` for better performance

- introduce `MmdWasmInstanceType` to specify WASM binary type. for now, debug and release are available

## 0.36.5 (2024-01-14)

- add missing PMD toon texture remapping

## 0.36.4 (2024-01-14)

- export missing new types

- fix wrong shared toon texture loading

- fix `BpmxConverter` does not serialize shared toon texture index

## 0.36.0 (2024-01-12)

- introduce `MmdWasmRuntime` for WASM driven MMD animation runtime (experimental)

- **breaking change** `MmdRuntime` now requires `Scene` instance to be passed to constructor

## 0.35.0 (2023-12-29)

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

## 0.34.0 (2023-11-25)

- remove dead code

- more strict bound check in `MmdRuntime` to prevent crash by invalid data

## 0.33.0 (2023-11-20)

- fix `MmdCompositeAnimation` Quaternion animation biending not working with weight which is smaller than 1.0

- fix `IkSolver` wrong rotation computation

## 0.32.0 (2023-11-13)

- introduce `MmdCompositeAnimation` to blend multiple animations frame perfectly

- fix `MmdPlayerControl` time formatting

- improve model loading shader compilation performance

## 0.31.3 (2023-10-25)

- fix animation not playing at start on audio player with zero duration

- fix invalid body dispose null check

- fix `MmdModel.removeAnimation` missing pose reset

## 0.31.2 (2023-10-22)

- fix wrong camera view matrix computation when distance is zero or positive value

## 0.31.1 (2023-10-21)

- ignore collision with zero volume body

## 0.31.0 (2023-10-19)

- fix signature validation
  - some PMX files have "PMXP" signature instead of "PMX " (with space)

- fix `PmxLoader` / `PmdLoader` load texture from file edge case

## 0.30.0 (2023-10-11)

- fix `MmdStandardMaterial` not affected by light intensity

- fix application of linked transform nodes being applied one frame late in `HumanoidMmd`

## 0.29.0 (2023-10-04)

- support old vmd format

- introduce `HumanoidMmd` to support MMD on generic humanoid model

## 0.28.0 (2023-09-23)

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

## 0.27.1 (2023-09-17)

- improve performance of `MmdPlayerControl` by minimizing time display updates

- fix rigidbody bouncing glitch
  - There seems to be a problem with the algorithm by which babylon js bone updates the local matrix. Bypass it and perform the optimal operation

## 0.27.0 (2023-09-16)

- fix body offset computation in `PhysicsWithBone`

- clamp physics constraint angular limit for better result

- improve mmd runtime performance

- introduce `AnimationRetargeter` to retarget any humanoid animation to mmd model

## 0.26.0 (2023-09-16)

- fix append transform position computation

- support non-PMX model append transform rotation

- `MmdPlayerControl` fix time display initialization

- #8 support babylon.js animation runtime

- some GC optimizations in animation runtime

- improve physics damping parameter import

## 0.25.0 (2023-08-30)

- improve parse speed of PMX, BPMX and VMD

- big-endian device support

- introduce `MmdCameraAnimationGroup` and `MmdModelAnimationGroup` to use MMD animation runtime with babylon.js `Animation` container

## 0.24.0 (2023-08-16)

- #11 shows the mesh when all texture loads and shaders are compiled

- fix constraints axis calculation

- #5 improve physics parameter import

- now you need import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation" and "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation" side effect to use MMD animation runtime

- **breaking change** BVMD format updated to 2.0.0. Files of version 1.0.0 are no longer compatible. Please re-convert VMD files

- `BvmdLoader.loadFromBufferAsync` is removed because it ended in less than 1 ms

## 0.23.0 (2023-08-08)

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
