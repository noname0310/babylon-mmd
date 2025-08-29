---
sidebar_position: 1
sidebar_label: MMD 모델 로더 (PmxLoader, PmdLoader)
---

# MMD 모델 로더 (PmxLoader, PmdLoader)

이 섹션에서는 **MMD 모델 파일(PMX, PMD)을 로드**하는 데 사용되는 컴포넌트에 대해 설명합니다.

MMD 모델은 **`PmxLoader`** 또는 **`PmdLoader`** 를 사용하여 로드할 수 있습니다.

## PmxLoader/PmdLoader

**`PmxLoader`** 와 **`PmdLoader`** 는 각각 **PMX 및 PMD 파일**을 로드하는 데 사용되는 로더입니다.

## Babylon.js SceneLoader에 로더 등록하기

이들은 **Babylon.js SceneLoader API**와 통합되어 있습니다.

따라서 사용하기 전에 먼저 **`PmxLoader` 또는 `PmdLoader`를 Babylon.js SceneLoader에 등록**해야 합니다.

이는 **"babylon-mmd/esm/Loader/pmxLoader"** 또는 **"babylon-mmd/esm/Loader/pmdLoader"** 를 가져옴으로써 수행할 수 있습니다.

```typescript
// .pmx 파일을 로드하기 위해 글로벌 SceneLoader 상태에 `PmxLoader` 인스턴스를 등록합니다.
import "babylon-mmd/esm/Loader/pmxLoader"; 

// .pmd 파일을 로드하기 위해 글로벌 SceneLoader 상태에 `PmdLoader` 인스턴스를 등록합니다.
import "babylon-mmd/esm/Loader/pmdLoader"; 
```

이는 암시적으로 다음 코드를 실행합니다:

```typescript
RegisterSceneLoaderPlugin(new PmxLoader()); // "babylon-mmd/esm/Loader/pmxLoader"를 가져올 때
RegisterSceneLoaderPlugin(new PmdLoader()); // "babylon-mmd/esm/Loader/pmdLoader"를 가져올 때
```

:::info
**UMD 패키지**를 사용하는 경우, 스크립트가 로드될 때 이러한 사이드 이펙트가 자동으로 적용됩니다. 따라서 별도로 가져올 필요가 없습니다.
:::

:::info
**`import "babylon-mmd";`** 와 같이 루트에서 심볼을 가져오면 모든 사이드 이펙트가 자동으로 적용됩니다. 따라서 별도로 가져올 필요가 없습니다.

그러나 이 경우 **트리 셰이킹이 적용되지 않으므로** 프로덕션 환경에서는 권장하지 않습니다.
:::

## MMD 모델 로드하기

**Babylon.js SceneLoader API**는 씬에 3D 에셋을 추가하는 여러 함수를 제공합니다.

이러한 함수 중 어느 것이든 사용하여 **MMD 모델을 로드**할 수 있습니다.

### ImportMeshAsync

**`ImportMeshAsync`** 함수는 MMD 모델을 씬에 추가하고 로드된 요소를 **`ISceneLoaderAsyncResult`** 형태로 반환합니다.

반환값에서 MMD의 루트 노드인 **`MmdMesh`** 를 얻을 수 있습니다.

```typescript
const result: ISceneLoaderAsyncResult = await ImportMeshAsync("path/to/mmdModel.pmx", scene);
const mmdMesh = result.meshes[0] as MmdMesh;
```

위 예제에서는 **`result.meshes[0]`** 을 **`MmdMesh`** 로 캐스팅하고 있습니다. 이는 MMD 모델을 로드할 때 항상 유효합니다.

MMD 모델을 로드할 때, **`ISceneLoaderAsyncResult.meshes`** 배열의 **첫 번째 요소**는 항상 MMD 모델의 **루트 메시**입니다.

### AppendSceneAsync

**`AppendSceneAsync`** 함수는 MMD 모델을 씬에 추가합니다. 하지만 반환값이 없기 때문에 로드된 요소를 가져오려면 씬의 **`meshes`** 속성을 사용해야 합니다.

따라서 이 메서드는 **일반적으로 사용되지 않습니다**.

```typescript
await AppendSceneAsync("path/to/mmdModel.pmx", scene);
```

### LoadAssetContainerAsync

**`LoadAssetContainerAsync`** 함수는 MMD 모델을 로드하고 MMD 모델을 구성하는 모든 리소스가 포함된 **`AssetContainer`** 를 반환합니다.
이 **`AssetContainer`** 에는 로드된 메시, 머티리얼, 텍스처 등이 포함됩니다.

**`ImportMeshAsync`** 와 마찬가지로, 반환된 **`AssetContainer`** 에서 MMD 모델의 **루트 메시**를 얻을 수 있습니다.

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync("path/to/mmdModel.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

위 예제에서는 **`assetContainer.meshes[0]`** 을 **`MmdMesh`** 로 캐스팅하고 있습니다. 이는 MMD 모델을 로드할 때 항상 유효합니다.

MMD 모델을 로드할 때, **`AssetContainer.meshes`** 배열의 **첫 번째 요소**는 항상 MMD 모델의 **루트 메시**입니다.

**`LoadAssetContainerAsync`** 함수는 MMD 모델이 완전히 로드된 후 모든 것을 한 번에 씬에 추가하는 반면, **`ImportMeshAsync`** 함수는 MMD 모델 로딩 과정 중에 메시, 머티리얼, 텍스처 등을 비동기적으로 씬에 추가합니다. 비동기 처리로 인한 잠재적 문제를 방지하기 위해 **`LoadAssetContainerAsync` 함수를 사용하는 것이 권장**됩니다.

## 브라우저 파일 API 사용하기

위에서 우리는 **모델의 URL을 사용하여 MMD 모델을 로드**하는 방법을 배웠습니다.
그러나 **URL 기반 로딩 방식에는 문제**가 있으며, 이러한 문제는 **브라우저의 파일 API**를 사용하여 해결할 수 있습니다.

또한 **파일 API를 사용하여 사용자로부터 받은 파일**을 로드할 수도 있습니다.

### URL 기반 로딩의 문제점

URL을 사용할 때, 로더는 **PMX/PMD 파일을 가져온** 다음 3D 모델에 필요한 **텍스처 파일을 다시 가져옵니다**.

**PMX/PMD 형식은 파일 위치를 기준으로 상대 경로**로 텍스처 파일 경로를 포함합니다.

예를 들어, 이 파일 구조에서:

```
file1
├── model.pmx
├── texture1.png
├── texture2.png
└── file2
    ├── texture3.png
    └── texture4.png
```

텍스처 파일 경로는 일반적으로 PMX/PMD 파일에 다음과 같은 문자열로 저장됩니다:

```
texture1.png
texture2.png
file2/texture3.png
file2/texture4.png
```

그러나 **윈도우 파일 시스템은 파일과 폴더의 대소문자를 구분하지 않기** 때문에 다음 데이터도 유효합니다:

```
Texture1.png
Texture2.png
File2/Texture3.png
File2/Texture4.png
```

반대로, **브라우저 환경에서 가져올 때는 대소문자 구분이 적용**되므로, 대소문자가 정확히 일치하지 않으면 텍스처를 찾을 수 없습니다.

이를 해결하기 위해 가져오기 대신 **파일 API 기반 로딩 방식**을 사용할 수 있습니다.

### MMD 모델 파일이 포함된 폴더 선택하기

먼저, **파일 API를 사용하여 로컬 파일을 선택하고 읽는** 방법을 구현해야 합니다.

여기서는 **.pmx/.pmd 파일**뿐만 아니라 모델에서 사용하는 **텍스처 파일**도 읽어야 합니다.

따라서 사용자가 MMD 모델을 로드하는 데 필요한 **모든 리소스가 포함된 폴더를 선택**할 수 있게 해야 합니다.

예를 들어, 이 파일 구조에서:

```
file1
├── model.pmx
├── texture1.png
├── texture2.png
└── file2
    ├── texture3.png
    └── texture4.png
```

사용자가 **`file1` 폴더를 선택**할 수 있어야 합니다.

이상적으로는 폴더를 선택하기 위해 **[showDirectoryPicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) API**를 사용할 수 있지만, 이 기능은 **Firefox와 Safari에서 지원되지 않습니다**.

따라서 이 문서에서는 **HTML 파일 입력을 사용하여 폴더를 선택**하는 방법을 설명합니다.

먼저, HTML 파일 입력을 생성하고 **`directory`와 `webkitdirectory`** 속성을 사용하여 디렉토리 선택을 활성화합니다.

```html
<input type="file" id="folderInput" directory webkitdirectory />
```

그런 다음, 사용자가 폴더를 선택하면 **폴더 내의 모든 파일을 읽을 수 있습니다**.

```typescript
const fileInput = document.getElementById("folderInput") as HTMLInputElement;
fileInput.onchange = (): void => {
    if (fileInput.files === null) return;
    const files = Array.from(fileInput.files);

    // 로드할 모델 파일을 찾습니다. (여러 PMX/PMD 파일 중에서 선택할 수 있는 UI로 구현할 수도 있습니다.)
    let modelFile: File | null = null;
    for (const file of files) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".pmx") || name.endsWith(".pmd")) {
            modelFile = file;
            break;
        }
    }
    if (modelFile === null) {
        console.error("PMX/PMD 모델 파일을 찾을 수 없습니다.");
        return;
    }

    // 이제 폴더 내의 모든 파일을 포함하는 files와 로드할 대상인 modelFile을 갖게 되었습니다.
};
```

또는 폴더 선택을 위한 **드래그 앤 드롭 기능**을 구현할 수도 있습니다. 이에 대해서는 [babylon-mmd-viewer fileDropControlBuilder.ts](https://github.com/noname0310/babylon-mmd-viewer/blob/main/src/Viewer/fileDropControlBuilder.ts)를 참조하세요.

### URL 대신 파일 사용하기

위에서 URL을 사용하여 로드한 코드에서 **URL을 파일로 교체**하면 됩니다. 여기서는 텍스처를 로드하기 위해 **폴더에서 읽은 모든 파일 목록**도 전달해야 합니다.

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync(
    modelFile,
    scene,
    {
        rootUrl: modelFile.webkitRelativePath.substring(0, modelFile.webkitRelativePath.lastIndexOf("/") + 1),
        pluginOptions: {
            mmdmodel: {
                referenceFiles: files // 잠재적으로 텍스처가 될 수 있는 모든 파일을 전달합니다.
            }
        }
    }
);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

이렇게 로드할 때 로더는 **텍스처를 찾기 위해 `files.webkitRelativePath`를 사용**합니다. 이는 텍스처 파일을 올바르게 찾기 위해 **윈도우 파일 시스템의 경로 해결 방식을 모방**합니다.

**rootUrl**은 `modelFile.webkitRelativePath`에서 마지막 `/`까지 추출한 경로입니다.
이 경로는 **MMD 모델이 위치한 폴더 경로**를 나타내며, 로더는 텍스처 파일을 찾을 때 이 경로를 기준으로 상대 경로를 계산합니다.

## URL 텍스처 경로 해결

**서버에서 MMD 모델을 제공**할 때는 URL 가져오기 메서드를 사용해야 하므로 파일 API 접근 방식을 사용할 수 없습니다. 이 경우 텍스처 로딩 문제를 해결하기 위해 **두 가지 방법**을 사용할 수 있습니다:

1. **모델 수정** - **[PMXEditor](https://www.deviantart.com/johnwithlenon/art/PmxEditor-v0273-English-Version-unofficial-trans-925125044)** 를 사용하여 모델의 텍스처 경로의 대소문자 오류를 수정합니다.
2. **BPMX로 변환** - PMX/PMD 형식을 BPMX 형식으로 변환할 때 텍스처 경로 문제는 변환 과정에서 해결됩니다. 자세한 내용은 **[바빌론 PMX 포맷](./the-babylon-pmx-format)** 문서를 참조하세요.

## 로더 옵션

**MMD 모델 로더는 다양한 옵션**을 제공하여 MMD 모델을 로드할 때 여러 시나리오에서 최상의 결과를 얻을 수 있습니다.

이러한 옵션은 **`pluginOptions`**를 통해 전달됩니다.

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

각 옵션은 다음과 같은 목적으로 사용됩니다:

### materialBuilder

MMD 모델에 머티리얼을 할당하는 방법을 정의하는 **`IMmdMaterialBuilder`** 인스턴스를 설정합니다.\
기본값은 **`null`** 입니다. **기본값이 `null`인 경우 MMD 모델은 머티리얼 없이 로드됩니다.**

자세한 내용은 **[머티리얼 빌더](./material-builder)** 문서를 참조하세요.

### useSdef

모델이 **SDEF(구형 변형, Spherical Deformation)**를 지원하는지 여부를 설정합니다.\
기본값은 **`true`** 입니다.

자세한 내용은 **[SDEF 지원](./sdef-support)** 문서를 참조하세요.

### buildSkeleton

**스켈레톤을 로드**할지 여부를 설정합니다.\
기본값은 **`true`** 입니다.

예를 들어, 스테이지를 로드할 때는 스켈레톤을 생성할 필요가 없으므로 이 값을 **`false`**로 설정할 수 있습니다. **스켈레톤이 없는 `MmdMesh`는 MMD 런타임에 등록할 수 없습니다**.

### buildMorph

**모프(Morph)를 로드**할지 여부를 설정합니다.\
기본값은 **`true`** 입니다.

예를 들어, 스테이지를 로드할 때는 모프를 생성할 필요가 없으므로 이 값을 **`false`**로 설정할 수 있습니다.

### boundingBoxMargin

**바운딩 박스의 여백**을 설정합니다.\
기본값은 **`10`** 입니다.

**Babylon.js는 스켈레톤으로 인한 변형이 발생할 때 바운딩 박스를 업데이트하지 않습니다**. 바운딩 박스는 명시적으로 **[BoundingInfoHelper](https://forum.babylonjs.com/t/new-feature-boundinginfohelper/51469)** 를 사용할 때만 업데이트됩니다.

따라서 **MMD 모델에 애니메이션이 적용**될 때 바운딩 박스와 메시가 일치하지 않아 **카메라 프러스텀 내의 메시가 컬링**될 수 있습니다.
이를 방지하기 위해 **바운딩 박스에 여백을 설정**하는 것이 좋습니다.

이 값은 **MMD 애니메이션이 MMD 모델을 원점에서 얼마나 멀리 이동시키는지**에 따라 조정해야 합니다.
MMD 애니메이션이 MMD 모델을 원점에서 더 멀리 이동시킨다면, **더 큰 값을 설정**하는 것이 좋습니다.

예를 들어, 스테이지는 움직임이 없으므로 **`boundingBoxMargin`을 0으로 설정**해도 괜찮습니다.

MMD 모델 메시의 **`alwaysSelectAsActiveMesh` 속성이 `true`로 설정**되어 있으면, 해당 메시에는 **프러스텀 컬링이 적용되지 않습니다**. 이 경우에도 `boundingBoxMargin` 값을 설정할 필요가 없습니다.

### alwaysSetSubMeshesBoundingInfo

**항상 서브메시에 바운딩 정보를 설정**할지 여부를 설정합니다.\
기본값은 **`true`** 입니다.

**optimizeSubmeshes가 false인 경우**

**optimizeSubmeshes**가 `false`로 설정된 경우, 이 옵션은 무시되며 **모든 `SubMesh` BoundingInfo는 항상 메시의 BoundingInfo와 일치하도록 설정**됩니다.

이는 **MMD 모델의 머티리얼 렌더링 순서를 설정**하기 위한 것입니다.

**MMD 모델은 머티리얼을 렌더링할 때 항상 동일한 순서로 렌더링**되어야 합니다.
서브메시가 모두 독립적인 `Mesh`로 분할되어 있다면 **`Mesh.alphaIndex`를 사용하여 렌더링 순서를 설정**할 수 있습니다.

그러나 **하나의 `Mesh`에 여러 개의 `SubMesh`가 존재**하는 경우, 각 `SubMesh`의 그리기 순서는 일반적인 방법으로 설정할 수 없으며, **Babylon.js는 각 `SubMesh`의 `BoundingInfo`를 기준으로 정렬하여 렌더링 순서를 설정**합니다.
이를 해결하기 위해 **모든 `SubMesh` BoundingInfo가 동일하게 설정**됩니다. Babylon.js는 **렌더링 순서를 정렬할 때 안정적 정렬을 사용**하므로, 이 경우 렌더링은 `Mesh.subMeshes`의 순서대로 수행됩니다.

**optimizeSubmeshes가 true인 경우**

이 경우 **`Mesh`당 하나의 `SubMesh`만 존재**하므로 `Mesh`의 BoundingInfo를 `SubMesh`에 복사하는 것은 의미가 없어 보일 수 있습니다.
**`Mesh`당 하나의 `SubMesh`가 존재**하는 경우, Babylon.js는 BoundingInfo를 `SubMesh`에 저장하지 않고 `SubMesh.getBoundingInfo()`를 호출할 때 `Mesh`의 BoundingInfo를 반환합니다.

그러나 **`scene.clearCachedVertexData()`를 수행**하여 이미 GPU에 업로드된 VertexData를 제거할 때,
`SubMesh.getBoundingInfo()`를 호출하면 `SubMesh`는 **`Mesh`의 BoundingInfo 대신 undefined를 반환**합니다.

그 이유는 `SubMesh.getBoundingInfo()`에서 **`this.IsGlobal`이 실제와 달리 `false`를 반환**하기 때문입니다. **이것은 버그**입니다.

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

이로 인해 **렌더링 과정에서 정렬이 실패**하여 **렌더링 중 오류가 발생**합니다.

이 문제는 **`Mesh`의 `BoundingInfo`를 `SubMesh`에 복사**하여 해결됩니다.

### preserveSerializationData

**재직렬화를 위한 데이터를 보존**할지 여부를 설정합니다.\
기본값은 **`false`** 입니다.

MMD 모델에서 **babylon-mmd에서 사용되지 않는 데이터를 보존**하려면 `preserveSerializationData`를 **`true`**로 설정해야 합니다.
이 경우 **본의 tailPosition이나 머티리얼의 영어 이름과 같은 추가 정보**를 보존할 수 있습니다.

**PMX/PMD 모델을 로드한 다음 `BpmxConverter`를 사용하여 BPMX로 변환**하는 경우, 손실 없이 BPMX로 변환하기 위해 이 옵션을 **`true`** 로 설정해야 합니다.

### loggingEnabled

**로깅을 활성화**할지 여부를 설정합니다.\
기본값은 **`false`** 입니다.

**개발 중에 로깅을 활성화**하는 것이 좋습니다. 잘못된 PMX/PMD 파일을 로드할 때 발생하는 문제를 진단하는 데 도움이 됩니다.

이 값이 **`false`** 이면 로더는 **로딩 과정에서 발생하는 문제에 대한 경고를 출력하지 않습니다**.

### referenceFiles

**참조 파일 목록**을 설정합니다.\
기본값은 **`[]`** 입니다.

**참조 파일은 MMD 모델의 텍스처를 로드**하는 데 사용됩니다.

### optimizeSubmeshes

**서브메시 최적화를 활성화**할지 여부를 설정합니다.\
기본값은 **`true`** 입니다.

이 값이 **`false`** 이면 MMD 모델은 **여러 개의 `SubMesh`가 있는 하나의 `Mesh`** 로 로드됩니다.

예를 들어, MMD 모델에 3개의 머티리얼이 있는 경우, 이 모델은 **3개의 `SubMesh`가 있는 하나의 `Mesh`**로 로드되며, 각 `SubMesh`에 별도의 `Material`을 할당하기 위해 **`MultiMaterial`이 사용**됩니다.

```typescript
// 머티리얼 기반으로 여러 SubMesh가 로드된 MMD 모델
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

이 값이 **`true`**이면 MMD 모델은 머티리얼 수에 따라 **여러 개의 `Mesh`로 분할**됩니다. **각 `Mesh`에는 하나의 `SubMesh`만** 있습니다.

```typescript
// 머티리얼 기반으로 여러 Mesh로 분할된 MMD 모델
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

이 경우, 하나의 지오메트를 여러 부분으로 분할하는 과정에서 **정보 손실이 발생할 수 있습니다**.

상황에 따라 **이 옵션을 `false`로 설정하면 더 나은 성능**을 제공할 수 있습니다.

### optimizeSingleMaterialModel

**단일 머티리얼 모델 최적화를 활성화**할지 여부를 설정합니다.\
기본값은 **`true`**입니다.

**optimizeSubmeshes가 `true`**인 경우에도 MMD 모델이 단일 머티리얼을 사용할 때는 **루트 메시 아래에 하나의 메시**로 로드됩니다.
이 경우 지오메트를 루트 메시에 포함시켜 **하나의 `Mesh` 인스턴스로 최적화**할 수 있으며, 이 최적화는 **optimizeSingleMaterialModel이 `true`**일 때 적용됩니다.

```typescript
// optimizeSingleMaterialModel: false, optimizeSubmeshes: true로 로드된 하나의 머티리얼을 사용하는 MMD 모델
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
// optimizeSingleMaterialModel: true, optimizeSubmeshes: true로 로드된 하나의 머티리얼을 사용하는 MMD 모델
Mesh1 {
    subMeshes: [ SubMesh1 ]
}
```

**optimizeSubmeshes가 `false`**인 경우, 이 옵션은 **무시됩니다**.

## 더 나아가기

babylon-mmd는 다양한 사용 사례를 지원하기 위한 **다양한 로딩 옵션**과 **MMD 동작을 재현하기 위한 여러 기능**을 제공합니다.

- **BMP 텍스처 로딩 이슈** - **BMP 텍스처가 올바르게 로드되지 않는 문제**에 대해서는 **[BMP 텍스처 로더 수정](./fix-bmp-texture-loader)**을 참조하세요.
- **모델 변형 이슈** - **모델 변형이 MMD와 다른 문제**에 대해서는 **[SDEF 지원](./sdef-support)**을 참조하세요.
- **머티리얼 빌더** - **머티리얼 빌더**에 대한 자세한 정보는 **[머티리얼 빌더](./material-builder)**를 참조하세요.
- **MMD 스탠다드 머티리얼** - **MMD 셰이더를 재현하는 MMD 스탠다드 머티리얼**에 대한 자세한 정보는 **[MMD 스탠다드 머티리얼](./mmd-standard-material)**을 참조하세요.
- **BPMX** - **PMX/PMD 파일 변환 및 최적화**에 대한 자세한 정보는 **[바빌론 PMX 포맷](./the-babylon-pmx-format)**을 참조하세요.
