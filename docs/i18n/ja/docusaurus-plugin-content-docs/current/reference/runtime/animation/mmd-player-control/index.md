---
sidebar_position: 3
sidebar_label: MMD プレイヤー コントロール
---

# MMD プレイヤー コントロール

このセクションでは、ビデオ プレイヤーのような GUI を使用して **MMD アニメーションを制御** する方法を説明します。

![playercontrol](@site/docs/reference/runtime/animation/mmd-player-control/playercontrol.png)

*この画像は `MmdPlayerControl` で構成された MMD アニメーション プレイヤーの例を示しています。モデル: YYB式初音ミク_10th_v1.02 by SANMUYYB*

## MmdPlayerControl

`MmdPlayerControl` クラスは **MMD アニメーションを制御** するための GUI を提供します。この GUI には、再生、一時停止、フレーム ナビゲーション、音量制御などの機能が含まれます。

```typescript
const playerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
```

`MmdPlayerControl` クラスは **3 つの引数** を受け取ります：
- `scene`: `Scene` オブジェクト。
  - GUI HTML エレメントは、このシーンの `scene.getEngine().getInputElement()` に追加されます。
  - オブジェクトのライフタイムは `Scene` オブジェクトに **依存** しています。
- `mmdRuntime`: `IMmdRuntime` オブジェクト。
  - このオブジェクトのアニメーションは `MmdPlayerControl` によって **制御** されます。
- `audioPlayer`: `IPlayer` インターフェースを実装するオーディオ プレイヤー オブジェクト。
  - この引数は **オプション** であり、提供されない場合、オーディオ音量制御は無効になります。

### メソッド

`MmdPlayerControl` クラスは以下のメソッドを提供します：

- `dispose(): void`: `MmdPlayerControl` オブジェクトを解放します。このメソッドは **明示的に** 呼び出すことができ、または `Scene` オブジェクトが解放されるときに **自動的に** 呼び出されます。

```typescript
playerControl.dispose();
```

- `showPlayerControl(): void`: プレイヤー コントロール GUI を **表示** します。

```typescript
playerControl.showPlayerControl();
```

- `hidePlayerControl(): void`: プレイヤー コントロール GUI を **非表示** にします。

```typescript
playerControl.hidePlayerControl();
```

GUI はユーザーがカーソルをホバーしたときに表示されるため、`showPlayerControl()` と `hidePlayerControl()` メソッドは **通常デフォルトでは使用されません**。

:::warning
`MmdPlayerControl` クラスは **デバッグ目的** で提供されており、プロダクション環境での使用は **設計されていません**。したがって、このクラスを使用してアプリケーションを開発することは推奨されません。

プロダクション環境でプレイヤー コントロール GUI が必要な場合は、`MmdPlayerControl` クラスを参考にして **独自に実装** することをお勧めします。
:::
