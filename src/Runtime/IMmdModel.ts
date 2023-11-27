import type { IMmdLinkedBoneContainer } from "./IMmdRuntimeLinkedBone";
import type { RuntimeMmdMesh } from "./mmdMesh";
import type { MmdMorphController } from "./mmdMorphController";
import type { IMmdRuntimeBone } from "./mmdRuntimeBone";

/**
 * IMmdModel is a model that can bind animation.
 */
export interface IMmdModel {
    /**
     * The mesh of this model
     */
    readonly mesh: RuntimeMmdMesh;

    /**
     * The skeleton of this model
     *
     * This can be a instance of `Skeleton`, or if you are using a humanoid model, it will be referencing a virtualized bone tree
     *
     * So MmdModel.mesh.skeleton is not always equal to MmdModel.skeleton
     */
    readonly skeleton: IMmdLinkedBoneContainer;

    /**
     * The morph controller of this model
     *
     * The `MmdMorphController` not only wrapper of `MorphTargetManager` but also controls the CPU bound morphs (bone, material, group)
     */
    readonly morph: MmdMorphController;

    /**
     * Get the sorted bones of this model
     *
     * The bones are sorted by `transformOrder`
     */
    get sortedRuntimeBones(): readonly IMmdRuntimeBone[];
}
