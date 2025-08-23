---
sidebar_position: 1
sidebar_label: Build Your Own MMD Material Builder
---

# Build Your Own MMD Material Builder

This section explains how to implement your own **material builder**.

The MMD model loaders (**`PmxLoader`**, **`PmdLoader`**, **`BpmxLoader`**) delegate all responsibility for loading textures and materials to the **material builder** during the MMD model loading process.

Therefore, the **material builder** is responsible for the entire process, from **resource resolution** to **alpha evaluation** and **draw order** settings.

Implementing a material builder from scratch is not a simple task, as it requires consideration of all these aspects.

## Implementing with `MaterialBuilderBase`

The **`MaterialBuilderBase`** class provides common implementations needed when creating a material builder.

This class provides the following implementations:

- **Alpha Evaluation**
- **Draw Order** setting

This class requires the implementation of the following methods:

- **`_buildTextureNameMap`** - A method to build the texture name map.
- **`loadGeneralScalarProperties`** - A method to load diffuse, specular, ambient, and shininess properties.
- **`loadDiffuseTexture`** - A method to load the Diffuse texture.
- **`setAlphaBlendMode`** - A method to set the alpha blend mode of the Diffuse texture.
- **`loadSphereTexture`** - A method to load the Sphere Texture.
- **`loadToonTexture`** - A method to load the Toon Texture.
- **`loadOutlineRenderingProperties`** - A method to load edgeSize and edgeColor properties.

If there is no corresponding implementation for a feature in the material, you can leave the method body empty.

For example, **`PBRMaterialBuilder`** has empty method bodies for **`loadSphereTexture`**, **`loadToonTexture`**, and **`loadOutlineRenderingProperties`**.

We start by inheriting from **`MaterialBuilderBase`**, setting the generic parameter, and implementing the constructor:
```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public constructor() {
        super(MyMaterial);
    }
}
```

### Implementing `_buildTextureNameMap`

This is a method to build a mapping to store texture names without loss when serializing an MMD model.

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    protected override _buildTextureNameMap(
        materialsInfo: readonly MaterialInfo[],
        materials: MmdStandardMaterial[],
        imagePathTable: readonly string[],
        texturesInfo: readonly TextureInfo[],
        textureNameMap: Map<BaseTexture, string>
    ): void {
        for (let i = 0; i < materialsInfo.length; ++i) {
            const materialInfo = materialsInfo[i];
            const material = materials[i];

            const diffuseTexturePath = imagePathTable[texturesInfo[materialInfo.textureIndex]?.imagePathIndex];
            if (diffuseTexturePath !== undefined) {
                const diffuseTexture = material.diffuseTexture;
                if (diffuseTexture !== null) {
                    textureNameMap.set(diffuseTexture, diffuseTexturePath);
                }
            }

            const sphereTexturePath = imagePathTable[texturesInfo[materialInfo.sphereTextureIndex]?.imagePathIndex];
            if (sphereTexturePath !== undefined) {
                const sphereTexture = material.sphereTexture;
                if (sphereTexture !== null) {
                    textureNameMap.set(sphereTexture, sphereTexturePath);
                }
            }

            const toonTexturePath = imagePathTable[texturesInfo[materialInfo.toonTextureIndex]?.imagePathIndex];
            if (toonTexturePath !== undefined) {
                const toonTexture = material.toonTexture;
                if (toonTexture !== null) {
                    textureNameMap.set(toonTexture, toonTexturePath);
                }
            }
        }
    }
}
```

The **`textureNameMap`** is stored in **`MmdMesh.metadata.textureNameMap`** after loading.

### Implementing `loadGeneralScalarProperties`

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override loadGeneralScalarProperties(
        material: MyMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[]
    ): void {
        const diffuse = materialInfo.diffuse;
        material.diffuseColor = new Color3(
            diffuse[0],
            diffuse[1],
            diffuse[2]
        );

        const specular = materialInfo.specular;
        material.specularColor = new Color3(
            specular[0],
            specular[1],
            specular[2]
        );

        const ambient = materialInfo.ambient;
        material.ambientColor = new Color3(
            ambient[0],
            ambient[1],
            ambient[2]
        );

        const alpha = materialInfo.diffuse[3];
        material.alpha = alpha;
        if (alpha === 0) {
            for (let i = 0; i < meshes.length; ++i) {
                const mesh = meshes[i];
                if ((mesh as Mesh).isVisible !== undefined) {
                    (mesh as Mesh).isVisible = false;
                } else {
                    // TODO: handle visibility of submeshes individually
                }
            }
        }

        material.specularPower = materialInfo.shininess;
    }
}
```

Each material may or may not have properties corresponding to **`diffuseColor`**, **`specularColor`**, **`ambientColor`**, **`alpha`**, and **`specularPower`**. You only need to perform mapping for the properties that exist.

### BMP Loader Support

If you have applied babylon-mmd's custom BMP texture loader, the material builder also needs to be modified.

For this, we can add the following method to the material builder:

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    protected _getForcedExtension(texturePath: string): string | undefined {
        if (texturePath.substring(texturePath.length - 4).toLowerCase() === ".bmp") {
            if (_GetCompatibleTextureLoader(".dxbmp") !== null) {
                return ".dxbmp";
            }
        }
        return undefined;
    }
}
```

### Implementing `loadDiffuseTexture`

Perform **Texture Resolution** using **`imagePathTable`**, **`referenceFileResolver`**, **`_textureLoader`**, **`uniqueId`**, and **`rootUrl`**. It should be implemented to handle cases using the browser File API, URLs, or ArrayBuffers.

**`onTextureLoadComplete`** must be called regardless of whether the texture loading succeeds or fails. If this callback is not called, the material builder will wait indefinitely for the texture to load.

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override async loadDiffuseTexture(
        uniqueId: number,
        material: MyMaterial,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        textureInfo: Nullable<TextureInfo>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        referenceFileResolver: ReferenceFileResolver,
        logger: ILogger,
        onTextureLoadComplete?: () => void
    ): Promise<void> {
        material.backFaceCulling = (materialInfo.flag & PmxObject.Material.Flag.IsDoubleSided) ? false : true;

        const diffuseTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
        if (diffuseTexturePath !== undefined) {
            const diffuseTextureFileFullPath = referenceFileResolver.createFullPath(diffuseTexturePath);

            let texture: Nullable<Texture>;
            const file = referenceFileResolver.resolve(diffuseTextureFileFullPath);
            if (file !== undefined) {
                texture = await this._textureLoader.loadTextureFromBufferAsync(
                    uniqueId,
                    diffuseTextureFileFullPath,
                    file instanceof File ? file : file.data,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: Constants.TEXTUREFORMAT_RGBA,
                        mimeType: file instanceof File ? file.type : file.mimeType,
                        forcedExtension: this._getForcedExtension(diffuseTexturePath)
                    }
                );
            } else {
                texture = await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    diffuseTexturePath,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: Constants.TEXTUREFORMAT_RGBA,
                        forcedExtension: this._getForcedExtension(diffuseTexturePath)
                    }
                );
            }

            const diffuseTexture = texture;

            if (diffuseTexture !== null) {
                material.diffuseTexture = diffuseTexture;
            } else {
                logger.error(`Failed to load diffuse texture: ${diffuseTextureFileFullPath}`);
            }
            onTextureLoadComplete?.();
        } else {
            onTextureLoadComplete?.();
        }
    };
}
```

### Implementing `setAlphaBlendMode`

In this method, you perform **Alpha Evaluation** and apply the results to the material.

Here, different processing is required for each **`MmdMaterialRenderMethod`**.

Also, the BPMX format may already contain the Alpha Evaluation result, so you should check **`evaluatedTransparency`**.

To simplify the process a bit, the **`MaterialBuilderBase._evaluateDiffuseTextureTransparencyModeAsync`** method is provided.

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override async setAlphaBlendMode(
        material: MyMaterial,
        materialInfo: MaterialInfo,
        meshes: readonly ReferencedMesh[],
        logger: ILogger,
        getTextureAlphaChecker: () => Nullable<TextureAlphaChecker>
    ): Promise<void> {
        if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlending) {
            if (material.diffuseTexture) {
                material.diffuseTexture.hasAlpha = true;
                material.useAlphaFromDiffuseTexture = true;
            }
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;
            material.forceDepthWrite = true;

            return;
        }

        if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
            if (material.alpha < 1) {
                if (material.diffuseTexture) {
                    material.diffuseTexture.hasAlpha = true;
                    material.useAlphaFromDiffuseTexture = true;
                }
                material.transparencyMode = Material.MATERIAL_ALPHABLEND;
                material.forceDepthWrite = true;

                return;
            }
        }

        const diffuseTexture = material.diffuseTexture;
        const evaluatedTransparency = (materialInfo as Partial<BpmxObject.Material>).evaluatedTransparency ?? -1;
        if (diffuseTexture !== null) {
            const transparencyMode = await this._evaluateDiffuseTextureTransparencyModeAsync(
                diffuseTexture,
                evaluatedTransparency,
                meshes,
                logger,
                getTextureAlphaChecker
            );
            if (transparencyMode !== null) {
                const hasAlpha = transparencyMode !== Material.MATERIAL_OPAQUE;

                if (hasAlpha) diffuseTexture.hasAlpha = true;
                material.useAlphaFromDiffuseTexture = hasAlpha;
                material.transparencyMode = transparencyMode;
                if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
                    material.forceDepthWrite = hasAlpha;
                }
            }
        } else {
            if (this.renderMethod === MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation) {
                let etIsNotOpaque = (evaluatedTransparency >> 4) & 0x03;
                if ((etIsNotOpaque ^ 0x03) === 0) { // 11: not evaluated
                    etIsNotOpaque = 0; // fallback to opaque
                }

                material.transparencyMode = etIsNotOpaque === 0 ? Material.MATERIAL_OPAQUE : Material.MATERIAL_ALPHABLEND;
            } else /* if (this.renderMethod === MmdStandardMaterialRenderMethod.AlphaEvaluation) */ {
                let etAlphaEvaluateResult = evaluatedTransparency & 0x0F;
                if ((etAlphaEvaluateResult ^ 0x0F) === 0) { // 1111: not evaluated
                    etAlphaEvaluateResult = 0; // fallback to opaque
                }

                material.transparencyMode = Material.MATERIAL_OPAQUE;
            }
        }
    }
}
```

### Implementing `loadSphereTexture`

This method loads the **Sphere texture**. The Texture Resolution method is similar to **`loadDiffuseTexture`**.

Additionally, the method of applying the Sphere texture to the material differs depending on **`materialInfo.sphereTextureMode`**.

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override async loadSphereTexture(
        uniqueId: number,
        material: MyMaterial,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        textureInfo: Nullable<TextureInfo>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        referenceFileResolver: ReferenceFileResolver,
        logger: ILogger,
        onTextureLoadComplete?: () => void
    ): Promise<void> {
        if (materialInfo.sphereTextureMode !== PmxObject.Material.SphereTextureMode.Off) {
            const sphereTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
            if (sphereTexturePath !== undefined) {
                const format = scene.getEngine().isWebGPU || materialInfo.sphereTextureMode === PmxObject.Material.SphereTextureMode.Multiply
                    ? Constants.TEXTUREFORMAT_RGBA
                    : Constants.TEXTUREFORMAT_RGB; // Maybe we should not use RGB format for performance reasons

                const sphereTextureFileFullPath = referenceFileResolver.createFullPath(sphereTexturePath);

                let sphereTexture: Nullable<Texture>;
                const file = referenceFileResolver.resolve(sphereTextureFileFullPath);
                if (file !== undefined) {
                    sphereTexture = (await this._textureLoader.loadTextureFromBufferAsync(
                        uniqueId,
                        sphereTextureFileFullPath,
                        file instanceof File ? file : file.data,
                        scene,
                        assetContainer,
                        {
                            ...textureInfo,
                            deleteBuffer: this.deleteTextureBufferAfterLoad,
                            format: format,
                            mimeType: file instanceof File ? file.type : file.mimeType,
                            forcedExtension: this._getForcedExtension(sphereTexturePath)
                        }
                    ));
                } else {
                    sphereTexture = (await this._textureLoader.loadTextureAsync(
                        uniqueId,
                        rootUrl,
                        sphereTexturePath,
                        scene,
                        assetContainer,
                        {
                            ...textureInfo,
                            deleteBuffer: this.deleteTextureBufferAfterLoad,
                            format: format,
                            forcedExtension: this._getForcedExtension(sphereTexturePath)
                        }
                    ));
                }

                if (sphereTexture !== null) {
                    material.sphereTexture = sphereTexture;
                    material.sphereTextureBlendMode = materialInfo.sphereTextureMode as number;
                } else {
                    logger.error(`Failed to load sphere texture: ${sphereTextureFileFullPath}`);
                }

                onTextureLoadComplete?.();
            } else {
                onTextureLoadComplete?.();
            }
        } else {
            onTextureLoadComplete?.();
        }
    }
}
```

### Implementing `loadToonTexture`

This method loads the **Toon texture**. The Texture Resolution method is similar to **`loadDiffuseTexture`**.

During the Texture Resolution process for Toon textures, if **`isSharedToonTexture`** is true, one of the 11 pre-provided shared textures will be used. In this case, instead of finding the texture path from **`imagePathTable`**, **`materialInfo.toonTextureIndex`** is passed to **`_textureLoader`** to specify which shared texture to use. This behavior mimics the implementation of MMD.

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override async loadToonTexture(
        uniqueId: number,
        material: MyMaterial,
        materialInfo: MaterialInfo,
        imagePathTable: readonly string[],
        textureInfo: Nullable<TextureInfo>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        referenceFileResolver: ReferenceFileResolver,
        logger: ILogger,
        onTextureLoadComplete?: () => void
    ): Promise<void> {
        let toonTexturePath;
        if (materialInfo.isSharedToonTexture) {
            toonTexturePath = materialInfo.toonTextureIndex;
        } else {
            toonTexturePath = imagePathTable[textureInfo?.imagePathIndex ?? -1];
        }
        if (toonTexturePath !== undefined) {
            const toonTextureFileFullPath = referenceFileResolver.createFullPath(toonTexturePath.toString());

            let toonTexture: Nullable<Texture>;
            const file = typeof toonTexturePath === "string" ? referenceFileResolver.resolve(toonTextureFileFullPath) : undefined;
            if (file !== undefined) {
                toonTexture = (await this._textureLoader.loadTextureFromBufferAsync(
                    uniqueId,
                    toonTextureFileFullPath,
                    file instanceof File ? file : file.data,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: scene.getEngine().isWebGPU ? Constants.TEXTUREFORMAT_RGBA : Constants.TEXTUREFORMAT_RGB,
                        mimeType: file instanceof File ? file.type : file.mimeType
                    }
                ));
            } else {
                toonTexture = (await this._textureLoader.loadTextureAsync(
                    uniqueId,
                    rootUrl,
                    toonTexturePath,
                    scene,
                    assetContainer,
                    {
                        ...textureInfo,
                        deleteBuffer: this.deleteTextureBufferAfterLoad,
                        format: scene.getEngine().isWebGPU ? Constants.TEXTUREFORMAT_RGBA : Constants.TEXTUREFORMAT_RGB
                    }
                ));
            }

            if (toonTexture !== null) {
                material.toonTexture = toonTexture;
            } else {
                logger.error(`Failed to load toon texture: ${toonTextureFileFullPath}`);
            }

            onTextureLoadComplete?.();
        } else {
            onTextureLoadComplete?.();
        }
    }
}
```

### Implementing `loadOutlineRenderingProperties`

The implementation for loading properties for outline rendering is as follows:

```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public override loadOutlineRenderingProperties(
        material: MyMaterial,
        materialInfo: MaterialInfo,
        logger: ILogger
    ): void {
        if (materialInfo.flag & PmxObject.Material.Flag.EnabledToonEdge) {
            if (Scene.prototype.getMmdOutlineRenderer === undefined) {
                logger.warn("MMD Outline Renderer is not available. Please import \"babylon-mmd/esm/Loader/mmdOutlineRenderer\".");
            }

            material.renderOutline = true;
            material.outlineWidth = materialInfo.edgeSize;
            const edgeColor = materialInfo.edgeColor;
            material.outlineColor = new Color3(
                edgeColor[0], edgeColor[1], edgeColor[2]
            );
            material.outlineAlpha = edgeColor[3];
        }
    }
}
```

## Finally

Please refer to [pbrMaterialBuilder.ts](https://github.com/noname0310/babylon-mmd/blob/main/src/Loader/pbrMaterialBuilder.ts). You can check the elements mentioned above there.
