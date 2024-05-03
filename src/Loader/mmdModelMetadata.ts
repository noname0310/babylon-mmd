import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import type { Nullable } from "@babylonjs/core/types";

import type { PmxObject } from "./Parser/pmxObject";

/**
 * Mmd model metadata
 *
 * Metadata for construct a `MmdModel` from mmd mesh
 *
 * You can also put MmdModelMetadata into a non-mmd mesh as metadata to make it work by mmd runtime
 */
export interface MmdModelMetadata {
    /**
     * Indicate this mesh.metadata is a mmd model metadata
     */
    readonly isMmdModel: true;

    /**
     * Mmd model header
     */
    readonly header: MmdModelMetadata.Header;

    /**
     * Mmd model bones information
     */
    readonly bones: readonly MmdModelMetadata.Bone[];

    /**
     * Mmd model morphs information
     */
    readonly morphs: readonly MmdModelMetadata.Morph[];

    /**
     * Mmd model rigid bodies information
     */
    readonly rigidBodies: PmxObject["rigidBodies"];

    /**
     * Mmd model joints information
     */
    readonly joints: PmxObject["joints"];

    /**
     * Mmd model meshes
     */
    readonly meshes: readonly Mesh[];

    /**
     * Mmd model materials that used in submeshes
     *
     * it should not contain multi-materials
     */
    readonly materials: readonly Material[];

    /**
     * Mmd model skeleton
     */
    readonly skeleton: Nullable<Skeleton>;
}

/**
 * mmd model metadata for serialization
 *
 * Additional information for serialization into bpmx file
 */
export interface MmdModelSerializationMetadata extends MmdModelMetadata {
    /**
     * Indicate this mesh.metadata is a mmd model metadata for serialization
     */
    readonly containsSerializationData: true;

    /**
     * Mmd model bones information for serialization
     */
    readonly bones: readonly MmdModelMetadata.SerializationBone[];

    /**
     * Mmd model morphs information for serialization
     */
    readonly morphs: readonly MmdModelMetadata.SerializationMorph[];

    /**
     * Mmd model texture original names
     */
    readonly textureNameMap: Nullable<Map<BaseTexture, string>>;

    /**
     * Mmd model material information for serialization
     */
    readonly materialsMetadata: MmdModelMetadata.MaterialMetadata[];

    /**
     * Mmd model display frames
     */
    readonly displayFrames: Nullable<PmxObject["displayFrames"]>;
}

export namespace MmdModelMetadata {
    /**
     * Mmd model metadata header
     */
    export interface Header {
        /**
         * Model name
         */
        readonly modelName: PmxObject.Header["modelName"];

        /**
         * Model name in english
         */
        readonly englishModelName: PmxObject.Header["englishModelName"];

        /**
         * Model comment
         */
        readonly comment: PmxObject.Header["comment"];

        /**
         * Model comment in english
         */
        readonly englishComment: PmxObject.Header["englishComment"];
    }

    /**
     * Mmd model morph information
     */
    export type Morph = GroupMorph | BoneMorph | MaterialMorph | VertexMorph | UvMorph;

    /**
     * Base morph information
     */
    export interface BaseMorph {
        /**
         * Morph name
         */
        readonly name: PmxObject.Morph["name"];

        /**
         * Morph name in english
         */
        readonly englishName: PmxObject.Morph["englishName"];

        /**
         * Morph category
         */
        readonly category: PmxObject.Morph["category"];

        /**
         * Morph type
         */
        readonly type: PmxObject.Morph["type"];
    }

    /**
     * Group morph information
     */
    export interface GroupMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.GroupMorph["type"];

        /**
         * Morph indices
         */
        readonly indices: PmxObject.Morph.GroupMorph["indices"];

        /**
         * Morph ratios
         */
        readonly ratios: PmxObject.Morph.GroupMorph["ratios"];
    }

    /**
     * Bone morph information
     */
    export interface BoneMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.BoneMorph["type"];

        /**
         * Morph indices
         */
        readonly indices: PmxObject.Morph.BoneMorph["indices"];

        /**
         * Morph positions
         *
         * Repr: [..., x, y, z, ...]
         */
        readonly positions: PmxObject.Morph.BoneMorph["positions"];

        /**
         * Morph rotations in quaternion
         *
         * Repr: [..., x, y, z, w, ...]
         */
        readonly rotations: PmxObject.Morph.BoneMorph["rotations"];
    }

    /**
     * Material morph information
     */
    export interface MaterialMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.MaterialMorph["type"];

        /**
         * Morph elements
         *
         * @see PmxObject.Morph.MaterialMorph["elements"]
         */
        readonly elements: PmxObject.Morph.MaterialMorph["elements"];
    }

    /**
     * Vertex morph information
     */
    export interface VertexMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.VertexMorph["type"];

        /**
         * The morph targets that drive this vertex morph
         */
        readonly morphTargets: MorphTarget[];
    }

    /**
     * UV morph information
     */
    export interface UvMorph extends BaseMorph {
        /**
         * Morph type
         */
        readonly type: PmxObject.Morph.UvMorph["type"];

        /**
         * The morph targets that drive this uv morph
         */
        readonly morphTargets: MorphTarget[];
    }

    /**
     * Mmd model bone information
     */
    export interface Bone {
        /**
         * Bone name
         */
        readonly name: PmxObject.Bone["name"];

        /**
         * Bone name in english
         */
        readonly englishName: PmxObject.Bone["englishName"];

        /**
         * Parent bone index
         */
        readonly parentBoneIndex: PmxObject.Bone["parentBoneIndex"];

        /**
         * Transform order
         *
         * @see PmxObject.Bone["transformOrder"]
         */
        readonly transformOrder: PmxObject.Bone["transformOrder"];

        /**
         * Bone flag
         *
         * @see PmxObject.Bone.Flag
         */
        readonly flag: PmxObject.Bone["flag"];

        /**
         * Append transform (optional)
         *
         * @see PmxObject.Bone["appendTransform"]
         */
        readonly appendTransform: PmxObject.Bone["appendTransform"];

        /**
         * IK information (optional)
         *
         * @see PmxObject.Bone["ik"]
         */
        readonly ik: PmxObject.Bone["ik"];
    }

    /**
     * Mmd model morph information for serialization
     */
    export type SerializationMorph = GroupMorph | BoneMorph | MaterialMorph | SerializationVertexMorph | SerializationUvMorph;

    /**
     * Vertex morph information for serialization
     */
    export interface SerializationVertexMorph extends VertexMorph {
        elements: SerializationVertexMorphElement[];
    }

    /**
     * Vertex morph element information for serialization
     */
    export interface SerializationVertexMorphElement {
        /**
         * Mesh index
         */
        readonly meshIndex: number;

        /**
         * Vertex indices
         */
        readonly indices: PmxObject.Morph.VertexMorph["indices"];

        /**
         * Vertex position offsets
         *
         * Repr: [..., x, y, z, ...]
         */
        readonly offsets: PmxObject.Morph.VertexMorph["positions"];
    }

    /**
     * UV morph information for serialization
     */
    export interface SerializationUvMorph extends UvMorph {
        elements: SerializationUvMorphElement[];
    }

    /**
     * UV morph element information for serialization
     */
    export interface SerializationUvMorphElement {
        /**
         * Mesh index
         */
        readonly meshIndex: number;

        /**
         * Vertex indices
         */
        readonly indices: PmxObject.Morph.UvMorph["indices"];

        /**
         * UV offsets
         *
         * Repr: [..., x, y, ...]
         */
        readonly offsets: PmxObject.Morph.UvMorph["offsets"];
    }

    /**
     * Mmd model bone information for serialization
     */
    export interface SerializationBone extends Bone {
        /**
         * This property is not used in runtime but used in editor
         */
        readonly tailPosition: PmxObject.Bone["tailPosition"];

        /**
         * This property is not used in runtime but used in editor
         */
        readonly axisLimit: PmxObject.Bone["axisLimit"];

        /**
         * This property is not used in runtime but used in editor
         */
        readonly localVector: PmxObject.Bone["localVector"];

        /**
         * This property is not used in runtime but used in editor
         */
        readonly externalParentTransform: PmxObject.Bone["externalParentTransform"];
    }

    /**
     * Mmd model material information for serialization
     */
    export interface MaterialMetadata {
        /**
         * Material name in english
         */
        readonly englishName: PmxObject.Material["englishName"];

        /**
         * Material comment
         */
        readonly comment: PmxObject.Material["comment"];

        /**
         * Is double sided
         */
        readonly isDoubleSided: boolean;
    }

    /**
     * Check if the metadata is a serialization metadata
     * @param metadata Metadata to check
     * @returns `true` if the metadata is a serialization metadata
     */
    export function isSerializationMetadata(metadata: MmdModelMetadata): metadata is MmdModelSerializationMetadata {
        return (metadata as MmdModelSerializationMetadata).containsSerializationData === true;
    }
}
