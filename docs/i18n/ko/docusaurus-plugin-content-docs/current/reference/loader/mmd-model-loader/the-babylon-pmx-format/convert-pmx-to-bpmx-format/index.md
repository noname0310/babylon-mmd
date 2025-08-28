---
sidebar_position: 1
sidebar_label: PMX에서 BPMX 형식으로 변환
---

# PMX에서 BPMX 형식으로 변환

이 섹션에서는 **PMX** 파일을 **BPMX** 파일로 변환하는 방법을 설명합니다.

**PMX** 파일을 **BPMX** 파일로 변환하기 위해 다음 두 가지 방법 중 하나를 사용할 수 있습니다:

- 웹 애플리케이션을 사용하여 변환할 수 있습니다.
- 프로그래밍 방식으로 변환할 수 있습니다.

각 방법은 장단점이 있으므로 필요에 따라 적절한 방법을 선택하시기 바랍니다.

## 변환기 애플리케이션 사용하기

**babylon-mmd**는 **PMX/PMD** 파일을 **BPMX** 파일로 변환하기 위한 웹 애플리케이션을 제공합니다.

아래 링크에서 애플리케이션을 사용할 수 있습니다.

[PMX to BPMX 변환기](https://noname0310.github.io/babylon-mmd/pmx_converter/)

![변환기 UI](@site/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format/bpmx-converter-ui.png)
***PMX to BPMX 변환기**의 스크린샷. 모델: [YYB Hatsune Miku_NT](https://bowlroll.net/file/284019)*

1. **PMX/PMD 파일이 포함된 폴더를 끌어다 놓으세요.**
    - MMD 모델을 로드하는 데 필요한 모든 텍스처 파일이 포함되어 있어야 합니다.

2. **파일 목록에서 변환할 PMX/PMD 파일을 선택하면 모델이 오른쪽 씬에 표시됩니다.**

3. **최적화 옵션을 설정하세요. 각 옵션은 변환하려는 모델의 특성에 따라 다르게 설정할 수 있습니다.**
    - ***시리얼라이제이션 데이터 보존***: **babylon-mmd**가 사용하지 않는 **PMX/PMD** 파일의 시리얼라이제이션 데이터를 보존합니다.
      - 여기에는 **텍스처 경로**, **머티리얼 영문 이름**, **디스플레이 프레임** 등이 포함됩니다.
      - 이는 내부적으로 `loaderOptions.mmdmodel.preserveSerializationData` 옵션에 의해 제어됩니다.
    - ***서브메시 최적화***: **서브메시**를 개별 **메시**로 분리할지 여부를 설정합니다.
      - 이는 내부적으로 `loaderOptions.mmdmodel.optimizeSubmeshes` 옵션에 의해 제어됩니다.
    - ***스켈레톤 빌드***: 모델의 **스켈레톤** 데이터를 저장할지 여부를 설정합니다.
      - 스테이지와 같이 스켈레톤이 필요하지 않은 모델의 경우 이 옵션을 끌 수 있습니다.
    - ***모프 타겟 빌드***: 모델의 **모프 타겟** 데이터를 저장할지 여부를 설정합니다.
      - 스테이지와 같이 모프 타겟이 필요하지 않은 모델의 경우 이 옵션을 끌 수 있습니다.

4. **머티리얼 렌더링 문제 해결.**
   - 이 단계는 선택 사항입니다. 모델이 올바르게 렌더링되면 이 단계를 건너뛸 수 있습니다.
   - 이를 위해 아래의 **머티리얼 렌더링 메서드 수정** 섹션을 참조하세요.

5. **변환을 수행하세요.**

:::info
이름에도 불구하고 **PMX to BPMX 변환기**는 **PMD** 파일도 지원합니다.
:::

![BPMX 다운로드](@site/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format/bpmx-converter-download.png)
***BPMX** 형식으로 다운로드된 변환된 파일.*

### 머티리얼 렌더링 메서드 수정

**BPMX** 파일은 머티리얼의 **알파 평가** 결과를 형식에 저장합니다.

구체적으로, **`MmdMaterialRenderMethod.AlphaEvaluation`** 또는 **`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`** 메서드에 필요한 **알파 평가** 결과를 각각 저장합니다.

이 결과는 나중에 모델을 로드할 때 사용되며, **알파 평가** 단계를 건너뛰어 모델 로딩 프로세스 속도를 향상시킵니다. 또한 알고리즘 결함으로 인해 잘못 렌더링되는 요소를 수동으로 수정하고 변환할 수 있습니다.

**Fix Material** 탭은 이러한 **알파 평가** 결과를 수정하기 위한 UI를 제공합니다.

![머티리얼 수정 UI](@site/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format/bpmx-converter-fixmaterial1.png)
***Fix Material**의 알파 모드 탭*

**알파 모드**는 **`MmdMaterialRenderMethod.AlphaEvaluation`** 렌더링 메서드로 모델이 어떻게 보이는지 보여줍니다. 여기서 이상하게 보이는 머티리얼의 렌더링 메서드를 수정할 수 있습니다.

YYB Hatsune Miku_NT 모델의 경우, B, B-L, sleeve05의 렌더링 메서드를 **알파 블렌드**로 변경하면 더 좋은 결과를 얻을 수 있습니다.

![머티리얼 수정 UI 2](@site/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format/bpmx-converter-fixmaterial2.png)
***Fix Material**의 강제 뎁스 라이트 모드 탭*

**강제 뎁스 라이트 모드**는 **`MmdMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation`** 렌더링 메서드로 모델이 어떻게 보이는지 보여줍니다. 여기서 이상하게 보이는 머티리얼의 렌더링 메서드를 수정할 수 있습니다.

YYB Hatsune Miku_NT 모델의 경우, sleeve05의 렌더링 메서드를 **알파 블렌드**로 변경하면 더 좋은 결과를 얻을 수 있습니다.

## 프로그래밍 방식 변환

**BPMX** 변환은 **`BpmxConverter`**에 의해 수행됩니다.

**`BpmxConverter`**는 **`MmdMesh`**를 입력으로 받아 **BPMX** 형식으로 변환합니다.

가장 간단한 사용 예시는 다음과 같습니다:

```typescript
const materialBuilder = new MmdStandardMaterialBuilder();
materialBuilder.deleteTextureBufferAfterLoad = false; // 1
const assetContainer = await LoadAssetContainerAsync(
    fileOrUrl,
    scene,
    {
        pluginOptions: {
            mmdmodel: {
                materialBuilder: materialBuilder,
                loggingEnabled: true
            }
        }
    }
);
const mmdMesh = assetContainer.meshes[0] as MmdMesh;

const bpmxConverter = new BpmxConverter();
bpmxConverter.loggingEnabled = true;
const arrayBuffer = bpmxConverter.convert(mmdMesh); // 2
assetContainer.dispose(); // 3
```

1. 기본적으로 머티리얼 빌더는 텍스처를 GPU에 업로드한 후 버퍼를 삭제하도록 설정되어 있습니다. 그러나 이는 텍스처를 시리얼라이즈하는 것을 불가능하게 만들기 때문에 먼저 머티리얼 빌더의 **`deleteTextureBufferAfterLoad`** 옵션을 `false`로 설정해야 합니다.

2. **`BpmxConverter.convert`**를 사용하여 변환을 수행합니다. 이 함수는 두 번째 매개변수로 옵션을 받을 수 있습니다.

3. **`assetContainer.dispose()`**를 호출하여 리소스를 해제합니다. **`assetContainer.addAllToScene()`**를 사용한 경우 모든 리소스(지오메트리, 머티리얼, 텍스처, 모프타겟매니저, 스켈레톤)를 수동으로 해제해야 합니다.

하지만 위의 예시에서는 **알파 평가** 결과가 **BPMX** 파일에 저장되지 않습니다. **알파 평가** 결과를 저장하려면 **`TextureAlphaChecker`**를 사용하여 수동으로 **알파 평가** 결과를 생성하고 이를 **`BpmxConverter`**에 전달해야 합니다.

다음은 이 모든 것을 수행하는 예시입니다:

```typescript
const settings = {
    preserveSerializationData: true,
    optimizeSubmeshes: true,
    buildSkeleton: true,
    buildMorph: true
};

const materialBuilder = new MmdStandardMaterialBuilder();
materialBuilder.deleteTextureBufferAfterLoad = false;
materialBuilder.renderMethod = MmdMaterialRenderMethod.AlphaEvaluation;
materialBuilder.forceDisableAlphaEvaluation = true;

const textureAlphaChecker = new TextureAlphaChecker(scene);

const assetContainer = await LoadAssetContainerAsync(
    fileOrUrl,
    scene,
    {
        pluginOptions: {
            mmdmodel: {
                materialBuilder: materialBuilder,
                preserveSerializationData: settings.preserveSerializationData,
                optimizeSubmeshes: settings.optimizeSubmeshes,
                loggingEnabled: true
            }
        }
    }
);
const mmdMesh = assetContainer.meshes[0] as MmdMesh;

const meshes = mmdMesh.metadata.meshes;
const materials = mmdMesh.metadata.materials;
const translucentMaterials: boolean[] = new Array(materials.length).fill(false);
const alphaEvaluateResults: number[] = new Array(materials.length).fill(-1);

for (let i = 0; i < materials.length; ++i) {
    const material = materials[i] as MmdStandardMaterial;

    // collect referenced meshes
    const referencedMeshes: ReferencedMesh[] = [];
    for (let meshIndex = 0; meshIndex < meshes.length; ++meshIndex) {
        const mesh = meshes[meshIndex];
        if ((mesh.material as MultiMaterial).subMaterials !== undefined) {
            const subMaterials = (mesh.material as MultiMaterial).subMaterials;
            for (let subMaterialIndex = 0; subMaterialIndex < subMaterials.length; ++subMaterialIndex) {
                const subMaterial = subMaterials[subMaterialIndex];
                if (subMaterial === material) {
                    referencedMeshes.push({
                        mesh,
                        subMeshIndex: subMaterialIndex
                    });
                }
            }
        } else {
            if (mesh.material === material) referencedMeshes.push(mesh);
        }
    }

    const diffuseTexture = material.diffuseTexture;

    // evaluate DepthWriteAlphaBlendingWithEvaluation renderMethod result manually
    if (material.alpha < 1) {
        translucentMaterials[i] = true;
    } else if (!diffuseTexture) {
        translucentMaterials[i] = false;
    } else {
        translucentMaterials[i] = true;
        for (let referencedMeshIndex = 0; referencedMeshIndex < referencedMeshes.length; ++referencedMeshIndex) {
            const referencedMesh = referencedMeshes[referencedMeshIndex];
            let isOpaque = false;
            if ((referencedMesh as { mesh: Mesh; subMeshIndex: number }).subMeshIndex !== undefined) {
                const { mesh, subMeshIndex } = referencedMesh as { mesh: Mesh; subMeshIndex: number };
                isOpaque = await textureAlphaChecker.hasFragmentsOnlyOpaqueOnGeometryAsync(diffuseTexture, mesh, subMeshIndex);
            } else {
                isOpaque = await textureAlphaChecker.hasFragmentsOnlyOpaqueOnGeometryAsync(diffuseTexture, referencedMesh as Mesh, null);
            }
            if (isOpaque) {
                translucentMaterials[i] = false;
                break;
            }
        }
    }

    // evaluate AlphaEvaluation renderMethod result manually
    if (diffuseTexture !== null) {
        let transparencyMode = Number.MIN_SAFE_INTEGER;
        for (let i = 0; i < referencedMeshes.length; ++i) {
            const referencedMesh = referencedMeshes[i];

            const newTransparencyMode = await textureAlphaChecker.hasTranslucentFragmentsOnGeometryAsync(
                diffuseTexture,
                (referencedMesh as { mesh: Mesh })?.mesh ?? referencedMesh as Mesh,
                (referencedMesh as { subMeshIndex: number })?.subMeshIndex !== undefined
                    ? (referencedMesh as { subMeshIndex: number }).subMeshIndex
                    : null,
                materialBuilder.alphaThreshold,
                materialBuilder.alphaBlendThreshold
            );

            if (transparencyMode < newTransparencyMode) {
                transparencyMode = newTransparencyMode;
            }
        }
        alphaEvaluateResults[i] = transparencyMode !== Number.MIN_SAFE_INTEGER
            ? transparencyMode
            : Material.MATERIAL_OPAQUE;
    } else {
        alphaEvaluateResults[i] = Material.MATERIAL_OPAQUE;
    }
}

const bpmxConverter = new BpmxConverter();
bpmxConverter.loggingEnabled = true;
const arrayBuffer = bpmxConverter.convert(mmdMesh, {
    buildSkeleton: settings.buildSkeleton,
    buildMorph: settings.buildMorph,
    translucentMaterials: translucentMaterials,
    alphaEvaluateResults: alphaEvaluateResults
});
assetContainer.dispose();
```

필요에 따라 이를 재사용할 수 있도록 함수를 만들 수 있습니다.

더 자세한 구현 세부사항은 **[PMX to BPMX 변환기 소스](https://github.com/noname0310/babylon-mmd/blob/main/src/Test/Scene/pmxConverterScene.ts)를 참조하세요**.

**`BpmxConverter`** API는 다양한 옵션을 지원하므로 모든 사양을 완전히 준수하는 코드를 작성하기가 매우 까다롭지만, 필요한 기능만 선택적으로 사용하여 유용한 결과를 얻을 수 있습니다.
