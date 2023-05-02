import * as BABYLON from "babylonjs";

export type PmxObject = Readonly<{
    header: PmxObject.Header;
    vertices: PmxObject.Vertex[];
    faces: PmxObject.Face[];
    textures: string[];
    materials: PmxObject.Material[];
    bones: PmxObject.Bone[];
    morphs: PmxMorphInfo[];
    frames: PmxFrameInfo[];
    rigidBodies: PmxRigidBodyInfo[];
    constraints: PmxConstraintInfo[];
}>;

namespace PmxObject {
    export type Header = Readonly<{
        magic: string;
        version: number;
        headerSize: number;
        encoding: number;
        additionalUvNum: number;
        vertexIndexSize: number;
        textureIndexSize: number;
        materialIndexSize: number;
        boneIndexSize: number;
        morphIndexSize: number;
        rigidBodyIndexSize: number;
        modelName: string;
        englishModelName: string;
        comment: string;
        englishComment: string;
        vertexCount: number;
        faceCount: number;
        textureCount: number;
        materialCount: number;
        boneCount: number;
        morphCount: number;
        frameCount: number;
        rigidBodyCount: number;
        constraintCount: number;
    }>;

    export type Vertex = Readonly<{
        position: BABYLON.Vector3;
        normal: BABYLON.Vector3;
        uv: BABYLON.Vector2;
        auvs: [number, number, number, number];
        type: number;
        skinIndices: number[];
        skinWeights: number[];
        skinC?: BABYLON.Vector3;
        skinR0?: BABYLON.Vector3;
        skinR1?: BABYLON.Vector3;
        edgeRatio: number;
    }>;

    export type Face = Readonly<{
        indices: [number, number, number];
    }>;

    export type Material = Readonly<{
        name: string;
        englishName: string;
        diffuse: [number, number, number, number];
        specular: [number, number, number];
        shininess: number;
        ambient: [number, number, number];
        flag: number;
        edgeColor: [number, number, number, number];
        edgeSize: number;
        textureIndex: number;
        envTextureIndex: number;
        envFlag: number;
        toonFlag: number;
        toonIndex: number;
        comment: string;
        faceCount: number;
    }>;

    export type Bone = Readonly<{
        name: string;
        englishName: string;
        position: BABYLON.Vector3;
        parentIndex: number;
        transformationClass: number;
        flag: number;
        connectIndex?: number;
        offsetPosition?: BABYLON.Vector3;
        grant?: {
            isLocal: boolean;
            affectRotation: boolean;
            affectPosition: boolean;
            parentIndex: number;
            ratio: number;
        };
        fixAxis?: [number, number, number];
        localXVector?: BABYLON.Vector3;
        localZVector?: BABYLON.Vector3;
        key?: number;
        ik?: {
            effector: number;
            target: any;
            iteration: number;
            maxAngle: number;
            linkCount: number;
            links: {
                index: number;
                angleLimitation: number;
                lowerLimitationAngle?: [number, number, number];
                upperLimitationAngle?: [number, number, number];
            }[];
        }
    }>;

    export type Morph = Readonly<{
        name: string;
        englishName: string;
        panel: number;
        type: number;
        offsets: {
            index: number;
            position?: BABYLON.Vector3;
            normal?: BABYLON.Vector3;
            uv?: BABYLON.Vector2;
            additionalUv?: BABYLON.Vector4;
            bone?: {
                index: number;
                position?: BABYLON.Vector3;
                rotation?: BABYLON.Vector4;
            };
            material?: {
                index: number;
                operation: number;
                diffuse?: [number, number, number, number];
                specular?: [number, number, number];
                shininess?: number;
                ambient?: [number, number, number];
                edgeColor?: [number, number, number, number];
                edgeSize?: number;
                texture?: number;
                sphereTexture?: number;
                sphereMode?: number;
                toonTexture?: number;
            };
            group?: {
                index: number;
                morphs: {
                    index: number;
                    ratio: number;
                }[];
            };
        }[];
    }>;
}
