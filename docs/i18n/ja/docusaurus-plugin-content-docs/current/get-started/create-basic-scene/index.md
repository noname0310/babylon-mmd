---
sidebar_position: 1
sidebar_label: 基本的なシーンの作成
---

# 基本的なシーンの作成

ここでは**基本的なシーン**を作成します。以下の要素を追加します:

- **カメラの作成**: シーンを見るためのビューポイントを提供します。
- **背景とアンビエントカラーの設定**: シーンの **ClearColor** と **AmbientColor** を設定します。
- **ライティングの追加**: モデルがはっきりと見えるようにシーンを照らします。
- **グラウンドの作成**: モデルが立つための床を作成します。

## カメラの作成

まず、**カメラを作成**しましょう。

レンダラーが正しく機能するためには、**activeCamera** として設定されたカメラが必要です。

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

**`babylon-mmd`** パッケージが提供する **`MmdCamera`** を使用します。

このカメラは、MMD ソフトウェアの**カメラの動作を再現**します。

## 背景とアンビエントカラーの設定

**背景色**と**アンビエントライティング**を設定します。背景色は **`ClearColor`** で、アンビエントライティングは **`AmbientColor`** で設定できます。

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

ここで、**`scene.ambientColor`** はすべてのマーテリアルの **`ambientColor`** プロパティに影響します。

**MMD モデル**の場合、シェーディングを適切に再現するために ambientColor に **0.5 のスケーリング**を適用する必要があるため、この **(0.5, 0.5, 0.5)** の値は**意図的**なものであり、任意ではありません。

## ライトの作成

**MMD のライティングモデル**は、**単一のディレクショナルライト**によって定義されます。

したがって、他のライティング設定では正しくレンダリングされない場合があります。たとえば、**ヘミスフェリックライト**を一緒に使用すると、MMD ソフトウェアとは**異なるシェーディング結果**が生成される可能性があります。

**`DirectionalLight`** を作成し、シャドウをレンダリングするために **`ShadowGenerator`** も作成します。

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

**`ShadowGenerator`** の設定は**任意の値**であり、**必要に応じて調整**できます。

## グラウンドの作成

**グラウンドプレーン**を作成します。これは**シーンを視覚的に理解するのに役立ちます**が、**必須ではありません**。

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

## 結果

シーンを実行すると、**エラーが発生しなくなり**、次のような**白い画面**が表示されるはずです:

![result](@site/docs/get-started/create-basic-scene/result.png)

<details>
<summary>完全なコード</summary>
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
