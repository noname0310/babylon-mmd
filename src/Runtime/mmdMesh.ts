import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Material } from "@babylonjs/core/Materials/material";
import type { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

/**
 * Mesh type that able to create `MmdModel` instance
 */
export interface MmdMesh extends Mesh {
    metadata: MmdModelMetadata;
    material: MmdMultiMaterial;
    skeleton: Skeleton;
    morphTargetManager: MorphTargetManager;
}

/**
 * Mesh type that able to force create `MmdModel` instance
 */
export interface HumanoidMesh extends Mesh {
    metadata: MmdModelMetadata;
    material: Material;
    skeleton: Skeleton;
    morphTargetManager: Nullable<MorphTargetManager>;
}

/**
 * Static mesh loaded from PMX or BPMX file
 */
export interface MmdStaticMesh extends Mesh {
    metadata: MmdModelMetadata;
    material: MmdMultiMaterial;
}

/**
 * Multi material for MMD model
 */
export interface MmdMultiMaterial extends MultiMaterial {
    subMaterials: Material[];
}

/**
 * Mesh type that after create `MmdModel` instance
 */
export interface RuntimeMmdMesh extends Mesh {
    metadata: RuntimeMmdModelMetadata;
    material: MmdMultiMaterial;
    skeleton: Skeleton;
    morphTargetManager: MorphTargetManager;
}

/**
 * Metadata for `RuntimeMmdMesh`
 */
export interface RuntimeMmdModelMetadata {
    isRuntimeMmdModel: true;
    header: MmdModelMetadata.Header;
}

export namespace MmdMesh {
    /**
     * Check if the mesh is MMD mesh
     * @param mesh Mesh to check
     * @returns `true` if the mesh is `MmdMesh`
     */
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

    /**
     * Check if the mesh is MMD static mesh
     * @param mesh Mesh to check
     * @returns `true` if the mesh is `MmdStaticMesh`
     */
    export function isMmdStaticMesh(mesh: Mesh): mesh is MmdStaticMesh {
        if (mesh.metadata === null || !mesh.metadata.isMmdModel) return false;
        if (mesh.material === null || !(mesh.material as MultiMaterial).subMaterials) return false;
        for (const material of (mesh.material as MultiMaterial).subMaterials) {
            if (material === null) return false;
        }

        return true;
    }
}

export namespace HumanoidMesh {
    /**
     * Check if the mesh is humanoid mesh
     * @param mesh Mesh to check
     * @returns `true` if the mesh is `HumanoidMesh`
     */
    export function isHumanoidMesh(mesh: Mesh): mesh is HumanoidMesh {
        if (mesh.metadata === null || !mesh.metadata.isMmdModel) return false;
        if (mesh.material === null) return false;
        if (mesh.skeleton === null) return false;

        return true;
    }
}
