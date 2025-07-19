import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

/**
 * Mesh type that has MMD model metadata
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface MmdMesh extends Mesh {
    _mmdMeshPhantomProperty: true;
    metadata: MmdModelMetadata;
}

/**
 * Mesh type that able to create `MmdModel` instance
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface MmdSkinnedMesh extends MmdMesh {
    _mmdSkinnedMeshPhantomProperty: true;
    metadata: MmdSkinedModelMetadata;
}

/**
 * Metadata for `MmdModel`
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface MmdSkinedModelMetadata extends MmdModelMetadata {
    /**
     * Mmd model skeleton
     */
    readonly skeleton: Skeleton;
}

/**
 * Mesh type that has trimmed MMD model metadata
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface TrimmedMmdSkinnedMesh extends Mesh {
    metadata: TrimmedMmdSkinedModelMetadata;
}

/**
 * Metadata for `RuntimeMmdModel`
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface TrimmedMmdSkinedModelMetadata {
    readonly isTrimmedMmdSkinedModel: true;
    readonly header: MmdModelMetadata.Header;

    /**
     * Mmd model meshes
     */
    readonly meshes: readonly Mesh[];

    /**
     * Mmd model materials
     */
    readonly materials: readonly Material[];

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
     */
    export function isMmdMesh(mesh: Mesh): mesh is MmdMesh {
        if (mesh.metadata === null || !mesh.metadata.isMmdModel) return false;
        return true;
    }

    /**
     * Check if the mesh is MMD model root mesh and can create `MmdModel` instance
     * @param mesh Mesh to check
     * @returns `true` if the mesh is `MmdSkinnedMesh`
     */
    export function isMmdSkinnedMesh(mesh: Mesh): mesh is MmdSkinnedMesh {
        if (mesh.metadata === null || !mesh.metadata.isMmdModel) return false;
        if (mesh.metadata.skeleton === null) return false;
        return true;
    }
}
