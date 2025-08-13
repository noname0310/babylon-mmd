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

Above, we learned how to **load MMD models using the model's URL**.
However, the **URL-based loading method has issues**, and these can be resolved by using the **browser's File API**.

You can also use the **File API to load files received from users**.

### Issues with URL-based Loading

When using URLs, the loader **fetches the PMX/PMD file** and then **fetches the texture files** required by the 3D model again.

The **PMX/PMD format includes texture file paths as relative paths** based on the file's location.

For example, in this file structure:

```
file1
├── model.pmx
├── texture1.png
├── texture2.png
└── file2
    ├── texture3.png
    └── texture4.png
```

Texture file paths are typically stored in PMX/PMD files as strings like this:

```
texture1.png
texture2.png
file2/texture3.png
file2/texture4.png
```

However, since the **Windows file system is case-insensitive** for files and folders, the following data is also valid:

```
Texture1.png
Texture2.png
File2/Texture3.png
File2/Texture4.png
```

Conversely, when **fetching in a browser environment, case sensitivity applies**, so if the case doesn't match exactly, textures cannot be found.

To solve this, we can use a **File API-based loading method** instead of fetch.

### Selecting a Folder Containing MMD Model Files

First, you need to implement a way to **select and read local files using the File API**.

Here, we need to read not only the **.pmx/.pmd files** but also the **texture files used by the model**.

Therefore, you need to allow users to **select a folder containing all resources** needed to load the MMD model.

For example, in this file structure:

```
file1
├── model.pmx
├── texture1.png
├── texture2.png
└── file2
    ├── texture3.png
    └── texture4.png
```

We need to allow users to **select the `file1` folder**.

Ideally, you can use the **[showDirectoryFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) API** to select folders, but this feature is **not supported in Firefox and Safari**.

Therefore, this document explains how to **select folders using HTML file input**.

First, create an HTML file input and enable directory selection using the **`directory` and `webkitdirectory`** attributes.

```html
<input type="file" id="folderInput" directory webkitdirectory />
```

Then, when the user selects a folder, you can **read all files in the folder**.

```typescript
const fileInput = document.getElementById("folderInput") as HTMLInputElement;
fileInput.onchange = (): void => {
    if (fileInput.files === null) return;
    const files = Array.from(fileInput.files);

    // Find the model file to load. (You can implement this as UI to let users choose from multiple PMX/PMD files.)
    let modelFile: File | null = null;
    for (const file of files) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".pmx") || name.endsWith(".pmd")) {
            modelFile = file;
            break;
        }
    }
    if (modelFile === null) {
        console.error("No PMX/PMD model file found.");
        return;
    }

    // Now we have files containing all files in the folder and modelFile as the target to load.
};
```

Alternatively, you can implement **drag & drop functionality** for folder selection. For this, refer to [babylon-mmd-viewer fileDropControlBuilder.ts](https://github.com/noname0310/babylon-mmd-viewer/blob/main/src/Viewer/fileDropControlBuilder.ts).

### Using File Instead of URL

Simply **replace the URL with a file** in the code that loaded using URLs above. Here, we also need to pass the **list of all files read from the folder** to load textures.

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync(
    modelFile,
    scene,
    {
        rootUrl: modelFile.webkitRelativePath.substring(0, modelFile.webkitRelativePath.lastIndexOf("/") + 1),
        pluginOptions: {
            mmdmodel: {
                referenceFiles: files // Pass all files that could potentially be textures.
            }
        }
    }
);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

When loading this way, the loader **uses `files.webkitRelativePath` to find textures**. It mimics the **Windows File System's path resolution method** to correctly find texture files.

The **rootUrl** is the path extracted from `modelFile.webkitRelativePath` up to the last `/`.
This path represents the **folder path where the MMD model is located**, and the loader calculates relative paths based on this path when finding texture files.

## URL Texture Path Resolution

When **serving MMD models from a server**, you must use URL fetch methods, so you cannot use the File API approach. In this case, you can use **two methods to solve texture loading issues**:

1. **Model Modification** - Use **[PMXEditor](https://www.deviantart.com/johnwithlenon/art/PmxEditor-v0273-English-Version-unofficial-trans-925125044)** to fix case errors in the model's texture paths.
2. **Convert to BPMX** - When converting PMX/PMD format to BPMX format, texture path issues are resolved during the conversion process. For details, see the **[The Babylon PMX Format](./the-babylon-pmx-format)** documentation.

## Loader Options

The **MMD model loader provides various options** to achieve the best results in multiple scenarios when loading MMD models.

These options are passed through **`pluginOptions`**.

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

                referenceFiles: [],
                optimizeSubmeshes: true,
                optimizeSingleMaterialModel: true
            }
        }
    }
);
```

Each option serves the following purposes:

### materialBuilder

Sets an **`IMmdMaterialBuilder`** instance that defines how to assign materials to MMD models.\
Default value is **`null`**. **When the default value is `null`, MMD models are loaded without materials.**

For details, see the **[Material Builder](./material-builder)** documentation.

### useSdef

Sets whether the model supports **SDEF (Spherical Deformation)**.\
Default value is **`true`**.

For details, see the **[SDEF Support](./sdef-support)** documentation.

### buildSkeleton

Sets whether to **load the skeleton**.\
Default value is **`true`**.

For example, when loading stages, you don't need to create skeletons, so you can set this to **`false`**. **`MmdMesh` without a Skeleton cannot be registered with the MMD runtime**.

### buildMorph

Sets whether to **load Morphs**.\
Default value is **`true`**.

For example, when loading stages, you don't need to create Morphs, so you can set this to **`false`**.

### boundingBoxMargin

Sets the **margin for the bounding box**.\
Default value is **`10`**.

**Babylon.js does not update bounding boxes when deformation occurs due to Skeleton**. Bounding boxes are only updated when explicitly using **[BoundingInfoHelper](https://forum.babylonjs.com/t/new-feature-boundinginfohelper/51469)**.

Therefore, when **animations are applied to MMD models**, the bounding box and mesh may not match, causing meshes within the **Camera Frustum to be culled**.
To prevent this, it's good to **set a margin for the bounding box**.

This value should be adjusted based on **how far MMD animations move the MMD model from the origin**.
If MMD animations move the MMD model farther from the origin, it's better to **set a larger value**.

For example, stages have no movement, so **setting `boundingBoxMargin` to 0 is fine**.

If the MMD model mesh's **`alwaysSelectAsActiveMesh` property is set to `true`**, **Frustum Culling is not applied** to that mesh. In this case, you also don't need to set the `boundingBoxMargin` value.

### alwaysSetSubMeshesBoundingInfo

Sets whether to **always set bounding information for sub-meshes**.\
Default value is **`true`**.

**When optimizeSubmeshes is false**

If **optimizeSubmeshes** is set to `false`, this option is ignored, and **all `SubMesh` BoundingInfo of the `Mesh` is always set to match the Mesh's BoundingInfo**.

This is to **set the material rendering order for MMD models**.

**MMD models must always be rendered in the same order** when rendering materials.
If sub-meshes are all divided into independent `Mesh`es, you can **set rendering order using `Mesh.alphaIndex`**.

However, when **multiple `SubMesh`es exist in one `Mesh`**, each `SubMesh`'s Draw order cannot be set through normal methods, and **Babylon.js sets rendering order by sorting based on each `SubMesh`'s `BoundingInfo`**.
To solve this, **all `SubMesh` BoundingInfo is set identically**. Since Babylon.js uses **stable sort when sorting rendering order**, rendering is performed in the order of `Mesh.subMeshes` in this case.

**When optimizeSubmeshes is true**

In this case, since **only one `SubMesh` exists per `Mesh`**, copying the `Mesh`'s BoundingInfo to the `SubMesh` may seem meaningless.
When **one `SubMesh` exists per `Mesh`**, Babylon.js doesn't store BoundingInfo in the `SubMesh` and returns the `Mesh`'s BoundingInfo when calling `SubMesh.getBoundingInfo()`.

However, when **`scene.clearCachedVertexData()` is performed** to remove VertexData already uploaded to GPU,
when calling `SubMesh.getBoundingInfo()`, the `SubMesh` **returns undefined instead of the `Mesh`'s BoundingInfo**.

The reason is that **`this.IsGlobal` returns `false` contrary to reality** in `SubMesh.getBoundingInfo()`. **This is a bug**.

```typescript
// https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Meshes/subMesh.ts#L230-L249
class SubMesh {
    // ...

    /**
     * Returns true if this submesh covers the entire parent mesh
     * @ignorenaming
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public get IsGlobal(): boolean {
        return this.verticesStart === 0 && this.verticesCount === this._mesh.getTotalVertices() && this.indexStart === 0 && this.indexCount === this._mesh.getTotalIndices();
    }

    /**
     * Returns the submesh BoundingInfo object
     * @returns current bounding info (or mesh's one if the submesh is global)
     */
    public getBoundingInfo(): BoundingInfo {
        if (this.IsGlobal || this._mesh.hasThinInstances) {
            return this._mesh.getBoundingInfo();
        }

        return this._boundingInfo;
    }

    // ...
}
```

Because of this, **sorting fails during the rendering process**, causing **Errors to be thrown during rendering**.

This problem is **solved by copying the `Mesh`'s `BoundingInfo` to the `SubMesh`**.

### preserveSerializationData

Sets whether to **preserve data for re-serialization**.\
Default value is **`false`**.

To **preserve data not used by babylon-mmd** in MMD models, you need to set `preserveSerializationData` to **`true`**.
In this case, you can preserve **additional information like Bone's tailPosition or Material's English name**.

If you **load PMX/PMD models and then convert to BPMX** using `BpmxConverter`, you should set this option to **`true`** to convert to BPMX without loss.

### loggingEnabled

Sets whether to **enable logging**.\
Default value is **`false`**.

It's good to **enable logging during development**. It helps diagnose issues when loading invalid PMX/PMD files.

If this value is **`false`**, the loader **outputs no warnings about issues** that occur during the loading process.

### referenceFiles

Sets the **list of reference files**.\
Default value is **`[]`**.

**Reference files are used to load textures** for MMD models.

### optimizeSubmeshes

Sets whether to **enable sub-mesh optimization**.\
Default value is **`true`**.

If this value is **`false`**, MMD models are loaded as **one `Mesh` with multiple `SubMesh`es**.

For example, if an MMD model has 3 materials, this model is loaded as **one `Mesh` with 3 `SubMesh`es**, and **`MultiMaterial` is used** to assign separate `Material`s to each `SubMesh`.

```typescript
// MMD model loaded with multiple SubMeshes based on materials
Mesh1 {
    subMeshes: [
        SubMesh1,
        SubMesh2,
        SubMesh3
    ],
    material: MultiMaterial {
        materials: [
            Material1,
            Material2,
            Material3
        ]
    }
}
```

If this value is **`true`**, MMD models are **divided into multiple `Mesh`es** based on the number of materials. **Each `Mesh` has only one `SubMesh`**.

```typescript
// MMD model divided into multiple Meshes based on materials
Mesh1 {
    children: [
        Mesh2 {
            subMeshes: [ SubMesh1 ],
            material: Material1
        },
        Mesh3 {
            subMeshes: [ SubMesh2 ],
            material: Material2
        },
        Mesh4 {
            subMeshes: [ SubMesh3 ],
            material: Material3
        }
    ]
}
```

In this case, **information loss may occur** during the process of dividing one geometry into multiple parts.

Depending on the situation, **setting this option to `false` may provide better performance**.

### optimizeSingleMaterialModel

Sets whether to **enable single material model optimization**.\
Default value is **`true`**.

When **optimizeSubmeshes is `true`**, even when MMD models use a single material, they are loaded as **one mesh under the root mesh**.
In this case, it's possible to **optimize to one `Mesh` instance** by including geometry in the root mesh, and this optimization is applied when **optimizeSingleMaterialModel is `true`**.

```typescript
// MMD model using one material loaded with optimizeSingleMaterialModel: false, optimizeSubmeshes: true
Mesh1 {
    children: [
        Mesh2 {
            subMeshes: [ SubMesh1 ],
            material: Material1
        }
    ]
}
```

```typescript
// MMD model using one material loaded with optimizeSingleMaterialModel: true, optimizeSubmeshes: true
Mesh1 {
    subMeshes: [ SubMesh1 ]
}
```

When **optimizeSubmeshes is `false`**, this option is **ignored**.

## Going Further

babylon-mmd provides **various loading options** to support multiple use cases and **several features to reproduce MMD behavior**.

- **BMP Texture Loading Issues** - For issues where **BMP textures are not loaded correctly**, see **[Fix BMP Texture Loader](./fix-bmp-texture-loader)**.
- **Model Deformation Issues** - For issues where **model deformation differs from MMD**, see **[SDEF Support](./sdef-support)**.
- **Material Builder** - For detailed information about **material builders**, see **[Material Builder](./material-builder)**.
- **MMD Standard Material** - For detailed information about **MMD Standard Material that reproduces MMD shaders**, see **[MMD Standard Material](./mmd-standard-material)**.
- **BPMX** - For detailed information about **PMX/PMD file conversion and optimization**, see **[The Babylon PMX Format](./the-babylon-pmx-format)**.
