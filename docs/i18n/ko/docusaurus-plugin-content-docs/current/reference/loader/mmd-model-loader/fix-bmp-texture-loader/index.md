---
sidebar_position: 1
sidebar_label: BMP 텍스처 로더 수정
---

# BMP 텍스처 로더 수정

**BMP 텍스처를 사용하는 모델을 로딩할 때** 문제가 발생하면 이 문서를 참조하여 문제를 해결할 수 있습니다.

## 문제 진단

![잘못 로드된 BMP 텍스처 예시](@site/docs/reference/loader/mmd-model-loader/fix-bmp-texture-loader/2025-08-14-211741.png)
*[MMD 학교 강당 스테이지](https://www.deviantart.com/maddoktor2/art/DL-MMD-School-Auditorium-Stage-665280215) 모델에서 **잘못 로드된 텍스처** 예시*

**BMP 텍스처**를 사용하는 모델을 로딩할 때, **알파 채널이 있는 BMP 파일이 제대로 표시되지 않는** 경우가 있습니다.

## 원인

이 문제는 **브라우저와 MMD가 BMP 텍스처 파일을 읽는 방식의 차이** 때문에 발생합니다. (Babylon.js는 브라우저의 BMP 텍스처 로딩 구현을 사용합니다.)

문제는 텍스처에 알파 채널이 있더라도 **브라우저가 알파 채널을 무시하고 RGB 채널만 읽는다**는 것입니다. 이로 인해 **알파 채널 손실**이 발생합니다.

## 해결책

babylon-mmd는 BMP 텍스처를 올바르게 로드하기 위해 **추가 처리를 수행하는 BMP 텍스처 로더**를 제공합니다.

이를 사용하려면 Babylon.js 텍스처 로더 글로벌 상태에 **babylon-mmd의 BMP 텍스처 로더를 등록**해야 합니다.

```typescript
import { RegisterDxBmpTextureLoader } from "babylon-mmd/esm/Loader/registerDxBmpTextureLoader";

RegisterDxBmpTextureLoader();
```

**`RegisterDxBmpTextureLoader` 함수는 babylon-mmd의 BMP 텍스처 로더**를 Babylon.js의 텍스처 로더에 등록합니다. 이 함수는 **첫 번째 호출에만 영향**을 미칩니다.

:::info
이 함수는 **인덱스를 임포트할 때 실행되는 사이드 이펙트**입니다. 예: `import { MmdRuntime } from "babylon-mmd";`

따라서 **babylon-mmd의 인덱스를 한 번이라도 임포트**하면 `DxBmpTextureLoader`가 이미 등록됩니다.
:::

![올바르게 로드된 BMP 텍스처 예시](@site/docs/reference/loader/mmd-model-loader/fix-bmp-texture-loader/2025-08-14-212535.png)
*MMD 학교 강당 스테이지 모델에서 **올바르게 로드된 텍스처** 예시*
