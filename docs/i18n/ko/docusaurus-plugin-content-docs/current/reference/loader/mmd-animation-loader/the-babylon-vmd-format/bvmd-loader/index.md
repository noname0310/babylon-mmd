---
sidebar_position: 2
sidebar_label: BVMD 로더
---

# BVMD 로더

이 섹션에서는 **Babylon VMD (BVMD)** 애니메이션 파일을 로드하는 방법을 설명합니다.

## BvmdLoader

**BVMD** 파일을 **`MmdAnimation`** 객체로 로드하기 위해 **`BvmdLoader`** 를 사용할 수 있습니다. **`BvmdLoader`** 는 **`VmdLoader`** 와 거의 동일한 인터페이스를 제공합니다.

```typescript
const bvmdLoader = new BvmdLoader();
const mmdAnimation: MmdAnimation = await bvmdLoader.loadAsync("motion1", "path/to/motion1.bvmd");
```

**`loadAsync`** 메서드가 받는 매개변수는 다음과 같습니다:

- **`name`**: 애니메이션의 이름.
- **`fileOrUrl`**: `string` 또는 `File`로 된 BVMD 파일의 URL.
- **`onProgress`**: 로딩 진행 상황과 함께 주기적으로 호출되는 콜백 함수.

또한 **BVMD** 파일을 로드하기 위해 **`load`** 메서드를 사용할 수 있습니다. **`load`** 메서드는 **`onLoad`** 와 **`onError`** 콜백을 받습니다.

**`loadFromBuffer`** 메서드를 사용하여 **`ArrayBuffer`** 에서 **BVMD** 파일을 로드할 수도 있습니다.

```typescript
const arrayBuffer = await fetch("path/to/motion1.bvmd")
    .then(response => response.arrayBuffer());

const bvmdLoader = new BvmdLoader();
const mmdAnimation = bvmdLoader.loadFromBuffer("motion1", arrayBuffer);
```

**BVMD** 포맷의 효율적인 구조로 인해 파싱 시간이 매우 짧기 때문에, **`loadFromBuffer`** 는 **`onProgress`** 콜백을 제공하지 않으며 비동기 작업이 아닙니다.

또한 **`BvmdLoader.loggingEnabled`** 를 사용하여 로깅을 활성화할 수 있습니다. 기본값은 `false`입니다. `false`로 설정되면 로그가 출력되지 않습니다.
