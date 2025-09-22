---
sidebar_position: 1
sidebar_label: MMD アニメーション
---

# MMD アニメーション

`MmdAnimation` は MMD モデルやカメラのアニメーションを **格納するためのコンテナー** です。

これを MMD モデルやカメラにバインドすることで **アニメーションを再生** できます。

## アニメーション ランタイム

アニメーション ランタイムは、時刻 t でアニメーション データを **評価し**、MMD モデルやカメラに **バインドする責任を持つエンティティ** です。

いくつかのタイプのランタイムがあり、以下の 2 つのランタイム実装を使用して `MmdAnimation` をバインドできます：

- `MmdRuntimeModelAnimation`: MMD モデル アニメーションをバインドするためのランタイム
- `MmdRuntimeCameraAnimation`: MMD カメラ アニメーションをバインドするためのランタイム

カメラとモデル アニメーション ランタイムが別々に提供される理由は、**効率的なツリーシェイキング** のためです。

MMD モデル アニメーションのみが必要な場合は `MmdRuntimeModelAnimation` のみをインポートでき、カメラ アニメーションのみが必要な場合は `MmdRuntimeCameraAnimation` のみをインポートできます。

アニメーション ランタイムは基本的に、アニメーション コンテナー（`MmdAnimation`）のプロトタイプにバインド メソッドを追加する **サイドエフェクトを実行** することで動作します。

したがって、ランタイムを使用するには、そのサイドエフェクトを実行するために **ランタイムをインポート** する必要があります。

```ts
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
```

## ランタイム アニメーションの作成

ランタイム アニメーションは、`MmdCamera` や `MmdModel` などのバインド先のターゲットによって作成されます。

これは、ランタイム アニメーションが **バインド先に依存する特性** を持つためです。

以下のように `MmdCamera` や `MmdModel` の `createRuntimeAnimation` メソッドを呼び出すことでランタイム アニメーションを作成できます：

```ts
const camera: MmdCamera = ...;
const model: MmdModel = ...;

const cameraAnimationHandle: MmdRuntimeAnimationHandle = camera.createRuntimeAnimation(animation);
const modelAnimationHandle: MmdRuntimeAnimationHandle = model.createRuntimeAnimation(animation);
```

`createRuntimeAnimation` メソッドは引数としてアニメーション コンテナーを受け取り、**ランタイム アニメーション ハンドルを返します**。

ランタイム アニメーション オブジェクト自体ではなく **ハンドル** を返すことに注意することが重要です。

## MMD ランタイム アニメーション ハンドル

ランタイム アニメーションは、アニメーション コンテナーと共にバインド情報を含むオブジェクトです。

このオブジェクトのプロパティにアクセスすることは、通常 **バインドの読み取りや変更時にのみ必要** であり、一般的にはこれらの値を直接変更する必要はありません。

したがって、ランタイム アニメーションは **デフォルトでハンドル オブジェクトを通じて制御** されます。

ランタイム アニメーション オブジェクトにアクセスする必要がある場合は、`MmdCamera` や `MmdModel` の `runtimeAnimations` マップでハンドルをキーとして使用してアクセスできます。

```ts
const cameraRuntimeAnimation = camera.runtimeAnimations.get(cameraAnimationHandle);
const modelRuntimeAnimation = model.runtimeAnimations.get(modelAnimationHandle);
```

## ランタイム アニメーションのライフサイクル

ランタイム アニメーションは `MmdCamera` や `MmdModel` に依存するオブジェクトであるため、バインド先が破棄されると **ランタイム アニメーションも破棄されます**。

ただし、ランタイム アニメーションが不要になった場合は、`MmdCamera` や `MmdModel` の `destroyRuntimeAnimation` メソッドを呼び出すことで **明示的に破棄** できます。

```ts
camera.destroyRuntimeAnimation(cameraAnimationHandle);
model.destroyRuntimeAnimation(modelAnimationHandle);
```

## ランタイム アニメーションの再生

`MmdCamera` や `MmdModel` は **一度に 1 つのランタイム アニメーションのみ再生** できます。
したがって、新しいランタイム アニメーションを再生するには、`setRuntimeAnimation` メソッドを呼び出して **現在再生中のランタイム アニメーションを置き換える** 必要があります。

```ts
camera.setRuntimeAnimation(cameraAnimationHandle);
model.setRuntimeAnimation(modelAnimationHandle);
```

アニメーションの再生を停止したい場合は、`setRuntimeAnimation` メソッドに引数として `null` を渡すことができます。

```ts
camera.setRuntimeAnimation(null);
model.setRuntimeAnimation(null);
```

ランタイム アニメーションは、MMD ランタイムによって **常に同時に評価およびバインド** されます。

したがって、異なる時間に複数のアニメーションを再生したい場合は、**各アニメーションに対して別々の MMD ランタイムを作成** する必要があります。

:::info
コンポジット アニメーションを使用して複数のアニメーションを同時に再生する方法もありますが、この場合内部的には 1 つのランタイム アニメーションのみが再生されています。
:::

## MMD WASM アニメーション

`MmdWasmRuntime` を使用している場合、**WebAssembly（WASM）で実装された** MMD アニメーション評価およびバインド機能を使用して MMD アニメーションを再生することもできます。

この場合、**モーフ ターゲット ウェイトの設定以外のすべてのアニメーション計算** が WASM で処理されるため、**高いパフォーマンス** を期待できます。

MMD WASM アニメーションを使用するには、`MmdWasmRuntimeModelAnimation` ランタイムをインポートしてそのサイドエフェクトを実行する必要があります。

```ts
import "babylon-mmd/esm/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation";
``` 

:::info
WASM 実装は **カメラ アニメーションには提供されていません**。これは、カメラ アニメーションはモデル アニメーションと比較して計算量がはるかに少ないため、WASM で実装しても大幅なパフォーマンス向上は期待できないためです。
:::

その後、アニメーション コンテナーを `MmdWasmAnimation` として作成し、`MmdWasmModel` に **バインド** します。

```ts
const wasmModel: MmdWasmModel = ...;
const wasmAnimation = new MmdWasmAnimation(mmdAnimation);
const wasmModelAnimationHandle = wasmModel.createRuntimeAnimation(wasmAnimation);
```

:::warning

WASM 側でアニメーション データに直接アクセスするため、`MmdWasmAnimation` は **内部的に `MmdAnimation` データを WASM メモリーにコピーして格納** します。

したがって、`MmdWasmAnimation` が持つすべての `TypedArray` データは **`WebAssembly.Memory` オブジェクトのメモリー バッファーを参照** しています。

その結果、マルチスレッド シナリオでこの `TypedArray` データにアクセスすることは **非常に危険** です。

:::

### MMD WASM アニメーション使用時の注意点

注意すべき重要な点は、`MmdWasmAnimation` のメモリー管理は **GC によって自動的に処理されない** ため、使用しなくなった場合は `dispose` メソッドを呼び出して **明示的にメモリーを解放** する必要があることです。

```ts
wasmAnimation.dispose();
```
