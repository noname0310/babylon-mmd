import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

/**
 * Node type that able to create `MmdModel` instance
 */
export interface MmdModelNode extends TransformNode {
    metadata: MmdSkinedModelMetadata;
}

/**
 * Metadata for `MmdModelNode`
 */
export interface MmdSkinedModelMetadata extends MmdModelMetadata {
    /**
     * Mmd model skeleton
     */
    readonly skeleton: Skeleton;
}

/**
 * Node type that after create `MmdModel` instance
 */
export interface RuntimeMmdModelNode extends TransformNode {
    metadata: RuntimeMmdModelMetadata;
}

/**
 * Metadata for `RuntimeMmdModelMode`
 */
export interface RuntimeMmdModelMetadata {
    readonly isRuntimeMmdModel: true;
    readonly header: MmdModelMetadata.Header;

    /**
     * Mmd model meshes
     */
    readonly meshes: readonly Mesh[];

    /**
     * Mmd model skeleton
     */
    readonly skeleton: Skeleton;

    /**
     * Mmd model materials
     */
    readonly materials: Material[];
}

/**
 * Provides a way to validate that a transform node meets the components to be loaded into the MMD runtime
 */
export namespace MmdModelNode {
    /**
     * Check if the node is MMD model root node
     * @param node Node to check
     * @returns `true` if the node is `MmdModelNode`
     */
    export function isMmdModelNode(node: TransformNode): node is MmdModelNode {
        if (node.metadata === null || !node.metadata.isMmdModel) return false;
        if (node.metadata.skeleton === null) return false;
        return true;
    }
}
