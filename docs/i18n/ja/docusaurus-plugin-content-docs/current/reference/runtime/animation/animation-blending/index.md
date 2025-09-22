---
sidebar_position: 4
sidebar_label: アニメーションブレンディング
---

# アニメーションブレンディング

babylon-mmdは、**フレーム完璧なアニメーションブレンディング**をサポートする`MmdCompositeAnimation`アニメーションコンテナを提供します。

<blockquote class="twitter-tweet" data-media-max-width="10000">
<p lang="ja" dir="ltr">
    babylon-mmdはframe perfectなアニメーションブレンディングを提供するようになりました
    <br/>
    <br/>
    ユーザーの入力によってダンスの次の内容を変更することが可能で、正確なタイミングを決めることができるので、リズムゲームを取り入れたQTEアニメーションコンテンツを作ることができると思われます。
    <a href="https://t.co/ZCRZU9YVMW">pic.twitter.com/ZCRZU9YVMW</a>
</p>
&mdash; noname0310 (@noname20310)
<a href="https://twitter.com/noname20310/status/1724322704323756229?ref_src=twsrc%5Etfw">
November 14, 2023
</a>
</blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

*このビデオは、Composite Animationを使用して2人用のダンスアニメーションを1つのMMDモデルで**交互に再生**する例を示しています。*

クレジット：
- モデル：
  - YYB Hatsune Miku_10th by YYB
  - YYB Miku Default edit by YYB / HB-Squiddy / FreezyChan-3Dreams
  - YYB miku Crown Knight by YYB / Pilou la baka
- モーション by srs / ATY
- カメラ by 小紋
- ミュージック： 
  - 君にとって by Wonder-K 

:::info
Babylon.jsの`AnimationGroup`でMMDアニメーションを再生することにより、Babylon.jsのアニメーションブレンディング機能も使用できます。

ただし、このセクションでは`AnimationGroup`については**説明しません**。`AnimationGroup`を使用してMMDアニメーションを再生する方法については、[Use Babylon.js Animation Runtime](../use-babylonjs-animation-runtime#babylonjs-animation-group)ドキュメントを参照してください。
:::

## MMD Composite Animation

`MmdCompositeAnimation`は、複数のMMD Animationを1つとして**バンドルして管理**するアニメーションコンテナです。

各アニメーションは、**開始フレームと終了フレーム**の情報を含む`MmdAnimationSpan`オブジェクトとして管理されます。

以下は、2つの`MmdAnimation`オブジェクトを1つの`MmdCompositeAnimation`にバンドルするサンプルコードです：

```typescript
const compositeAnimation = new MmdCompositeAnimation("composite");
const duration = Math.max(mmdAnimation1.endFrame, mmdAnimation2.endFrame);
const animationSpan1 = new MmdAnimationSpan(mmdAnimation1, undefined, duration, 0, 1);
const animationSpan2 = new MmdAnimationSpan(mmdAnimation2, undefined, duration, 0, 1);
compositeAnimation.addSpan(animationSpan1);
compositeAnimation.addSpan(animationSpan2);
```

この場合、**両方のアニメーション**がフレーム0から開始し、`duration`フレームまで再生されます。

### MMD Animation Span

`MmdAnimationSpan`コンストラクタは以下の通りです：

```typescript
new MmdAnimationSpan(animation: MmdBindableAnimation, startFrame?: number, endFrame?: number, offset?: number, weight?: number): MmdAnimationSpan
```

- `animation`：`MmdAnimation`や`MmdModelAnimationContainer`など、カメラやモデルにバインド可能なアニメーションコンテナ
- `startFrame`：アニメーションが開始するフレーム（**デフォルト**：animation.startFrame）
- `endFrame`：アニメーションが終了するフレーム（**デフォルト**：animation.endFrame）
- `offset`：このSpanがComposite Animationで開始するフレーム（**デフォルト**：0）
- `weight`：アニメーションブレンディングに使用される重み（**デフォルト**：1）

`MmdCompositeAnimation`は**複数の**`AnimationSpan`オブジェクトを管理し、各`AnimationSpan`はアニメーション再生中に**動的に追加または削除**できます。

### MMD Composite Animationメソッド

`MmdCompositeAnimation`クラスは以下のメソッドを提供します：

- `addSpan(span: MmdAnimationSpan): void`：`MmdAnimationSpan`を**追加**します。
- `removeSpan(span: MmdAnimationSpan): void`：`MmdAnimationSpan`を**削除**します。
- `removeSpanFromIndex(index: number): void`：インデックスで`MmdAnimationSpan`を**削除**します。
- `get startFrame(): number`：このComposite Animationの開始フレームを**返します**。
- `get endFrame(): number`：このComposite Animationの終了フレームを**返します**。
- `get spans(): readonly MmdAnimationSpan[]`：現在登録されているすべての`MmdAnimationSpan`オブジェクトを**返します**。

### MMD Animation Spanトランジション

`MmdAnimationSpan`は、`weight`プロパティを通じてアニメーションブレンディングに使用される重みを設定できます。さらに、`MmdAnimationSpan`の開始と終了に`transition`フレームを設定して、アニメーション開始時に重みが0から1に、または終了時に1から0に変化することを**スムーズに制御**する**便利機能**が提供されています。

この目的のために、`MmdAnimationSpan`クラスは以下のプロパティを提供します：

- `MmdAnimationSpan.easeInFrameTime`：アニメーション開始時に重みが**0から1に変化**するフレーム数を設定します。
- `MmdAnimationSpan.easeOutFrameTime`：アニメーション終了時に重みが**1から0に変化**するフレーム数を設定します。
- `MmdAnimationSpan.easingFunction`：重み変化に使用されるイージング関数を設定します。**デフォルトは**`null`で、この場合**線形変化**が適用されます。

例えば、MMDアニメーションは30fpsで再生されるため、`easeInFrameTime`と`easeOutFrameTime`の両方を30に設定すると、アニメーション開始時と終了時に**それぞれ1秒間**重みが変化します。

以下は、`easeInFrameTime`と`easeOutFrameTime`の両方を30に設定してトランジションを適用するサンプルコードです：

```typescript
const animationSpan = new MmdAnimationSpan(mmdAnimation1);
animationSpan.easeInFrameTime = 30;
animationSpan.easeOutFrameTime = 30;
const easingFunction = new BezierCurveEase(0.7, 0.01, 0.3, 0.99);
animationSpan.easingFunction = easingFunction;
compositeAnimation.addSpan(animationSpan);
```

## MMD Composite Runtime Animation

`MmdCompositeAnimation`も、他のMMDアニメーションコンテナと同様に`MmdCamera`や`MmdModel`に**バインディング**して使用できます。バインディングのために、アニメーション評価とバインディングを担当する**ランタイムをインポート**する必要があります。

```typescript
import "babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdCompositeRuntimeModelAnimation";
```

その後、`MmdCamera`や`MmdModel`の`createRuntimeAnimation`メソッドを使用して`MmdCompositeAnimation`を**バインディング**できます。

```typescript
const camera: MmdCamera = ...;
const model: MmdModel = ...;

const compositeAnimationHandle: MmdRuntimeAnimationHandle = camera.createRuntimeAnimation(compositeAnimation);
const compositeAnimationHandle: MmdRuntimeAnimationHandle = model.createRuntimeAnimation(compositeAnimation);
```

## 制限事項

MMD Composite Animationは、複数のアニメーションをブレンディングする際に、プロパティパスから評価結果に**直接アクセス**してそれらを読み書きします。

そのため、`MmdWasmRuntime`が提供するWASM側でのアニメーション評価など、アニメーション評価とプロパティへの実際の適用の間に遅延がある機能とは**互換性がありません**。

例えば、`MmdWasmRuntimeModelAnimation`を使用して`MmdWasmAnimation`を評価し、WASM側でアニメーション評価を実行する場合、`MmdCompositeAnimation`との**ブレンディングはサポートされません**。

代わりに、`MmdRuntimeModelAnimation`を使用して`MmdWasmAnimation`を評価する場合、`MmdCompositeAnimation`との**ブレンディングは可能**です。

## サンプルコード

サンプルコードは[compositeAnimationTestScene.ts](https://github.com/noname0310/babylon-mmd/blob/main/src/Test/Scene/compositeAnimationTestScene.ts)で確認できます。

このサンプルコードでは、**UIを通じて重みを調整**でき、静的に設定されたフレーム番号に従って2つのアニメーションが**交互に再生**される様子を見ることができます。
