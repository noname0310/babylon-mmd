---
sidebar_position: 1
sidebar_label: MMD Model Loader (PmxLoader, PmdLoader)
---

# MMD Model Loader (PmxLoader, PmdLoader)

This section describes the components used to **load MMD model files (PMX, PMD)**.

MMD models can be loaded using **`PmxLoader`** or **`PmdLoader`**.

## PmxLoader/PmdLoader

**`PmxLoader`** and **`PmdLoader`** are loaders used to load **PMX and PMD files** respectively.

## Registering Loaders with Babylon.js SceneLoader

These are integrated with the **Babylon.js SceneLoader API**.

So before using them, you must first **register `PmxLoader` or `PmdLoader` with the Babylon.js SceneLoader**.

This can be done by importing **"babylon-mmd/esm/Loader/pmxLoader"** or **"babylon-mmd/esm/Loader/pmdLoader"**.

```typescript
// Registers a `PmxLoader` instance to the global SceneLoader state for loading .pmx files.
import "babylon-mmd/esm/Loader/pmxLoader"; 

// Registers a `PmdLoader` instance to the global SceneLoader state for loading .pmd files.
import "babylon-mmd/esm/Loader/pmdLoader"; 
```

This implicitly executes the following code:

```typescript
RegisterSceneLoaderPlugin(new PmxLoader()); // When importing "babylon-mmd/esm/Loader/pmxLoader"
RegisterSceneLoaderPlugin(new PmdLoader()); // When importing "babylon-mmd/esm/Loader/pmdLoader"
```

:::info
If you are using the **UMD package**, these side effects are automatically applied when the script is loaded. Therefore, you don't need to import them separately.
:::

:::info
If you import symbols from the root like **`import "babylon-mmd";`**, all side effects are automatically applied. Therefore, you don't need to import them separately.

However, in this case **Tree Shaking is not applied**, so it's not recommended for production environments.
:::

## Loading MMD Models

The **Babylon.js SceneLoader API** provides several functions to add 3D assets to the Scene.

You can use any of these functions to **load MMD models**.

### ImportMeshAsync

The **`ImportMeshAsync`** function adds an MMD model to the Scene and returns the loaded elements in the form of **`ISceneLoaderAsyncResult`**.

We can obtain the **`MmdMesh`**, which is the root node of the MMD, from the return value.

```typescript
const result: ISceneLoaderAsyncResult = await ImportMeshAsync("path/to/mmdModel.pmx", scene);
const mmdMesh = result.meshes[0] as MmdMesh;
```

In the above example, we are casting **`result.meshes[0]`** to **`MmdMesh`**. This is always valid when loading MMD models.

When loading MMD models, the **first element** of the **`ISceneLoaderAsyncResult.meshes`** array is always the **root mesh** of the MMD model.

### AppendSceneAsync

The **`AppendSceneAsync`** function adds an MMD model to the Scene. However, since there's no return value, you need to use the Scene's **`meshes`** property to get the loaded elements.

Therefore, this method is **not commonly used**.

```typescript
await AppendSceneAsync("path/to/mmdModel.pmx", scene);
```

### LoadAssetContainerAsync

The **`LoadAssetContainerAsync`** function loads an MMD model and returns an **`AssetContainer`** containing all resources that make up the MMD model.
This **`AssetContainer`** includes loaded Mesh, Material, Texture, etc.

Like **`ImportMeshAsync`**, we can obtain the **root mesh** of the MMD model from the returned **`AssetContainer`**.

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync("path/to/mmdModel.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

In the above example, we are casting **`assetContainer.meshes[0]`** to **`MmdMesh`**. This is always valid when loading MMD models.

When loading MMD models, the **first element** of the **`AssetContainer.meshes`** array is always the **root mesh** of the MMD model.

The **`LoadAssetContainerAsync`** function adds everything to the Scene at once after the MMD model is fully loaded, while the **`ImportMeshAsync`** function asynchronously adds Mesh, Material, Texture, etc. to the Scene during the MMD model loading process. **It is recommended to use the `LoadAssetContainerAsync` function** to load MMD models to avoid potential issues caused by asynchronous processing.

## Use Browser File API



## Loader Options



## Going Further

babylon-mmd provides **various loading options** to support multiple use cases and **several features to reproduce MMD behavior**.
