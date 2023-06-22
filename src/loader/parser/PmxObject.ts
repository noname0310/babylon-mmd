import type { Vec2, Vec3, Vec4 } from "./MmdTypes";

export type PmxObject = Readonly<{
    header: PmxObject.Header;
    vertices: readonly PmxObject.Vertex[];
    faces: Uint8Array | Uint16Array | Int32Array;
    textures: readonly PmxObject.Texture[];
    materials: readonly PmxObject.Material[];
    bones: readonly PmxObject.Bone[];
    morphs: readonly PmxObject.Morph[];
    displayFrames: readonly PmxObject.DisplayFrame[];
    rigidBodies: readonly PmxObject.RigidBody[];
    joints: readonly PmxObject.Joint[];
    softBodies: readonly PmxObject.SoftBody[]; // pmx 2.1 spec (which is not supported by mmd)
}>;

export namespace PmxObject {
    export type Header = Readonly<{
        signature: string;
        version: number;

        encoding: Header.Encoding;
        additionalVec4Count: number; // 0 | 1 | 2 | 3 | 4;

        vertexIndexSize: number; // 1 | 2 | 4;
        textureIndexSize: number; // 1 | 2 | 4;
        materialIndexSize: number; // 1 | 2 | 4;
        boneIndexSize: number; // 1 | 2 | 4;
        morphIndexSize: number; // 1 | 2 | 4;
        rigidBodyIndexSize: number; // 1 | 2 | 4;

        modelName: string;
        englishModelName: string;
        comment: string;
        englishComment: string;
    }>;

    export namespace Header {
        export enum Encoding {
            Utf16le = 0,
            Utf8 = 1
        }
    }

    export type Vertex = Readonly<{
        position: Vec3;
        normal: Vec3;
        uv: Vec2;
        additionalVec4: readonly Vec4[];
        weightType: Vertex.BoneWeightType;
        boneWeight: Vertex.BoneWeight;
        edgeRatio: number;
    }>;

    export namespace Vertex {
        export enum BoneWeightType {
            Bdef1 = 0,
            Bdef2 = 1,
            Bdef4 = 2,
            Sdef = 3,
            Qdef = 4 // pmx 2.1 spec (which is not supported by mmd)
        }

        export type BoneWeightSDEF = Readonly<{
            boneWeight0: number;
            c: Vec3;
            r0: Vec3;
            r1: Vec3;
        }>;

        export type BoneWeight<T extends BoneWeightType = Vertex.BoneWeightType> = Readonly<{
            boneIndices: T extends BoneWeightType.Bdef1 ? number
                : T extends BoneWeightType.Bdef2 ? Vec2
                : T extends BoneWeightType.Bdef4 ? Vec4
                : T extends BoneWeightType.Sdef ? Vec2
                : T extends BoneWeightType.Qdef ? Vec4
                : never;

            boneWeights: T extends BoneWeightType.Bdef1 ? null
                : T extends BoneWeightType.Bdef2 ? number
                : T extends BoneWeightType.Bdef4 ? Vec4
                : T extends BoneWeightType.Sdef ? BoneWeightSDEF
                : T extends BoneWeightType.Qdef ? Vec4
                : never;
        }>;
    }

    // export type Face = Readonly<Vec3>; // indices replaced to RelativeIndexable<number>

    export type Texture = string;

    export type Material = Readonly<{
        name: string;
        englishName: string;

        diffuse: Vec4;
        specular: Vec3;
        shininess: number;
        ambient: Vec3;

        flag: number;

        edgeColor: Vec4;
        edgeSize: number;

        textureIndex: number;
        sphereTextureIndex: number;
        sphereTextureMode: Material.SphereTextureMode;

        isSharedToonTexture: boolean;
        toonTextureIndex: number;

        comment: string;
        surfaceCount: number;
    }>;

    export namespace Material {
        export enum Flag {
            IsDoubleSided = 1 << 0,
            EnabledGroundShadow = 1 << 1,
            EnabledDrawShadow = 1 << 2,
            EnabledReceiveShadow = 1 << 3,
            EnabledToonEdge = 1 << 4,
            EnabledVertexColor = 1 << 5, // pmx 2.1 spec (which is not supported by mmd)
            EnabledPointDraw = 1 << 6, // pmx 2.1 spec (which is not supported by mmd)
            EnabledLineDraw = 1 << 7 // pmx 2.1 spec (which is not supported by mmd)
        }

        export enum SphereTextureMode {
            Off = 0,
            Multiply = 1,
            Add = 2,
            SubTexture = 3
        }
    }

    export type Bone = Readonly<{
        name: string;
        englishName: string;

        position: Vec3;
        parentBoneIndex: number;
        transformOrder: number; // (a.k.a. Deform)

        flag: number;
        tailPosition: number | Vec3; // (a.k.a. Link to)

        appendTransform: Readonly<{
            isLocal: boolean;
            affectRotation: boolean;
            affectPosition: boolean;
            parentIndex: number;
            ratio: number;
        }> | undefined;
        axisLimit: Vec3 | undefined;
        localVector: Readonly<{
            x: Vec3;
            z: Vec3;
        }> | undefined;
        transformAfterPhysics: boolean;
        externalParentTransform: number | undefined;
        ik: Readonly<{
            target: number;
            iteration: number; // (a.k.a. Loop)
            rotationConstraint: number; // (a.k.a. Angle) radians
            links: readonly Bone.IKLink[];
        }> | undefined;
    }>;

    export namespace Bone {
        export enum Flag {
            UseBoneIndexAsTailPosition = 0x0001,

            IsRotatable = 0x0002,
            IsMovable = 0x0004,
            IsVisible = 0x0008,
            IsControllable = 0x0010,
            IsIkEnabled = 0x0020,

            LocalAppendTransform = 0x0080,
            HasAppendRotate = 0x0100,
            HasAppendMove = 0x0200,
            HasAxisLimit = 0x0400,
            HasLocalVector = 0x0800,
            TransformAfterPhysics = 0x1000,
            IsExternalParentTransformed = 0x2000,
        }

        export type IKLink = Readonly<{
            target: number;
            limitation: {
                minimumAngle: Vec3;
                maximumAngle: Vec3;
            } | undefined;
        }>;
    }

    export type Morph = Readonly<{
        name: string;
        englishName: string;

        category: Morph.Category;
        type: Morph.Type;

        elements: readonly Morph.GroupMorph[]
            | readonly Morph.VertexMorph[]
            | readonly Morph.BoneMorph[]
            | readonly Morph.UvMorph[]
            | readonly Morph.MaterialMorph[]
            | readonly Morph.FlipMorph[]
            | readonly Morph.ImpulseMorph[];
    }>;

    export namespace Morph {
        export enum Category {
            System = 0,
            Eyebrow = 1,
            Eye = 2,
            Lip = 3,
            Other = 4
        }

        export enum Type {
            GroupMorph = 0,
            VertexMorph = 1,
            BoneMorph = 2,
            UvMorph = 3,
            AdditionalUvMorph1 = 4,
            AdditionalUvMorph2 = 5,
            AdditionalUvMorph3 = 6,
            AdditionalUvMorph4 = 7,
            MaterialMorph = 8,
            FlipMorph = 9, // pmx 2.1 spec (which is not supported by mmd)
            ImpulseMorph = 10 // pmx 2.1 spec (which is not supported by mmd)
        }

        export type GroupMorph = Readonly<{
            index: number; // morph index (cannot be group morph)
            ratio: number;
        }>;

        export type VertexMorph = Readonly<{
            index: number; // vertex index
            position: Vec3;
        }>;

        export type BoneMorph = Readonly<{
            index: number; // bone index
            position: Vec3;
            rotation: Vec4;
        }>;

        export type UvMorph = Readonly<{
            index: number; // vertex index
            offset: Vec4;
        }>;

        export type MaterialMorph = Readonly<{
            index: number; // material index
            type: MaterialMorph.Type;
            diffuse: Vec4;
            specular: Vec3;
            shininess: number;
            ambient: Vec3;
            edgeColor: Vec4;
            edgeSize: number;
            textureColor: Vec4;
            sphereTextureColor: Vec4;
            toonTextureColor: Vec4;
        }>;

        export namespace MaterialMorph {
            export enum Type {
                Multiply = 0,
                Add = 1
            }
        }

        export type FlipMorph = Readonly<{
            index: number; // morph index
            ratio: number;
        }>;

        export type ImpulseMorph = Readonly<{
            index: number; // rigidbody index
            isLocal: boolean;
            velocity: Vec3;
            torque: Vec3;
        }>;
    }

    export type DisplayFrame = Readonly<{
        name: string;
        englishName: string;

        isSpecialFrame: boolean;
        frames: readonly DisplayFrame.FrameData[];
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
        shapeSize: Vec3;
        shapePosition: Vec3;
        shapeRotation: Vec3;
        mass: number;
        linearDamping: number;
        angularDamping: number;
        repulsion: number;
        friction: number;
        physicsMode: RigidBody.PhysicsMode;
    }>;

    export namespace RigidBody {
        export enum ShapeType {
            Sphere = 0,
            Box = 1,
            Capsule = 2
        }

        export enum PhysicsMode {
            FollowBone = 0,
            Physics = 1,
            PhysicsWithBone = 2
        }
    }

    export type Joint = Readonly<{
        name: string;
        englishName: string;

        type: Joint.Type;
        rigidbodyIndexA: number;
        rigidbodyIndexB: number;
        position: Vec3;
        rotation: Vec3;
        positionMin: Vec3;
        positionMax: Vec3;
        rotationMin: Vec3;
        rotationMax: Vec3;
        springPosition: Vec3;
        springRotation: Vec3;
    }>;

    export namespace Joint {
        export enum Type {
            Spring6dof = 0,
            Sixdof = 1, // pmx 2.1 spec (which is not supported by mmd)
            P2p = 2, // pmx 2.1 spec (which is not supported by mmd)
            ConeTwist = 3, // pmx 2.1 spec (which is not supported by mmd)
            Slider = 4, // pmx 2.1 spec (which is not supported by mmd)
            Hinge = 5 // pmx 2.1 spec (which is not supported by mmd)
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

        anchors: readonly SoftBody.AnchorRigidBody[];
        vertexPins: Uint8Array | Uint16Array | Int32Array;
    }>;

    export namespace SoftBody {
        export enum Type {
            TriMesh = 0,
            Rope = 1
        }

        export enum Flag {
            Blink = 0x0001,
            ClusterCreation = 0x0002,
            LinkCrossing = 0x0004
        }

        export enum AeroDynamicModel {
            VertexPoint = 0,
            VertexTwoSided = 1,
            VertexOneSided = 2,
            FaceTwoSided = 3,
            FaceOneSided = 4
        }

        export type AnchorRigidBody = Readonly<{
            rigidbodyIndex: number;
            vertexIndex: number;
            isNearMode: boolean;
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
