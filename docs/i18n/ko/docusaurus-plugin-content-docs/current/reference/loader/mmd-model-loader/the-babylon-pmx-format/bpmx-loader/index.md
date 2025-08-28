---
sidebar_position: 2
sidebar_label: BPMX 로더
---

# BPMX 로더

이 섹션에서는 **PMX** 파일의 변형인 **Babylon PMX (BPMX)** 파일을 로드하는 방법에 대해 설명합니다.

**BPMX** 포맷은 **MMD** 모델을 저장하기 위한 포맷으로, **PMX/PMD**와 달리 단일 바이너리 포맷입니다.

**BPMX** 파일을 로드하기 위해 **`BpmxLoader`**를 사용합니다. 이 로더는 **`PmxLoader`**와 **`PmdLoader`**와 거의 동일한 방식으로 작동합니다.

## SceneLoader에 등록하기

먼저, **`BpmxLoader`**를 **Babylon.js SceneLoader**에 등록해야 합니다. 이는 사이드 이펙트를 위한 임포트를 통해 수행됩니다.

```typescript
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader";
```

이 임포트 구문은 암묵적으로 다음과 같은 사이드 이펙트를 수행합니다:

```typescript
RegisterSceneLoaderPlugin(new BpmxLoader());
```

## BPMX 파일 로딩하기

**BPMX** 파일은 **PMX/PMD** 파일과 마찬가지로 **Babylon.js SceneLoader API**를 사용하여 로드할 수 있습니다.

아래는 SceneLoader API 메서드 중 하나인 **`LoadAssetContainerAsync`**를 사용하여 **BPMX** 파일을 로드하는 예시입니다.

```typescript
const assetContainer: AssetContainer = await LoadAssetContainerAsync("path/to/mmdModel.bpmx", scene);
assetContainer.addAllToScene(); 
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

또한 **`ImportMeshAsync`**와 **`AppendSceneAsync`**를 사용하여 **BPMX** 파일을 로드할 수도 있습니다.

:::info
**BPMX** 파일은 텍스처를 포함한 모든 에셋을 단일 파일에 저장하기 때문에 **텍스처 해상도**와 관련된 문제가 없으며, 모든 에셋은 단일 네트워크 요청으로 로드할 수 있습니다.
:::

## 브라우저 파일 API 사용하기

브라우저의 **파일 API**를 사용하여 파일을 로드할 수도 있습니다.

아래는 [showOpenFilePicker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker) API를 사용하여 **BPMX** 파일을 선택하고 로드하는 예시입니다.

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
showOpenFilePicker 브라우저 API는 Firefox와 Safari에서 지원되지 않습니다.
:::

## 로더 옵션

**PMX/PMD** 로더와 달리, **BPMX** 로더는 일부 최적화 관련 옵션을 지원하지 않습니다. 이는 **BPMX** 파일이 변환 과정에서 이미 최적화되었기 때문입니다.

아래는 **`pluginOptions`**를 사용하여 **BPMX** 로더가 지원하는 모든 옵션을 설정하는 예시입니다.

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

**`useSingleMeshForSingleGeometryModel`**을 제외하고, 다른 옵션들은 **PMX/PMD** 로더와 동일합니다. 각 옵션에 대한 설명은 [PMX/PMD 로더 옵션](../../#loader-options) 문서를 참조하세요.

### useSingleMeshForSingleGeometryModel

**`BpmxLoader`**는 N개의 지오메트리가 있는 모델을 로드하기 위해 빈 **루트 메시**를 생성하고 그 아래에 지오메트리가 있는 N개의 메시를 생성합니다. 따라서 3개의 지오메트리가 있는 3D 모델의 구조는 다음과 같이 구성됩니다.

```
RootMesh {
    children: [
        Mesh1
        Mesh2
        Mesh3
    ]
}
```

그러나 모델이 단일 지오메트리를 가진 경우, **루트 메시**는 불필요합니다. 따라서 **`useSingleMeshForSingleGeometryModel`**이 `true`인 경우, 단일 지오메트리를 가진 모델은 **루트 메시** 없이 하나의 메시만으로 구성되며, 계층 구조는 다음과 같이 구성됩니다.

```
Mesh1
```

**`useSingleMeshForSingleGeometryModel`**이 `false`인 경우, 단일 지오메트리를 가진 모델도 여전히 **rootMesh**를 가지며, 계층 구조는 다음과 같이 구성됩니다.

```
RootMesh {
    children: [
        Mesh1
    ]
}
```

**`useSingleMeshForSingleGeometryModel`**의 기본값은 `true`입니다.
