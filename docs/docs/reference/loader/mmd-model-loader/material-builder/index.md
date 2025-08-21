---
sidebar_position: 4
sidebar_label: Material Builder
---

# Material Builder

During the process of loading an MMD model, the tasks of **loading textures and assigning materials are entirely delegated to the Material Builder**.

You can set the `materialBuilder` for `PmxLoader` and `PmdLoader` through loader options.

We have separated the material loading process for the following reasons:

- Measurements have shown that, on average, the most time-consuming part of loading an MMD model is **initializing materials by loading textures**. However, depending on the use case, loading materials may not be necessary. Therefore, we need to allow users to **selectively load materials to reduce loading time**.

- Additionally, users should be able to **apply shading based on different materials instead of the MMD shading model at load time**. For example, a user might want to use a **Physically Based Rendering (PBR) material** for a more realistic look.

## Introduction of Material Builder

All MMD model loaders allow you to set a material builder via **`loaderOptions.mmdmodel.materialBuilder: Nullable<IMaterialBuilder>`**.

This option defaults to **`null`**, but if you import the babylon-mmd index, **`MmdStandardMaterialBuilder` is set as the default**.

:::info
In this context, importing the index means code like this:

```typescript
import { Something } from "babylon-mmd";
```

Conversely, you can also import the file where the symbol is defined directly:

```typescript
import { Something } from "babylon-mmd/esm/something";
```

For tree-shaking purposes, the default value of `loaderOptions.mmdmodel.materialBuilder` is set to `null`.
However, to make the library easier for beginners to use, it is designed so that **importing the index sets `MmdStandardMaterialBuilder` as the default**.
:::

You can set the material builder as follows:

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: new MmdStandardMaterialBuilder()
        }
    }
});
```

If you are loading multiple models with a single material, you can **share one material builder**.

In this case, the material builder **internally caches textures**, which can significantly reduce loading time, especially when loading the same model multiple times.

```typescript
const pbrMaterialBuilder = new PBRMaterialBuilder();

const assetContainer1: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl1, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: pbrMaterialBuilder
        }
    }
});

const assetContainer2: AssetContainer = await LoadAssetContainerAsync(modelFileOrUrl2, scene, {
    pluginOptions: {
        mmdmodel: {
            materialBuilder: pbrMaterialBuilder
        }
    }
});
```

## Kinds of Material Builders

You can create a material builder by implementing the **`IMmdMaterialBuilder`** interface, and the material builders provided by babylon-mmd also implement this interface.

babylon-mmd provides three material builders:

- **`MmdStandardMaterialBuilder`** - A material builder that uses **`MmdStandardMaterial`** to reproduce MMD's behavior.
- **`StandardMaterialBuilder`** - A material builder that uses Babylon.js's **`StandardMaterial`**.
- **`PBRMaterialBuilder`** - A material builder that uses Babylon.js's **`PBRMaterial`**.

### MmdStandardMaterialBuilder

**`MmdStandardMaterialBuilder`** is a material builder that loads MMD materials using **`MmdStandardMaterial`**.

This material builder **loads all MMD material properties supported by babylon-mmd**, with methods provided for each category.

If you want to change the loading behavior, you can **override the corresponding methods**, except for `_setMeshesAlphaIndex`.

**Properties set by `MmdStandardMaterialBuilder._setMeshesAlphaIndex`:**

- **`AbstractMesh.alphaIndex`** - Sets the material's alpha index according to the material order (see Render Method below).

**Properties set by `MmdStandardMaterialBuilder.loadGeneralScalarProperties`:**

- **`StandardMaterial.diffuseColor`** - MMD Material "diffuse" (rgb)
- **`StandardMaterial.specularColor`** - MMD Material "specular" (rgb)
- **`StandardMaterial.ambientColor`** - MMD Material "ambient" (rgb)
- **`Material.alpha`** - MMD Material "diffuse" (a)
- **`AbstractMesh.isVisible`** - Set to false if "diffuse" (a) is 0
- **`StandardMaterial.specularPower`** - MMD Material "reflect"

**Properties set by `MmdStandardMaterialBuilder.loadDiffuseTexture`:**

- **`Material.backFaceCulling`** - MMD Material "is double sided"
- **`StandardMaterial.diffuseTexture`** - MMD Material "texture"

**Properties set by `MmdStandardMaterialBuilder.setAlphaBlendMode`:**

- **`StandardMaterial.diffuseTexture.hasAlpha`** - Set to true if MMD Material "texture" has an alpha channel (see Alpha Evaluation below)
- **`StandardMaterial.useAlphaFromDiffuseTexture`** - Set to true if MMD Material "texture" has an alpha channel
- **`Material.transparencyMode`** - Determined by Render Method (see Render Method below)
- **`Material.forceDepthWrite`** - Determined by Render Method (see Render Method below)

**Properties set by `MmdStandardMaterialBuilder.loadSphereTexture`:**

- **`MmdStandardMaterial.sphereTexture`** - MMD Material "sphere texture"
- **`MmdStandardMaterial.sphereTextureBlendMode`** - MMD Material "sphere texture mode"

**Properties set by `MmdStandardMaterialBuilder.loadToonTexture`:**

- **`MmdStandardMaterial.toonTexture`** - MMD Material "toon texture"

**Properties set by `MmdStandardMaterialBuilder.loadOutlineRenderingProperties`:**

- **`MmdStandardMaterial.renderOutline`** - Set to true to enable outline rendering
- **`MmdStandardMaterial.outlineWidth`** - MMD Material "edge size"
- **`MmdStandardMaterial.outlineColor`** - MMD Material "edge color" (rgb)
- **`MmdStandardMaterial.outlineAlpha`** - MMD Material "edge color" (a)

### StandardMaterialBuilder

**`StandardMaterialBuilder`** is a material builder that loads MMD materials using **`StandardMaterial`**.

This material builder **loads only a subset of MMD material properties**, so data loss occurs during the loading process.

If you want to change the loading behavior, you can **override the corresponding methods**, except for `_setMeshesAlphaIndex`.

**Properties set by `StandardMaterialBuilder._setMeshesAlphaIndex`:**

- **`AbstractMesh.alphaIndex`** - Sets the material's alpha index according to the material order (see Render Method below).

**Properties set by `StandardMaterialBuilder.loadGeneralScalarProperties`:**

- **`StandardMaterial.diffuseColor`** - MMD Material "diffuse" (rgb)
- **`StandardMaterial.specularColor`** - MMD Material "specular" (rgb)
- **`StandardMaterial.ambientColor`** - MMD Material "ambient" (rgb)
- **`Material.alpha`** - MMD Material "diffuse" (a)
- **`AbstractMesh.isVisible`** - Set to false if "diffuse" (a) is 0
- **`StandardMaterial.specularPower`** - MMD Material "reflect"

**Properties set by `StandardMaterialBuilder.loadDiffuseTexture`:**

- **`Material.backFaceCulling`** - MMD Material "is double sided"
- **`StandardMaterial.diffuseTexture`** - MMD Material "texture"

**Properties set by `StandardMaterialBuilder.setAlphaBlendMode`:**

- **`StandardMaterial.diffuseTexture.hasAlpha`** - Set to true if MMD Material "texture" has an alpha channel (see Alpha Evaluation below)
- **`StandardMaterial.useAlphaFromDiffuseTexture`** - Set to true if MMD Material "texture" has an alpha channel
- **`Material.transparencyMode`** - Determined by Render Method (see Render Method below)
- **`Material.forceDepthWrite`** - Determined by Render Method (see Render Method below)

**The following three methods are empty and can be optionally implemented by overriding them:**

- `StandardMaterialBuilder.loadSphereTexture`
- `StandardMaterialBuilder.loadToonTexture`
- `StandardMaterialBuilder.loadOutlineRenderingProperties`

### PBRMaterialBuilder

**`PBRMaterialBuilder`** is a material builder that loads MMD materials using **`PBRMaterial`**.

This material builder **loads only a subset of MMD material properties**, so data loss occurs during the loading process.
Also, for properties that do not have a 1:1 mapping with MMD material parameters, **data distortion may occur** due to additional conversions.

If you want to change the loading behavior, you can **override the corresponding methods**, except for `_setMeshesAlphaIndex`.

**Properties set by `PBRMaterialBuilder._setMeshesAlphaIndex`:**

- **`AbstractMesh.alphaIndex`** - Sets the material's alpha index according to the material order (see Render Method below).

**Properties set by `PBRMaterialBuilder.loadGeneralScalarProperties`:**

- **`PBRMaterial.albedoColor`** - MMD Material "diffuse" (rgb)
- **`PBRMaterial.reflectionColor`** - MMD Material "specular" (rgb)
- **`PBRMaterial.ambientColor`** - MMD Material "ambient" (rgb)
- **`Material.alpha`** - MMD Material "diffuse" (a)
- **`AbstractMesh.isVisible`** - Set to false if "diffuse" (a) is 0
- **`PBRMaterial.roughness`** - MMD Material "reflect"

**Properties set by `PBRMaterialBuilder.loadDiffuseTexture`:**

- **`Material.backFaceCulling`** - MMD Material "is double sided"
- **`PBRMaterial.albedoTexture`** - MMD Material "texture"

**Properties set by `PBRMaterialBuilder.setAlphaBlendMode`:**

- **`PBRMaterial.albedoTexture.hasAlpha`** - Set to true if MMD Material "texture" has an alpha channel (see Alpha Evaluation below)
- **`PBRMaterial.useAlphaFromAlbedoTexture`** - Set to true if MMD Material "texture" has an alpha channel
- **`Material.transparencyMode`** - Determined by Render Method (see Render Method below)
- **`Material.forceDepthWrite`** - Determined by Render Method (see Render Method below)

**The following three methods are empty and can be optionally implemented by overriding them:**

- `PBRMaterialBuilder.loadSphereTexture`
- `PBRMaterialBuilder.loadToonTexture`
- `PBRMaterialBuilder.loadOutlineRenderingProperties`

## Render Method

MMD renders meshes using **Alpha Blending** with **Depth Write** and **Depth Test** enabled.
The Material Builder provides several options to implement this behavior while achieving optimized results.

If a Mesh is completely **Opaque**, rendering without Alpha Blending can produce the same result. babylon-mmd provides several options to automatically perform this for rendering optimization, controlled by the material builder's `renderMethod`.

### DepthWriteAlphaBlendingWithEvaluation

This rendering method renders **Opaque meshes without Alpha Blending** and uses Alpha Blending only when absolutely necessary.

In other words, when loading a model with this method, the material's `transparencyMode` can be either **`Material.MATERIAL_ALPHABLEND`** or **`Material.MATERIAL_ALPOAQUE`**, and `forceDepthWrite` is set to **`true`**.

This is the **default** method.

### DepthWriteAlphaBlending

This rendering method renders **all meshes using Alpha Blending**.

In other words, when loading a model with this method, the material's `transparencyMode` is always **`Material.MATERIAL_ALPHABLEND`**, and `forceDepthWrite` is set to **`true`**.

This method is **identical to MMD's rendering method**, so if you encounter any rendering issues, it is recommended to try this method.

### AlphaEvaluation

This rendering method determines whether to render a mesh using **Alpha Blending, Alpha Test, or Opaque** mode, and **does not perform Depth Write when using Alpha Blending**.

In other words, when loading a model with this method, the material's `transparencyMode` can be **`Material.MATERIAL_ALPHATEST`**, **`Material.MATERIAL_ALPHABLEND`**, or **`Material.MATERIAL_OPAQUE`**, and `forceDepthWrite` is set to **`false`**.

This method is the **most compatible with Babylon.js's rendering pipeline**, as using Alpha Blend with Depth Write is not a common practice.

## Alpha Evaluation

Among the rendering methods described above, **`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`** needs to determine if a mesh is Opaque. Also, **`MmdMaterialRenderMethod.AlphaEvaluation`** needs to evaluate the mesh's Alpha value to select the appropriate rendering method.

This process is called **Alpha Evaluation**.

### Process

1. Render the geometry in **UV Space** to a Render Target. At this time, only the **Alpha value** of each pixel is rendered by sampling the texture.
2. Read the pixel data of the Render Target using the **readPixels** function.
3. Evaluate the Alpha values from the read pixel data to select the appropriate rendering method.

- For **`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`**, if even one fragment of the textured geometry has an Alpha value other than `255`, the material's `transparencyMode` is set to **`Material.MATERIAL_ALPHABLEND`**.
- For **`MmdMaterialRenderMethod.AlphaEvaluation`**, the material's rendering method is determined by the material builder's **`alphaThreshold`** and **`alphaBlendThreshold`** values.

### Caveats

**Alpha Evaluation may not work correctly in some edge cases**. For example, if the mesh's UV topology is abnormal, Alpha Evaluation may produce incorrect results. In this case, increasing the material builder's **`alphaEvaluationResolution`** might solve the problem.

When performing Alpha Evaluation, **every material must be rendered to a Render Target once at load time**. This is a non-negligible cost. Therefore, you can disable Alpha Evaluation using the material builder's **`forceDisableAlphaEvaluation`** option.
In this case, Alpha Evaluation is not performed.

Also, the **BPMX format** stores the Alpha Evaluation results in the format, so you can use it and **skip the Alpha Evaluation process at load time**.

## Draw Order Configuration

MMD always renders meshes according to the order of materials.
However, Babylon.js, in contrast, sorts meshes based on their distance from the camera before rendering.

babylon-mmd provides separate solutions for two cases to reproduce the same Draw Order as MMD.
