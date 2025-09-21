---
sidebar_position: 9
sidebar_label: 비-MMD 모델에 MMD 애니메이션 적용
---

# 비-MMD 모델에 MMD 애니메이션 적용

MMD 애니메이션은 일반적으로 **준표준 본 구조**(準標準ボーン構造)를 따르는 MMD 모델과 호환되도록 설계되었습니다.

그러나 babylon-mmd는 **휴머노이드 모델**에 MMD 애니메이션을 적용하는 것도 지원합니다.

## 휴머노이드 모델

휴머노이드 모델은 **Unity의 휴머노이드 리그**와 **Mixamo 리그**의 본 구조를 따르는 모델을 의미합니다.

휴머노이드 모델의 본 구조는 다음과 같습니다:

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

## 휴머노이드 MMD

`HumanoidMmd`는 휴머노이드 모델에 MMD 애니메이션을 적용하기 위한 **헬퍼 클래스**입니다.

이 클래스를 사용하여 **프록시 준표준 스켈레톤**을 생성하여 `MmdModel`을 만들고, **실시간 리타겟팅**을 사용하여 휴머노이드 모델에 MMD 애니메이션을 적용할 수 있습니다.

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

휴머노이드 모델에서 `MmdModel`을 생성하는 함수의 시그니처는 다음과 같습니다:

```typescript
HumanoidMmd.createMmdModelFromHumanoid<T extends IMmdModel>(
    mmdRuntime: IMmdRuntime<T>,
    humanoidMesh: Mesh,
    meshes: readonly Mesh[],
    options: ICreateMmdModelFromHumanoidOptions = {}
): T
```

- **mmdRuntime: `IMmdRuntime<MmdModel>`**
  - `MmdRuntime` 클래스 또는 `MmdWasmRuntime` 클래스의 인스턴스일 수 있습니다.

- **humanoidMesh: `Mesh`**
  - MMD 메타데이터를 저장할 메시입니다. 이 메시는 **덕 타이핑**을 통해 MMD 모델로 취급됩니다.
  - `MmdModel`이 생성된 후, 이 메시는 `MmdSkinnedMesh` 인터페이스를 만족하게 됩니다.

- **meshes: `readonly Mesh[]`**
  - 휴머노이드 모델을 구성하는 메시 배열입니다. `HumanoidMmd`는 `MmdModel`을 초기화할 때 이 메시 배열에서 **스켈레톤과 MorphTargetMerger**를 찾습니다.
  - 따라서 모프 타겟 애니메이션을 사용하려면 모프 타겟이 포함된 메시를 이 배열에 **반드시 포함**해야 합니다.

- **options: `ICreateMmdModelFromHumanoidOptions`**
  - **boneMap: `{ [key: string]: string }`**
    - 휴머노이드 모델의 본 이름 맵입니다.
    - Unity의 휴머노이드 리그는 본 이름을 특정 문자열로 고정하지 않으므로, 사용자가 **본 이름 맵을 직접 지정**해야 합니다.
  - **morphMap: `{ [key: string]: string }`**
    - 휴머노이드 모델의 모프 타겟 이름 맵입니다.
    - 휴머노이드 모델이 あ, い, う, え, お 등의 MMD 모프와 동등한 모프 타겟을 포함하는 경우, 이 옵션을 사용하여 **매핑**하여 모프 타겟 이름 맵을 지정할 수 있습니다.
    - 이 옵션을 지정하지 않으면 MMD 모프와 **동일한 이름**의 모프 타겟을 찾습니다.
  - **transformOffset?: `Matrix`**
    - 휴머노이드 모델의 **루트 본**에 적용할 변환 행렬입니다.
    - 이 옵션은 모델의 월드 트랜스폼이 Rest 포즈에서 **특정 방향으로 회전**되어 있을 때 필요합니다.
    - 예를 들어, GLTF 모델은 Babylon.js로 가져올 때 y축을 중심으로 **180도 회전**이 루트 노드에 적용되므로, 스켈레톤의 루트 노드를 지정하기 위해 이 옵션을 사용해야 합니다.
    - 또한 일부 모델은 **항등원이 아닌** 스켈레톤 트랜스폼을 가지고 있습니다. 이 경우에도 이 옵션을 사용하여 Rest 포즈의 월드 트랜스폼을 수정할 수 있습니다.

:::warning
모든 옵션은 **신중하게 구성**해야 합니다. boneMap이 올바르지 않거나 transformOffset이 부적절하게 설정된 경우, MMD 애니메이션이 휴머노이드 모델에 올바르게 적용되지 않을 수 있습니다.
:::

### Rest 포즈 구성

모델의 rest 포즈를 **A-포즈**로 설정해야 합니다.

`HumanoidMmd`는 바인딩 시점의 포즈를 **Rest 포즈**로 간주합니다.

따라서 모델이 T-포즈인 경우, 바인딩하기 전에 **팔의 각도를 조정**하여 A-포즈를 만들어야 합니다.

다음 코드는 팔을 A-포즈로 조정하는 예제입니다:

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

## 적용 예제

다음은 babylon-mmd의 휴머노이드 모델 지원 기능을 사용하여 휴머노이드 모델에 MMD 애니메이션을 적용하는 예제입니다:

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

*모델: あまとうさぎ의 [カリン](https://booth.pm/ja/items/3470989)*

이 데모의 코드는 [babylon-mmd의 테스트 코드](https://github.com/noname0310/babylon-mmd/blob/main/src/Test/Scene/humanoidMmdTestScene2.ts)에서 찾을 수 있습니다.

## 제한사항

- 휴머노이드 MMD는 **하드코딩되고 임시방편적으로 구현된** 부분이 많습니다. 따라서 모든 휴머노이드 모델에 대해 완벽하게 작동하지 않을 수 있습니다.
- 휴머노이드 MMD는 **실시간**으로 리타겟팅을 수행하므로, MMD 모델에 비해 성능이 떨어질 수 있습니다.
- 휴머노이드 MMD는 **물리 시뮬레이션을 처리하지 않습니다**. 비-MMD 모델에 물리 시뮬레이션을 적용하려면 시뮬레이션 솔버를 직접 구현해야 합니다.

따라서 가능하다면 **비-MMD 모델을 PMX 형식으로 변환**하여 MMD 모델로 사용하는 것이 권장됩니다.
