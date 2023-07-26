# Create Basic Scene

First, you need a basic scene before you load the MMD.

In this tutorial, we will do basic scene setting using minimal code.

## Clone the `babylon-mmd-viwewer` repository

Project setups can vary widely depending on personal preferences. However, for starters, I recommend the **[babylon-mmd-viewer](https://github.com/noname0310/babylon-mmd-viewer.git)** repository as a template for using babylon-mmd

Clone the repository using git:

```bash
git clone https://github.com/noname0310/babylon-mmd-viewer.git
```

When you open a cloned repository in vscode, src requires these four sources(other files can be deleted):

![vscode explorer files](image.png)

Let's first run the project in watch mode.

```bash
npm i
npm start
```

It's okay if there's still an error Let's open [https://localhost:20310](https://localhost:20310) in the browser and write the code.

Start with the blank template.

```typescript title="src/sceneBuilder.ts"
import type { Engine } from "@babylonjs/core";
import { Scene, Vector3 } from "@babylonjs/core";

import type { ISceneBuilder } from "./baseRuntime";
import { MmdCamera } from "babylon-mmd";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        const scene = new Scene(engine);

        const camera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        
        return scene;
    }
}
```

add light, shadow, and ground.

```typescript title="src/sceneBuilder.ts"
const hemisphericLight = new HemisphericLight("HemisphericLight", new Vector3(0, 1, 0), scene);
hemisphericLight.intensity = 0.4;
hemisphericLight.specular.set(0, 0, 0);
hemisphericLight.groundColor.set(1, 1, 1);

const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
directionalLight.intensity = 0.8;
directionalLight.shadowMaxZ = 20;
directionalLight.shadowMinZ = -15;

const shadowGenerator = new ShadowGenerator(2048, directionalLight, true, camera);
shadowGenerator.bias = 0.01;

const ground = MeshBuilder.CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
ground.receiveShadows = true;
shadowGenerator.addShadowCaster(ground);
```

![now we have ground](image-1.png)


