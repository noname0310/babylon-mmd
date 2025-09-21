---
sidebar_position: 9
sidebar_label: Apply MMD Animation on Non-MMD Model
---

# Apply MMD Animation on Non-MMD Model

MMD animations are generally designed to be compatible with MMD models that follow the **semi-standard bone structure** (準標準ボーン構造).

However, babylon-mmd also supports applying MMD animations to **Humanoid models**.

## Humanoid Model

A Humanoid model refers to models that follow the bone structure of **Unity's Humanoid Rig** and the **Mixamo rig**.

Humanoid model bone structure is as follows:

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

`HumanoidMmd` is a **helper class** for applying MMD animations to Humanoid models.

Using this class, you can create a **proxy semi-standard skeleton** to generate an `MmdModel` and apply MMD animations to Humanoid models using **real-time retargeting**.

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

The signature of the function that creates an `MmdModel` from a Humanoid model is as follows:

```typescript
HumanoidMmd.createMmdModelFromHumanoid<T extends IMmdModel>(
    mmdRuntime: IMmdRuntime<T>,
    humanoidMesh: Mesh,
    meshes: readonly Mesh[],
    options: ICreateMmdModelFromHumanoidOptions = {}
): T
```

- **mmdRuntime: `IMmdRuntime<MmdModel>`**
  - Can be an instance of the `MmdRuntime` class or the `MmdWasmRuntime` class.

- **humanoidMesh: `Mesh`**
  - The mesh that will store the MMD metadata. This mesh is treated as an MMD model through **duck-typing**.
  - After the `MmdModel` is created, this mesh will satisfy the `MmdSkinnedMesh` interface.

- **meshes: `readonly Mesh[]`**
  - An array of meshes that make up the Humanoid model. `HumanoidMmd` searches for the **Skeleton and MorphTargetMerger** in this array of meshes when initializing the `MmdModel`.
  - Therefore, if you want to use Morph Target animation, you **must include** the meshes containing Morph Targets in this array.

- **options: `ICreateMmdModelFromHumanoidOptions`**
  - **boneMap: `{ [key: string]: string }`**
    - The bone name map of the Humanoid model.
    - Unity's Humanoid Rig doesn't fix bone names to specific strings, so users need to **specify the bone name map directly**.
  - **morphMap: `{ [key: string]: string }`**
    - The morph target name map of the Humanoid model.
    - If the Humanoid model includes morph targets equivalent to MMD Morphs such as あ, い, う, え, お, etc., you can **map them** using this option to specify the morph target name map.
    - If this option is not specified, it will look for morph targets with the **same names** as the MMD Morphs.
  - **transformOffset?: `Matrix`**
    - The transformation matrix to apply to the **root bone** of the Humanoid model.
    - This option is necessary when the model's World Transform is **rotated in a specific direction** in its Rest pose.
    - For example, GLTF models have a **180-degree rotation** applied to the root node around the y-axis when imported into Babylon.js, so you need to use this option to specify the root node of the Skeleton.
    - Also, some models have Skeleton Transforms that are **not identity**. In this case, you can also use this option to correct the World Transform in the Rest pose.

:::warning
All options need to be **carefully configured**. If the boneMap is incorrect or the transformOffset is improperly set, the MMD animation may not be applied correctly to the Humanoid model.
:::

### Rest Pose Configuration

You also need to set the model's rest pose to an **A-pose**.

`HumanoidMmd` considers the pose at the time of binding as the **Rest pose**.

Therefore, if the model is in a T-pose, you need to **adjust the angle of the arms** to create an A-pose before binding.

The following code is an example of adjusting the arms to an A-pose:

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

## Application Example

Here's an example of applying MMD animations to a Humanoid model using babylon-mmd's Humanoid model support feature:

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

*Model: あまとうさぎ's [カリン](https://booth.pm/ja/items/3470989)*

The code for this demo can be found in [babylon-mmd's test code](https://github.com/noname0310/babylon-mmd/blob/main/src/Test/Scene/humanoidMmdTestScene2.ts).

## Limitations

- Humanoid MMD has many parts that are **hard-coded and implemented ad-hoc**. Therefore, it may not work perfectly for all Humanoid models.
- Humanoid MMD performs retargeting in **real-time**, which may result in lower performance compared to MMD models.
- Humanoid MMD **does not handle physics simulation**. If you want to apply physics simulation to a Non-MMD model, you need to implement the simulation Solver yourself.

Therefore, when possible, it is recommended to **convert non-MMD models to PMX format** and use them as MMD models.
