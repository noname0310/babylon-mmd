---
sidebar_position: 4
sidebar_label: 머티리얼 모핑 활성화
---

# 머티리얼 모핑 활성화

MMD 모델은 **머티리얼 모핑**을 지원하며, 이는 애니메이션을 통해 머티리얼 매개변수를 제어할 수 있는 기능입니다.

이 기능은 일반적으로 애니메이션을 통해 MMD 모델의 특정 부분을 켜거나 끄는 데 사용됩니다.

이 기능은 일반적으로 애니메이션을 통해 MMD 모델의 특정 부분을 켜거나 끄는 데 사용됩니다.

이 기능은 babylon-mmd에서 **기본적으로 비활성화**되어 있지만, `MmdModel` 객체를 생성할 때 머티리얼 프록시 구현을 전달하여 활성화할 수 있습니다.

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    materialProxyConstructor: MmdStandardMaterialProxy
});
```

:::info
"babylon-mmd" 패키지 루트를 가져오면 사이드 이펙트를 통해 머티리얼 모핑이 **자동으로 활성화**됩니다.

이는 사용 편의성을 위한 기능이지만, 위와 같이 머티리얼 프록시를 전달하여 **명시적으로 활성화**하는 것이 권장됩니다.
:::

## 머티리얼 프록시

머티리얼 매개변수를 조작할 때 MMD 런타임은 **머티리얼에 직접 접근하지 않고** 머티리얼 프록시를 통해 접근합니다.

이 접근 방식을 통해 **모든 유형의 머티리얼**을 사용하는 MMD 모델에서 머티리얼 모핑을 지원할 수 있습니다.

babylon-mmd는 **두 가지 머티리얼 프록시**를 제공하며, `IMmdMaterialProxy` 인터페이스를 구현하는 클래스를 생성하여 직접 구현할 수도 있습니다.

- `MmdStandardMaterialProxy`: `MmdStandardMaterial`을 사용하는 MMD 모델용 머티리얼 프록시
- `StandardMaterialProxy`: `StandardMaterial`을 사용하는 MMD 모델용 머티리얼 프록시

:::warning
MMD 모델에서 사용하는 머티리얼과 **호환되지 않는** 머티리얼 프록시를 전달하면 런타임 오류가 발생할 수 있습니다.
:::
