import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Material } from "@babylonjs/core/Materials/material";
import type { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";

export interface MmdMesh extends Mesh {
    metadata: MmdModelMetadata;
    material: MmdMultiMaterial;
    skeleton: Skeleton;
    morphTargetManager: MorphTargetManager;
}

export interface MmdStaticMesh extends Mesh {
    metadata: MmdModelMetadata;
    material: MmdMultiMaterial;
}

export interface MmdMultiMaterial extends MultiMaterial {
    subMaterials: Material[];
}

export interface RuntimeMmdMesh extends Mesh {
    metadata: RuntimeMmdModelMetadata;
    material: MmdMultiMaterial;
    skeleton: Skeleton;
    morphTargetManager: MorphTargetManager;
}

export interface RuntimeMmdModelMetadata {
    isRuntimeMmdModel: true;
    header: MmdModelMetadata.Header;
}

export namespace MmdMesh {
    export function isMmdMesh(mesh: Mesh): mesh is MmdMesh {
        if (mesh.metadata === null || !mesh.metadata.isMmdModel) return false;
        if (mesh.material === null || !(mesh.material as MultiMaterial).subMaterials) return false;
        for (const material of (mesh.material as MultiMaterial).subMaterials) {
            if (material === null) return false;
        }
        if (mesh.skeleton === null) return false;
        if (mesh.morphTargetManager === null) return false;

        return true;
    }

    export function isMmdStaticMesh(mesh: Mesh): mesh is MmdStaticMesh {
        if (mesh.metadata === null || !mesh.metadata.isMmdModel) return false;
        if (mesh.material === null || !(mesh.material as MultiMaterial).subMaterials) return false;
        for (const material of (mesh.material as MultiMaterial).subMaterials) {
            if (material === null) return false;
        }

        return true;
    }
}
