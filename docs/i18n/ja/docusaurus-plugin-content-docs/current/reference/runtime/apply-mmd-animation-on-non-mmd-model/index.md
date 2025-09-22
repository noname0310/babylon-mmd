---
sidebar_position: 9
sidebar_label: 非MMDモデルにMMDアニメーションを適用
---

# 非MMDモデルにMMDアニメーションを適用

MMDアニメーションは、一般的に**準標準ボーン構造**に従うMMDモデルと互換性があるように設計されています。

しかし、babylon-mmdは**ヒューマノイドモデル**にMMDアニメーションを適用することもサポートしています。

## ヒューマノイドモデル

ヒューマノイドモデルは、**UnityのHumanoid Rig**と**Mixamo rig**のボーン構造に従うモデルを指します。

ヒューマノイドモデルのボーン構造は以下の通りです：

```typescript title="babylon-mmd/Loader/Util/mmdHumanoidMapper.ts"
/**
 * refs:
 * https://docs.unity3d.com/ScriptReference/HumanBodyBones.html
 * https://github.com/V-Sekai/three-vrm-1-sandbox-mixamo/blob/master/mixamoVRMRigMap.js
 *
 * unity humanoid bone structure:
 *
 * - Hips
 *     - Spine
 *         - Chest
 *             - UpperChest
 *                 - Neck
 *                     - Head
 *                         - LeftEye
 *                         - RightEye
 *                         - Jaw
 *
 *                 - LeftShoulder
 *                     - LeftUpperArm
 *                         - LeftLowerArm
 *                             - LeftHand
 *                                 - LeftThumbProximal
 *                                     - LeftThumbIntermediate
 *                                         - LeftThumbDistal
 *                                 - LeftIndexProximal
 *                                     - LeftIndexIntermediate
 *                                         - LeftIndexDistal
 *                                 - LeftMiddleProximal
 *                                     - LeftMiddleIntermediate
 *                                         - LeftMiddleDistal
 *                                 - LeftRingProximal
 *                                     - LeftRingIntermediate
 *                                         - LeftRingDistal
 *                                 - LeftLittleProximal
 *                                     - LeftLittleIntermediate
 *                                         - LeftLittleDistal
 *
 *                 - RightShoulder
 *                     - RightUpperArm
 *                         - RightLowerArm
 *                             - RightHand
 *                                 - RightThumbProximal
 *                                     - RightThumbIntermediate
 *                                         - RightThumbDistal
 *                                 - RightIndexProximal
 *                                     - RightIndexIntermediate
 *                                         - RightIndexDistal
 *                                 - RightMiddleProximal
 *                                     - RightMiddleIntermediate
 *                                         - RightMiddleDistal
 *                                 - RightRingProximal
 *                                     - RightRingIntermediate
 *                                         - RightRingDistal
 *                                 - RightLittleProximal
 *                                     - RightLittleIntermediate
 *                                         - RightLittleDistal
 *
 *     - LeftUpperLeg
 *         - LeftLowerLeg
 *             - LeftFoot
 *                 - LeftToes
 *
 *     - RightUpperLeg
 *         - RightLowerLeg
 *             - RightFoot
 *                 - RightToes
 */
```

## Humanoid MMD

`HumanoidMmd`は、ヒューマノイドモデルにMMDアニメーションを適用するための**ヘルパークラス**です。

このクラスを使用して、**プロキシ準標準スケルトン**を作成して`MmdModel`を生成し、**リアルタイムリターゲティング**を使用してヒューマノイドモデルにMMDアニメーションを適用できます。

```typescript
const mmdRuntime = new MmdRuntime(scene);

const humanoidMmd = new HumanoidMmd();
const mmdModel = humanoidMmd.createMmdModelFromHumanoid(
    mmdRuntime,
    modelRoot,
    [modelMesh],
    {
        boneMap: new MmdHumanoidMapper({
            hips: "Hips",
            spine: "Spine",
            chest: "Chest",
            neck: "Neck",
            head: "Head",
            leftShoulder: "LeftShoulder",
            leftUpperArm: "LeftUpperArm",
            leftLowerArm: "LeftLowerArm",
            leftHand: "LeftHand",
            rightShoulder: "RightShoulder",
            rightUpperArm: "RightUpperArm",
            rightLowerArm: "RightLowerArm",
            rightHand: "RightHand",
            leftUpperLeg: "LeftUpperLeg",
            leftLowerLeg: "LeftLowerLeg",
            leftFoot: "LeftFoot",
            leftToes: "LeftToeBase",
            rightUpperLeg: "RightUpperLeg",
            rightLowerLeg: "RightLowerLeg",
            rightFoot: "RightFoot",
            rightToes: "RightToeBase",

            leftEye: "LeftEye",
            rightEye: "RightEye",

            leftThumbProximal: "LeftThumbProximal",
            leftThumbIntermediate: "LeftThumbIntermediate",
            leftThumbDistal: "LeftThumbDistal",
            leftIndexProximal: "LeftIndexProximal",
            leftIndexIntermediate: "LeftIndexIntermediate",
            leftIndexDistal: "LeftIndexDistal",
            leftMiddleProximal: "LeftMiddleProximal",
            leftMiddleIntermediate: "LeftMiddleIntermediate",
            leftMiddleDistal: "LeftMiddleDistal",
            leftRingProximal: "LeftRingProximal",
            leftRingIntermediate: "LeftRingIntermediate",
            leftRingDistal: "LeftRingDistal",
            leftLittleProximal: "LeftLittleProximal",
            leftLittleIntermediate: "LeftLittleIntermediate",
            leftLittleDistal: "LeftLittleDistal",

            rightThumbProximal: "RightThumbProximal",
            rightThumbIntermediate: "RightThumbIntermediate",
            rightThumbDistal: "RightThumbDistal",
            rightIndexProximal: "RightIndexProximal",
            rightIndexIntermediate: "RightIndexIntermediate",
            rightIndexDistal: "RightIndexDistal",
            rightMiddleProximal: "RightMiddleProximal",
            rightMiddleIntermediate: "RightMiddleIntermediate",
            rightMiddleDistal: "RightMiddleDistal",
            rightRingProximal: "RightRingProximal",
            rightRingIntermediate: "RightRingIntermediate",
            rightRingDistal: "RightRingDistal",
            rightLittleProximal: "RightLittleProximal",
            rightLittleIntermediate: "RightLittleIntermediate",
            rightLittleDistal: "RightLittleDistal"
        }).boneMap,
        transformOffset: modelArmatureRootWorldTransform
    }
);
```

ヒューマノイドモデルから`MmdModel`を作成するファンクションのシグネチャは以下の通りです：

```typescript
HumanoidMmd.createMmdModelFromHumanoid<T extends IMmdModel>(
    mmdRuntime: IMmdRuntime<T>,
    humanoidMesh: Mesh,
    meshes: readonly Mesh[],
    options: ICreateMmdModelFromHumanoidOptions = {}
): T
```

- **mmdRuntime: `IMmdRuntime<MmdModel>`**
  - `MmdRuntime`クラスまたは`MmdWasmRuntime`クラスのインスタンスが可能です。

- **humanoidMesh: `Mesh`**
  - MMDメタデータを格納するメッシュ。このメッシュは**ダックタイピング**を通じてMMDモデルとして扱われます。
  - `MmdModel`が作成された後、このメッシュは`MmdSkinnedMesh`インターフェースを満たします。

- **meshes: `readonly Mesh[]`**
  - ヒューマノイドモデルを構成するメッシュの配列。`HumanoidMmd`は、`MmdModel`の初期化時にこのメッシュ配列で**スケルトンとモーフターゲットマージャー**を検索します。
  - したがって、モーフターゲットアニメーションを使用したい場合は、モーフターゲットを含むメッシュをこの配列に**含める必要**があります。

- **options: `ICreateMmdModelFromHumanoidOptions`**
  - **boneMap: `{ [key: string]: string }`**
    - ヒューマノイドモデルのボーン名マップ。
    - UnityのHumanoid Rigはボーン名を特定の文字列に固定しないため、ユーザーは**ボーン名マップを直接指定**する必要があります。
  - **morphMap: `{ [key: string]: string }`**
    - ヒューマノイドモデルのモーフターゲット名マップ。
    - ヒューマノイドモデルに「あ」、「い」、「う」、「え」、「お」などのMMDモーフに相当するモーフターゲットが含まれている場合、このオプションを使用してそれらを**マッピング**し、モーフターゲット名マップを指定できます。
    - このオプションが指定されない場合、MMDモーフと**同じ名前**のモーフターゲットを探します。
  - **transformOffset?: `Matrix`**
    - ヒューマノイドモデルの**ルートボーン**に適用するトランスフォームマトリックス。
    - このオプションは、モデルのワールドトランスフォームがレストポーズで**特定の方向に回転**している場合に必要です。
    - 例えば、GLTFモデルはBabylon.jsにインポートされる際にy軸周りに**180度の回転**がルートノードに適用されるため、このオプションを使用してスケルトンのルートノードを指定する必要があります。
    - また、一部のモデルは**アイデンティティではない**スケルトントランスフォームを持っています。この場合も、このオプションを使用してレストポーズのワールドトランスフォームを修正できます。

:::warning
すべてのオプションは**慎重に設定**する必要があります。boneMapが間違っていたり、transformOffsetが不適切に設定されている場合、MMDアニメーションがヒューマノイドモデルに正しく適用されない可能性があります。
:::

### レストポーズ設定

また、モデルのレストポーズを**Aポーズ**に設定する必要があります。

`HumanoidMmd`は、バインディング時のポーズを**レストポーズ**として考慮します。

したがって、モデルがTポーズの場合、バインディング前に**腕の角度を調整**してAポーズを作成する必要があります。

以下のコードは、腕をAポーズに調整する例です：

```typecript title="src/Test/Scene/humanoidMmdTestScene2.ts"
const modelMesh = modelLoadResult.meshes[1] as Mesh;
{
    const transformNodes = modelLoadResult.transformNodes;
    const leftArm = transformNodes.find((transformNode) => transformNode.name === "LeftUpperArm")!;
    const rightArm = transformNodes.find((transformNode) => transformNode.name === "RightUpperArm")!;
    const degToRad = Math.PI / 180;
    leftArm.rotationQuaternion = leftArm.rotationQuaternion!.multiply(Quaternion.FromEulerAngles(0, 0, -35 * degToRad));
    rightArm.rotationQuaternion = rightArm.rotationQuaternion!.multiply(Quaternion.FromEulerAngles(0, 0, 35 * degToRad));
}
```

## アプリケーション例

以下は、babylon-mmdのヒューマノイドモデルサポート機能を使用してヒューマノイドモデルにMMDアニメーションを適用する例です：

<blockquote class="twitter-tweet" data-media-max-width="10000">
<p lang="ja" dir="ltr">
あまとうさぎさんのカリンです
<br/><br/>
これで、babylon-mmdはpmx/pmdモデルだけでなくヒューマノイドモデルもサポートします
<br/><br/>
仮想mmdスケルトンを構築した後、ランタイムにリターゲティングを行う構造です。
<a href="https://t.co/1D5mR2FpQl">https://t.co/1D5mR2FpQl</a>
<a href="https://t.co/AoRirjzVj4">pic.twitter.com/AoRirjzVj4</a>
</p>
&mdash; noname0310 (@noname20310)
<a href="https://twitter.com/noname20310/status/1709437802335920549?ref_src=twsrc%5Etfw">October 4, 2023</a>
</blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 

*モデル: あまとうさぎの[カリン](https://booth.pm/ja/items/3470989)*

このデモのコードは[babylon-mmdのテストコード](https://github.com/noname0310/babylon-mmd/blob/main/src/Test/Scene/humanoidMmdTestScene2.ts)で確認できます。

## 制限事項

- ヒューマノイドMMDには**ハードコードされてアドホックに実装**された部分が多くあります。そのため、すべてのヒューマノイドモデルで完璧に動作しない可能性があります。
- ヒューマノイドMMDは**リアルタイム**でリターゲティングを実行するため、MMDモデルと比較してパフォーマンスが低下する可能性があります。
- ヒューマノイドMMDは**物理シミュレーションを処理しません**。非MMDモデルに物理シミュレーションを適用したい場合は、シミュレーションソルバーを自分で実装する必要があります。

したがって、可能な場合は、**非MMDモデルをPMXフォーマットに変換**してMMDモデルとして使用することが推奨されます。
