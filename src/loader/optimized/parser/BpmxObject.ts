import type { PmxObject } from "@/loader/parser/PmxObject";

export type BpmxObject = Readonly<{
    header: BpmxObject.Header;
    geometry: BpmxObject.Geometry;
    textures: readonly BpmxObject.Texture[];
    materials: readonly BpmxObject.Material[];
    bones: readonly BpmxObject.Bone[];
    morphs: readonly BpmxObject.Morph[];
    displayFrames: readonly BpmxObject.DisplayFrame[];
    rigidBodies: readonly BpmxObject.RigidBody[];
    joints: readonly BpmxObject.Joint[];
}>;

export namespace BpmxObject {
    export type Header = Readonly<{
        signature: string;
        version: [number, number, number];

        modelName: string;
        englishModelName: string;
        comment: string;
        englishComment: string;
    }>;

    export type Geometry = Readonly<{
        positions: Float32Array;
        normals: Float32Array;
        uvs: Float32Array;
        indices: Uint16Array | Uint32Array;
        matricesIndices: Float32Array;
        matricesWeights: Float32Array;
        sdef: {
            c: Float32Array;
            r0: Float32Array;
            r1: Float32Array;
        } | undefined;
    }>;

    export type Texture = Readonly<{
        name: string;
        data: ArrayBuffer;
    }>;

    export type Material = PmxObject.Material & Readonly<{
        evauatedTransparency: number;
    }>;

    export type Bone = PmxObject.Bone;

    export type Morph = Morph.GroupMorph | Morph.VertexMorph | Morph.BoneMorph | Morph.UvMorph;

    export namespace Morph {
        export type BaseMorph = Readonly<{
            name: string;
            englishName: string;

            category: PmxObject.Morph.Category;
            type: PmxObject.Morph.Type;
        }>;

        export type GroupMorph = BaseMorph & Readonly<{
            elements: Int32Array; // morph index
            elements2: Float32Array; // morph weight
            elements3: null;
        }>;

        export type VertexMorph = BaseMorph & Readonly<{
            elements: Int32Array; // vertex index
            elements2: Float32Array; // vertex offset
            elements3: null;
        }>;

        export type BoneMorph = BaseMorph & Readonly<{
            elements: Int32Array; // bone index
            elements2: Float32Array; // bone position
            elements3: Float32Array; // bone rotation
        }>;

        export type UvMorph = BaseMorph & Readonly<{
            elements: Int32Array; // vertex index
            elements2: Float32Array; // uv offset
            elements3: null;
        }>;
    }

    export type DisplayFrame = PmxObject.DisplayFrame;

    export type RigidBody = PmxObject.RigidBody;

    export type Joint = PmxObject.Joint;
}
