import type { PmxObject } from "./parser/PmxObject";

export interface MmdModelMetadata {
    isMmdModel: true;
    header: MmdModelMetadata.Header;
    bones: readonly MmdModelMetadata.Bone[];
    morphs: readonly MmdModelMetadata.Morph[];
    rigidBodies: PmxObject["rigidBodies"];
    joints: PmxObject["joints"];
}

export namespace MmdModelMetadata {
    export interface Header {
        modelName: PmxObject.Header["modelName"];
        englishModelName: PmxObject.Header["englishModelName"];
        comment: PmxObject.Header["comment"];
        englishComment: PmxObject.Header["englishComment"];
    }

    export type Morph = GroupMorph | BoneMorph | MaterialMorph | VertexMorph | UvMorph;

    export interface BaseMorph {
        name: PmxObject.Morph["name"];
        englishName: PmxObject.Morph["englishName"];

        category: PmxObject.Morph["category"];
        type: PmxObject.Morph["type"];
    }

    export interface GroupMorph extends BaseMorph {
        type: PmxObject.Morph.GroupMorph["type"];

        indices: PmxObject.Morph.GroupMorph["indices"];
        ratios: PmxObject.Morph.GroupMorph["ratios"];
    }

    export interface BoneMorph extends BaseMorph {
        type: PmxObject.Morph.BoneMorph["type"];

        indices: PmxObject.Morph.BoneMorph["indices"];
        positions: PmxObject.Morph.BoneMorph["positions"];
        rotations: PmxObject.Morph.BoneMorph["rotations"];
    }

    export interface MaterialMorph extends BaseMorph {
        type: PmxObject.Morph.MaterialMorph["type"];

        elements: PmxObject.Morph.MaterialMorph["elements"];
    }

    export interface VertexMorph extends BaseMorph {
        type: PmxObject.Morph.VertexMorph["type"];

        index: number; // MorphTargetManager morph target index
    }

    export interface UvMorph extends BaseMorph {
        type: PmxObject.Morph.UvMorph["type"];

        index: number; // MorphTargetManager morph target index
    }

    export interface Bone {
        name: PmxObject.Bone["name"];
        parentBoneIndex: PmxObject.Bone["parentBoneIndex"];
        transformOrder: PmxObject.Bone["transformOrder"];
        flag: PmxObject.Bone["flag"];
        appendTransform: PmxObject.Bone["appendTransform"];
        // axisLimit: PmxObject.Bone["axisLimit"];
        // localVector: PmxObject.Bone["localVector"];
        transformAfterPhysics: PmxObject.Bone["transformAfterPhysics"];
        // externalParentTransform: PmxObject.Bone["externalParentTransform"];
        ik: PmxObject.Bone["ik"];
    }
}
