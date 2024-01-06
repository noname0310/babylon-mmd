import { Quaternion } from "@babylonjs/core/Maths/math.vector";

import type { RuntimeMorph } from "./mmdMorphControllerBase";
import { MmdMorphControllerBase } from "./mmdMorphControllerBase";

/**
 * The MmdMorphController uses `MorphTargetManager` to handle position uv morphs, while the material, bone, and group morphs are handled by CPU bound
 *
 * As a result, it reproduces the behavior of the MMD morph system
 */
export class MmdMorphController extends MmdMorphControllerBase {
    /**
     * Sets the weight of the morph
     *
     * If there are multiple morphs with the same name, all of them will be set to the same weight, this is the behavior of MMD
     * @param morphName Name of the morph
     * @param weight Weight of the morph
     */
    public override setMorphWeight(morphName: string, weight: number): void {
        const morphIndexMap = this._morphIndexMap;
        const morphIndices = morphIndexMap.get(morphName);
        if (morphIndices === undefined) return;

        const morphWeights = this._morphWeights;

        for (let i = 0; i < morphIndices.length; ++i) {
            morphWeights[morphIndices[i]] = weight;
        }

        if (weight !== 0) {
            this._activeMorphs.add(morphName);
        }
    }

    /**
     * Sets the weight of the morph from the index
     *
     * This method is faster than `setMorphWeight` because it does not need to search the morphs with the given name
     */
    public override setMorphWeightFromIndex(morphIndex: number, weight: number): void {
        this._morphWeights[morphIndex] = weight;

        if (weight !== 0) {
            this._activeMorphs.add(this._morphs[morphIndex].name);
        }
    }

    protected override _resetBoneMorph(morph: RuntimeMorph): void {
        const bones = this._runtimeBones;
        const indices = morph.elements as Int32Array;

        for (let i = 0; i < indices.length; ++i) {
            const index = indices[i];
            const bone = bones[index];
            if (bone === undefined) continue;

            bone.morphPositionOffset.set(0, 0, 0);
            bone.morphRotationOffset.set(0, 0, 0, 1);
            bone.disableMorph();
        }
    }

    private readonly _tempQuaternion = new Quaternion();

    protected override _applyBoneMorph(morph: RuntimeMorph, weight: number): void {
        const bones = this._runtimeBones;

        const indices = morph.elements as Int32Array;
        const positions = morph.elements2 as Float32Array;
        const rotations = morph.elements3 as Float32Array;
        for (let i = 0; i < indices.length; ++i) {
            const index = indices[i];

            const bone = bones[index];
            if (bone === undefined) continue;

            bone.morphPositionOffset.addInPlaceFromFloats(
                positions[i * 3 + 0] * weight,
                positions[i * 3 + 1] * weight,
                positions[i * 3 + 2] * weight
            );

            Quaternion.SlerpToRef(
                bone.morphRotationOffset,
                this._tempQuaternion.copyFromFloats(
                    rotations[i * 4 + 0],
                    rotations[i * 4 + 1],
                    rotations[i * 4 + 2],
                    rotations[i * 4 + 3]
                ),
                weight,
                bone.morphRotationOffset
            );

            if (weight !== 0) bone.enableMorph();
        }
    }
}
