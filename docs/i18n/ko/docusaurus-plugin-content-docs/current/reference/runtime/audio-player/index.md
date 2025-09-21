---
sidebar_position: 8
sidebar_label: 오디오 플레이어
---

# 오디오 플레이어

이 섹션에서는 MMD 런타임에 오디오 플레이어 컴포넌트를 추가하여 음악을 재생하는 방법을 설명합니다.

## IPlayer 인터페이스

MMD 런타임은 기본적으로 `Engine.getDeltaTime()` 메서드를 사용하여 **애니메이션을 업데이트**합니다.

그러나 오디오를 재생할 때는 MMD 런타임의 재생 속도가 **오디오 재생 속도와 동기화**되어야 합니다. 이는 오디오 객체가 일종의 타이머 역할을 하기 때문입니다.

babylon-mmd는 (오디오) 플레이어가 구현해야 하는 메서드들을 `IPlayer` 인터페이스를 통해 정의합니다. 이러한 메서드들을 모두 구현하면, 해당 플레이어를 MMD 런타임의 **동기화 대상**으로 사용할 수 있습니다.

다음은 `IPlayer` 인터페이스를 구현하는 `StreamAudioPlayer` 클래스를 `MmdRuntime`에 설정하는 예제입니다:

```typescript
const audioPlayer = new StreamAudioPlayer();
mmdRuntime.setAudioPlayer(audioPlayer);
```

## 오디오 동기화 방법

오디오 플레이어가 설정되면, MMD 런타임은 애니메이션을 업데이트하기 위해 **상당히 복잡한 로직**을 사용합니다.

엄밀히 말하면, 오디오 플레이어를 사용할 때도 MMD 런타임은 여전히 기본적으로 `Engine.getDeltaTime()` 메서드를 사용하여 애니메이션을 업데이트합니다. 하지만 오디오 플레이어의 재생 위치가 애니메이션 재생 위치와 **동기화되지 않은 경우**, 오디오 플레이어의 재생 위치에 맞춰 애니메이션 재생 위치를 조정합니다.

즉, 오디오 플레이어가 설정되면 MMD 런타임은 오디오 플레이어의 재생 위치에 맞춰 **애니메이션의 재생 위치를 조정**하지만, 오디오 플레이어를 주 타이머로 **사용하지는 않습니다**.

또한 애니메이션이 오디오보다 길 경우, 오디오가 끝난 후에도 애니메이션은 끝까지 계속 재생되어야 합니다. 따라서 오디오 자체는 MMD 런타임 재생의 **주 타이머가 될 수 없습니다**.

## StreamAudioPlayer

babylon-mmd는 `IPlayer` 인터페이스를 구현하는 `StreamAudioPlayer` 클래스를 제공합니다.

이 클래스는 내부적으로 `HTMLAudioElement`를 사용하여 오디오를 재생합니다.

사용 방법의 예제는 다음과 같습니다:

```typescript
const audioPlayer = new StreamAudioPlayer(scene);
audioPlayer.source = "path/to/audio/file.mp3";
mmdRuntime.setAudioPlayer(audioPlayer);
```

`StreamAudioPlayer` 클래스는 생성 시 `Scene` 객체를 인수로 받습니다. 이는 `HTMLAudioElement`의 생명주기를 `Scene` 객체에 **바인딩하기 위함**입니다.

:::warning
`StreamAudioPlayer` 클래스 생성자의 첫 번째 인수로 `null`을 지정하면, `dispose()` 메서드가 호출될 때까지 `HTMLAudioElement`가 **메모리에 남아있을 수 있다**는 점에 주의하세요.
:::
