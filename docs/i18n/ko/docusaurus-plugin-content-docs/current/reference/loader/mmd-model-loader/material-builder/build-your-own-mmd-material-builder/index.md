---
sidebar_position: 1
sidebar_label: 자신만의 MMD 머티리얼 빌더 만들기
---

# 자신만의 MMD 머티리얼 빌더 만들기

이 섹션에서는 자신만의 **머티리얼 빌더**를 구현하는 방법을 설명합니다.

MMD 모델 로더(**`PmxLoader`**, **`PmdLoader`**, **`BpmxLoader`**)는 MMD 모델 로딩 과정에서 텍스처와 머티리얼을 로드하는 모든 책임을 **머티리얼 빌더**에게 위임합니다.

따라서 **머티리얼 빌더**는 **리소스 로딩**부터 **알파 평가** 및 **드로우 오더** 설정까지 전체 프로세스를 담당합니다.

머티리얼 빌더를 처음부터 구현하는 것은 이러한 모든 측면을 고려해야 하기 때문에 간단한 작업이 아닙니다.

## `MaterialBuilderBase`로 구현하기

**`MaterialBuilderBase`** 클래스는 머티리얼 빌더를 만들 때 필요한 공통 구현을 제공합니다.

이 클래스는 다음과 같은 구현을 제공합니다:

- **알파 평가**
- **드로우 오더** 설정

이 클래스는 다음 메서드의 구현이 필요합니다:

- **`_buildTextureNameMap`** - 텍스처 이름 맵을 만드는 메서드
- **`loadGeneralScalarProperties`** - 디퓨즈, 스페큘러, 앰비언트 및 광택 속성을 로드하는 메서드
- **`loadDiffuseTexture`** - 디퓨즈 텍스처를 로드하는 메서드
- **`setAlphaBlendMode`** - 디퓨즈 텍스처의 알파 블렌드 모드를 설정하는 메서드
- **`loadSphereTexture`** - 스피어 텍스처를 로드하는 메서드
- **`loadToonTexture`** - 툰 텍스처를 로드하는 메서드
- **`loadOutlineRenderingProperties`** - edgeSize 및 edgeColor 속성을 로드하는 메서드

머티리얼에 해당 기능에 대한 구현이 없는 경우 메서드 본문을 비워둘 수 있습니다.

예를 들어, **`PBRMaterialBuilder`**는 **`loadSphereTexture`**, **`loadToonTexture`**, **`loadOutlineRenderingProperties`**에 대해 비어있는 메서드 본문을 가지고 있습니다.

우리는 **`MaterialBuilderBase`**를 상속받고 제네릭 매개변수를 설정하고 생성자를 구현하는 것으로 시작합니다:
```typescript
class MyMaterialBuilder extends MaterialBuilderBase<MyMaterial> {
    public constructor() {
        super(MyMaterial);
    }
}
```

### `_buildTextureNameMap` 구현하기

이것은 MMD 모델을 직렬화할 때 손실 없이 텍스처 이름을 저장하기 위한 매핑을 구축하는 메서드입니다.

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

**`textureNameMap`**은 로딩 후 **`MmdMesh.metadata.textureNameMap`**에 저장됩니다.

### `loadGeneralScalarProperties` 구현하기

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

각 머티리얼은 **`diffuseColor`**, **`specularColor`**, **`ambientColor`**, **`alpha`**, **`specularPower`**에 해당하는 속성이 있을 수도 있고 없을 수도 있습니다. 존재하는 속성에 대해서만 매핑을 수행하면 됩니다.

### BMP 로더 지원

babylon-mmd의 커스텀 BMP 텍스처 로더를 적용한 경우, 머티리얼 빌더도 수정해야 합니다.

이를 위해 머티리얼 빌더에 다음 메서드를 추가할 수 있습니다:

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

### `loadDiffuseTexture` 구현하기

**`imagePathTable`**, **`referenceFileResolver`**, **`_textureLoader`**, **`uniqueId`**, **`rootUrl`**을 사용하여 **텍스처 로딩**을 수행합니다. 브라우저 파일 API, URL 또는 ArrayBuffer를 사용하는 경우를 처리하도록 구현해야 합니다.

텍스처 로딩이 성공하든 실패하든 상관없이 **`onTextureLoadComplete`**를 호출해야 합니다. 이 콜백이 호출되지 않으면 머티리얼 빌더는 텍스처가 로드될 때까지 무기한 대기합니다.

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

### `setAlphaBlendMode` 구현하기

이 메서드에서는 **알파 평가**를 수행하고 결과를 머티리얼에 적용합니다.

여기서는 각 **`MmdMaterialRenderMethod`**에 대해 다른 처리가 필요합니다.

또한 BPMX 형식에는 이미 알파 평가 결과가 포함되어 있을 수 있으므로 **`evaluatedTransparency`**를 확인해야 합니다.

프로세스를 조금 단순화하기 위해 **`MaterialBuilderBase._evaluateDiffuseTextureTransparencyModeAsync`** 메서드가 제공됩니다.

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

### `loadSphereTexture` 구현하기

이 메서드는 **스피어 텍스처**를 로드합니다. 텍스처 로딩 방법은 **`loadDiffuseTexture`**와 유사합니다.

또한, 스피어 텍스처를 머티리얼에 적용하는 방법은 **`materialInfo.sphereTextureMode`**에 따라 다릅니다.

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

### `loadToonTexture` 구현하기

이 메서드는 **툰 텍스처**를 로드합니다. 텍스처 로딩 방법은 **`loadDiffuseTexture`**와 유사합니다.

툰 텍스처의 텍스처 로딩 과정에서 **`isSharedToonTexture`**가 true인 경우, 11개의 미리 제공된 공유 텍스처 중 하나가 사용됩니다. 이 경우 **`imagePathTable`**에서 텍스처 경로를 찾는 대신 **`materialInfo.toonTextureIndex`**가 **`_textureLoader`**에 전달되어 어떤 공유 텍스처를 사용할지 지정합니다. 이 동작은 MMD의 구현을 모방합니다.

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

### `loadOutlineRenderingProperties` 구현하기

아웃라인 렌더링을 위한 속성을 로드하는 구현은 다음과 같습니다:

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

## 마지막으로

[pbrMaterialBuilder.ts](https://github.com/noname0310/babylon-mmd/blob/main/src/Loader/pbrMaterialBuilder.ts)를 참조하세요. 위에서 언급한 요소들을 확인할 수 있습니다.
