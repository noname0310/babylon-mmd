// refs:
// https://docs.unity3d.com/ScriptReference/HumanBodyBones.html
// https://github.com/V-Sekai/three-vrm-1-sandbox-mixamo/blob/master/mixamoVRMRigMap.js

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
 *                                                                    - 右親指３: right thumb 3
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
 *                                                                     - 左親指３: left thumb 3
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
 * missing bones in humanoid:
 *
 *
 */

export interface MmdHumanoidBoneMap {
    /**
     * maps to "センター"
     */
    hips: string;

    /**
     * maps to "上半身"
     */
    spine: string;
}

export class MmdHumanoidMapper {

}
