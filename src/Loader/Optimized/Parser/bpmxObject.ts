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
    geometries: readonly BpmxObject.Geometry[];

    /**
     * Images of the model
     */
    images: readonly BpmxObject.Image[];

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
         * Name of the geometry
         */
        name: string;

        /**
         * Material index of the geometry
         *
         * If the material index is -1, the geometry has no material
         */
        materialIndex: number | readonly Geometry.SubGeometry[];

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
         * Additional vertex texture coordinates
         *
         * Repr: [..., x, y, z, w, ...][length = 0..=4]
         */
        additionalUvs: readonly Float32Array[];

        /**
         * Indices of the geometry
         *
         * If mesh is not indexed, this is undefined
         *
         * Repr: [..., index0, ...]
         */
        indices: Int32Array | Uint32Array | Uint16Array | undefined;

        /**
         * Skinning data of the geometry
         *
         * If mesh is not skinned, this is undefined
         */
        skinning: Geometry.Skinning | undefined;

        /**
         * Edge scale of the geometry
         */
        edgeScale: Float32Array | undefined;
    }>;

    export namespace Geometry {
        /**
         * Attributes for all geometries
         */
        export enum MeshType {
            /**
             * Mesh is skinned (has bone weights and indices)
             */
            IsSkinnedMesh = 1 << 0
        }

        /**
         * Attributes for each geometry
         */
        export enum GeometryType {
            /**
             * Geometry has SDEF data
             */
            HasSdef = 1 << 0,

            /**
             * Geometry is indexed
             */
            IsIndexed = 1 << 1,

            /**
             * Geometry has edge scale
             */
            HasEdgeScale = 1 << 2
        }

        /**
         * Index element type
         */
        export enum IndexElementType {
            /**
             * 32-bit signed integer
             */
            Int32 = 0,

            /**
             * 32-bit unsigned integer
             */
            Uint32 = 1,

            /**
             * 16-bit unsigned integer
             */
            Uint16 = 2
        }

        /**
         * Sub geometry for multi-material geometry
         */
        export type SubGeometry = Readonly<{
            /**
             * Material index of the geometry
             */
            materialIndex: number;

            /**
             * vertex index start
             */
            verticesStart: number;

            /**
             * vertices count
             */
            verticesCount: number;

            /**
             * Index start of the geometry
             */
            indexStart: number;

            /**
             * Index count of the geometry
             */
            indexCount: number;
        }>;

        /**
         * Skinning data of the geometry
         */
        export type Skinning = Readonly<{
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
    }

    /**
     * Image data of the texture
     */
    export type Image = Readonly<{
        /**
         * Relative path of the texture e.g. "tex/texture.png"
         *
         * Used as a key to load the texture not as a path
         */
        relativePath: string;

        /**
         * MIME type of the texture
         *
         * e.g. "image/png"
         */
        mimeType: string | undefined;

        /**
         * Texture data encoded in PNG/JPG/BMP
         */
        data: ArrayBuffer;
    }>;

    export namespace Image {
        /**
         * Flag of the image
         */
        export enum Flag {
            /**
             * Has mime type
             */
            HasMimeType = 1 << 0
        }
    }

    /**
     * Texture of the model
     */
    export type Texture = Readonly<{
        /**
         * Flag of the texture
         *
         * @see BpmxObject.Texture.Flag
         */
        flag: number;

        /**
         * Image sampling mode
         */
        samplingMode: number;

        /**
         * Image index
         */
        imageIndex: number;
    }>;

    export namespace Texture {
        /**
         * Flag of the texture
         */
        export enum Flag {
            /**
             * Disable mipmap
             */
            NoMipmap = 1 << 0,

            /**
             * Invert Y axis of the texture
             */
            InvertY = 1 << 1
        }
    }

    /**
     * Material information of the model
     *
     * This type is a subset of PmxObject.Material
     *
     * @see PmxObject.Material
     */
    export type Material = Omit<PmxObject.Material, "indexCount"> & Readonly<{
        /**
         * pre-evaluated transparency of the material
         *
         * evaluatedTransparency representation:
         *
         * reserved | is complete opaque | alpha evaluate result
         *
         * 00       | 00                 | 0000
         *
         * reserved: 11: default value
         *
         * is complete opaque: 11: not evaluated, 00: complete opaque, 01: not complete opaque
         *
         * alpha evaluate result: 1111: not evaluated, 0000: opaque, 0001: alphatest, 0010: alphablend, 0011: alphatest and blend
         */
        evaluatedTransparency: number;
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
        | Morph.VertexMorph
        | PmxObject.Morph.BoneMorph
        | Morph.UvMorph
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

        /**
         * Vertex morph is a morph that moves the vertex
         */
        export type VertexMorph = PmxObject.Morph.BaseMorph & Readonly<{
            /**
             * Type of the morph
             */
            type: PmxObject.Morph.Type.VertexMorph;

            /**
             * Vertex morph elements
             */
            elements: readonly VertexMorphElement[];
        }>;

        /**
         * Vertex morph element for single mesh
         */
        export type VertexMorphElement = Readonly<{
            /**
             * mesh index
             */
            meshIndex: number;

            /**
             * Vertex indices
             */
            indices: Int32Array;

            /**
             * Vertex position offsets
             *
             * Repr: [..., x, y, z, ...]
             */
            offsets: Float32Array;
        }>;

        /**
         * UV morph is a morph that moves the UV coordinate
         */
        export type UvMorph = PmxObject.Morph.BaseMorph & Readonly<{
            /**
             * Type of the morph
             */
            type: PmxObject.Morph.Type.UvMorph
                | PmxObject.Morph.Type.AdditionalUvMorph1
                | PmxObject.Morph.Type.AdditionalUvMorph2
                | PmxObject.Morph.Type.AdditionalUvMorph3
                | PmxObject.Morph.Type.AdditionalUvMorph4;

            /**
             * UV morph elements
             */
            elements: readonly UvMorphElement[];
        }>;

        /**
         * UV morph element for single mesh
         */
        export type UvMorphElement = Readonly<{
            /**
             * mesh index
             */
            meshIndex: number;

            /**
             * Vertex indices
             */
            indices: Int32Array;

            /**
             * UV offsets
             *
             * Repr: [..., u, v, ...]
             */
            offsets: Float32Array;
        }>;
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
