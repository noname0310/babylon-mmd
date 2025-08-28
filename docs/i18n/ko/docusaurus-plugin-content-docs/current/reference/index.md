---
sidebar_position: 1
sidebar_label: 레퍼런스
---

# 레퍼런스 개요

이 섹션에서는 babylon-mmd가 제공하는 기능에 대한 자세한 설명을 제공합니다.

babylon-mmd의 핵심 기능은 PMX, PMD, VMD 및 VPD 파일을 로드하고 MMD 모델을 Babylon.js 씬에 원활하게 통합하는 것입니다.

babylon-mmd는 Babylon.js 렌더링 파이프라인과의 호환성을 보장하면서 MMD(MikuMikuDance)의 동작을 정확하게 재현하기 위한 다양한 옵션을 제공합니다.

특정 사용 사례에 맞는 기능을 선택적으로 사용하고 Babylon.js 씬에 대한 최적의 구성을 만들 수 있습니다. 이를 위해서는 MMD 작동 방식과 babylon-mmd가 이러한 메커니즘을 재현하는 방법을 이해해야 하며, 이 섹션에서 자세히 다룹니다.

:::info

MMD 모델을 로드하고 애니메이션을 재생하는 기본 사용법을 알고 싶다면, [시작하기](/docs/get-started) 섹션을 참조하세요. 이 섹션에서는 babylon-mmd의 기본 사용법과 설정에 대한 안내를 제공합니다.

:::

레퍼런스 문서에는 다음과 같은 주제가 포함됩니다:

## **[개요](/docs/reference/overview)**

이 섹션에서는 babylon-mmd를 구성하는 컴포넌트와 그 관계를 설명합니다.

## **[MMD 동작 이해하기](/docs/reference/understanding-mmd-behaviour)**

이 섹션에서는 MMD의 에셋 구조와 동작을 이해하는 데 필요한 정보를 제공합니다. 또한 babylon-mmd가 MMD의 동작을 어떻게 재현하는지에 대한 기본적인 이해를 돕습니다.

- **[PMX 및 PMD 소개](/docs/reference/understanding-mmd-behaviour/introduction-to-pmx-and-pmd)** - PMX 및 PMD 파일의 구조와 동작을 이해하는 데 필요한 정보를 제공합니다.
- **[VMD 및 VPD 소개](/docs/reference/understanding-mmd-behaviour/introduction-to-vmd-and-vpd)** - VMD 및 VPD 파일의 구조와 동작을 이해하는 데 필요한 정보를 제공합니다.

## **[로더](/docs/reference/loader)**

이 섹션에서는 MMD 모델과 애니메이션 데이터를 로드하는 방법을 설명합니다.

- **[MMD 모델 로더 (PmxLoader, PmdLoader)](/docs/reference/loader/mmd-model-loader)** - MMD 모델 파일(PMX, PMD)을 로드하는 데 사용되는 컴포넌트를 설명합니다.
  - **[BMP 텍스처 로더 수정](/docs/reference/loader/mmd-model-loader/fix-bmp-texture-loader)** - BMP 텍스처가 있는 MMD 모델을 올바르게 로드하기 위한 컴포넌트를 설명합니다.
  - **[SDEF 지원](/docs/reference/loader/mmd-model-loader/sdef-support)** - 구면 변형(SDEF)이 있는 MMD 모델을 올바르게 로드하기 위한 컴포넌트를 설명합니다.
  - **[MMD 스탠다드 머티리얼](/docs/reference/loader/mmd-model-loader/mmd-standard-material)** - MMD 모델에 사용되는 스탠다드 머티리얼을 설명합니다.
  - **[머티리얼 빌더](/docs/reference/loader/mmd-model-loader/material-builder)** - MMD 모델에 머티리얼을 할당하는 방법과 MMD의 렌더링 방식을 재현하는 방법에 대해 설명합니다.
    - **[자신만의 MMD 머티리얼 빌더 구축하기](/docs/reference/loader/mmd-model-loader/material-builder/build-your-own-mmd-material-builder)** - MMD 모델의 머티리얼 할당을 커스터마이즈하는 방법을 설명합니다.
  - **[Babylon PMX 포맷](/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format)** - babylon-mmd에서 제공하는 PMX 파일의 변형인 BPMX 파일 포맷을 설명합니다.
    - **[PMX를 BPMX 포맷으로 변환하기](/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format)** - PMX 파일을 BPMX 포맷으로 변환하는 방법을 설명합니다.
    - **[BPMX 로더](/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/bpmx-loader)** - BPMX 파일을 로드하는 방법을 설명합니다.

- **[MMD 애니메이션 로더 (VmdLoader, VpdLoader)](/docs/reference/loader/mmd-animation-loader)** - MMD 애니메이션 파일(VMD, VPD)을 로드하는 데 사용되는 컴포넌트를 설명합니다.
  - **[Babylon VMD 포맷](/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format)** - babylon-mmd에서 제공하는 VMD 파일의 변형인 BVMD 파일 포맷을 설명합니다.
    - **[VMD를 BVMD 포맷으로 변환하기](/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format/convert-vmd-to-bvmd-format)** - VMD 파일을 BVMD 포맷으로 변환하는 방법을 설명합니다.
    - **[BVMD 로더](/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format/bvmd-loader)** - BVMD 파일을 로드하는 방법을 설명합니다.

## **[런타임](/docs/reference/runtime)**

이 섹션에서는 MMD 모델과 애니메이션을 실행하는 데 필요한 런타임 컴포넌트를 설명합니다.

- **[MMD 카메라](/docs/reference/runtime/mmd-camera)** - MMD 카메라를 설정하고 사용하는 방법을 설명합니다.
- **[MMD 런타임](/docs/reference/runtime/mmd-runtime)** - MMD 모델과 애니메이션을 실행하기 위한 런타임 환경을 설명합니다.
- **[MMD 웹어셈블리 런타임](/docs/reference/runtime/mmd-webassembly-runtime)** - 웹어셈블리를 사용하여 MMD 애니메이션을 실행하는 방법을 설명합니다.
- **[머티리얼 모핑 활성화하기](/docs/reference/runtime/enable-material-morphing)** - MMD 모델에서 머티리얼 모핑을 활성화하는 방법을 설명합니다.
- **[MMD 모델에 물리 적용하기](/docs/reference/runtime/apply-physics-to-mmd-models)** - MMD 모델에 물리를 설정하는 방법을 설명합니다.
- **[불릿 피직스](/docs/reference/runtime/bullet-physics)** - 불릿 피직스 월드를 제어하는 방법을 설명합니다.
- **[애니메이션](/docs/reference/runtime/animation/mmd-animation)** - MMD 모델의 애니메이션을 설정하고 제어하는 방법을 설명합니다.
  - **[MMD 애니메이션](/docs/reference/runtime/animation/mmd-animation)** - MMD 애니메이션을 설정하고 사용하는 방법을 설명합니다.
  - **[Babylon.js 애니메이션 런타임 사용하기](/docs/reference/runtime/animation/use-babylonjs-animation-runtime)** - Babylon.js 애니메이션 런타임을 사용하여 MMD 모델을 애니메이션하는 방법을 설명합니다.
  - **[MMD 플레이어 컨트롤](/docs/reference/runtime/animation/mmd-player-control)** - 비디오 플레이어와 유사한 GUI를 사용하여 MMD 애니메이션을 제어하는 방법을 설명합니다.
  - **[애니메이션 블렌딩](/docs/reference/runtime/animation/animation-blending)** - 여러 애니메이션을 함께 블렌딩하는 방법을 설명합니다.
- **[오디오 플레이어](/docs/reference/runtime/audio-player)** - 애니메이션과 동기화된 오디오 플레이어를 설정하는 방법을 설명합니다.
- **[비 MMD 모델에 MMD 애니메이션 적용하기](/docs/reference/runtime/apply-mmd-animation-on-non-mmd-model)** - 비 MMD 모델에 MMD 애니메이션을 적용하는 방법을 설명합니다.
<!-- - **[런타임 없이 MMD 모델 사용하기](/docs/reference/runtime/use-mmd-model-without-runtime)** - 런타임 없이 MMD 모델을 사용하는 방법을 설명합니다. -->
