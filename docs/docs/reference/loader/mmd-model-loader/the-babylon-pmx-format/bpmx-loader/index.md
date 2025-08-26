---
sidebar_position: 2
sidebar_label: BPMX Loader
---

# BPMX Loader

This section explains how to load **Babylon PMX (BPMX)** files, a variation of **PMX** files.

The **BPMX** format is a format for storing **MMD** models, and unlike **PMX/PMD**, it is a single binary format.

To load **BPMX** files, we use the **`BpmxLoader`**. This loader works in almost the same way as **`PmxLoader`** and **`PmdLoader`**.

## Registering with SceneLoader

First, we need to register the **`BpmxLoader`** with the **Babylon.js SceneLoader**. This is done by importing it for its side effect.

```typescript
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader";
```

This import statement implicitly performs the following side effect:

```typescript
RegisterSceneLoaderPlugin(new BpmxLoader());
```

## Loading BPMX Files

**BPMX** files can be loaded using the **Babylon.js SceneLoader API**, just like **PMX/PMD** files.

Below is an example of loading a **BPMX** file using **`LoadAssetContainerAsync`**, one of the SceneLoader API methods.

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync("path/to/mmdModel.bpmx", scene);
assetContainer.addAllToScene(); 
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

You can also use **`ImportMeshAsync`** and **`AppendSceneAsync`** to load **BPMX** files.

:::info
Since **BPMX** files store all assets, including textures, in a single file, there are no **Texture Resolution** related issues, and all assets can be loaded with a single network request.
:::

## Use Browser File API

You can also load files using the browser's **File API**.

Below is an example of selecting and loading a **BPMX** file using the [showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) API.

```typescript
const [fileHandle] = await window.showOpenFilePicker({
    types: [{
        description: "BPMX File",
        accept: {
            "application/octet-stream": [".bpmx"],
        },
    }],
    excludeAcceptAllOption: true,
    multiple: false,
});
const file = await fileHandle.getFile();

const assetContainer: AssetContainer = await LoadAssetContainerAsync(file, scene);
assetContainer.addAllToScene(); 
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

:::warning
The showOpenFilePicker browser API is not supported in Firefox and Safari.
:::

## Loader Options

Unlike the **PMX/PMD** loaders, the **BPMX** loader does not support some optimization-related options. This is because **BPMX** files are already optimized during the conversion process.

Below is an example of setting all options supported by the **BPMX** loader using **`pluginOptions`**.

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync(
    modelFileOrUrl,
    scene,
    {
        pluginOptions: {
            mmdmodel: {
                materialBuilder: null,
                useSdef: true,
                buildSkeleton: true,
                buildMorph: true,
                boundingBoxMargin: 10,
                alwaysSetSubMeshesBoundingInfo: true,
                preserveSerializationData: false,
                loggingEnabled: false,

                useSingleMeshForSingleGeometryModel: true
            }
        }
    }
);
```

Except for **`useSingleMeshForSingleGeometryModel`**, the other options are the same as for the **PMX/PMD** loaders. For a description of each option, please refer to the [PMX/PMD Loader Options](../../#loader-options) document.

### useSingleMeshForSingleGeometryModel

The **`BpmxLoader`** creates an empty **Root mesh** to load a model with N geometries and creates N meshes with geometries under it. Therefore, the structure of a 3D model with 3 geometries is configured as follows.

```
RootMesh {
    children: [
        Mesh1
        Mesh2
        Mesh3
    ]
}
```

However, if the model has a single geometry, the **Root mesh** is unnecessary. Therefore, if **`useSingleMeshForSingleGeometryModel`** is `true`, a model with a single geometry will consist of only one mesh without a **Root mesh**, and the hierarchy will be configured as follows.

```
Mesh1
```

If **`useSingleMeshForSingleGeometryModel`** is `false`, a model with a single geometry will still have a **rootMesh**, and the hierarchy will be configured as follows.

```
RootMesh {
    children: [
        Mesh1
    ]
}
```

The default value of **`useSingleMeshForSingleGeometryModel`** is `true`.
