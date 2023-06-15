import type { Bone, Mesh, MorphTargetManager, Skeleton } from "@babylonjs/core";

import type { MmdModelBoneMetadata, MmdModelMetadata } from "@/loader/MmdModelMetadata";

export interface MmdMesh extends Mesh {
    metadata: MmdModelMetadata;
    morphTargetManager: MorphTargetManager;
    skeleton: MmdSkeleton;
}

export interface MmdSkeleton extends Skeleton {
    bones: MmdBone[];
}

export interface MmdBone extends Bone {
    metadata: MmdModelBoneMetadata;
}

export namespace MmdMesh {
    export function isMmdMesh(mesh: Mesh): mesh is MmdMesh {
        if (mesh.metadata == null || !mesh.metadata.isMmdModel) return false;
        if (mesh.morphTargetManager == null) return false;
        if (mesh.skeleton == null) return false;

        return true;
    }
}
