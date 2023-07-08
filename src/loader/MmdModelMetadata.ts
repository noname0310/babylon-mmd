import type { PmxObject } from "./parser/PmxObject";

export interface MmdModelMetadata {
    readonly isMmdModel: true;
    readonly header: MmdModelMetadata.Header;
    readonly bones: readonly MmdModelMetadata.Bone[];
    readonly morphs: readonly MmdModelMetadata.Morph[];
    readonly rigidBodies: PmxObject["rigidBodies"];
    readonly joints: PmxObject["joints"];
}

export namespace MmdModelMetadata {
    export interface Header {
        readonly modelName: PmxObject.Header["modelName"];
        readonly englishModelName: PmxObject.Header["englishModelName"];
        readonly comment: PmxObject.Header["comment"];
        readonly englishComment: PmxObject.Header["englishComment"];
    }

    export type Morph = GroupMorph | BoneMorph | MaterialMorph | VertexMorph | UvMorph;

    export interface BaseMorph {
        readonly name: PmxObject.Morph["name"];
        readonly englishName: PmxObject.Morph["englishName"];

        readonly category: PmxObject.Morph["category"];
        readonly type: PmxObject.Morph["type"];
    }

    export interface GroupMorph extends BaseMorph {
        readonly type: PmxObject.Morph.GroupMorph["type"];

        readonly indices: PmxObject.Morph.GroupMorph["indices"];
        readonly ratios: PmxObject.Morph.GroupMorph["ratios"];
    }

    export interface BoneMorph extends BaseMorph {
        readonly type: PmxObject.Morph.BoneMorph["type"];

        readonly indices: PmxObject.Morph.BoneMorph["indices"];
        readonly positions: PmxObject.Morph.BoneMorph["positions"];
        readonly rotations: PmxObject.Morph.BoneMorph["rotations"];
    }

    export interface MaterialMorph extends BaseMorph {
        readonly type: PmxObject.Morph.MaterialMorph["type"];

        readonly elements: PmxObject.Morph.MaterialMorph["elements"];
    }

    export interface VertexMorph extends BaseMorph {
        readonly type: PmxObject.Morph.VertexMorph["type"];

        readonly index: number; // MorphTargetManager morph target index
    }

    export interface UvMorph extends BaseMorph {
        readonly type: PmxObject.Morph.UvMorph["type"];

        readonly index: number; // MorphTargetManager morph target index
    }

    export interface Bone {
        readonly name: PmxObject.Bone["name"];
        readonly parentBoneIndex: PmxObject.Bone["parentBoneIndex"];
        readonly transformOrder: PmxObject.Bone["transformOrder"];
        readonly flag: PmxObject.Bone["flag"];
        readonly appendTransform: PmxObject.Bone["appendTransform"];
        // readonly axisLimit: PmxObject.Bone["axisLimit"];
        // readonly localVector: PmxObject.Bone["localVector"];
        readonly transformAfterPhysics: PmxObject.Bone["transformAfterPhysics"];
        // readonly externalParentTransform: PmxObject.Bone["externalParentTransform"];
        readonly ik: PmxObject.Bone["ik"];
    }
}
