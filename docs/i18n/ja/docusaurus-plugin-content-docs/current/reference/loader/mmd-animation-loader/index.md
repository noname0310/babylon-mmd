---
sidebar_position: 2
sidebar_label: MMDアニメーションローダー (VmdLoader, VpdLoader)
---

# MMDアニメーションローダー (VmdLoader, VpdLoader)

このセクションでは、**MMDアニメーションファイル**（**VMD**、**VPD**）をロードするために使用されるコンポーネントについて説明します。

**MMDアニメーション**は **`VmdLoader`** でロードでき、ポーズデータも **`VpdLoader`** を使用してアニメーションとしてロードできます。

## VmdLoader

**`VmdLoader`** は、MMDアニメーションファイル形式である**ボーカロイドモーションデータ（VMD）**ファイルをロードするために使用されます。このローダーはVMDファイルからアニメーションデータを読み取り、babylon-mmdランタイムに適用できる形式でロードします。

**`VmdLoader`** はVMDファイルを解析して **`MmdAnimation`** インスタンスを返す複数のメソッドを提供しており、最も基本的なメソッドは **`loadAsync`** です。

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = await vmdLoader.loadAsync("motion1", "path/to/motion1.vmd");
```

**`loadAsync`** メソッドが受け取るパラメータは以下の通りです：

- **`name`**: アニメーションの名前。
- **`fileOrUrl`**: VMDファイルのURLを`string`または`string[]`、あるいは`File`または`File[]`として指定。
- **`onProgress`**: ロード進捗を定期的に通知するコールバック関数。

ここで注目すべき重要なポイントは、単一の **`MmdAnimation`** インスタンスを作成するために複数のアニメーションソースを受け取ることができることです。例えば、複数のVMDファイルを1つの **`MmdAnimation`** にロードできます。

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = await vmdLoader.loadAsync("motion1", [
  "path/to/motion1.vmd",
  "path/to/motion2.vmd"
]);
```

この場合、2つのモーションが結合され、配列内で先に登場するモーションが優先されます。つまり、両方のモーションが同じフレームにキーフレームを持つ場合、配列内で最初に登場するモーションのキーフレームが使用されます。

また、ブラウザの **File API**を使用してロードすることもできます。

さらに、以下のメソッドも提供されています：

- **`load`**: VMDファイルを同期的にロードし、onLoadおよびonErrorコールバックをサポート。
- **`loadFromBufferAsync`**/**`loadFromBuffer`**: 複数の**`ArrayBuffer`** インスタンスを解析して**`MmdAnimation`** をロード。
- **`loadFromVmdDataAsync`**/**`loadFromVmdData`**: 複数の**`VmdData`** インスタンスから**`MmdAnimation`** をロード。
- **`loadFromVmdObjectAsync`**/**`loadFromVmdObject`**: 複数の**`VmdObject`** インスタンスから**`MmdAnimation`** をロード。

これらすべてのメソッドをまとめると、**`VmdLoader`** がサポートする入力データ形式は以下のようになります：

- VMDファイル（**`File`** または**`File[]`**、**`string`** または**`string[]`**）
- アレイバッファ（**`ArrayBuffer`** または**`ArrayBuffer[]`**）
- VMDデータ（**`VmdData`** または**`VmdData[]`**）
- VMDオブジェクト（**`VmdObject`** または**`VmdObject[]`**）

ここで、**`VmdData`** と **`VmdObject`** は以下のような型です：

- **`VmdData`**: VMDデータを持つバッファを表すコンテナ型
- **`VmdObject`**: 遅延解析されるVMDデータオブジェクト

これらを使用して、解析メソッドを明示的に呼び出して **`MmdAnimation`** を作成することができます：

```typescript
const arrayBuffer = await fetch("path/to/motion1.vmd")
    .then(response => response.arrayBuffer());

const vmdData = VmdData.CheckedCreate(arrayBuffer);
if (vmdData === null) {
    throw new Error("VMDデータの検証に失敗しました");
}

const vmdObject = VmdObject.Parse(vmdData);

const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadFromVmdObjectAsync("motion1", vmdObject);
```

このように、すべてのプロセスを明示的に呼び出してロードできるようにすることで、babylon-mmdはロード過程での修正や、完全に異なるコンテナにロードする新しいロジックの記述を可能にする拡張性を提供しています。

さらに、**`VmdLoader`** は以下のオプションを提供します：

- **`VmdLoader.optimizeEmptyTracks`**: アニメーションに影響を与えないトラックを最適化して削除するかどうかを設定します。デフォルトは`true`です。
- **`VmdLoader.loggingEnabled`**: ロード処理中のログ出力を有効にします。値が`false`の場合、発生した問題に関するログは生成されません。デフォルトは`false`です。

## VpdLoader

**`VpdLoader`** は、MMDポーズデータファイル形式である**ボーカロイドポーズデータ（VPD）**ファイルをロードするために使用されます。このローダーはVPDファイルからポーズデータを読み取り、babylon-mmdランタイムに適用できる形式でロードします。

**`VpdLoader`** も **`VmdLoader`** と同様に、**`MmdAnimation`** を返す複数のメソッドを提供しています。最も基本的なメソッドは **`loadAsync`** です。

```typescript
const vpdLoader = new VpdLoader();
const mmdAnimation: MmdAnimation = await vpdLoader.loadAsync("pose1", "path/to/pose1.vpd");
```

このとき作成されるアニメーションは1フレームのアニメーションです。

他に提供されるロードメソッドには以下があります：

- **`load`**: VPDファイルを同期的にロードし、onLoadおよびonErrorコールバックをサポート。
- **`loadFromBufferAsync`**/**`loadFromBuffer`**: **`ArrayBuffer`** インスタンスを解析して **`MmdAnimation`** をロード。
- **`loadFromVpdObjectAsync`**/**`loadFromVpdObject`**: **`VpdObject`** インスタンスから **`MmdAnimation`** をロード。

**`VmdLoader`** とは異なり、**`VpdLoader`** は一度に複数のVPDファイルをロードすることをサポートしていません。

**`VpdLoader`** がサポートする入力データ形式は以下の通りです：

- VPDファイル（**`File`** または**`string[]`**）
- アレイバッファ（**`ArrayBuffer`**）
- VPDオブジェクト（**`VpdObject`**）

ここで、**`VpdObject`** はVPDファイルから解析されたデータを表すオブジェクトです。

VMDとは異なり、VPDファイルは遅延解析をサポートしていないため、VpdObjectはクラスではなくJavaScriptオブジェクトとして表されます。

これを使用して、解析メソッドを明示的に呼び出して **`MmdAnimation`** を作成する方法は以下の通りです：

```typescript
const arrayBuffer = await fetch("path/to/pose1.vpd")
    .then(response => response.arrayBuffer());

const textDecoder = new TextDecoder("shift_jis");

const text = textDecoder.decode(arrayBuffer);

const vpdObject = VpdReader.Parse(text);

const vpdLoader = new VpdLoader();
const mmdAnimation = await vpdLoader.loadFromVpdObjectAsync("pose1", vpdObject);
```

また、**`VpdLoader.loggingEnabled`** オプションを通じて、ロード処理中のログ出力を有効にすることができます。このオプションのデフォルト値は`false`です。

## MmdAnimation

基本的に、**MMDアニメーション**はBabylon.jsのアニメーションランタイムとは別のアニメーションランタイムで実行されます。これは、MMDアニメーションとBabylon.jsアニメーションランタイム間の仕様の違いが統合するには大きすぎるためです。

したがって、MMDアニメーションを格納するコンテナも、デフォルトではBabylon.jsの **`Animation`** や **`AnimationGroup`** ではなく、babylon-mmdが提供する **`MmdAnimation`** を使用します。

**`MmdAnimation`** のプロパティは以下の通りです：

|プロパティ名|型|説明|
|---|---|---|
|**`name`**|**`string`**|アニメーションの名前|
|**`boneTracks`**|**`MmdBoneAnimationTrack[]`**|ボーンの位置と回転アニメーショントラックのリスト|
|**`movableBoneTracks`**|**`MmdMovableBoneAnimationTrack[]`**|ボーンの回転アニメーショントラックのリスト|
|**`morphTracks`**|**`MmdMorphAnimationTrack[]`**|モーフアニメーショントラックのリスト|
|**`propertyTrack`**|**`MmdPropertyAnimationTrack`**|表示状態とIK切り替えアニメーショントラック|
|**`cameraTrack`**|**`MmdCameraAnimationTrack`**|カメラアニメーショントラック|

:::info
すべてのアニメーショントラックはTypedArrayで表され、デフォルトでは不変であることが前提とされています。

これは後述するWebAssemblyに関連する最適化を容易にするための制約です。データを修正しても安全だとわかっている場合は、問題なくトラック値を変更できます。
:::

**`MmdAnimation`** の注目すべき点は、モデルアニメーションを表す4つのトラックタイプ（**`boneTracks`**、**`movableBoneTracks`**、**`morphTracks`**、**`propertyTrack`**）とカメラアニメーションを表す **`cameraTrack`** が分離されていることです。

そのため、vmdアニメーションをロードする際、モデルアニメーションとカメラアニメーションを単一の **`MmdAnimation`** インスタンスにロードすることができます。

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = await vmdLoader.loadAsync("motion1", [
    "path/to/model/anim.vmd",
    "path/to/camera/anim.vmd"
]);
```

この場合、アニメーションは後でMMDモデルとカメラの両方に適用できます。
