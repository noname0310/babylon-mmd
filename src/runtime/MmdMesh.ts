import type { Bone, Mesh, MorphTargetManager, MultiMaterial, Skeleton } from "@babylonjs/core";

import type { MmdModelBoneMetadata, MmdModelMetadata } from "@/loader/MmdModelMetadata";

export interface MmdMesh extends Mesh {
    metadata: MmdModelMetadata;
    material: MultiMaterial;
    skeleton: MmdSkeleton;
    morphTargetManager: MorphTargetManager;
}

export interface MmdSkeleton extends Skeleton {
    bones: MmdBone[];
}

export interface MmdBone extends Bone {
    metadata: MmdModelBoneMetadata;
}

export interface RuntimeMmdMesh extends Mesh {
    metadata: RuntimeMmdModelMetadata;
    material: MultiMaterial;
    skeleton: MmdSkeleton;
    morphTargetManager: MorphTargetManager;
}

export interface RuntimeMmdModelMetadata {
    isRuntimeMmdModel: true;
    header: MmdModelMetadata.Header;
}

export namespace MmdMesh {
    export function isMmdMesh(mesh: Mesh): mesh is MmdMesh {
        if (mesh.metadata == null || !mesh.metadata.isMmdModel) return false;
        if (mesh.material == null || !(mesh.material as MultiMaterial).subMaterials) return false;
        if (mesh.skeleton == null) return false;
        if (mesh.morphTargetManager == null) return false;

        return true;
    }
}
