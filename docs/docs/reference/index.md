---
sidebar_position: 1
sidebar_label: Reference
---

# Reference Overview

This section provides detailed explanations of the features offered by babylon-mmd.

The core functionality of babylon-mmd is to load PMX, PMD, VMD, and VPD files and seamlessly integrate MMD models into Babylon.js scenes.

babylon-mmd offers various options to accurately reproduce the behavior of MMD (MikuMikuDance) while ensuring compatibility with Babylon.js rendering pipelines.

You can selectively use features that match your specific use case and create optimal configurations for your Babylon.js scenes. This requires understanding both how MMD works and how babylon-mmd reproduces these mechanics, which this section covers in detail.

:::info

If you want to know the basic usage of loading MMD models and playing animations, please refer to the [Getting Started](/docs/get-started) section. This section provides guidance on the basic usage and setup of babylon-mmd.

:::

The reference documentation includes the following topics:

## **[Overview](/docs/reference/overview)**

This section explains the components that make up babylon-mmd and their relationships.

## **[Understanding MMD Behavior](/docs/reference/understanding-mmd-behaviour)**

These sections provide information needed to understand the asset structure and behavior of MMD. They also help build a basic understanding of how babylon-mmd reproduces MMD's behavior.

- **[Introduction to PMX and PMD](/docs/reference/understanding-mmd-behaviour/introduction-to-pmx-and-pmd)** - Provides information needed to understand the structure and behavior of PMX and PMD files.
- **[Introduction to VMD and VPD](/docs/reference/understanding-mmd-behaviour/introduction-to-vmd-and-vpd)** - Provides information needed to understand the structure and behavior of VMD and VPD files.

## **[Loader](/docs/reference/loader)**

These sections explain how to load MMD models and animation data.

- **[MMD Model Loader (PmxLoader, PmdLoader)](/docs/reference/loader/mmd-model-loader/pmxloader-pmdloader)** - Describes the components used to load MMD model files (PMX, PMD).
  - **[Fix BMP Texture Loader](/docs/reference/loader/mmd-model-loader/fix-bmp-texture-loader)** - Explains the component for correctly loading MMD models with BMP textures.
  - **[SDEF Support](/docs/reference/loader/mmd-model-loader/sdef-support)** - Explains the component for correctly loading MMD models with Spherical Deformation (SDEF).
  - **[MMD StandardMaterial](/docs/reference/loader/mmd-model-loader/mmd-standard-material)** - Describes the standard material used for MMD models.
  - **[Material Builder](/docs/reference/loader/mmd-model-loader/material-builder)** - Explains how to assign materials to MMD models and discusses how to reproduce MMD's rendering methods.
    - **[Build Your Own MMD Material Builder](/docs/reference/loader/mmd-model-loader/build-your-own-mmd-material-builder)** - Explains how to customize material assignment for MMD models.
  - **[The Babylon PMX format](/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format)** - Describes the BPMX file format, a variant of PMX files provided by babylon-mmd.
    - **[Convert PMX to BPMX format](/docs/reference/loader/mmd-model-loader/convert-pmx-to-bpmx-format)** - Explains how to convert PMX files to BPMX format.
    - **[BPMX Loader](/docs/reference/loader/mmd-model-loader/bpmx-loader)** - Explains how to load BPMX files.

- **[Mmd Animation Loader (VmdLoader, VpdLoader)](/docs/reference/loader/mmd-animation-loader)** - Describes the components used to load MMD animation files (VMD, VPD).
  - **[The Babylon VMD format](/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format)** - Describes the BVMD file format, a variant of VMD files provided by babylon-mmd.
    - **[Convert VMD to BVMD format](/docs/reference/loader/mmd-animation-loader/convert-vmd-to-bvmd-format)** - Explains how to convert VMD files to BVMD format.
    - **[BVMD Loader](/docs/reference/loader/mmd-animation-loader/bvmd-loader)** - Explains how to load BVMD files.

## **[Runtime](/docs/reference/runtime)**

These sections describe the runtime components needed to run MMD models and animations.

- **[MMD Camera](/docs/reference/runtime/mmd-camera)** - Explains how to set up and use an MMD camera.
- **[MMD Runtime](/docs/reference/runtime/mmd-runtime)** - Describes the runtime environment for running MMD models and animations.
- **[MMD WebAssembly Runtime](/docs/reference/runtime/mmd-webassembly-runtime)** - Explains how to run MMD animations using WebAssembly.
- **[Enable Material Morphing](/docs/reference/runtime/enable-material-morphing)** - Explains how to enable material morphing in MMD models.
- **[Apply Physics To MMD Models](/docs/reference/runtime/apply-physics-to-mmd-models)** - Explains how to set up physics for MMD models.
- **[Bullet Physics](/docs/reference/runtime/bullet-physics)** - Explains how to control the Bullet Physics world.
- **[Animation](/docs/reference/runtime/animation/mmd-animation)** - Explains how to set up and control animations for MMD models.
  - **[MMD Animation](/docs/reference/runtime/animation/mmd-animation)** - Explains how to set up and use MMD animations.
  - **[Use Babylon.js Animation Runtime](/docs/reference/runtime/animation/use-babylonjs-animation-runtime)** - Explains how to use the Babylon.js animation runtime.
  - **[MMD Player Control](/docs/reference/runtime/animation/mmd-player-control)** - Explains how to control MMD animations using a GUI similar to a video player.
  - **[Animation Blending](/docs/reference/runtime/animation/animation-blending)** - Explains how to blend multiple animations together.
- **[Audio Player](/docs/reference/runtime/audio-player)** - Explains how to set up an audio player synchronized with animations.
- **[Apply MMD Animation on Non-MMD Model](/docs/reference/runtime/apply-mmd-animation-on-non-mmd-model)** - Explains how to apply MMD animations to non-MMD models.
- **[Use MMD Model Without Runtime](/docs/reference/runtime/use-mmd-model-without-runtime)** - Explains how to use MMD models without a runtime.
