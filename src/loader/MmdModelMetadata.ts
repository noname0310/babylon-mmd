import { PmxObject } from "./parser/PmxObject";

export interface MmdModelMetadata {
    header: MmdModelMetadata.Header;
    morphs: readonly MmdModelMetadata.Morph[];
    rigidBodies: PmxObject["rigidBodies"]
    joints: PmxObject["joints"]
}

export namespace MmdModelMetadata {
    export interface Header {
        modelName: PmxObject.Header["modelName"];
        englishModelName: PmxObject.Header["englishModelName"];
        comment: PmxObject.Header["comment"];
        englishComment: PmxObject.Header["englishComment"];
    }

    export interface Morph {
        name: PmxObject.Morph["name"];
        englishName: PmxObject.Morph["englishName"];

        category: PmxObject.Morph["category"];
        type: PmxObject.Morph["type"];

        elements: readonly PmxObject.Morph.GroupMorph[]
            | readonly PmxObject.Morph.BoneMorph[]
            | readonly PmxObject.Morph.MaterialMorph[]
            | undefined;
    }
}

export interface MmdModelBoneMetadata {
    transformOrder: PmxObject.Bone["transformOrder"];
    flag: PmxObject.Bone["flag"];
    appendTransform: PmxObject.Bone["appendTransform"];
    axisLimit: PmxObject.Bone["axisLimit"];
    localVector: PmxObject.Bone["localVector"];
    transformAfterPhysics: PmxObject.Bone["transformAfterPhysics"];
    externalParentTransform: PmxObject.Bone["externalParentTransform"];
    ik: PmxObject.Bone["ik"];
}
