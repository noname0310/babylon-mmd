import { MmdDataDeserializer } from "./MmdDataDeserializer";
import type { Vec3, Vec4 } from "./MmdTypes";
import { PmxObject } from "./PmxObject";

class IndexReader {
    private readonly _vertexIndexSize: number;
    private readonly _textureIndexSize: number;
    private readonly _materialIndexSize: number;
    private readonly _boneIndexSize: number;
    private readonly _morphIndexSize: number;
    private readonly _rigidBodyIndexSize: number;

    public constructor(
        vertexIndexSize: number,
        textureIndexSize: number,
        materialIndexSize: number,
        boneIndexSize: number,
        morphIndexSize: number,
        rigidBodyIndexSize: number
    ) {
        this._vertexIndexSize = vertexIndexSize;
        this._textureIndexSize = textureIndexSize;
        this._materialIndexSize = materialIndexSize;
        this._boneIndexSize = boneIndexSize;
        this._morphIndexSize = morphIndexSize;
        this._rigidBodyIndexSize = rigidBodyIndexSize;
    }

    public getVertexIndex(dataDeserializer: MmdDataDeserializer): number {
        switch (this._vertexIndexSize) {
        case 1:
            return dataDeserializer.getUint8();
        case 2:
            return dataDeserializer.getUint16();
        case 4:
            return dataDeserializer.getInt32();
        default:
            throw new Error(`Invalid vertexIndexSize: ${this._vertexIndexSize}`);
        }
    }

    private getNonVertexIndex(dataDeserializer: MmdDataDeserializer, indexSize: number): number {
        switch (indexSize) {
        case 1:
            return dataDeserializer.getInt8();
        case 2:
            return dataDeserializer.getInt16();
        case 4:
            return dataDeserializer.getInt32();
        default:
            throw new Error(`Invalid indexSize: ${indexSize}`);
        }
    }

    public getTextureIndex(dataDeserializer: MmdDataDeserializer): number {
        return this.getNonVertexIndex(dataDeserializer, this._textureIndexSize);
    }

    public getMaterialIndex(dataDeserializer: MmdDataDeserializer): number {
        return this.getNonVertexIndex(dataDeserializer, this._materialIndexSize);
    }

    public getBoneIndex(dataDeserializer: MmdDataDeserializer): number {
        return this.getNonVertexIndex(dataDeserializer, this._boneIndexSize);
    }

    public getMorphIndex(dataDeserializer: MmdDataDeserializer): number {
        return this.getNonVertexIndex(dataDeserializer, this._morphIndexSize);
    }

    public getRigidBodyIndex(dataDeserializer: MmdDataDeserializer): number {
        return this.getNonVertexIndex(dataDeserializer, this._rigidBodyIndexSize);
    }
}

export class PmxReader {
    private constructor() { /* block constructor */ }

    public static async parseAsync(data: ArrayBufferLike): Promise<PmxObject> {
        const dataDeserializer = new MmdDataDeserializer(data);

        const header = this.parseHeader(dataDeserializer);
        const indexReader = new IndexReader(
            header.vertexIndexSize,
            header.textureIndexSize,
            header.materialIndexSize,
            header.boneIndexSize,
            header.morphIndexSize,
            header.rigidBodyIndexSize
        );

        const vertices = await this.parseVerticesAsync(dataDeserializer, indexReader, header);
        const faces = this.parseFaces(dataDeserializer, indexReader, header);
        const textures = this.parseTextures(dataDeserializer);
        const materials = this.parseMaterials(dataDeserializer, indexReader);
        const bones = this.parseBones(dataDeserializer, indexReader);
        const morphs = this.parseMorphs(dataDeserializer, indexReader);
        const displayFrames = this.parseDisplayFrames(dataDeserializer, indexReader);
        const rigidBodies = this.parseRigidBodies(dataDeserializer, indexReader);
        const joints = this.parseJoints(dataDeserializer, indexReader);
        const softBodies = header.version <= 2.0
            ? []
            : this.parseSoftBodies(dataDeserializer, indexReader, header);

        if (dataDeserializer.bytesAvailable > 0) {
            console.warn(`There are ${dataDeserializer.bytesAvailable} bytes left after parsing`);
        }

        const pmxObject: PmxObject = {
            header,
            vertices,
            faces,
            textures,
            materials,
            bones,
            morphs,
            displayFrames,
            rigidBodies,
            joints,
            softBodies
        };

        return pmxObject;
    }

    private static parseHeader(dataDeserializer: MmdDataDeserializer): PmxObject.Header {
        if (dataDeserializer.bytesAvailable < (
            4 // signature
            + 4 // version (float32)
            + 1 // globalsCount (uint8)
            + 1 // encoding (uint8)
            + 1 // additionalVec4Count (uint8)
            + 1 // vertexIndexSize (uint8)
            + 1 // textureIndexSize (uint8)
            + 1 // materialIndexSize (uint8)
            + 1 // boneIndexSize (uint8)
            + 1 // morphIndexSize (uint8)
            + 1 // rigidBodyIndexSize (uint8)
        )) {
            throw new RangeError("is not pmx file");
        }
        const signature = dataDeserializer.getSignatureString(4);
        if (signature !== "PMX ") {
            throw new RangeError("is not pmx file");
        }

        const version = dataDeserializer.getFloat32();

        const globalsCount = dataDeserializer.getUint8();

        const encoding = dataDeserializer.getUint8();
        dataDeserializer.initializeTextDecoder(encoding === PmxObject.Header.Encoding.utf8 ? "utf-8" : "utf-16le");

        const additionalVec4Count = dataDeserializer.getUint8();
        const vertexIndexSize = dataDeserializer.getUint8();
        const textureIndexSize = dataDeserializer.getUint8();
        const materialIndexSize = dataDeserializer.getUint8();
        const boneIndexSize = dataDeserializer.getUint8();
        const morphIndexSize = dataDeserializer.getUint8();
        const rigidBodyIndexSize = dataDeserializer.getUint8();

        if (globalsCount < 8) {
            throw new Error(`Invalid globalsCount: ${globalsCount}`);
        } else if (8 < globalsCount) {
            console.warn(`globalsCount is greater than 8: ${globalsCount} files may be corrupted or higher version`);
            for (let i = 8; i < globalsCount; ++i) {
                dataDeserializer.getUint8();
            }
        }

        const modelName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
        const englishModelName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
        const comment = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
        const englishComment = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);

        const header: PmxObject.Header = {
            signature,
            version,

            encoding,
            additionalVec4Count,

            vertexIndexSize,
            textureIndexSize,
            materialIndexSize,
            boneIndexSize,
            morphIndexSize,
            rigidBodyIndexSize,

            modelName,
            englishModelName,
            comment,
            englishComment
        };
        return header;
    }

    private static async parseVerticesAsync(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader,
        header: PmxObject.Header
    ): Promise<PmxObject.Vertex[]> {
        const verticesCount = dataDeserializer.getInt32();

        const vertices: PmxObject.Vertex[] = [];

        for (let i = 0; i < verticesCount; ++i) {
            const position = dataDeserializer.getFloat32Array(3);
            const normal = dataDeserializer.getFloat32Array(3);
            const uv = dataDeserializer.getFloat32Array(2);
            const additionalVec4: Vec4[] = [];
            for (let j = 0; j < header.additionalVec4Count; j++) {
                additionalVec4.push(dataDeserializer.getFloat32Array(4));
            }
            const weightType: PmxObject.Vertex.BoneWeightType = dataDeserializer.getUint8();

            let boneWeight: PmxObject.Vertex.BoneWeight;

            switch (weightType) {
            case PmxObject.Vertex.BoneWeightType.bdef1: {
                const bdef1weight: PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef1> = {
                    boneIndices: [indexReader.getVertexIndex(dataDeserializer)],
                    boneWeights: [1.0]
                };
                boneWeight = bdef1weight;
                break;
            }
            case PmxObject.Vertex.BoneWeightType.bdef2: {
                const bdef2weight: PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef2> = {
                    boneIndices: [indexReader.getVertexIndex(dataDeserializer), indexReader.getVertexIndex(dataDeserializer)],
                    boneWeights: [dataDeserializer.getFloat32()]
                };
                boneWeight = bdef2weight;
                break;
            }
            case PmxObject.Vertex.BoneWeightType.bdef4: {
                const bdef4weight: PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef4> = {
                    boneIndices: [
                        indexReader.getVertexIndex(dataDeserializer),
                        indexReader.getVertexIndex(dataDeserializer),
                        indexReader.getVertexIndex(dataDeserializer),
                        indexReader.getVertexIndex(dataDeserializer)
                    ],
                    boneWeights: [
                        dataDeserializer.getFloat32(),
                        dataDeserializer.getFloat32(),
                        dataDeserializer.getFloat32(),
                        dataDeserializer.getFloat32()
                    ]
                };
                boneWeight = bdef4weight;
                break;
            }
            case PmxObject.Vertex.BoneWeightType.sdef: {
                const sdefweight: PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.sdef> = {
                    boneIndices: [indexReader.getVertexIndex(dataDeserializer), indexReader.getVertexIndex(dataDeserializer)],
                    boneWeights: {
                        boneWeight0: dataDeserializer.getFloat32(),
                        c: dataDeserializer.getFloat32Array(3),
                        r0: dataDeserializer.getFloat32Array(3),
                        r1: dataDeserializer.getFloat32Array(3)
                    }
                };
                boneWeight = sdefweight;
                break;
            }
            case PmxObject.Vertex.BoneWeightType.qdef: {
                const qdefweight: PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.qdef> = {
                    boneIndices: [
                        indexReader.getVertexIndex(dataDeserializer),
                        indexReader.getVertexIndex(dataDeserializer),
                        indexReader.getVertexIndex(dataDeserializer),
                        indexReader.getVertexIndex(dataDeserializer)
                    ],
                    boneWeights: [
                        dataDeserializer.getFloat32(),
                        dataDeserializer.getFloat32(),
                        dataDeserializer.getFloat32(),
                        dataDeserializer.getFloat32()
                    ]
                };
                boneWeight = qdefweight;
                break;
            }
            default:
                throw new Error(`Invalid weightType: ${weightType}`);
            }

            const edgeRatio = dataDeserializer.getFloat32();

            vertices.push({
                position,
                normal,
                uv,
                additionalVec4,
                weightType,
                boneWeight,
                edgeRatio
            });

            if (i % 10000 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return vertices;
    }

    private static parseFaces(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader,
        header: PmxObject.Header
    ): Uint8Array | Uint16Array | Int32Array {
        const facesindicesCount = dataDeserializer.getInt32();

        // const faces: PmxObject.Face[] = [];
        // for (let i = 0; i < facesIndiceCount; i += 3) {
        //     faces.push([getVertexIndex(), getVertexIndex(), getVertexIndex()]);
        // }
        const faceArrayBuffer = new ArrayBuffer(facesindicesCount * header.vertexIndexSize);

        let faces: Uint8Array | Uint16Array | Int32Array;
        switch (header.vertexIndexSize) {
        case 1:
            faces = new Uint8Array(faceArrayBuffer);
            break;
        case 2:
            faces = new Uint16Array(faceArrayBuffer);
            break;
        case 4:
            faces = new Int32Array(faceArrayBuffer);
            break;
        default:
            throw new Error(`Invalid vertexIndexSize: ${header.vertexIndexSize}`);
        }

        for (let i = 0; i < facesindicesCount; ++i) {
            faces[i] = indexReader.getVertexIndex(dataDeserializer);
        }

        return faces;
    }

    private static parseTextures(dataDeserializer: MmdDataDeserializer): PmxObject.Texture[] {
        const texturesCount = dataDeserializer.getInt32();

        const textures: PmxObject.Texture[] = [];
        for (let i = 0; i < texturesCount; ++i) {
            const textureName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            textures.push(textureName);
        }

        return textures;
    }

    private static parseMaterials(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader
    ): PmxObject.Material[] {
        const materialsCount = dataDeserializer.getInt32();

        const materials: PmxObject.Material[] = [];
        for (let i = 0; i < materialsCount; ++i) {
            const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);

            const diffuse = dataDeserializer.getFloat32Array(4);
            const specular = dataDeserializer.getFloat32Array(3);
            const shininess = dataDeserializer.getFloat32();
            const ambient = dataDeserializer.getFloat32Array(3);

            const flag = dataDeserializer.getUint8();

            const edgeColor = dataDeserializer.getFloat32Array(4);
            const edgeSize = dataDeserializer.getFloat32();

            const textureIndex = indexReader.getTextureIndex(dataDeserializer);
            const sphereTextureIndex = indexReader.getTextureIndex(dataDeserializer);
            const sphereTextureMode = dataDeserializer.getUint8();

            const isSharedToonTexture = dataDeserializer.getUint8() === 1;
            const toonTextureIndex = isSharedToonTexture ? dataDeserializer.getUint8() : indexReader.getTextureIndex(dataDeserializer);

            const comment = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            const faceCount = dataDeserializer.getInt32();

            const material: PmxObject.Material = {
                name,
                englishName,

                diffuse,
                specular,
                shininess,
                ambient,

                flag,

                edgeColor,
                edgeSize,

                textureIndex,
                sphereTextureIndex,
                sphereTextureMode,

                isSharedToonTexture,
                toonTextureIndex,

                comment,
                faceCount
            };
            materials.push(material);
        }

        return materials;
    }

    private static parseBones(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader
    ): PmxObject.Bone[] {
        const bonesCount = dataDeserializer.getInt32();

        const bones: PmxObject.Bone[] = [];
        for (let i = 0; i < bonesCount; ++i) {
            const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);

            const position = dataDeserializer.getFloat32Array(3);
            const parentBoneIndex = indexReader.getBoneIndex(dataDeserializer);
            const transformOrder = dataDeserializer.getInt32();

            const flag = dataDeserializer.getUint16();

            let tailPosition: number | Vec3;

            if (flag & PmxObject.Bone.Flag.useBoneIndexAsTailPosition) {
                tailPosition = indexReader.getBoneIndex(dataDeserializer);
            } else {
                tailPosition = dataDeserializer.getFloat32Array(3);
            }

            let additionalTransform;

            if (flag & PmxObject.Bone.Flag.hasAdditionalMove || flag & PmxObject.Bone.Flag.hasAdditionalRotate) {
                additionalTransform = {
                    isLocal: (flag & PmxObject.Bone.Flag.localAdditionTransform) !== 0,
                    affectRotation: (flag & PmxObject.Bone.Flag.hasAdditionalRotate) !== 0,
                    affectPosition: (flag & PmxObject.Bone.Flag.hasAdditionalMove) !== 0,
                    parentIndex: indexReader.getBoneIndex(dataDeserializer),
                    ratio: dataDeserializer.getFloat32()
                };
            }

            let axisLimit: Vec3 | undefined;

            if (flag & PmxObject.Bone.Flag.hasAxisLimit) {
                axisLimit = dataDeserializer.getFloat32Array(3);
            }

            let localVector;

            if (flag & PmxObject.Bone.Flag.hasLocalVector) {
                localVector = {
                    x: dataDeserializer.getFloat32Array(3),
                    z: dataDeserializer.getFloat32Array(3)
                };
            }

            const transformAfterPhysics = (flag & PmxObject.Bone.Flag.transformAfterPhysics) !== 0;

            let externalParentTransform: number | undefined;

            if (flag & PmxObject.Bone.Flag.isExternalParentTransformed) {
                externalParentTransform = dataDeserializer.getInt32();
            }

            let ik;

            if (flag & PmxObject.Bone.Flag.isIkEnabled) {
                const target = indexReader.getBoneIndex(dataDeserializer);
                const iteration = dataDeserializer.getInt32();
                const rotationConstraint = dataDeserializer.getFloat32();

                const links: PmxObject.Bone.IKLink[] = [];

                const linksCount = dataDeserializer.getInt32();
                for (let i = 0; i < linksCount; ++i) {
                    const ikLinkTarget = indexReader.getBoneIndex(dataDeserializer);
                    const hasLimit = dataDeserializer.getUint8() === 1;

                    const link: PmxObject.Bone.IKLink = {
                        target: ikLinkTarget,
                        limitation: hasLimit ? {
                            minimumAngle: dataDeserializer.getFloat32Array(3),
                            maximumAngle: dataDeserializer.getFloat32Array(3)
                        } : undefined
                    };
                    links.push(link);
                }

                ik = {
                    target,
                    iteration,
                    rotationConstraint,
                    links
                };
            }


            const bone: PmxObject.Bone = {
                name,
                englishName,

                position,
                parentBoneIndex,
                transformOrder,

                flag,
                tailPosition,

                additionalTransform,
                axisLimit,

                localVector,
                transformAfterPhysics,
                externalParentTransform,
                ik
            };
            bones.push(bone);
        }

        return bones;
    }

    private static parseMorphs(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader
    ): PmxObject.Morph[] {
        const morphsCount = dataDeserializer.getInt32();

        const morphs: PmxObject.Morph[] = [];
        for (let i = 0; i < morphsCount; ++i) {
            const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);

            const category: PmxObject.Morph.Category = dataDeserializer.getInt8();
            const type: PmxObject.Morph.Type = dataDeserializer.getInt8();

            const morphOffsetCount = dataDeserializer.getInt32();

            const elements = [];

            switch (type) {
            case PmxObject.Morph.Type.groupMorph:
                for (let i = 0; i < morphOffsetCount; ++i) {
                    const morphIndex = indexReader.getMorphIndex(dataDeserializer);
                    const morphRatio = dataDeserializer.getFloat32();

                    const element: PmxObject.Morph.GroupMorph = {
                        index: morphIndex,
                        ratio: morphRatio
                    };
                    elements.push(element);
                }
                break;
            case PmxObject.Morph.Type.vertexMorph:
                for (let i = 0; i < morphOffsetCount; ++i) {
                    const vertexIndex = indexReader.getVertexIndex(dataDeserializer);
                    const positionOffset = dataDeserializer.getFloat32Array(3);

                    const element: PmxObject.Morph.VertexMorph = {
                        index: vertexIndex,
                        position: positionOffset
                    };
                    elements.push(element);
                }
                break;
            case PmxObject.Morph.Type.boneMorph:
                for (let i = 0; i < morphOffsetCount; ++i) {
                    const boneIndex = indexReader.getBoneIndex(dataDeserializer);
                    const position = dataDeserializer.getFloat32Array(3);
                    const rotation = dataDeserializer.getFloat32Array(4);

                    const element: PmxObject.Morph.BoneMorph = {
                        index: boneIndex,
                        position,
                        rotation
                    };
                    elements.push(element);
                }
                break;
            case PmxObject.Morph.Type.uvMorph:
            case PmxObject.Morph.Type.additionalUvMorph1:
            case PmxObject.Morph.Type.additionalUvMorph2:
            case PmxObject.Morph.Type.additionalUvMorph3:
            case PmxObject.Morph.Type.additionalUvMorph4:
                for (let i = 0; i < morphOffsetCount; ++i) {
                    const vertexIndex = indexReader.getVertexIndex(dataDeserializer);
                    const uvOffset = dataDeserializer.getFloat32Array(4);

                    const element: PmxObject.Morph.UvMorph = {
                        index: vertexIndex,
                        offset: uvOffset
                    };
                    elements.push(element);
                }
                break;
            case PmxObject.Morph.Type.materialMorph:
                for (let i = 0; i < morphOffsetCount; ++i) {
                    const materialIndex = indexReader.getMaterialIndex(dataDeserializer);
                    const type = dataDeserializer.getUint8();
                    const diffuse = dataDeserializer.getFloat32Array(4);
                    const specular = dataDeserializer.getFloat32Array(3);
                    const shininess = dataDeserializer.getFloat32();
                    const ambient = dataDeserializer.getFloat32Array(3);
                    const edgeColor = dataDeserializer.getFloat32Array(4);
                    const edgeSize = dataDeserializer.getFloat32();
                    const textureColor = dataDeserializer.getFloat32Array(4);
                    const sphereTextureColor = dataDeserializer.getFloat32Array(4);
                    const toonTextureColor = dataDeserializer.getFloat32Array(4);

                    const element: PmxObject.Morph.MaterialMorph = {
                        index: materialIndex,
                        type,
                        diffuse,
                        specular,
                        shininess,
                        ambient,
                        edgeColor,
                        edgeSize,
                        textureColor,
                        sphereTextureColor,
                        toonTextureColor
                    };
                    elements.push(element);
                }
                break;
            case PmxObject.Morph.Type.flipMorph:
                for (let i = 0; i < morphOffsetCount; ++i) {
                    const morphIndex = indexReader.getMorphIndex(dataDeserializer);
                    const morphRatio = dataDeserializer.getFloat32();

                    const element: PmxObject.Morph.FlipMorph = {
                        index: morphIndex,
                        ratio: morphRatio
                    };
                    elements.push(element);
                }
                break;
            case PmxObject.Morph.Type.impulseMorph:
                for (let i = 0; i < morphOffsetCount; ++i) {
                    const rigidBodyIndex = indexReader.getRigidBodyIndex(dataDeserializer);
                    const isLocal = dataDeserializer.getUint8() === 1;
                    const velocity = dataDeserializer.getFloat32Array(3);
                    const torque = dataDeserializer.getFloat32Array(3);

                    const element: PmxObject.Morph.ImpulseMorph = {
                        index: rigidBodyIndex,
                        isLocal,
                        velocity,
                        torque
                    };
                    elements.push(element);
                }
                break;
            default:
                throw new Error(`Unknown morph type: ${type}`);
            }

            const morph: PmxObject.Morph = {
                name,
                englishName,
                category,
                type,
                elements: elements as PmxObject.Morph["elements"]
            };
            morphs.push(morph);
        }

        return morphs;
    }

    private static parseDisplayFrames(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader
    ): PmxObject.DisplayFrame[] {
        const displayFramesCount = dataDeserializer.getInt32();

        const displayFrames: PmxObject.DisplayFrame[] = [];
        for (let i = 0; i < displayFramesCount; ++i) {
            const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);

            const isSpecialFrame = dataDeserializer.getUint8() === 1;

            const elementsCount = dataDeserializer.getInt32();
            const frames: PmxObject.DisplayFrame.FrameData[] = [];
            for (let i = 0; i < elementsCount; ++i) {
                const frameType = dataDeserializer.getUint8();
                const frameIndex = frameType === PmxObject.DisplayFrame.FrameData.FrameType.Bone
                    ? indexReader.getBoneIndex(dataDeserializer)
                    : indexReader.getMorphIndex(dataDeserializer);

                const frame: PmxObject.DisplayFrame.FrameData = {
                    type: frameType,
                    index: frameIndex
                };
                frames.push(frame);
            }

            const displayFrame: PmxObject.DisplayFrame = {
                name,
                englishName,
                isSpecialFrame,
                frames
            };
            displayFrames.push(displayFrame);
        }

        return displayFrames;
    }

    private static parseRigidBodies(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader
    ): PmxObject.RigidBody[] {
        const rigidBodiesCount = dataDeserializer.getInt32();

        const rigidBodies: PmxObject.RigidBody[] = [];
        for (let i = 0; i < rigidBodiesCount; ++i) {
            const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);

            const boneIndex = indexReader.getBoneIndex(dataDeserializer);

            const collisionGroup = dataDeserializer.getUint8();
            const collisionMask = dataDeserializer.getUint16();

            const shapeType: PmxObject.RigidBody.ShapeType = dataDeserializer.getUint8();
            const shapeSize = dataDeserializer.getFloat32Array(3);
            const shapePosition = dataDeserializer.getFloat32Array(3);
            const shapeRotation = dataDeserializer.getFloat32Array(3);

            const mass = dataDeserializer.getFloat32();
            const linearDamping = dataDeserializer.getFloat32();
            const angularDamping = dataDeserializer.getFloat32();
            const repulsion = dataDeserializer.getFloat32();
            const friction = dataDeserializer.getFloat32();

            const physicsMode: PmxObject.RigidBody.PhysicsMode = dataDeserializer.getUint8();

            const rigidBody: PmxObject.RigidBody = {
                name,
                englishName,
                boneIndex,
                collisionGroup,
                collisionMask,
                shapeType,
                shapeSize,
                shapePosition,
                shapeRotation,
                mass,
                linearDamping,
                angularDamping,
                repulsion,
                friction,
                physicsMode
            };
            rigidBodies.push(rigidBody);
        }

        return rigidBodies;
    }

    private static parseJoints(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader
    ): PmxObject.Joint[] {
        const jointsCount = dataDeserializer.getInt32();

        const joints: PmxObject.Joint[] = [];
        for (let i = 0; i < jointsCount; ++i) {
            const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);

            const type: PmxObject.Joint.Type = dataDeserializer.getUint8();
            const rigidbodyIndexA = indexReader.getRigidBodyIndex(dataDeserializer);
            const rigidbodyIndexB = indexReader.getRigidBodyIndex(dataDeserializer);
            const position = dataDeserializer.getFloat32Array(3);
            const rotation = dataDeserializer.getFloat32Array(3);
            const positionMin = dataDeserializer.getFloat32Array(3);
            const positionMax = dataDeserializer.getFloat32Array(3);
            const rotationMin = dataDeserializer.getFloat32Array(3);
            const rotationMax = dataDeserializer.getFloat32Array(3);
            const springPosition = dataDeserializer.getFloat32Array(3);
            const springRotation = dataDeserializer.getFloat32Array(3);

            const joint: PmxObject.Joint = {
                name,
                englishName,

                type,
                rigidbodyIndexA,
                rigidbodyIndexB,
                position,
                rotation,
                positionMin,
                positionMax,
                rotationMin,
                rotationMax,
                springPosition,
                springRotation
            };
            joints.push(joint);
        }

        return joints;
    }

    private static parseSoftBodies(
        dataDeserializer: MmdDataDeserializer,
        indexReader: IndexReader,
        header: PmxObject.Header
    ): PmxObject.SoftBody[] {
        const softBodiesCount = dataDeserializer.getInt32();

        const softBodies: PmxObject.SoftBody[] = [];
        for (let i = 0; i < softBodiesCount; ++i) {
            const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);
            const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32(), false);

            const type: PmxObject.SoftBody.Type = dataDeserializer.getUint8();
            const materialIndex = indexReader.getMaterialIndex(dataDeserializer);
            const collisionGroup = dataDeserializer.getUint8();
            const collisionMask = dataDeserializer.getUint16();
            const flags = dataDeserializer.getUint8();

            const bLinkDistance = dataDeserializer.getInt32();
            const clusterCount = dataDeserializer.getInt32();
            const totalMass = dataDeserializer.getFloat32();
            const collisionMargin = dataDeserializer.getFloat32();
            const aeroModel: PmxObject.SoftBody.AeroDynamicModel = dataDeserializer.getInt32();

            const config: PmxObject.SoftBody.Config = {
                vcf: dataDeserializer.getFloat32(),
                dp: dataDeserializer.getFloat32(),
                dg: dataDeserializer.getFloat32(),
                lf: dataDeserializer.getFloat32(),
                pr: dataDeserializer.getFloat32(),
                vc: dataDeserializer.getFloat32(),
                df: dataDeserializer.getFloat32(),
                mt: dataDeserializer.getFloat32(),
                chr: dataDeserializer.getFloat32(),
                khr: dataDeserializer.getFloat32(),
                shr: dataDeserializer.getFloat32(),
                ahr: dataDeserializer.getFloat32()
            };

            const cluster: PmxObject.SoftBody.Cluster = {
                srhrCl: dataDeserializer.getFloat32(),
                skhrCl: dataDeserializer.getFloat32(),
                sshrCl: dataDeserializer.getFloat32(),
                srSpltCl: dataDeserializer.getFloat32(),
                skSpltCl: dataDeserializer.getFloat32(),
                ssSpltCl: dataDeserializer.getFloat32()
            };

            const interation: PmxObject.SoftBody.Interation = {
                vIt: dataDeserializer.getInt32(),
                pIt: dataDeserializer.getInt32(),
                dIt: dataDeserializer.getInt32(),
                cIt: dataDeserializer.getInt32()
            };

            const material: PmxObject.SoftBody.Material = {
                lst: dataDeserializer.getInt32(),
                ast: dataDeserializer.getInt32(),
                vst: dataDeserializer.getInt32()
            };

            const anchorsCount = dataDeserializer.getInt32();
            const anchors: PmxObject.SoftBody.AnchorRigidBody[] = [];
            for (let j = 0; j < anchorsCount; ++j) {
                const rigidbodyIndex = indexReader.getRigidBodyIndex(dataDeserializer);
                const vertexIndex = indexReader.getVertexIndex(dataDeserializer);
                const isNearMode = dataDeserializer.getUint8() !== 0;

                const anchorRigidBody: PmxObject.SoftBody.AnchorRigidBody = {
                    rigidbodyIndex,
                    vertexIndex,
                    isNearMode
                };
                anchors.push(anchorRigidBody);
            }

            const vertexPinCount = dataDeserializer.getInt32();

            const vertexPinArrayBuffer = new ArrayBuffer(vertexPinCount * header.vertexIndexSize);
            let vertexPins: Uint8Array | Uint16Array | Int32Array;
            switch (header.vertexIndexSize) {
            case 1:
                vertexPins = new Uint8Array(vertexPinArrayBuffer);
                break;
            case 2:
                vertexPins = new Uint16Array(vertexPinArrayBuffer);
                break;
            case 4:
                vertexPins = new Int32Array(vertexPinArrayBuffer);
                break;
            default:
                throw new Error(`Invalid vertexIndexSize: ${header.vertexIndexSize}`);
            }

            for (let i = 0; i < vertexPinCount; ++i) {
                vertexPins[i] = indexReader.getVertexIndex(dataDeserializer);
            }

            const softBody: PmxObject.SoftBody = {
                name,
                englishName,

                type,
                materialIndex,
                collisionGroup,
                collisionMask,
                flags,
                bLinkDistance,
                clusterCount,
                totalMass,
                collisionMargin,
                aeroModel,

                config,
                cluster,
                interation,
                material,

                anchors,
                vertexPins
            };

            softBodies.push(softBody);
        }

        return softBodies;
    }
}
