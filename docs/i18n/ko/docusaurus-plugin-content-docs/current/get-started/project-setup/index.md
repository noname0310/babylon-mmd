---
sidebar_position: 0
sidebar_label: 프로젝트 설정
---

# 프로젝트 설정

먼저 **babylon-mmd**를 사용하기 위한 **SPA 프로젝트**를 구성해야 합니다. 이 튜토리얼에서는 [**웹팩**](https://webpack.js.org/) 기반 프로젝트 템플릿을 활용합니다.

아래 명령어로 프로젝트를 클론하는 것부터 시작하세요.

```bash
git clone https://github.com/noname0310/babylon-mmd-template
```

이 프로젝트에는 **타입스크립트**, **웹팩**, **ES린트**, **Babylon.js**, **babylon-mmd**를 사용하기 위한 설정이 포함되어 있습니다.

구체적인 빌드 및 개발 환경 설정은 다음과 같습니다.

- **타입스크립트**(tsconfig.json)
  - src 폴더를 참조하기 위한 **"@/" 에일리어스**
  - 기타 엄격한 타입 검사와 함께 **스트릭트 모드** 활성화

- **웹팩**(webpack.config.ts)
  - **데브 서버** 구성(https, localhost:20310)
  - **SharedArrayBuffer** 활성화(크로스 오리진 아이솔레이티드)
  - **res 폴더** 내 모든 리소스를 fetch로 로드 가능(CopyWebpackPlugin)
  - 저장 시 **ES린트 오토 픽스**
  - **셰이더 코드 청크 스플리팅**
  - 개발 모드에서 **소스맵** 활성화

- **ES린트**(eslint.config.mjs)
  - **Babylon.js 코딩 스타일 가이드**에 맞춘 설정

이 프로젝트의 소스 구조는 다음과 같습니다.

```
/ (root)
├── /res: PMX 모델, VMD 애니메이션, MP3 오디오 등을 포함하는 폴더
├── /src: 프로젝트 소스 코드를 담는 폴더
│   ├── /baseRuntime.ts: Babylon.js 엔진 생성과 렌더링 루프 설정 코드
│   ├── /index.html: HTML 템플릿
│   ├── /index.ts: 씬 빌더로 씬을 생성하고 렌더링 루프를 시작하는 엔트리 포인트
│   └── /sceneBuilder.ts: 씬을 구성하는 코드
```

**MMD 씬**을 구성하기 위해 수정할 파일은 **sceneBuilder.ts** 하나뿐입니다.

먼저 프로젝트 의존성을 설치하고 개발 서버를 실행하세요.

```bash
npm install
npm start
```

브라우저에서 [https://localhost:20310](https://localhost:20310)을 열면 다음과 같은 에러가 표시됩니다.

![first run](@site/docs/get-started/project-setup/first_run.png)

기본적으로 **sceneBuilder.ts** 파일에는 **웹XR을 사용하는 babylon-mmd 예제**가 들어 있습니다.
하지만 로드할 **MMD 모델과 애니메이션**이 없으므로 에러가 발생합니다.

이제 MMD 씬을 구성하기 위해 sceneBuilder.ts 파일을 **완전히 새로 작성**할 것입니다.

우선 아래와 같은 **비어 있는 `build` 메서드**부터 시작하세요.

```typescript title="src/sceneBuilder.ts"
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Scene } from "@babylonjs/core/scene";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        return scene;
    }
}
```
