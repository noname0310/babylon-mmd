---
sidebar_position: 7
sidebar_label: アニメーション
---

# アニメーション

このセクションでは、**MMDアニメーションデータの再生と評価方法**について説明します。

## **MMDアニメーションストレージフォームと評価/バインディングコンポーネント**

MMDアニメーションデータは**主に**`MmdAnimation`オブジェクトとして表現されます。

しかし、**さまざまなフォームに変換して保存**することができ、フォームに応じて評価とバインディングのメソッドが異なります。

**MMDアニメーションデータを保存するさまざまなフォームは以下の通りです：**

| ストレージフォーム | 説明 |
|---|---|
| `MmdAnimation` | MMDアニメーションデータをそのまま保存する**基本フォーム** |
| `MmdWasmAnimation` | `MmdWasmRuntime`での**高速化のための**MMDアニメーションデータのフォーム |
| `MmdAnimationCameraContainer` | MMDアニメーションデータをBabylon.jsの`Animation`オブジェクト**(カメラ用)**に変換したフォーム |
| `MmdAnimationModelContainer` | MMDアニメーションデータをBabylon.jsの`Animation`オブジェクト**(モデル用)**に変換したフォーム |
| `AnimationGroup` | MMDアニメーションデータをBabylon.jsの`AnimationGroup`オブジェクトに変換したフォーム |
| `MmdCompositeAnimation` | **複数のMMDアニメーションデータを組み合わせた**フォーム |

保存されたMMDアニメーションデータをモデルやカメラに適用するには、**評価とバインディングプロセス**が必要です。

アニメーション適用プロセスは**2つの主要なステップ**に分けることができます：評価とバインディングです。
1. **評価**：特定の時間tに対してMMDアニメーションデータを評価し、各ボーンとモーフターゲットの変換と重みの値を計算します。
2. **バインディング**：評価された値をモデルのボーンとモーフターゲットに適用します。
   - 評価されたアニメーション状態は2つの要素に反映されます：
     - モデルの`Bone`の`position`と`rotationQuaternion`プロパティを評価された値に設定
     - モデルの`MmdMorphController`の`setMorphWeightFromIndex`メソッドを適切に呼び出してモーフターゲットの重みを設定

これらの評価とバインディングプロセスを実行するコンポーネントは、**アニメーションのストレージフォームによって異なります**。

**評価とバインディングのコンポーネントは以下の通りです：**

| ストレージフォーム | 評価コンポーネント | バインディングコンポーネント |
|---|---|---|
| `MmdAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdRuntimeModelAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdRuntimeModelAnimation` |
| `MmdWasmAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdWasmRuntimeModelAnimation` または `MmdRuntimeModelAnimation` | `MmdRuntimeCameraAnimation` <br/><br/> `MmdWasmRuntimeModelAnimation` または `MmdRuntimeModelAnimation` |
| `MmdAnimationCameraContainer` <br/><br/> `MmdAnimationModelContainer` | `MmdAnimationCameraContainer` <br/><br/> `MmdAnimationModelContainer` | `MmdRuntimeCameraAnimationContainer` <br/><br/> `MmdRuntimeModelAnimationContainer` |
| `AnimationGroup` | `AnimationGroup` | `AnimationGroup` |
| `MmdCompositeAnimation` | `MmdCompositeRuntimeCameraAnimation` <br/><br/> `MmdCompositeRuntimeModelAnimation` | `MmdCompositeRuntimeCameraAnimation` <br/><br/> `MmdCompositeRuntimeModelAnimation` |

### MMDアニメーション & MMDランタイムアニメーション

MMDランタイムアニメーションは、babylon-mmdが提供するMMDアニメーション評価とバインディングの**基本機能**です。

このクラスは、`MmdAnimation`を**評価**し、モデルとカメラに**バインディング**する機能を提供します。

この目的のために以下の2つのクラスを提供します：
- `MmdRuntimeModelAnimation`：MMDモデルにアニメーションを適用するクラス
- `MmdRuntimeCameraAnimation`：MMDカメラにアニメーションを適用するクラス

このメソッドは、MMDアニメーションを再生する**最も基本的な方法**であり、**優れたパフォーマンス**を提供します。

詳細については、[MMD Animation](./mmd-animation)ドキュメントを参照してください。

### MMD WASMアニメーション & MMD WASMランタイムアニメーション

MMD WASMランタイムアニメーションは、**WebAssemblyで実装された**MMDアニメーション評価とバインディング機能です。

このクラスは、`MmdWasmAnimation`を評価し、モデルにバインディングする機能を提供します。

このメソッドは、MMDアニメーションを再生する方法の中で**最高のパフォーマンス**を提供します。

詳細については、[MMD Animation](./mmd-animation)ドキュメントを参照してください。

### MMD AnimationContainer & MMD Runtime AnimationContainer

MMD AnimationContainerは、Babylon.jsの`Animation`を**使用してMMDアニメーションを評価**し、モデルとカメラに**バインディング**する機能を提供します。

バインディングを可能にするために、`MmdCameraAnimationContainer`と`MmdModelAnimationContainer`クラスのランタイムが提供されます：
- `MmdRuntimeModelAnimationContainer`：MMDモデルにアニメーションを適用するクラス
- `MmdRuntimeCameraAnimationContainer`：MMDカメラにアニメーションを適用するクラス

このメソッドの**利点**は、Babylon.jsのアニメーションコンテナシステムを活用できることです。

詳細については、[Use Babylon.js Animation Runtime](./use-babylonjs-animation-runtime)ドキュメントを参照してください。

### Babylon.js AnimationGroup

Babylon.jsの`AnimationGroup`を使用して、MMDアニメーションの**すべての評価とバインディングを処理**できます。

この目的のために、babylon-mmdは`MmdAnimation`を`AnimationGroup`に**変換**する`MmdModelAnimationContainer.createAnimationGroup`メソッドを提供します。

このメソッドの**利点**は、Babylon.jsのアニメーションシステムを完全に活用できることです。

詳細については、[Use Babylon.js Animation Runtime](./use-babylonjs-animation-runtime)ドキュメントを参照してください。

### アニメーションブレンディング

babylon-mmdは、**フレーム完璧なMMDアニメーションブレンディング**をサポートするアニメーションランタイムを提供します。

この目的のために、`MmdCompositeAnimation`アニメーションコンテナクラスが提供され、それを**評価とバインディング**するために`MmdCompositeRuntimeCameraAnimation`と`MmdCompositeRuntimeModelAnimation`クラスが提供されます。

詳細については、[Animation Blending](./animation-blending)ドキュメントを参照してください。
