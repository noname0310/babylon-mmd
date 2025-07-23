# Reference Overview

babylon-mmd is a library that allows you to load and render MMD (MikuMikuDance) models in Babylon.js, providing various features to use MMD models and animations within the Babylon.js.

Basically, babylon-mmd consists of two main components:

- **Loader**: Provides functionality to load MMD models and animations.
- **Runtime**: Provides functionality to play MMD animations.

Let's take a look at the architecture overview in the following order.

- Feature Overview

- Loader (PmxLoader, PmdLoader, VmdLoader)
  - SDEF Support
  - MmdStandardMaterial
  - Material Builder

- Runtime
  - MmdRuntime
  - MmdWasmRuntime
  - Use Mmd Model Without Runtime
  - Animation
    - MmdAnimation
    - Use Babylon.js Animation Runtime
  - Apply vmd animation on non-MMD model
