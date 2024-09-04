# Load BPMX Model

Learn how to load models in BPMX format.

## Load BPMX Model as Skinned Mesh

BPMX specs may have more than 0 Bone or MorphTarget, so basically everything loaded by `BpmxLoader` is Skinned Mesh even if it has no Bone or MorphTarget. (The same applies to the `PmxLoader`.)

For load bpmx model, we need to import side effects.

```typescript title="src/sceneBuilder.ts"
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader";
```

Then, load the model using the `loadAssetContainerAsync`.

```typescript title="src/sceneBuilder.ts"
const materialBuilder = new MmdStandardMaterialBuilder();
materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

engine.displayLoadingUI();

const modelMesh = await loadAssetContainerAsync(
    "res/YYB Piano dress Miku.bpmx",
    scene,
    {
        onProgress: (event) => engine.loadingUIText = `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`,
        pluginOptions: {
            mmdmodel: {
                materialBuilder: materialBuilder,
                boundingBoxMargin: 60,
                loggingEnabled: true
            }
        }
    }
).then((result) => {
    result.addAllToScene();
    return result.meshes[0] as MmdMesh;
});

modelMesh;

scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());
```

- `materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };` - Override the method to disable outline rendering. (This is just a setting for the goal in this example.)

- `materialBuilder: materialBuilder` - In this case we instantiate and pass the `MmdStandardMaterialBuilder`, but you can also implement your own material builder and pass it.

- `boundingBoxMargin: 60` - Set the bounding box margin. (The default value is 10.)

- `loggingEnabled: true` - Enable logging for better debugging. (The default value is false.)

:::info
Basically, dance motion can cause curring problem because it moves mesh far from the bounding box.

And the motion that we're going to use in this next example is especially problematic, so we need to make the bounding box bigger.
:::

![result1](image.png)

:::info
`BJS - [19:42:52]: Failed to load sphere texture: file:res/YYB Piano dress Miku.bpmx_`

You'll see this error message. These errors are often displayed when the 3D model data itself is incorrect, and to resolve this, the asset must be modified by using a editor such as [Pmx Editor](https://www.deviantart.com/johnwithlenon/art/PmxEditor-v0273-English-Version-unofficial-trans-925125044).
:::

## Load BPMX Model as Static Mesh

For models such as Stage, it is usually static. Importing these models into a static mesh can save performance.

If you don't need to get the mesh object, you can use `appendSceneAsync` instead of `loadAssetContainerAsync` which is more simple.

```typescript title="src/sceneBuilder.ts"
await appendSceneAsync(
    "res/ガラス片ドームB.bpmx",
    scene,
    {
        onProgress: (event) => engine.loadingUIText = `Loading stage... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`,
        pluginOptions: {
            mmdmodel: {
                buildSkeleton: false,
                buildMorph: false,
                boundingBoxMargin: 0,
                loggingEnabled: true
            }
        }
    }
);
```

- `buildSkeleton: false` - Disable building skeleton.
 
- `buildMorph: false` - Disable building morph.

- `boundingBoxMargin: 0` - Set the bounding box margin to 0. (because static mesh doesn't move)

:::info
Naturally, mmd models loaded as static mesh cannot be controlled by MMD Runtime.
:::

![result2](image-1.png)

## Load multiple assets simultaneously

Now, we are awaiting the model and stage to load one by one, but we can load them simultaneously by using `Promise.all`.

```typescript title="src/sceneBuilder.ts"
engine.displayLoadingUI();

let loadingTexts: string[] = [];
const updateLoadingText = (updateIndex: number, text: string): void => {
    loadingTexts[updateIndex] = text;
    engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
};

const [modelMesh, ] = await Promise.all([
    loadAssetContainerAsync(
        "res/YYB Piano dress Miku.bpmx",
        scene,
        {
            onProgress: (event) => updateLoadingText(0, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`),
            pluginOptions: {
                mmdmodel: {
                    materialBuilder: materialBuilder,
                    boundingBoxMargin: 60,
                    loggingEnabled: true
                }
            }
        }
    ).then((result) => {
        result.addAllToScene();
        return result.meshes[0] as MmdMesh;
    }),
    appendSceneAsync(
        "res/ガラス片ドームB.bpmx",
        scene,
        {
            onProgress: (event) => updateLoadingText(1, `Loading stage... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`),
            pluginOptions: {
                mmdmodel: {
                    materialBuilder: materialBuilder,
                    buildSkeleton: false,
                    buildMorph: false,
                    boundingBoxMargin: 0,
                    loggingEnabled: true
                }
            }
        }
    )
]);

scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());
```

- Simply added `Promise.all` and the loading screen.

## Add Shadow to Model

```typescript title="src/sceneBuilder.ts"
for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
shadowGenerator.addShadowCaster(modelMesh);
```

Pretty easy, right?

![result3](image-2.png)
