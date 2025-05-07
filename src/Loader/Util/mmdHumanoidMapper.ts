/**
 * refs:
 * https://learnmmd.com/http:/learnmmd.com/mmd-bone-reference-charts/
 * https://bowlroll.net/file/9611
 *
 * mmd standard bone structure:
 *
 * -全ての親: all parents (semi-standard)
 *
 *     - センター: center
 *         - グルーブ: groove (semi-standard)
 *             - 腰: waist (semi-standard)
 *                 - 上半身: upper body
 *                     - 上半身2: upper body 2 (semi-standard)
 *
 *                         - 右肩P: right shoulder parent
 *                             - 右肩: right shoulder
 *                                 - 右肩C: right shoulder child
 *                                     - 右腕: right arm
 *                                         - 右腕捩: right arm twist (semi-standard)
 *                                             - 右ひじ: right elbow
 *                                                 - 右手捩: right hand twist (semi-standard)
 *                                                     - 右手首: right wrist
 *
 *                                                        - 右中指１: right middle finger 1
 *                                                            - 右中指２: right middle finger 2
 *                                                                - 右中指３: right middle finger 3
 *
 *                                                        - 右人指１: right index finger 1
 *                                                            - 右人指２: right index finger 2
 *                                                                - 右人指３: right index finger 3
 *
 *                                                        - 右小指１: right little finger 1
 *                                                            - 右小指２: right little finger 2
 *                                                                - 右小指３: right little finger 3
 *
 *                                                        - 右薬指１: right ring finger 1
 *                                                            - 右薬指２: right ring finger 2
 *                                                                - 右薬指３: right ring finger 3
 *
 *                                                        - 右親指０: right thumb 0 (semi-standard)
 *                                                            - 右親指１: right thumb 1
 *                                                                - 右親指２: right thumb 2
 *
 *                         - 左肩P: left shoulder parent
 *                             - 左肩: left shoulder
 *                                 - 左肩C: left shoulder child
 *                                     - 左腕: left arm
 *                                         - 左腕捩: left arm twist (semi-standard)
 *                                             - 左ひじ: left elbow
 *                                                 - 左手捩: left hand twist (semi-standard)
 *                                                     - 左手首: left wrist
 *
 *                                                         - 左中指１: left middle finger 1
 *                                                             - 左中指２: left middle finger 2
 *                                                                 - 左中指３: left middle finger 3
 *
 *                                                         - 左人指１: left index finger 1
 *                                                             - 左人指２: left index finger 2
 *                                                                 - 左人指３: left index finger 3
 *
 *                                                         - 左小指１: left little finger 1
 *                                                             - 左小指２: left little finger 2
 *                                                                 - 左小指３: left little finger 3
 *
 *                                                         - 左薬指２: left ring finger 1
 *                                                             - 左薬指３: left ring finger 2
 *                                                                 - 左薬指４: left ring finger 3
 *
 *                                                         - 左親指０: left thumb 0 (semi-standard)
 *                                                             - 左親指１: left thumb 1
 *                                                                 - 左親指２: left thumb 2
 *
 *                         - 首: neck
 *                             - 頭: head
 *                                - 両目: both eyes
 *                                - 右目: right eye
 *                                - 左目: left eye
 *
 *                 - 下半身: lower body
 *                     - 腰キャンセル右: waist cancel right (semi-standard)
 *
 *                         - 右足: right leg
 *                             - 右ひざ: right knee
 *                                 - 右足首: right ankle
 *                                     - 右つま先: right toe
 *
 *                         - 右足D: right leg D (semi-standard)
 *                             - 右ひざD: right knee D (semi-standard)
 *                                 - 右足首D: right ankle D (semi-standard)
 *                                     - 右足先EX: right toe extra (semi-standard)
 *
 *                     - 腰キャンセル左: waist cancel left (semi-standard)
 *
 *                          - 左足: left leg
 *                             - 左ひざ: left knee
 *                                - 左足首: left ankle
 *                                   - 左つま先: left toe
 *
 *                          - 左足D: left leg D (semi-standard)
 *                             - 左ひざD: left knee D (semi-standard)
 *                                - 左足首D: left ankle D (semi-standard)
 *                                   - 左足先EX: left toe extra (semi-standard)
 *
 *     - 右足IK親: right leg ik parent (semi-standard)
 *         - 右足ＩＫ: right leg ik
 *             - 右つま先ＩＫ: right toe ik
 *
 *     - 左足IK親: left leg ik parent (semi-standard)
 *         - 左足ＩＫ: left leg ik
 *             - 左つま先ＩＫ: left toe ik
 */

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

/**
 * exists only in humanoid rig:
 *
 * - Jaw
 */

/**
 * Humanoid bone name map for interchanging assets between mmd and humanoid rig
 */
export interface IMmdHumanoidBoneMap {
    /**
     * maps to "センター"(center)
     */
    hips?: string;

    /**
     * maps to "上半身"(upper body)
     */
    spine?: string;

    /**
     * maps to "上半身2"(upper body 2)
     */
    chest?: string;

    /**
     * maps to "首"(neck)
     */
    neck?: string;

    /**
     * maps to "頭"(head)
     */
    head?: string;

    /**
     * maps to "左肩"(left shoulder)
     */
    leftShoulder?: string;

    /**
     * maps to "左腕"(left arm)
     */
    leftUpperArm?: string;

    /**
     * maps to "左ひじ"(left elbow)
     */
    leftLowerArm?: string;

    /**
     * maps to "左手首"(left wrist)
     */
    leftHand?: string;

    /**
     * maps to "右肩"(right shoulder)
     */
    rightShoulder?: string;

    /**
     * maps to "右腕"(right arm)
     */
    rightUpperArm?: string;

    /**
     * maps to "右ひじ"(right elbow)
     */
    rightLowerArm?: string;

    /**
     * maps to "右手首"(right wrist)
     */
    rightHand?: string;

    /**
     * maps to "左足"(left leg)
     */
    leftUpperLeg?: string;

    /**
     * maps to "左ひざ"(left knee)
     */
    leftLowerLeg?: string;

    /**
     * maps to "左足首"(left ankle)
     */
    leftFoot?: string;

    /**
     * maps to "左つま先"(left toe)
     */
    leftToes?: string;

    /**
     * maps to "右足"(right leg)
     */
    rightUpperLeg?: string;

    /**
     * maps to "右ひざ"(right knee)
     */
    rightLowerLeg?: string;

    /**
     * maps to "右足首"(right ankle)
     */
    rightFoot?: string;

    /**
     * maps to "右つま先"(right toe)
     */
    rightToes?: string;

    /**
     * maps to "左目"(left eye)
     */
    leftEye?: string;

    /**
     * maps to "右目"(right eye)
     */
    rightEye?: string;

    /**
     * maps to "左親指０"(left thumb 0)
     */
    leftThumbProximal?: string;

    /**
     * maps to "左親指１"(left thumb 1)
     */
    leftThumbIntermediate?: string;

    /**
     * maps to "左親指２"(left thumb 2)
     */
    leftThumbDistal?: string;

    /**
     * maps to "左人指１"(left index finger 1)
     */
    leftIndexProximal?: string;

    /**
     * maps to "左人指２"(left index finger 2)
     */
    leftIndexIntermediate?: string;

    /**
     * maps to "左人指３"(left index finger 3)
     */
    leftIndexDistal?: string;

    /**
     * maps to "左中指１"(left middle finger 1)
     */
    leftMiddleProximal?: string;

    /**
     * maps to "左中指２"(left middle finger 2)
     */
    leftMiddleIntermediate?: string;

    /**
     * maps to "左中指３"(left middle finger 3)
     */
    leftMiddleDistal?: string;

    /**
     * maps to "左薬指１"(left ring finger 1)
     */
    leftRingProximal?: string;

    /**
     * maps to "左薬指２"(left ring finger 2)
     */
    leftRingIntermediate?: string;

    /**
     * maps to "左薬指３"(left ring finger 3)
     */
    leftRingDistal?: string;

    /**
     * maps to "左小指１"(left little finger 1)
     */
    leftLittleProximal?: string;

    /**
     * maps to "左小指２"(left little finger 2)
     */
    leftLittleIntermediate?: string;

    /**
     * maps to "左小指３"(left little finger 3)
     */
    leftLittleDistal?: string;

    /**
     * maps to "右親指０"(right thumb 0)
     */
    rightThumbProximal?: string;

    /**
     * maps to "右親指１"(right thumb 1)
     */
    rightThumbIntermediate?: string;

    /**
     * maps to "右親指２"(right thumb 2)
     */
    rightThumbDistal?: string;

    /**
     * maps to "右人指１"(right index finger 1)
     */
    rightIndexProximal?: string;

    /**
     * maps to "右人指２"(right index finger 2)
     */
    rightIndexIntermediate?: string;

    /**
     * maps to "右人指３"(right index finger 3)
     */
    rightIndexDistal?: string;

    /**
     * maps to "右中指１"(right middle finger 1)
     */
    rightMiddleProximal?: string;

    /**
     * maps to "右中指２"(right middle finger 2)
     */
    rightMiddleIntermediate?: string;

    /**
     * maps to "右中指３"(right middle finger 3)
     */
    rightMiddleDistal?: string;

    /**
     * maps to "右薬指１"(right ring finger 1)
     */
    rightRingProximal?: string;

    /**
     * maps to "右薬指２"(right ring finger 2)
     */
    rightRingIntermediate?: string;

    /**
     * maps to "右薬指３"(right ring finger 3)
     */
    rightRingDistal?: string;

    /**
     * maps to "右小指１"(right little finger 1)
     */
    rightLittleProximal?: string;

    /**
     * maps to "右小指２"(right little finger 2)
     */
    rightLittleIntermediate?: string;

    /**
     * maps to "右小指３"(right little finger 3)
     */
    rightLittleDistal?: string;
}

/**
 * mixamo humanoid bone name map
 */
export const MixamoMmdHumanoidBoneMap = {
    hips: "mixamorig:Hips",
    spine: "mixamorig:Spine",
    chest: "mixamorig:Spine2",
    neck: "mixamorig:Neck",
    head: "mixamorig:Head",
    leftShoulder: "mixamorig:LeftShoulder",
    leftUpperArm: "mixamorig:LeftArm",
    leftLowerArm: "mixamorig:LeftForeArm",
    leftHand: "mixamorig:LeftHand",
    rightShoulder: "mixamorig:RightShoulder",
    rightUpperArm: "mixamorig:RightArm",
    rightLowerArm: "mixamorig:RightForeArm",
    rightHand: "mixamorig:RightHand",
    leftUpperLeg: "mixamorig:LeftUpLeg",
    leftLowerLeg: "mixamorig:LeftLeg",
    leftFoot: "mixamorig:LeftFoot",
    leftToes: "mixamorig:LeftToeBase",
    rightUpperLeg: "mixamorig:RightUpLeg",
    rightLowerLeg: "mixamorig:RightLeg",
    rightFoot: "mixamorig:RightFoot",
    rightToes: "mixamorig:RightToeBase",

    leftEye: undefined,
    rightEye: undefined,

    leftThumbProximal: "mixamorig:LeftHandThumb1",
    leftThumbIntermediate: "mixamorig:LeftHandThumb2",
    leftThumbDistal: "mixamorig:LeftHandThumb3",
    leftIndexProximal: "mixamorig:LeftHandIndex1",
    leftIndexIntermediate: "mixamorig:LeftHandIndex2",
    leftIndexDistal: "mixamorig:LeftHandIndex3",
    leftMiddleProximal: "mixamorig:LeftHandMiddle1",
    leftMiddleIntermediate: "mixamorig:LeftHandMiddle2",
    leftMiddleDistal: "mixamorig:LeftHandMiddle3",
    leftRingProximal: "mixamorig:LeftHandRing1",
    leftRingIntermediate: "mixamorig:LeftHandRing2",
    leftRingDistal: "mixamorig:LeftHandRing3",
    leftLittleProximal: "mixamorig:LeftHandPinky1",
    leftLittleIntermediate: "mixamorig:LeftHandPinky2",
    leftLittleDistal: "mixamorig:LeftHandPinky3",

    rightThumbProximal: "mixamorig:RightHandThumb1",
    rightThumbIntermediate: "mixamorig:RightHandThumb2",
    rightThumbDistal: "mixamorig:RightHandThumb3",
    rightIndexProximal: "mixamorig:RightHandIndex1",
    rightIndexIntermediate: "mixamorig:RightHandIndex2",
    rightIndexDistal: "mixamorig:RightHandIndex3",
    rightMiddleProximal: "mixamorig:RightHandMiddle1",
    rightMiddleIntermediate: "mixamorig:RightHandMiddle2",
    rightMiddleDistal: "mixamorig:RightHandMiddle3",
    rightRingProximal: "mixamorig:RightHandRing1",
    rightRingIntermediate: "mixamorig:RightHandRing2",
    rightRingDistal: "mixamorig:RightHandRing3",
    rightLittleProximal: "mixamorig:RightHandPinky1",
    rightLittleIntermediate: "mixamorig:RightHandPinky2",
    rightLittleDistal: "mixamorig:RightHandPinky3"
} as const satisfies IMmdHumanoidBoneMap;

/**
 * vrm humanoid bone name map
 */
export const VrmMmdHumanoidBoneMap = {
    hips: "hips",
    spine: "spine",
    chest: "chest",
    neck: "neck",
    head: "head",
    leftShoulder: "leftShoulder",
    leftUpperArm: "leftUpperArm",
    leftLowerArm: "leftLowerArm",
    leftHand: "leftHand",
    rightShoulder: "rightShoulder",
    rightUpperArm: "rightUpperArm",
    rightLowerArm: "rightLowerArm",
    rightHand: "rightHand",
    leftUpperLeg: "leftUpperLeg",
    leftLowerLeg: "leftLowerLeg",
    leftFoot: "leftFoot",
    leftToes: "leftToes",
    rightUpperLeg: "rightUpperLeg",
    rightLowerLeg: "rightLowerLeg",
    rightFoot: "rightFoot",
    rightToes: "rightToes",

    leftEye: "leftEye",
    rightEye: "rightEye",

    leftThumbProximal: "leftThumbProximal",
    leftThumbIntermediate: "leftThumbIntermediate",
    leftThumbDistal: "leftThumbDistal",
    leftIndexProximal: "leftIndexProximal",
    leftIndexIntermediate: "leftIndexIntermediate",
    leftIndexDistal: "leftIndexDistal",
    leftMiddleProximal: "leftMiddleProximal",
    leftMiddleIntermediate: "leftMiddleIntermediate",
    leftMiddleDistal: "leftMiddleDistal",
    leftRingProximal: "leftRingProximal",
    leftRingIntermediate: "leftRingIntermediate",
    leftRingDistal: "leftRingDistal",
    leftLittleProximal: "leftLittleProximal",
    leftLittleIntermediate: "leftLittleIntermediate",
    leftLittleDistal: "leftLittleDistal",

    rightThumbProximal: "rightThumbProximal",
    rightThumbIntermediate: "rightThumbIntermediate",
    rightThumbDistal: "rightThumbDistal",
    rightIndexProximal: "rightIndexProximal",
    rightIndexIntermediate: "rightIndexIntermediate",
    rightIndexDistal: "rightIndexDistal",
    rightMiddleProximal: "rightMiddleProximal",
    rightMiddleIntermediate: "rightMiddleIntermediate",
    rightMiddleDistal: "rightMiddleDistal",
    rightRingProximal: "rightRingProximal",
    rightRingIntermediate: "rightRingIntermediate",
    rightRingDistal: "rightRingDistal",
    rightLittleProximal: "rightLittleProximal",
    rightLittleIntermediate: "rightLittleIntermediate",
    rightLittleDistal: "rightLittleDistal"
} as const satisfies IMmdHumanoidBoneMap;

/**
 * bone name map generator for interchanging assets between mmd and humanoid rig
 */
export class MmdHumanoidMapper {
    private static readonly _PropertyMap = {
        hips: "センター",
        spine: "上半身",
        chest: "上半身2",
        neck: "首",
        head: "頭",
        leftShoulder: "左肩",
        leftUpperArm: "左腕",
        leftLowerArm: "左ひじ",
        leftHand: "左手首",
        rightShoulder: "右肩",
        rightUpperArm: "右腕",
        rightLowerArm: "右ひじ",
        rightHand: "右手首",
        leftUpperLeg: "左足",
        leftLowerLeg: "左ひざ",
        leftFoot: "左足首",
        leftToes: "左つま先",
        rightUpperLeg: "右足",
        rightLowerLeg: "右ひざ",
        rightFoot: "右足首",
        rightToes: "右つま先",

        leftEye: "左目",
        rightEye: "右目",

        leftThumbProximal: "左親指０",
        leftThumbIntermediate: "左親指１",
        leftThumbDistal: "左親指２",
        leftIndexProximal: "左人指１",
        leftIndexIntermediate: "左人指２",
        leftIndexDistal: "左人指３",
        leftMiddleProximal: "左中指１",
        leftMiddleIntermediate: "左中指２",
        leftMiddleDistal: "左中指３",
        leftRingProximal: "左薬指１",
        leftRingIntermediate: "左薬指２",
        leftRingDistal: "左薬指３",
        leftLittleProximal: "左小指１",
        leftLittleIntermediate: "左小指２",
        leftLittleDistal: "左小指３",

        rightThumbProximal: "右親指０",
        rightThumbIntermediate: "右親指１",
        rightThumbDistal: "右親指２",
        rightIndexProximal: "右人指１",
        rightIndexIntermediate: "右人指２",
        rightIndexDistal: "右人指３",
        rightMiddleProximal: "右中指１",
        rightMiddleIntermediate: "右中指２",
        rightMiddleDistal: "右中指３",
        rightRingProximal: "右薬指１",
        rightRingIntermediate: "右薬指２",
        rightRingDistal: "右薬指３",
        rightLittleProximal: "右小指１",
        rightLittleIntermediate: "右小指２",
        rightLittleDistal: "右小指３"
    } as const satisfies IMmdHumanoidBoneMap;

    private static readonly _PropertyKeys: readonly (keyof IMmdHumanoidBoneMap)[] = Object.keys(MmdHumanoidMapper._PropertyMap) as (keyof IMmdHumanoidBoneMap)[];

    /**
     * Humanoid bone to mmd bone name map
     */
    public readonly boneMap: { readonly [key: string]: string };

    /**
     * Create a new `MmdHumanoidMapper` instance
     * @param mmdHumanoidBoneMap humanoid bone name map
     */
    public constructor(mmdHumanoidBoneMap: IMmdHumanoidBoneMap) {
        const boneMap = this.boneMap = {} as { [key: string]: string };

        const propertyMap = MmdHumanoidMapper._PropertyMap;
        const propertyKeys = MmdHumanoidMapper._PropertyKeys;
        for (let i = 0, iMax = propertyKeys.length; i < iMax; ++i) {
            const propertyKey = propertyKeys[i];
            const humanoidBoneName = mmdHumanoidBoneMap[propertyKey];
            const mmdBoneName = propertyMap[propertyKey];
            if (humanoidBoneName !== undefined && mmdBoneName !== undefined) {
                boneMap[humanoidBoneName] = mmdBoneName;
            }
        }
    }
}
