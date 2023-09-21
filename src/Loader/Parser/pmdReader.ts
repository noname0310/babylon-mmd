import type { ILogger } from "./ILogger";
import { ConsoleLogger } from "./ILogger";
import { MmdDataDeserializer } from "./mmdDataDeserializer";
import { PmxObject } from "./pmxObject";

type RemoveReadonly<T> = { -readonly [P in keyof T]: T[P] };

type PartialHeader = Omit<RemoveReadonly<PmxObject.Header>,
    "englishModelName" |
    "englishComment"
    > & {
    englishModelName: undefined;
    englishComment: undefined;
};

type PartialMaterial = Omit<RemoveReadonly<PmxObject.Material>,
    "textureIndex" |
    "sphereTextureIndex"
    > & {
    textureIndex: string;
    sphereTextureIndex: string;
};

/**
 * PmdReader is a static class that parses PMD data
 */
export class PmdReader {
    private constructor() { /* block constructor */ }

    /**
     * Parses PMD data asynchronously
     * @param data Arraybuffer of PMD data
     * @param logger Logger
     * @returns PMD data as a PmxObject
     * @throws {Error} If the parse fails
     */
    public static async ParseAsync(data: ArrayBufferLike, logger: ILogger = new ConsoleLogger()): Promise<PmxObject> {
        const dataDeserializer = new MmdDataDeserializer(data);
        dataDeserializer.initializeTextDecoder("shift-jis");

        const header = this._ParseHeader(dataDeserializer);
        const vertices = await this._ParseVerticesAsync(dataDeserializer);
        const faces = this._ParseFaces(dataDeserializer);
        const materials = this._ParseMaterials(dataDeserializer);
        // const bones = this._ParseBones(dataDeserializer);
        // const morphs = this._ParseMorphs(dataDeserializer);
        // const displayFrames = this._ParseDisplayFrames(dataDeserializer);

        // const textures = this._ParseTextures(dataDeserializer);
        // const rigidBodies = this._ParseRigidBodies(dataDeserializer);
        // const joints = this._ParseJoints(dataDeserializer);

        if (dataDeserializer.bytesAvailable > 0) {
            logger.warn(`There are ${dataDeserializer.bytesAvailable} bytes left after parsing`);
        }

        header;
        vertices;
        faces;
        materials;

        // const pmxObject: PmxObject = {
        //     header,
        //     vertices,
        //     faces,
        //     textures,
        //     materials,
        //     bones,
        //     morphs,
        //     displayFrames,
        //     rigidBodies,
        //     joints,
        //     softBodies: []
        // };

        throw new Error("not implemented");

        // return pmxObject;
    }

    private static _ParseHeader(dataDeserializer: MmdDataDeserializer): PartialHeader {
        if (dataDeserializer.bytesAvailable < (
            3 // signature
            + 4 // version (float32)
        )) {
            throw new Error("is not pmd file");
        }
        const signature = dataDeserializer.getSignatureString(3);
        if (signature !== "Pmd") {
            throw new Error("is not pmd file");
        }

        const version = dataDeserializer.getFloat32();

        const modelName = dataDeserializer.getDecoderString(20, true);
        const comment = dataDeserializer.getDecoderString(256, true);

        const header: PartialHeader = {
            signature,
            version,

            encoding: PmxObject.Header.Encoding.ShiftJis,
            additionalVec4Count: 0,

            vertexIndexSize: 2,
            textureIndexSize: 4, // PMD does not use texture indices
            materialIndexSize: 4, // PMD does not use material indices
            boneIndexSize: 2,
            morphIndexSize: 2, // PMD does not use morph indices
            rigidBodyIndexSize: 4,

            modelName,
            englishModelName: undefined, // initialized later
            comment,
            englishComment: undefined // initialized later
        };
        return header;
    }

    private static async _ParseVerticesAsync(dataDeserializer: MmdDataDeserializer): Promise<PmxObject.Vertex[]> {
        const verticesCount = dataDeserializer.getInt32();

        const vertices: PmxObject.Vertex[] = [];

        let time = performance.now();
        for (let i = 0; i < verticesCount; ++i) {
            const position = dataDeserializer.getFloat32Tuple(3);
            const normal = dataDeserializer.getFloat32Tuple(3);
            const uv = dataDeserializer.getFloat32Tuple(2);
            const weightType = PmxObject.Vertex.BoneWeightType.Bdef2;
            const boneWeight: PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef2> = {
                boneIndices: [dataDeserializer.getUint16(), dataDeserializer.getUint16()],
                boneWeights: dataDeserializer.getUint8() / 100
            };
            const edgeFlag = dataDeserializer.getUint8() !== 0;

            vertices.push({
                position,
                normal,
                uv,
                additionalVec4: [],
                weightType,
                boneWeight,
                edgeScale: edgeFlag ? 1.0 : 0.0
            });

            if (i % 10000 === 0 && 100 < performance.now() - time) {
                await new Promise(resolve => setTimeout(resolve, 0));
                time = performance.now();
            }
        }

        return vertices;
    }

    private static _ParseFaces(dataDeserializer: MmdDataDeserializer): Uint16Array {
        const facesindicesCount = dataDeserializer.getInt32();
        const faces = new Uint16Array(facesindicesCount);
        dataDeserializer.getUint16Array(faces);
        return faces;
    }

    private static _ParseMaterials(dataDeserializer: MmdDataDeserializer): PartialMaterial[] {
        const materialsCount = dataDeserializer.getInt32();

        const materials: PartialMaterial[] = [];
        for (let i = 0; i < materialsCount; ++i) {
            const diffuse = dataDeserializer.getFloat32Tuple(4);
            const shininess = dataDeserializer.getFloat32(); // order is different from PMX
            const specular = dataDeserializer.getFloat32Tuple(3);
            const ambient = dataDeserializer.getFloat32Tuple(3);

            const toonTextureIndex = dataDeserializer.getInt8();
            const edgeFlag = dataDeserializer.getUint8();
            const surfaceCount = dataDeserializer.getUint32();
            const texturePath = dataDeserializer.getDecoderString(20, true);

            const flag: PmxObject.Material.Flag =
                PmxObject.Material.Flag.EnabledDrawShadow |
                PmxObject.Material.Flag.EnabledReceiveShadow |
                (edgeFlag !== 0
                    ? (PmxObject.Material.Flag.EnabledToonEdge |
                        PmxObject.Material.Flag.EnabledGroundShadow)
                    : 0)
            ;

            let diffuseTexturePath: string | undefined;
            let sphereTexturePath: string | undefined;

            const delimiterIndex = texturePath.indexOf("*");
            if (delimiterIndex !== -1) {
                diffuseTexturePath = texturePath.substring(0, delimiterIndex);
                sphereTexturePath = texturePath.substring(delimiterIndex + 1);
            } else {
                diffuseTexturePath = texturePath;
                sphereTexturePath = "";
            }

            const material: PartialMaterial = {
                name: texturePath,
                englishName: "",

                diffuse,
                specular,
                shininess,
                ambient,

                flag,

                edgeColor: [0, 0, 0, 1],
                edgeSize: 1.0,

                textureIndex: diffuseTexturePath, // mapped later
                sphereTextureIndex: sphereTexturePath, // mapped later
                sphereTextureMode: sphereTexturePath !== ""
                    ? sphereTexturePath[sphereTexturePath.length - 1].toLowerCase() === "h"
                        ? PmxObject.Material.SphereTextureMode.Multiply
                        : PmxObject.Material.SphereTextureMode.Add
                    : PmxObject.Material.SphereTextureMode.Off,

                isSharedToonTexture: false,
                toonTextureIndex,

                comment: "",
                surfaceCount
            };
            materials.push(material);
        }

        return materials;
    }

    // private static _ParseBones(dataDeserializer: MmdDataDeserializer): PmxObject.Bone[] {
    //     const bonesCount = dataDeserializer.getUint16();

    //     const bones: PmxObject.Bone[] = [];
    //     for (let i = 0; i < bonesCount; ++i) {
    //         const name = dataDeserializer.getDecoderString(20, true);

    //         const parentBoneIndex = dataDeserializer.getInt16();
    //         const tailPosition = dataDeserializer.getInt16();
    //         const transformOrder = dataDeserializer.getInt32();
    //         const position = dataDeserializer.getFloat32Tuple(3);

    //         const flag = PmxObject.Bone.Flag.UseBoneIndexAsTailPosition |
    //             dataDeserializer.getUint16();

    //         let appendTransform;

    //         if (flag & PmxObject.Bone.Flag.HasAppendMove || flag & PmxObject.Bone.Flag.HasAppendRotate) {
    //             appendTransform = {
    //                 isLocal: (flag & PmxObject.Bone.Flag.LocalAppendTransform) !== 0,
    //                 affectRotation: (flag & PmxObject.Bone.Flag.HasAppendRotate) !== 0,
    //                 affectPosition: (flag & PmxObject.Bone.Flag.HasAppendMove) !== 0,
    //                 parentIndex: indexReader.getBoneIndex(dataDeserializer),
    //                 ratio: dataDeserializer.getFloat32()
    //             };
    //         }

    //         let axisLimit: Vec3 | undefined;

    //         if (flag & PmxObject.Bone.Flag.HasAxisLimit) {
    //             axisLimit = dataDeserializer.getFloat32Tuple(3);
    //         }

    //         let localVector;

    //         if (flag & PmxObject.Bone.Flag.HasLocalVector) {
    //             localVector = {
    //                 x: dataDeserializer.getFloat32Tuple(3),
    //                 z: dataDeserializer.getFloat32Tuple(3)
    //             };
    //         }

    //         const transformAfterPhysics = (flag & PmxObject.Bone.Flag.TransformAfterPhysics) !== 0;

    //         let externalParentTransform: number | undefined;

    //         if (flag & PmxObject.Bone.Flag.IsExternalParentTransformed) {
    //             externalParentTransform = dataDeserializer.getInt32();
    //         }

    //         let ik;

    //         if (flag & PmxObject.Bone.Flag.IsIkEnabled) {
    //             const target = indexReader.getBoneIndex(dataDeserializer);
    //             const iteration = dataDeserializer.getInt32();
    //             const rotationConstraint = dataDeserializer.getFloat32();

    //             const links: PmxObject.Bone.IKLink[] = [];

    //             const linksCount = dataDeserializer.getInt32();
    //             for (let i = 0; i < linksCount; ++i) {
    //                 const ikLinkTarget = indexReader.getBoneIndex(dataDeserializer);
    //                 const hasLimit = dataDeserializer.getUint8() === 1;

    //                 const link: PmxObject.Bone.IKLink = {
    //                     target: ikLinkTarget,
    //                     limitation: hasLimit ? {
    //                         minimumAngle: dataDeserializer.getFloat32Tuple(3),
    //                         maximumAngle: dataDeserializer.getFloat32Tuple(3)
    //                     } : undefined
    //                 };
    //                 links.push(link);
    //             }

    //             ik = {
    //                 target,
    //                 iteration,
    //                 rotationConstraint,
    //                 links
    //             };
    //         }


    //         const bone: PmxObject.Bone = {
    //             name,
    //             englishName,

    //             position,
    //             parentBoneIndex,
    //             transformOrder,

    //             flag,
    //             tailPosition,

    //             appendTransform,
    //             axisLimit,

    //             localVector,
    //             transformAfterPhysics,
    //             externalParentTransform,
    //             ik
    //         };
    //         bones.push(bone);
    //     }

    //     return bones;
    // }
}
