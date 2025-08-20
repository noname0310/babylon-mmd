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

### Alpha Evaluation

### Draw Order Configuration
