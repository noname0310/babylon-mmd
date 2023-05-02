import * as BABYLON from "babylonjs";

export type PmxObject = Readonly<{
    header: PmxObject.Header;
    vertices: PmxObject.Vertex[];
    faces: PmxObject.Face[];
    textures: PmxObject.Texture[];
    materials: PmxObject.Material[];
    bones: PmxObject.Bone[];
    morphs: PmxMorphInfo[];
    frames: PmxFrameInfo[];
    rigidBodies: PmxRigidBodyInfo[];
    constraints: PmxConstraintInfo[];
}>;

export namespace PmxObject {
    export type Header = Readonly<{
        sign: string;
        version: number;

        encoding: number;
        additionalUvCount: number;

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
        displayCount: number;
        rigidBodyCount: number;
        jointCount: number; // (a.k.a. constraintCount)
    }>;

    export type Vertex = Readonly<{
        position: BABYLON.Vector3;
        normal: BABYLON.Vector3;
        uv: BABYLON.Vector2;
        additionalUvs: [number, number, number, number];
        weightType: Vertex.BoneWeightType;
        boneWeight: Vertex.BoneWeight;
        edgeRatio: number;
    }>;

    export namespace Vertex {    
        export enum BoneWeightType {
            BDEF1 = 0,
            BDEF2 = 1,
            BDEF4 = 2,
            SDEF = 3
        }

        export type BoneWeightSDEF = Readonly<{
            c: BABYLON.Vector3;
            r0: BABYLON.Vector3;
            r1: BABYLON.Vector3;
        }>;

        export type BoneWeight<T extends BoneWeightType = Vertex.BoneWeightType> = Readonly<{
            boneIndices: T extends BoneWeightType.BDEF1 ? [number] 
                : T extends BoneWeightType.BDEF2 ? [number, number]
                : T extends BoneWeightType.BDEF4 ? [number, number, number, number]
                : T extends BoneWeightType.SDEF ? [number, number]
                : never;

            boneWeights: T extends BoneWeightType.BDEF1 ? never
                : T extends BoneWeightType.BDEF2 ? [number]
                : T extends BoneWeightType.BDEF4 ? [number, number, number, number]
                : T extends BoneWeightType.SDEF ? BoneWeightSDEF
                : never;
        }>;
    }

    export type Texture = string;

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
        sphereTextureIndex: number;
        sphereTextureMode: number;

        isSharedToonTexture: boolean;
        toonTextureIndex: number;
        
        comment: string;
        vertexCount: number;
    }>;

    export namespace Material {
        export enum Flag {
            IsDoubleSided = 1 << 0,
            EnabledGroundShadow = 1 << 1,
            EnabledSelfShadowMap = 1 << 2,
            EnabledSelfShadow = 1 << 3,
            EnabledToonEdge = 1 << 4
        }
    }

    export type Bone = Readonly<{
        name: string;
        englishName: string;

        position: BABYLON.Vector3;
        parentIndex: number;
        transformOrder: number;
        
        displayConnection: number | BABYLON.Vector3; // (a.k.a. Link to)

        additionalMove?: {
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
