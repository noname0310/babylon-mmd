---
sidebar_position: 2
sidebar_label: Babylon.js アニメーション ランタイムの使用
---

# Babylon.js アニメーション ランタイムの使用

Babylon.js のアニメーション システムを使用して MMD アニメーションを再生すると、以下の **利点** があります：
- **Babylon.js アニメーション カーブ エディター** サポート
- **アニメーション ブレンディング** サポート
- **より汎用的な** アニメーション管理

したがって、babylon-mmd は Babylon.js のアニメーション システムを使用して MMD アニメーションを再生する方法を提供します。

## Babylon.js アニメーション システム アーキテクチャ

まず、Babylon.js のアニメーション システム アーキテクチャの **機能** を理解する必要があります。

<!-- https://play.d2lang.com/?script=UnLMy8xNLMnMzzNU4kJwjJA5xkpcMF5iUk6qoZKVQjWXgoJSUGleSWZuKrIJWESNsIoaK3HVciFbrmCjq4BiiR4285FdSIQONG8QoWMg_GpEsl-NSParETF-xeYMBV07BaWQxKL01BJDDaf8vFSF_CIF3_yiggyIoCaqIUaEDDHCZQggAAD__w%3D%3D&layout=elk& -->

### Babylon.js アニメーション

Babylon.js では、アニメーションは **主に** `Animation` オブジェクトを使用して表現されます。

`Animation` オブジェクトは、特定のプロパティの **アニメーション キーフレームを格納するコンテナー** です。

アニメーションによって制御できるタイプは **8 種類** あります：

- `Float` (数値)
- `Vector3`
- `Quaternion`
- `Matrix`
- `Color3`
- `Color4`
- `Vector2`
- `Size`

各タイプは **異なる補間メソッド** を使用します。

例えば、`Float` タイプは **線形補間** を使用し、`Quaternion` タイプは **球面線形補間（SLERP）** を使用します。

`Animation` オブジェクトは、時刻 t の **値を評価する** `_interpolate` メソッドを提供します。

ただし、アニメーションをバインド ターゲットに適用するロジックは **含まれていません**。

### Babylon.js ランタイム アニメーション

`RuntimeAnimation` は、`Animation` オブジェクトを **実際に評価** し、ターゲットに **バインドする** ことを担当します。

アニメーション評価ロジックの一部と **バインド パス解決** のロジックが `RuntimeAnimation` オブジェクトに実装されています。

### Babylon.js Animatable

`Animatable` は、**複数の** `RuntimeAnimation` オブジェクトを管理し、シーンのレンダリング ループと同期して **アニメーションを更新** することを担当します。

**複雑なアニメーション ブレンディング ロジック** もここで処理されます。（Babylon.js はアニメーション ブレンディングをサポートしています。）

したがって、`Animatable` オブジェクトを使用して **複数の** `RuntimeAnimation` オブジェクトを同時に再生し、以下のように MMD モデル アニメーションを再生できます：

<!-- https://play.d2lang.com/?script=UnLMy8xNLElMykk1VLJSqOZSUFAKKs0rycxNhchk5ufBJBQUlJDEuBQUarGpNsKi2ginamMsqo0hqmu5uFBcp4fFYQq6dgpKIYlF6aklhhpO-XmpmkpWCkmZeSmEtBohazXS8M0vKsiAcIg1wRjZBGMN39TiDIWwzOLEpMyczJJKuCmAAAAA__8%3D&layout=elk& -->

![Animatable Diagram](@site/docs/reference/runtime/animation/use-babylonjs-animation-runtime/animatable-diagram.png)
*この図は、`Animatable`、`RuntimeAnimation`、`Animation` オブジェクトとバインド ターゲット間の **参照関係** を示しています。*

babylon-mmd は `Animatable` オブジェクト アプローチを **直接使用していない** ため、実際の図は多少異なります。

### Babylon.js アニメーション グループ

`AnimationGroup` は、`Animation` オブジェクトとバインド ターゲットを **ペアとして管理** するコンテナーです。

![Animation Group Diagram](@site/docs/reference/runtime/animation/use-babylonjs-animation-runtime/animation-group-diagram.png)
*この図は、`AnimationGroup` が `Animation` オブジェクトとバインド ターゲットを **ペアとして管理** する方法を示しています。*

`AnimationGroup` は **内部で** `Animatable` オブジェクトを使用してアニメーションを再生します。使いやすくするために **高レベルの API** を提供します。

<!-- https://play.d2lang.com/?script=jNCxCsJADAbg_Z4i3G7BjB0EJ3fxBa40SMCmUtNJ-u5Cz6vXI1XHJvnTL-ePwl1Q7uU09ON972t4OgB_CcOVlNqlnToAPqvFQhyevyZnptFI4yqNMT05954IzY0WznkU5Y5-a_INn6Mq6x7YHaD4F8tDgygHpcJRGYR5Qbq9hoaldasYbvE3n-NvPpZ8_MJHg485HxP_FQAA__8%3D&layout=elk& -->
![Animation Group With Animatable Diagram](@site/docs/reference/runtime/animation/use-babylonjs-animation-runtime/animation-group-with-animatable-diagram.png)
*この図は、`AnimationGroup` が **内部で** `Animatable` オブジェクトを使用してアニメーションを再生する方法を示しています。*

## Babylon.js アニメーション システムを使用した MMD アニメーションの再生

Babylon.js のアニメーション システムを使用して MMD アニメーションを再生するために提供される **2 つの主要な方法** があります：

1. `Animation` オブジェクトの `_interpolate` メソッドを使用したアニメーション評価後の **直接バインド**
2. `AnimationGroup` オブジェクトを使用した **アニメーション評価とバインド**

各方法の **利点と欠点** は以下の通りです：

| 方法 | 利点 | 欠点 |
|---|---|---|
| 方法 1 <br/> (`Animation` の使用) | **Babylon.js アニメーション カーブ エディター** サポート | `MmdAnimation` と比較して **パフォーマンス低下** と **メモリー使用量増加** |
| 方法 2 <br/> (`AnimationGroup` の使用) | Babylon.js アニメーション システムの **すべての機能** が利用可能 | 方法 1 と比較して **より大きなパフォーマンス低下** と **より多くのメモリー使用量** |

これらの 2 つの方法を使用して MMD アニメーションを再生する方法を見てみましょう。

### アニメーション コンテナー クラス

`Animation` オブジェクトは、単一のプロパティの **アニメーション キーフレームを格納する** コンテナーです。

ただし、私たちが扱う MMD アニメーションには **複数のプロパティのアニメーション キーフレーム** が含まれています。

したがって、babylon-mmd は複数の `Animation` オブジェクトを **一緒に管理** するコンテナー クラス `MmdCameraAnimationContainer` と `MmdModelAnimationContainer` を提供します。

`MmdCameraAnimationContainer` と `MmdModelAnimationContainer` は、それぞれ `MmdCamera` と `MmdModel` に適用されるように設計された `Animation` オブジェクトの **コレクション** を管理します。

これらは以下のように作成されます：

```typescript
const modelBezierBuilder = new MmdModelAnimationContainerBezierBuilder();
const cameraBezierBuilder = new MmdCameraAnimationContainerBezierBuilder();

const mmdModelAnimationContainer = new MmdModelAnimationContainer(mmdAnimation, modelBezierBuilder);
const mmdCameraAnimationContainer = new MmdCameraAnimationContainer(mmdAnimation, cameraBezierBuilder);
```

アニメーション コンテナーを作成する際に **ビルダーが一緒に渡される** ことに **注意** してください。

これは、Babylon.js のアニメーション システムが MMD アニメーションの補間メソッドを **完全にはサポートしていない** ためです。

Babylon.js は キーフレーム間のベジェ補間を **サポートしておらず**、デフォルトで提供される **3 つの主要な補間メソッド** は以下の通りです：
- Linear（線形）
- Step（ステップ）
- Hermite（エルミート）

エルミート補間は inTangent と outTangent を使用して **三次スプライン補間** を実装しており、ベジェ補間と比較して **自由度が低い** です。

したがって、babylon-mmd はベジェ補間をサポートするために **3 つのオプション** を提供します：

- `Mmd(Model/Camera)AnimationContainerHermiteBuilder`: **エルミート補間** を使用して `Mmd(Model/Camera)AnimationContainer` を作成します。
  - この方法は、ベジェ補間タンジェントをエルミート補間タンジェントに **近似** します。この方法は **精度が低く**、特にカメラ アニメーションで大きな違いが生じる場合があります。
- `Mmd(Model/Camera)AnimationContainerSampleBuilder`: ベジェ補間を線形補間で **近似** します。
  - この方法は、ベジェ カーブを 30 フレーム間隔で **サンプリング** し、線形補間で近似します。この方法は **高精度** ですが **メモリー使用量が増加** します。また、アニメーションが **編集不可能** になるという欠点もあります。
- `Mmd(Model/Camera)lAnimationContainerBezierBuilder`: ベジェ補間を **正確に実装** します。
  - この方法は、`Animation` オブジェクトの `_interpolate` メソッドを **オーバーライド** することでベジェ補間を正確に実装します。これは **最も正確な** 方法ですが、`Animation` オブジェクトの `_interpolate` メソッドをオーバーライドして存在しない補間メソッドを強制的に追加するため、**アニメーション カーブ エディター などのツールが正常に動作しない** 場合があります。


作成された `MmdModelAnimationContainer` と `MmdCameraAnimationContainer` は、それぞれ `MmdModel` と `MmdCamera` に **バインド** できます。バインド方法に応じて、`Animation` オブジェクトの `_interpolate` メソッドのみを **使用するか**、`AnimationGroup` を通じて `RuntimeAnimation` と `Animatable` オブジェクトを使用するかが決まります。

### 方法 1: `Animation` オブジェクトの使用

babylon-mmd は、`MmdModelAnimationContainer` と `MmdCameraAnimationContainer` を **直接バインド** するランタイム実装を提供します。

これは、`"babylon-mmd/esm//Runtime/Animation/mmdRuntimeCameraAnimationContainer"` と `"babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationContainer"` モジュールをインポートすることで使用できます。

```typescript
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimationContainer";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationContainer";
```

これにより、`MmdAnimation` をバインドするのと **同じ方法** で、`MmdCamera` と `MmdModel` オブジェクトの `createRuntimeAnimation` メソッドを使用して `Mmd(Camera/Model)AnimationContainer` をバインドできます。

```typescript
const camera: MmdCamera = ...;
const model: MmdModel = ...;

const cameraAnimationHandle = camera.createRuntimeAnimation(mmdCameraAnimationContainer);
const modelAnimationHandle = model.createRuntimeAnimation(mmdModelAnimationContainer);
```

### 方法 2: `AnimationGroup` オブジェクトの使用

`MmdModelAnimationContainer` と `MmdCameraAnimationContainer` は、`AnimationGroup` オブジェクトを **作成する** ための `createAnimationGroup` メソッドを提供します。

```typescript
const modelAnimationGroup = mmdModelAnimationContainer.createAnimationGroup("modelAnimation", mmdModel);
const cameraAnimationGroup = mmdCameraAnimationContainer.createAnimationGroup("cameraAnimation", mmdCamera);
```

これで、`AnimationGroup` API を使用して **アニメーションを再生** できます。

```typescript
modelAnimationGroup.play(true);
cameraAnimationGroup.play(true);
```

`AnimationGroup` オブジェクトは、再生だけでなく複数のアニメーションのブレンディングを含む **複数の機能** を提供します。詳細については、[Babylon.js 公式ドキュメント](https://doc.babylonjs.com/features/featuresDeepDive/animation/groupAnimations/) を参照してください。

:::info
`AnimationGroup` オブジェクトを使用してアニメーションを再生する場合、**MMD ランタイムはもはや** アニメーションの実行エンティティではないため、MMD ランタイムにオーディオを追加しても **オーディオとアニメーションは同期されません**。
:::
