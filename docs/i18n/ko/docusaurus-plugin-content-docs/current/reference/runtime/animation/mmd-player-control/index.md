---
sidebar_position: 3
sidebar_label: MMD 플레이어 컨트롤
---

# MMD 플레이어 컨트롤

이 섹션에서는 비디오 플레이어와 유사한 GUI를 사용하여 **MMD 애니메이션을 제어**하는 방법을 설명합니다.

![playercontrol](@site/docs/reference/runtime/animation/mmd-player-control/playercontrol.png)

*이 이미지는 `MmdPlayerControl`로 구성된 MMD 애니메이션 플레이어의 예제를 보여줍니다. 모델: YYB式初音ミク_10th_v1.02 by SANMUYYB*

## MmdPlayerControl

`MmdPlayerControl` 클래스는 **MMD 애니메이션을 제어**하기 위한 GUI를 제공합니다. 이 GUI에는 재생, 일시정지, 프레임 네비게이션, 볼륨 제어 등의 기능이 포함됩니다.

```typescript
const playerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
```

`MmdPlayerControl` 클래스는 **세 개의 인수**를 받습니다:
- `scene`: `Scene` 객체입니다.
  - GUI HTML 요소는 이 씬의 `scene.getEngine().getInputElement()`에 추가됩니다.
  - 객체의 생명주기는 `Scene` 객체에 **의존적**입니다.
- `mmdRuntime`: `IMmdRuntime` 객체입니다.
  - 이 객체의 애니메이션은 `MmdPlayerControl`에 의해 **제어됩니다**.
- `audioPlayer`: `IPlayer` 인터페이스를 구현하는 오디오 플레이어 객체입니다.
  - 이 인수는 **선택사항**이며, 제공되지 않으면 오디오 볼륨 제어가 비활성화됩니다.

### 메서드

`MmdPlayerControl` 클래스는 다음 메서드를 제공합니다:

- `dispose(): void`: `MmdPlayerControl` 객체를 해제합니다. 이 메서드는 **명시적으로** 호출할 수 있으며, `Scene` 객체가 해제될 때 **자동으로** 호출됩니다.

```typescript
playerControl.dispose();
```

- `showPlayerControl(): void`: 플레이어 컨트롤 GUI를 **표시**합니다.

```typescript
playerControl.showPlayerControl();
```

- `hidePlayerControl(): void`: 플레이어 컨트롤 GUI를 **숨깁니다**.

```typescript
playerControl.hidePlayerControl();
```

사용자가 커서를 GUI 위에 올리면 GUI가 표시되므로, `showPlayerControl()`과 `hidePlayerControl()` 메서드는 기본적으로 **일반적으로 사용되지 않습니다**.

:::warning
`MmdPlayerControl` 클래스는 **디버깅 목적**으로 제공되며 프로덕션 환경에서의 사용을 위해 **설계되지 않았습니다**. 따라서 이 클래스를 사용한 애플리케이션 개발은 권장되지 않습니다.

프로덕션 환경에서 플레이어 컨트롤 GUI가 필요한 경우, `MmdPlayerControl` 클래스를 참고하여 **직접 구현**하는 것이 좋습니다.
:::
