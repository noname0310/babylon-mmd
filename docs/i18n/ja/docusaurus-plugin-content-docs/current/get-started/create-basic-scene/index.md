---
sidebar_position: 1
sidebar_label: Create Basic Scene
---

# Create Basic Scene

Now let's create a **basic scene**. We will add the following elements:

- **Create Camera**: Provides a viewpoint to see the scene.
- **Set Background and Ambient Color**: Configure the scene's **ClearColor** and **AmbientColor**.
- **Add Lighting**: Illuminate the scene so models are clearly visible.
- **Create Ground**: Create a floor for models to stand on.

## Create Camera

First, let's **create a camera**.

The renderer needs a camera to be set as the **activeCamera** to function properly.

```typescript title="src/sceneBuilder.ts"
//...
// highlight-next-line
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        
        // highlight-next-line
        const mmdCamera = new MmdCamera("MmdCamera", new Vector3(0, 10, 0), scene);

        return scene;
    }
}
```

We use the **`MmdCamera`** provided by the **`babylon-mmd`** package.

This camera **reproduces the camera behavior** of MMD software.

## Set Background and Ambient Color

Set the **background color** and **ambient lighting**. The background color can be set with **`ClearColor`**, and ambient lighting with **`AmbientColor`**.

```typescript title="src/sceneBuilder.ts"
//...
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
//...
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
//...

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        // highlight-start
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        // highlight-end

        const mmdCamera = new MmdCamera("MmdCamera", new Vector3(0, 10, 0), scene);

        return scene;
    }
}
```

Here, **`scene.ambientColor`** affects the **`ambientColor`** property of all materials.

For **MMD models**, a **0.5 scaling** must be applied to ambientColor to properly reproduce shading, so this **(0.5, 0.5, 0.5)** value is **intentional**, not arbitrary.

## Create Light

**MMD's lighting model** is defined by a **single Directional Light**.

Therefore, other lighting setups may not render properly. For example, using **Hemispheric Light** together can produce **different shading results** than MMD software.

Create a **`DirectionalLight`** and also create a **`ShadowGenerator`** to render shadows.

```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
//...

import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
//...
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);

        const mmdCamera = new MmdCamera("MmdCamera", new Vector3(0, 10, 0), scene);

        // highlight-start
        const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 1.0;
        directionalLight.autoCalcShadowZBounds = true;

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;
        // highlight-end
        return scene;
    }
}
```

The **`ShadowGenerator`** settings are **arbitrary values** and can be **adjusted as needed**.

## Create Ground

Create a **ground plane**. This helps **visually understand the scene** and is **not required**.

```typescript title="src/sceneBuilder.ts"
//...
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
//...
export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        
        // ...

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        // highlight-start
        const ground = CreateGround("ground1", { width: 100, height: 100, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;
        // highlight-end
        return scene;
    }
}
```

## Result

Now when you run the scene, there will be **no more errors** and you should see a **white screen** like the following:

![result](@site/docs/get-started/create-basic-scene/result.png)

<details>
<summary>Full code</summary>
```typescript title="src/sceneBuilder.ts"
// highlight-next-line
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
// highlight-start
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
// highlight-end
import { Scene } from "@babylonjs/core/scene";
// highlight-next-line
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        // highlight-start
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);

        const mmdCamera = new MmdCamera("MmdCamera", new Vector3(0, 10, 0), scene);

        const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 1.0;
        directionalLight.autoCalcShadowZBounds = true;

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = CreateGround("ground1", { width: 100, height: 100, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;
        // highlight-end

        return scene;
    }
}
```
</details>
