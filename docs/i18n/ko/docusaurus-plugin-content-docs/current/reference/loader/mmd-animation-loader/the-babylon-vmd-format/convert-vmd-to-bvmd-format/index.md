---
sidebar_position: 1
sidebar_label: VMD를 BVMD 포맷으로 변환하기
---

# VMD를 BVMD 포맷으로 변환하기

이 섹션에서는 **VMD** 파일을 **BVMD** 파일로 변환하는 방법을 설명합니다.

**VMD** 파일을 **BVMD** 파일로 변환하기 위해 다음 두 가지 방법 중 하나를 사용할 수 있습니다:

- 웹 애플리케이션을 사용하여 변환할 수 있습니다.
- 프로그래밍 방식으로 변환할 수 있습니다.

**두 방법 모두 동일한 결과를 생성합니다.**

## 변환기 애플리케이션 사용하기

**babylon-mmd**는 **VMD** 파일을 **BVMD** 파일로 변환하는 웹 애플리케이션을 제공합니다.

아래 링크에서 애플리케이션을 사용할 수 있습니다.

[VMD to BVMD 변환기](https://noname0310.github.io/babylon-mmd/vmd_converter/)

![변환기 UI](@site/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format/convert-vmd-to-bvmd-format/bvmd-converter-ui.png)
***VMD to BVMD 변환기**의 스크린샷*

1. **하나 이상의 VMD 파일을 드래그 앤 드롭합니다.**
    - 여러 **VMD** 파일을 드롭하면, 파일들이 병합되며 먼저 드롭된 파일의 키프레임이 우선시됩니다.

2. **변환을 수행합니다.**

## 프로그래밍 방식 변환

**BVMD** 변환은 **`BvmdConverter`** 클래스를 사용하여 수행됩니다.

**`BvmdConverter`** 는 **`MmdAnimation`** 오브젝트를 입력으로 받아 **BVMD** 포맷 데이터로 변환합니다.

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = await vmdLoader.loadAsync("path/to/your/file.vmd");

const arrayBuffer = BvmdConverter.Convert(mmdAnimation);
```

이 방식은 웹 애플리케이션 버전과 정확히 동일한 방식으로 작동합니다.
