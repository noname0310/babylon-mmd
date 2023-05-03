import * as BABYLON from "babylonjs";

export type PmxObject = Readonly<{
    header: PmxObject.Header;
    vertices: PmxObject.Vertex[];
    faces: PmxObject.Face[];
    textures: PmxObject.Texture[];
    materials: PmxObject.Material[];
    bones: PmxObject.Bone[];
    morphs: PmxObject.Morph[];
    display: PmxObject.Display[];
    rigidBodies: PmxObject.RigidBody[];
    constraints: PmxObject.Constraint[];
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

        // vertexCount: number;
        // faceCount: number;
        // textureCount: number;
        // materialCount: number;
        // boneCount: number;
        // morphCount: number;
        // displayCount: number;
        // rigidBodyCount: number;
        // jointCount: number; // (a.k.a. constraintCount)
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
            bdef1 = 0,
            bdef2 = 1,
            bdef4 = 2,
            sdef = 3
        }

        export type BoneWeightSDEF = Readonly<{
            c: BABYLON.Vector3;
            r0: BABYLON.Vector3;
            r1: BABYLON.Vector3;
        }>;

        export type BoneWeight<T extends BoneWeightType = Vertex.BoneWeightType> = Readonly<{
            boneIndices: T extends BoneWeightType.bdef1 ? [number] 
                : T extends BoneWeightType.bdef2 ? [number, number]
                : T extends BoneWeightType.bdef4 ? [number, number, number, number]
                : T extends BoneWeightType.sdef ? [number, number]
                : never;

            boneWeights: T extends BoneWeightType.bdef1 ? never
                : T extends BoneWeightType.bdef2 ? [number]
                : T extends BoneWeightType.bdef4 ? [number, number, number, number]
                : T extends BoneWeightType.sdef ? BoneWeightSDEF
                : never;
        }>;
    }

    export type Texture = string;

    export type Face = Readonly<[number, number, number]>; // indices

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
        sphereTextureMode: Material.SphereTextureMode;

        isSharedToonTexture: boolean;
        toonTextureIndex: number;
        
        comment: string;
        vertexCount: number;
    }>;

    export namespace Material {
        export enum Flag {
            isDoubleSided = 1 << 0,
            enabledGroundShadow = 1 << 1, 
            enabledSelfShadowMap = 1 << 2,
            enabledSelfShadow = 1 << 3,
            enabledToonEdge = 1 << 4
        }

        export enum SphereTextureMode {
            off = 0,
            multiply = 1,
            add = 2,
            subTexture = 3
        }
    }

    export type Bone = Readonly<{
        name: string;
        englishName: string;

        position: BABYLON.Vector3;
        parentIndex: number;
        transformOrder: number; // (a.k.a. Deform) todo: need to check
        
        flag: number;
        displayConnection: number | BABYLON.Vector3; // (a.k.a. Link to)

        additionalMove?: {
            isLocal: boolean;
            affectRotation: boolean;
            affectPosition: boolean;
            parentIndex: number;
            ratio: number;
        };
        axisLimit?: [number, number, number];
        localVector?: {
            x: BABYLON.Vector3;
            z: BABYLON.Vector3;
        };
        transformAfterPhysics?: boolean;
        externalParentTransform?: number;
        ik?: {
            target: number;
            iteration: number; // (a.k.a. Loop)
            rotationConstraint: number; // (a.k.a. Angle)
            links: Bone.IKLink[];
        }
    }>;

    export namespace Bone {
        export enum Flag {
            useBoneIndexAsConnection = 0x0001,
            isRotatable = 0x0002,
            isMovable = 0x0004,
            isVisible = 0x0008,
            isControllable = 0x0010,
            isIkEnabled = 0x0020,
            hasAdditionalRotate = 0x0100,
            hasAdditionalMove = 0x0200,
            hasAxisLimit = 0x0400,
            hasLocalVector = 0x0800,
            transformAfterPhysics = 0x1000,
            isExternalParentTransformed = 0x2000,
        }

        export type IKLink = Readonly<{
            target: number;
            limitation?: {
                maximumAngle: [number, number, number];
                minimumAngle: [number, number, number];
            };
        }>;
    }

    export type Morph = Readonly<{
        name: string;
        englishName: string;

        category: Morph.Category;
        type: Morph.Type;

        elements: Morph.GroupMorph[]
            | Morph.VertexMorph[]
            | Morph.BoneMorph[]
            | Morph.UvMorph[]
            | Morph.MaterialMorph[];
    }>;

    export namespace Morph {
        export enum Category {
            system = 0,
            eyebrow = 1,
            eye = 2,
            lip = 3,
            other = 4
        }

        export enum Type {
            groupMorph = 0,
            vertexMorph = 1,
            boneMorph = 2,
            uvMorph = 3,
            additionalUvMorph1 = 4,
            additionalUvMorph2 = 5,
            additionalUvMorph3 = 6,
            additionalUvMorph4 = 7,
            materialMorph = 8
        }

        export type GroupMorph = Readonly<{
            index: number;
            ratio: number;
        }>;

        export type VertexMorph = Readonly<{
            index: number;
            position: BABYLON.Vector3;
        }>;

        export type BoneMorph = Readonly<{
            index: number;
            position: BABYLON.Vector3;
            rotation: BABYLON.Quaternion;
        }>;

        export type UvMorph = Readonly<{
            index: number;
            offset: [number, number, number, number]
        }>;

        export type MaterialMorph = Readonly<{
            index: number;
            type: MaterialMorph.Type;
            diffuse: [number, number, number, number];
            specular: [number, number, number];
            shininess: number;
            ambient: [number, number, number];
            edgeColor: [number, number, number, number];
            edgeSize: number;
            textureColor: [number, number, number, number];
            sphereTextureColor: [number, number, number, number];
            toonTextureColor: [number, number, number, number];
        }>;

        export namespace MaterialMorph {
            export enum Type {
                multiply = 0,
                add = 1
            }
        }
    }
}
