import type { PmxObject } from "@/Loader/Parser/pmxObject";

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
        version: readonly [number, number, number];

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
        relativePath: string;
        data: ArrayBuffer;
    }>;

    export type Material = PmxObject.Material & Readonly<{
        evauatedTransparency: number;
    }>;

    export type Bone = PmxObject.Bone;

    export type Morph = PmxObject.Morph.GroupMorph
        | PmxObject.Morph.VertexMorph
        | PmxObject.Morph.BoneMorph
        | PmxObject.Morph.UvMorph
        | PmxObject.Morph.MaterialMorph;

    export namespace Morph {
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

    export type DisplayFrame = PmxObject.DisplayFrame;

    export type RigidBody = PmxObject.RigidBody;

    export type Joint = PmxObject.Joint;
}
