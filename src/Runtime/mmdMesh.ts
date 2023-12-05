import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

/**
 * Mesh type that able to create `MmdModel` instance
 */
export interface MmdMesh extends Mesh {
    metadata: SkinedMmdModelMetadata;
}

/**
 * Metadata for `MmdModel`
 */
export interface SkinedMmdModelMetadata extends MmdModelMetadata {
    /**
     * Mmd model skeleton
     */
    readonly skeleton: Skeleton;
}

/**
 * Mesh type that after create `MmdModel` instance
 */
export interface RuntimeMmdMesh extends Mesh {
    metadata: RuntimeMmdModelMetadata;
}

/**
 * Metadata for `RuntimeMmdModel`
 */
export interface RuntimeMmdModelMetadata {
    readonly isRuntimeMmdModel: true;
    readonly header: MmdModelMetadata.Header;

    /**
     * Mmd model meshes
     */
    readonly meshes: readonly Mesh[];

    /**
     * Mmd model materials
     */
    readonly materials: Material[];

    /**
     * Mmd model skeleton
     */
    readonly skeleton: Skeleton;
}

/**
 * Provides a way to validate that a mesh meets the components to be loaded into the MMD runtime
 */
export namespace MmdMesh {
    /**
     * Check if the mesh is MMD model root mesh
     * @param mesh Mesh to check
     * @returns `true` if the mesh is `MmdMesh`
     */
    export function isMmdMesh(mesh: Mesh): mesh is MmdMesh {
        if (mesh.metadata === null || !mesh.metadata.isMmdModel) return false;
        if (mesh.metadata.skeleton === null) return false;
        return true;
    }
}
