---
sidebar_position: 3
sidebar_label: MMD WebAssembly ランタイム
---

# MMD WebAssembly ランタイム

このセクションでは、**WebAssembly** (WASM) で実装されたMMDランタイムの使用方法について説明します。

babylon-mmdは**WASM**で実装されたMMDランタイムを提供します。

<!-- ![WebAssembly Architecture](./wasm-architecture.png) -->

import WebAssemblyArchitecture from "@site/docs/reference/runtime/mmd-webassembly-runtime/wasm-architecture.png";

<img src={WebAssemblyArchitecture} style={{width: 400}} />

*この図は、babylon-mmdのWebAssemblyランタイムのアーキテクチャを示しています。*

このWASMランタイムは、元の`MmdRuntime`クラスのJavaScriptインプリメンテーションを**Rust**で**完全に書き直し**、WASMにコンパイルしたものです。

WASMランタイムは、様々な最適化テクニックを適用することで、JavaScriptランタイムよりも**優れたパフォーマンス**を提供します。

適用されている最適化テクニックは以下の通りです：

- IKソルバー以外のすべてのオペレーションを**float32**で処理。
- **128ビットSIMD**インストラクションを使用してベクターオペレーションを並列処理。
- **ワーカーベースのマルチスレッディング**を採用し、モデルごとに並列処理を実行。
- **Bullet Physics**エンジンをFFIでバインドし、物理シミュレーションを処理（emscriptenを使用せず）。

## MmdWasmInstance

WASMランタイムを使用するには、まずbabylon-mmdが提供する**WASMバイナリをロード**する必要があります。これは`getMmdWasmInstance()`ファンクションを使用して行うことができます。

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```

`getMmdWasmInstance()`ファンクションは**非同期でWASMバイナリをロード**し、WASMモジュールインスタンスを返します。

babylon-mmdでは、バイナリを選択する際に**3つのオプション**を提供します：

- **シングルスレッド**または**マルチスレッド**：S / M
- **Bullet Physics**含む、または含まない：P / （なし）
- **リリースビルド**または**デバッグビルド**：R / D

そのため、**8つのWASMインスタンスタイプ**のうち1つを選択できます：

- `MmdWasmInstanceTypeSR`：シングルスレッド、リリースビルド
- `MmdWasmInstanceTypeSD`：シングルスレッド、デバッグビルド
- `MmdWasmInstanceTypeMR`：マルチスレッド、リリースビルド
- `MmdWasmInstanceTypeMD`：マルチスレッド、デバッグビルド
- `MmdWasmInstanceTypeSPR`：シングルスレッド、フィジックス、リリースビルド
- `MmdWasmInstanceTypeSPD`：シングルスレッド、フィジックス、デバッグビルド
- `MmdWasmInstanceTypeMPR`：マルチスレッド、フィジックス、リリースビルド
- `MmdWasmInstanceTypeMPD`：マルチスレッド、フィジックス、デバッグビルド

使用シナリオに適したバイナリを選択できます。

理論的には、**最高のパフォーマンス**を持つバイナリは`MmdWasmInstanceTypeMPR`（マルチスレッド、フィジックス、リリースビルド）です。

ただし、`SharedArrayBuffer`をサポートしていない環境では、**マルチスレッディングが動作しない**ため、シングルスレッドバージョンを使用する必要があります。

物理シミュレーションが不要な場合は、**フィジックスエンジンなし**のバイナリを選択して、ロード時間を短縮できます。

また、開発時には、ランタイム内で発生するエラーを追跡するために**デバッグビルド**の使用が推奨されます。リリースビルドでは、パニックが発生した際のエラー診断が困難です。

:::info
フィジックスエンジンなしのバイナリを選択した場合でも、`MmdPhysics`、`MmdAmmoPhysics`、または`MmdBulletPhysics`クラスを使用して物理シミュレーションを処理することは可能です。ただし、フィジックスエンジンが含まれたバイナリを使用する場合と比較して、パフォーマンスが劣る可能性があります。
:::

## MmdWasmRuntimeクラス

`MmdWasmRuntime`クラスは、WASMで実装されたMMDランタイムクラスで、`MmdRuntime`クラスと**ほぼ同じAPI**を提供します。

使用するには、単純に元の`MmdRuntime`クラスの代わりに`MmdWasmRuntime`クラスを使用し、**`MmdWasmInstance`をコンストラクタに渡す**だけです。

```typescript
const mmdWasmRuntime = new MmdWasmRuntime(mmdWasmInstance, scene);
```

そうすると、タイプが自動的に伝播され、`createMmdModel`ファンクションの戻り値のタイプも`MmdWasmModel`タイプになります。

## MmdWasmAnimationクラス

WASMランタイムでデータを処理するには、データを**WASMメモリースペースにコピー**する必要があります。

しかし、`MmdAnimation`コンテナは**JavaScript側**のArrayBufferインスタンスにデータを格納します。

そのため、`MmdAnimation`に格納されたアニメーションデータは、WASM側で**評価することができません**。この場合、**アニメーション評価**はJavaScript側で処理され、その後**IKソルブ**、**アペンドトランスフォーム**、**ボーンモーフ**、**物理シミュレーション**がWASM側で処理されます。

<!-- https://play.d2lang.com/?script=tJHPavMwEMTveoph758_2mMPBQea0pZAwYGcFWfdCPTHrCRDKHn3Upk2TnBKL71ptbszP3aozSLs01K047VxTPh3D3rWg25aMX2iihbcBWG87g_RtBFN0m-MG1JqOnaHdwVcmx27ANXeOJ1M8HgYtM3lSQo4qqNStOFtHSO7rT38KHh7EnyUkHusgvR7_McieB4LGttNsAPj6eWsrPue_Q5r0T52QdwIUNyytZy-3E4u3_bGZTuB_typu8RyDvhnePPHKJFdoJe_ObRy6N_kWxSmiVTX_C-Sq2Z9i9zSeG2xCWJ3WOkkpuVI6iMAAP__&layout=elk& -->
<!-- ![MmdAnimation Pipeline](mmdanimation-pipeline.png) -->

import MmdAnimationPipeline from "@site/docs/reference/runtime/mmd-webassembly-runtime/mmdanimation-pipeline.png";

<img src={MmdAnimationPipeline} style={{width: 600}} />

*この図は、MmdAnimationデータがWASMメモリースペースにコピーされていない場合のアニメーション評価の処理方法を示しています。*

babylon-mmdでは、**アニメーションデータのコピー**をWASMメモリースペースにサポートするため、`MmdWasmAnimation`クラスを提供します。これにより、アニメーション評価を含む**ほぼすべてのアニメーション計算**が**WASM側**で処理されます。

<!-- https://play.d2lang.com/?script=rJBBSwMxEIXv-RWPuVvvHoQtWBEpCC30nG5nbSDJLJOkUKT_XcxqpUu8ecvke8N8POqLKse8Uht46wIT7h5BO953KXHY-zMtaMmDKOPteE6uT9hk-85kzE3qAR8GaEcnBlAXXbDZScTTyfpSnzShZ5UyYi06HnGPpUSehm-8EX9ivLzejN04cjxgqzamQTR8wYupGsV7zj8avwJXLxeKv56fdrohs_5l_s96rZZq8TPx-tcSM5dZ_4tmrO6vXLQeO1F_wNpmdT0nMp8BAAD__w%3D%3D&layout=elk&theme=0& -->
<!-- ![MMD Wasm Animation Pipeline](mmdwasmanimation-pipeline.png) -->

import MmdWasmAnimationPipeline from "@site/docs/reference/runtime/mmd-webassembly-runtime/mmdwasmanimation-pipeline.png";

<img src={MmdWasmAnimationPipeline} style={{width: 600}} />

*この図は、MmdWasmAnimationデータがWASMメモリースペースにコピーされた場合のアニメーション評価の処理方法を示しています。*

これを行うには、単純に`MmdWasmAnimation`インスタンスを作成し、MMDモデルにバインドします。

```typescript
const mmdWasmAnimation = new MmdWasmAnimation(mmdAnimation, mmdWasmInstance, scene);

const runtimeAnimationHandle = mmdWasmModel.createRuntimeAnimation(mmdWasmAnimation);
mmdWasmModel.setRuntimeAnimation(runtimeAnimationHandle);
```

この方法で、アニメーション評価がWASM側で処理され、**可能なすべてのアニメーション計算**がWASM側で処理されることが保証されます。

:::info
`MmdAnimation`とは異なり、`MmdWasmAnimation`では**手動でのメモリー解放**が必要です。

不要になった場合は、`MmdWasmAnimation.dispose()`メソッドを呼び出して**メモリーを解放**してください。
:::

## バッファード評価

WASMランタイムは**バッファード評価**をサポートしており、この機能は、マルチスレッディングランタイム（例：MR、MPD）を使用する際に、レンダリングとは**別のスレッド**でアニメーション計算を処理します。

この機能は**デフォルトで無効**になっています。有効にするには、`MmdWasmRuntime.evaluationType`プロパティを`MmdWasmRuntimeAnimationEvaluationType.Buffered`に設定します。

```typescript
mmdWasmRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Buffered;
```

バッファード評価が有効になると、アニメーション計算は**1フレーム遅延**で処理され、レンダリングスレッドは**前のフレーム**から計算された結果を使用します。これは、レンダリングスレッドがアニメーション計算を待つことなく、すぐにレンダリングを実行できるようにする**パイプライン技術**の一種です。

以下は、バッファード評価とイミディエート評価の違いを示すイメージです：

<!-- ![Buffered Evaluation VS Immediate Evaluation](buffered-vs-immediate.png) -->

import BufferedVsImmediate from "@site/docs/reference/runtime/mmd-webassembly-runtime/buffered-vs-immediate.jpg";

<img src={BufferedVsImmediate} style={{width: 600}} />

*この図は、バッファード評価とイミディエート評価の違いを示しています。*

## 制限事項

WebAssemblyにコンパイルされたコードは、JavaScriptコードとは異なり、**プロトタイプを変更**したり、**継承**を通じて動作を変更することができません。

したがって、**高レベルのカスタマイゼーション**が必要な場合は、WebAssemblyランタイムではなく、JavaScriptランタイムの使用が推奨されます。

## 詳細情報

[Enhancing Browser Physics Simulations: WebAssembly and Multithreading Strategies](https://ieeexplore.ieee.org/document/11071666)

この論文では、babylon-mmdのWebAssemblyランタイムの最適化に適用された**様々な技術**について説明しており、このページで使用されている画像の一部も、この論文から抜粋されています。

この論文では、使用された最適化技術についての**詳細な説明**と、その結果としてどの程度の**パフォーマンス向上**が達成されたかについて説明されています。
