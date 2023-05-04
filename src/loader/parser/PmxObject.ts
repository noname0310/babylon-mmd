import type * as BABYLON from "babylonjs";

export type PmxObject = Readonly<{
    header: PmxObject.Header;
    vertices: PmxObject.Vertex[];
    faces: PmxObject.Face[];
    textures: PmxObject.Texture[];
    materials: PmxObject.Material[];
    bones: PmxObject.Bone[];
    morphs: PmxObject.Morph[];
    displayFrame: PmxObject.DisplayFrame[];
    rigidBodies: PmxObject.RigidBody[];
    joints: PmxObject.Joint[];
    softBodies: PmxObject.SoftBody[];
}>;

export namespace PmxObject {
    export type Header = Readonly<{
        signature: string;
        version: number;

        encoding: Header.Encoding;
        additionalUvCount: 0 | 1 | 2 | 3 | 4;

        vertexIndexSize: 1 | 2 | 4;
        textureIndexSize: 1 | 2 | 4;
        materialIndexSize: 1 | 2 | 4;
        boneIndexSize: 1 | 2 | 4;
        morphIndexSize: 1 | 2 | 4;
        rigidBodyIndexSize: 1 | 2 | 4;

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

    export namespace Header {
        export enum Encoding {
            utf16le = 0,
            utf8 = 1
        }
    }

    export type Vertex = Readonly<{
        position: BABYLON.Vector3;
        normal: BABYLON.Vector3;
        uv: BABYLON.Vector2;
        additionalVec4: [number, number, number, number];
        weightType: Vertex.BoneWeightType;
        boneWeight: Vertex.BoneWeight;
        edgeRatio: number;
    }>;

    export namespace Vertex {
        export enum BoneWeightType {
            bdef1 = 0,
            bdef2 = 1,
            bdef4 = 2,
            sdef = 3,
            qdef = 4
        }

        export type BoneWeightSDEF = Readonly<{
            bone1Weight: number;
            c: BABYLON.Vector3;
            r0: BABYLON.Vector3;
            r1: BABYLON.Vector3;
        }>;

        export type BoneWeight<T extends BoneWeightType = Vertex.BoneWeightType> = Readonly<{
            boneIndices: T extends BoneWeightType.bdef1 ? [number]
                : T extends BoneWeightType.bdef2 ? [number, number]
                : T extends BoneWeightType.bdef4 ? [number, number, number, number]
                : T extends BoneWeightType.sdef ? [number, number]
                : T extends BoneWeightType.qdef ? [number, number, number, number]
                : never;

            boneWeights: T extends BoneWeightType.bdef1 ? never
                : T extends BoneWeightType.bdef2 ? [number]
                : T extends BoneWeightType.bdef4 ? [number, number, number, number]
                : T extends BoneWeightType.sdef ? BoneWeightSDEF
                : T extends BoneWeightType.qdef ? [number, number, number, number]
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
        faceCount: number;
    }>;

    export namespace Material {
        export enum Flag {
            isDoubleSided = 1 << 0,
            enabledGroundShadow = 1 << 1,
            enabledDrawShadow = 1 << 2,
            enabledReceiveShadow = 1 << 3,
            enabledToonEdge = 1 << 4,
            enabledVertexColor = 1 << 5,
            enabledPointDraw = 1 << 6,
            enabledLineDraw = 1 << 7
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
            rotationConstraint: number; // (a.k.a. Angle) radians
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
            | Morph.MaterialMorph[]
            | Morph.FlipMorph[]
            | Morph.ImpulseMorph[];
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
            materialMorph = 8,
            flipMorph = 9,
            impulseMorph = 10
        }

        export type GroupMorph = Readonly<{
            index: number; // morph index (cannot be group morph)
            ratio: number;
        }>;

        export type VertexMorph = Readonly<{
            index: number; // vertex index
            position: BABYLON.Vector3;
        }>;

        export type BoneMorph = Readonly<{
            index: number; // bone index
            position: BABYLON.Vector3;
            rotation: BABYLON.Quaternion;
        }>;

        export type UvMorph = Readonly<{
            index: number; // vertex index
            offset: [number, number, number, number]
        }>;

        export type MaterialMorph = Readonly<{
            index: number; // material index
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

        export type FlipMorph = Readonly<{
            index: number; // morph index
            value: number;
        }>;

        export type ImpulseMorph = Readonly<{
            index: number; // rigidbody index
            isLocal: boolean;
            velocity: BABYLON.Vector3;
            torque: BABYLON.Vector3;
        }>;
    }

    export type DisplayFrame = Readonly<{
        name: string;
        englishName: string;

        isSpecialFrame: boolean;
        data: DisplayFrame.FrameData[];
    }>;

    export namespace DisplayFrame {
        export type FrameData = Readonly<{
            type: FrameData.FrameType;
            index: number; // bone or morph index
        }>;

        export namespace FrameData {
            export enum FrameType {
                Bone = 0,
                Morph = 1
            }
        }
    }

    export type RigidBody = Readonly<{
        name: string;
        englishName: string;

        boneIndex: number;
        collisionGroup: number;
        collisionMask: number;
        shapeType: RigidBody.ShapeType;
        shapeSize: BABYLON.Vector3;
        shapePosition: BABYLON.Vector3;
        shapeRotation: BABYLON.Vector3;
        mass: number;
        linearDamping: number;
        angularDamping: number;
        repulsion: number;
        friction: number;
        physicsMode: RigidBody.PhysicsMode;
    }>;

    export namespace RigidBody {
        export enum ShapeType {
            sphere = 0,
            box = 1,
            capsule = 2
        }

        export enum PhysicsMode {
            followBone = 0,
            physics = 1,
            physicsWithBone = 2
        }
    }

    export type Joint = Readonly<{
        name: string;
        englishName: string;

        type: Joint.Type;
        rigidbodyIndexA: number;
        rigidbodyIndexB: number;
        position: BABYLON.Vector3;
        rotation: BABYLON.Vector3;
        positionMin: BABYLON.Vector3;
        positionMax: BABYLON.Vector3;
        rotationMin: BABYLON.Vector3;
        rotationMax: BABYLON.Vector3;
        springPosition: BABYLON.Vector3;
        springRotation: BABYLON.Vector3;
    }>;

    export namespace Joint {
        export enum Type {
            spring6dof = 0,
            sixdof = 1,
            p2p = 2,
            coneTwist = 3,
            slider = 4,
            hinge = 5
        }
    }

    export type SoftBody = Readonly<{
        name: string;
        englishName: string;

        type: SoftBody.Type;
        materialIndex: number;
        collisionGroup: number;
        collisionMask: number;
        flags: SoftBody.Flag;
        bLinkDistance: number;
        clusterCount: number;
        totalMass: number;
        collisionMargin: number;
        aeroModel: SoftBody.AeroDynamicModel;

        config: SoftBody.Config;
        cluster: SoftBody.Cluster;
        interation: SoftBody.Interation;
        material: SoftBody.Material;

        anchors: SoftBody.AnchorRigidBody[];
        vertexPins: number[];
    }>;

    export namespace SoftBody {
        export enum Type {
            triMesh = 0,
            rope = 1
        }

        export enum Flag {
            bLink = 0x0001,
            clusterCreation = 0x0002,
            linkCrossing = 0x0004
        }

        export enum AeroDynamicModel {
            vertexPoint = 0,
            vertexTwoSided = 1,
            vertexOneSided = 2,
            faceTwoSided = 3,
            faceOneSided = 4
        }

        export type AnchorRigidBody = Readonly<{
            rigidbodyIndex: number;
            vertexIndex: number;
            nearMode: number;
        }>;

        export type Config = Readonly<{
            vcf: number; // Velocities correction factor (Baumgarte)
            dp: number; // Damping coefficient
            dg: number; // Drag coefficient
            lf: number; // Lift coefficient
            pr: number; // Pressure coefficient
            vc: number; // Volume conversation coefficient
            df: number; // Dynamic friction coefficient
            mt: number; // Pose matching coefficient
            chr: number; // Rigid contacts hardness
            khr: number; // Kinetic contacts hardness
            shr: number; // Soft contacts hardness
            ahr: number; // Anchors hardness
        }>;

        export type Cluster = Readonly<{
            srhrCl: number; // Soft vs rigid hardness
            skhrCl: number; // Soft vs kinetic hardness
            sshrCl: number; // Soft vs soft hardness
            srSpltCl: number; // Soft vs rigid impulse split
            skSpltCl: number; // Soft vs rigid impulse split
            ssSpltCl: number; // Soft vs rigid impulse split
        }>;

        export type Interation = Readonly<{
            vIt: number; // Velocities iteration
            pIt: number; // Positions iteration
            dIt: number; // Drift iteration
            cIt: number; // Cluster iteration
        }>;

        export type Material = Readonly<{
            lst: number; // Linear stiffness coefficient
            ast: number; // Area/Angular stiffness coefficient
            vst: number; // Volume stiffness coefficient
        }>;
    }
}
