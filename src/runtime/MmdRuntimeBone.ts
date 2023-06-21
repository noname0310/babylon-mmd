import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";

export class MmdRuntimeBone {
    public readonly transformOrder: number;
    // public readonly appendTransform: MmdModelMetadata.Bone["appendTransform"];
    // public readonly

    public constructor(boneMetadata: MmdModelMetadata.Bone) {
        this.transformOrder = boneMetadata.transformOrder;
    }
}
