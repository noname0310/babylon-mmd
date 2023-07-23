import type { PmxObject } from "@/Loader/Parser/pmxObject";

/**
 * BpmxObject is a type that represents the data of a model in the BPMX format
 *
 * BPMX is a single binary file format that contains all the data of a model
 */
export type BpmxObject = Readonly<{
    /**
     * Header of the BPMX file
     */
    header: BpmxObject.Header;

    /**
     * Geometry data of the model
     */
    geometry: BpmxObject.Geometry;

    /**
     * Textures of the model
     */
    textures: readonly BpmxObject.Texture[];

    /**
     * Material information of the model
     */
    materials: readonly BpmxObject.Material[];

    /**
     * Bone information of the model
     */
    bones: readonly BpmxObject.Bone[];

    /**
     * Morph information of the model
     */
    morphs: readonly BpmxObject.Morph[];

    /**
     * Display frames of the model
     */
    displayFrames: readonly BpmxObject.DisplayFrame[];

    /**
     * Rigid body information of the model
     */
    rigidBodies: readonly BpmxObject.RigidBody[];

    /**
     * Joint information of the model
     */
    joints: readonly BpmxObject.Joint[];
}>;

export namespace BpmxObject {
    /**
     * Header of the BPMX file
     */
    export type Header = Readonly<{
        /**
         * Signature of the BPMX file (always "BPMX")
         */
        signature: string;

        /**
         * Version of the BPMX file
         */
        version: readonly [number, number, number];

        /**
         * Model name
         */
        modelName: string;

        /**
         * Model name in English
         */
        englishModelName: string;

        /**
         * Comment
         */
        comment: string;

        /**
         * Comment in English
         */
        englishComment: string;
    }>;

    /**
     * Geometry data of the model
     */
    export type Geometry = Readonly<{
        /**
         * Vertex positions
         *
         * Repr: [..., x, y, z, ...]
         */
        positions: Float32Array;

        /**
         * Vertex normals
         *
         * Repr: [..., x, y, z, ...]
         */
        normals: Float32Array;

        /**
         * Vertex texture coordinates
         *
         * Repr: [..., u, v, ...]
         */
        uvs: Float32Array;

        /**
         * Indices of the geometry
         *
         * Repr: [..., index0, ...]
         */
        indices: Uint16Array | Uint32Array;

        /**
         * Bone vertex indices
         *
         * Repr: [..., boneIndex0, boneIndex1, boneIndex2, boneIndex3, ...]
         */
        matricesIndices: Float32Array;

        /**
         * Bone vertex weights
         *
         * Repr: [..., boneWeight0, boneWeight1, boneWeight2, boneWeight3, ...]
         */
        matricesWeights: Float32Array;

        /**
         * SDEF data(optional)
         */
        sdef: {
            /**
             * SDEF center
             *
             * Repr: [..., x, y, z, ...]
             */
            c: Float32Array;

            /**
             * SDEF r0
             *
             * Repr: [..., x, y, z, ...]
             */
            r0: Float32Array;

            /**
             * SDEF r1
             *
             * Repr: [..., x, y, z, ...]
             */
            r1: Float32Array;
        } | undefined;
    }>;

    /**
     * Texture of the model
     */
    export type Texture = Readonly<{
        /**
         * Relative path of the texture e.g. "tex/texture.png"
         *
         * Used as a key to load the texture not as a path
         */
        relativePath: string;

        /**
         * Texture datd encoded in PNG/JPG/BMP
         */
        data: ArrayBuffer;
    }>;

    /**
     * Material information of the model
     *
     * This type is a subset of PmxObject.Material
     *
     * @see PmxObject.Material
     */
    export type Material = PmxObject.Material & Readonly<{
        /**
         * pre-evaluated transparency of the material
         *
         * 0: opaque
         *
         * 1: alpha-test
         *
         * 2: alpha-blend
         */
        evauatedTransparency: number;
    }>;

    /**
     * Bone information of the model
     *
     * This type is a subset of PmxObject.Bone
     *
     * @see PmxObject.Bone
     */
    export type Bone = PmxObject.Bone;

    /**
     * Morph information of the model
     *
     * This type is a subset of PmxObject.Morph
     *
     * @see PmxObject.Morph
     */
    export type Morph = PmxObject.Morph.GroupMorph
        | PmxObject.Morph.VertexMorph
        | PmxObject.Morph.BoneMorph
        | PmxObject.Morph.UvMorph
        | PmxObject.Morph.MaterialMorph;

    export namespace Morph {
        /**
         * Type of the morph
         */
        export type Type = PmxObject.Morph.Type.GroupMorph
            | PmxObject.Morph.Type.VertexMorph
            | PmxObject.Morph.Type.BoneMorph
            | PmxObject.Morph.Type.UvMorph
            | PmxObject.Morph.Type.AdditionalUvMorph1
            | PmxObject.Morph.Type.AdditionalUvMorph2
            | PmxObject.Morph.Type.AdditionalUvMorph3
            | PmxObject.Morph.Type.AdditionalUvMorph4
            | PmxObject.Morph.Type.MaterialMorph;
    }

    /**
     * Display frame of the model
     *
     * This type is a subset of PmxObject.DisplayFrame
     *
     * @see PmxObject.DisplayFrame
     */
    export type DisplayFrame = PmxObject.DisplayFrame;

    /**
     * Rigid body information of the model
     *
     * This type is a subset of PmxObject.RigidBody
     *
     * @see PmxObject.RigidBody
     */
    export type RigidBody = PmxObject.RigidBody;

    /**
     * Joint information of the model
     *
     * This type is a subset of PmxObject.Joint
     *
     * @see PmxObject.Joint
     */
    export type Joint = PmxObject.Joint;
}
