import { LoadFileError } from "@babylonjs/core/Misc/fileTools";

import type { Vec3 } from "@/Loader/Parser/mmdTypes";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ILogger } from "../../Parser/ILogger";
import { ConsoleLogger } from "../../Parser/ILogger";
import { AlignedDataDeserializer } from "../alignedDataDeserializer";
import { BpmxObject } from "./bpmxObject";

/**
 * BpmxReader is a static class that parses BPMX data
 */
export class BpmxReader {
    private constructor() { /* block constructor */ }

    /**
     * Parses BPMX data asynchronously
     * @param data Arraybuffer of BPMX data
     * @param logger Logger
     * @returns BPMX data
     * @throws {RangeError} If the parse fails
     * @throws {LoadFileError} If the BPMX version is not supported
     */
    public static async ParseAsync(data: ArrayBufferLike, logger: ILogger = new ConsoleLogger()): Promise<BpmxObject> {
        const dataDeserializer = new AlignedDataDeserializer(data);

        const header = this._ParseHeader(dataDeserializer);
        const dataPositions = header.dataPositions;
        const isSkinnedMesh = dataPositions.positionToBone !== 0;
        const geometries = dataPositions.positionToMesh !== 0
            ? await this._ParseGeometriesAsync(dataDeserializer, dataPositions.positionToMesh, isSkinnedMesh)
            : [];
        const images = dataPositions.positionToImage !== 0
            ? await this._ParseImagesAsync(dataDeserializer, dataPositions.positionToImage)
            : [];
        const textures = dataPositions.positionToTexture !== 0
            ? this._ParseTexturesAsync(dataDeserializer, dataPositions.positionToTexture)
            : [];
        const materials = dataPositions.positionToMaterial !== 0
            ? this._ParseMaterials(dataDeserializer, dataPositions.positionToMaterial)
            : [];
        const bones = isSkinnedMesh
            ? this._ParseBones(dataDeserializer, dataPositions.positionToBone)
            : [];
        const morphs = dataPositions.positionToMorph !== 0
            ? this._ParseMorphs(dataDeserializer, dataPositions.positionToMorph)
            : [];
        const displayFrames = dataPositions.positionToDisplayFrame !== 0
            ? this._ParseDisplayFrames(dataDeserializer, dataPositions.positionToDisplayFrame)
            : [];
        const rigidBodies = dataPositions.positionToRigidBody !== 0
            ? this._ParseRigidBodies(dataDeserializer, dataPositions.positionToRigidBody)
            : [];
        const joints = dataPositions.positionToJoint !== 0
            ? this._ParseJoints(dataDeserializer, dataPositions.positionToJoint)
            : [];

        if (dataDeserializer.bytesAvailable > 0) {
            logger.warn(`There are ${dataDeserializer.bytesAvailable} bytes left after parsing`);
        }

        const bpmxObject: BpmxObject = {
            header,
            geometries,
            images,
            textures,
            materials,
            bones,
            morphs,
            displayFrames,
            rigidBodies,
            joints
        };

        return bpmxObject;
    }

    private static readonly _V300Int = 3 << 16 | 0 << 8 | 0;
    private static readonly _V310Int = 3 << 16 | 1 << 8 | 0;

    private static _ParseHeader(dataDeserializer: AlignedDataDeserializer): BpmxObject.Header {
        if (dataDeserializer.bytesAvailable < (
            4 + // signature
            3 // version
        )) {
            throw new RangeError("is not bpmx file");
        }
        const signature = dataDeserializer.getString(4);
        if (signature !== "BPMX") {
            throw new RangeError("is not bpmx file");
        }

        const version = [
            dataDeserializer.getUint8(),
            dataDeserializer.getUint8(),
            dataDeserializer.getUint8()
        ] as const;
        const versionInt = version[0] << 16 | version[1] << 8 | version[2];

        if (versionInt < this._V300Int || this._V310Int <= versionInt) {
            throw new LoadFileError(`BPMX version ${version[0]}.${version[1]}.${version[2]} is not supported.`);
        }
        dataDeserializer.offset += 1; // padding

        const sizeOfHeader = dataDeserializer.getUint32();
        let leftHeaderBytes = sizeOfHeader;

        let positionToModelInfo = 0;
        if (4 <= leftHeaderBytes) {
            positionToModelInfo = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToMesh = 0;
        if (4 <= leftHeaderBytes) {
            positionToMesh = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToImage = 0;
        if (4 <= leftHeaderBytes) {
            positionToImage = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToTexture = 0;
        if (4 <= leftHeaderBytes) {
            positionToTexture = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToMaterial = 0;
        if (4 <= leftHeaderBytes) {
            positionToMaterial = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToBone = 0;
        if (4 <= leftHeaderBytes) {
            positionToBone = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToMorph = 0;
        if (4 <= leftHeaderBytes) {
            positionToMorph = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToDisplayFrame = 0;
        if (4 <= leftHeaderBytes) {
            positionToDisplayFrame = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToRigidBody = 0;
        if (4 <= leftHeaderBytes) {
            positionToRigidBody = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToJoint = 0;
        if (4 <= leftHeaderBytes) {
            positionToJoint = dataDeserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let modelName = "";
        let englishModelName = "";
        let comment = "";
        let englishComment = "";
        if (positionToModelInfo !== 0) {
            dataDeserializer.offset = positionToModelInfo;
            modelName = dataDeserializer.getString(dataDeserializer.getUint32());
            englishModelName = dataDeserializer.getString(dataDeserializer.getUint32());
            comment = dataDeserializer.getString(dataDeserializer.getUint32());
            englishComment = dataDeserializer.getString(dataDeserializer.getUint32());
        }

        const header: BpmxObject.Header = {
            signature,
            version,
            dataPositions: {
                positionToModelInfo,
                positionToMesh,
                positionToImage,
                positionToTexture,
                positionToMaterial,
                positionToBone,
                positionToMorph,
                positionToDisplayFrame,
                positionToRigidBody,
                positionToJoint
            },
            modelName,
            englishModelName,
            comment,
            englishComment
        };
        return header;
    }

    private static async _ParseGeometriesAsync(dataDeserializer: AlignedDataDeserializer, positionToMesh: number, isSkinnedMesh: boolean): Promise<BpmxObject.Geometry[]> {
        dataDeserializer.offset = positionToMesh;
        let time = performance.now();

        const meshCount = dataDeserializer.getUint32();

        const geometries: BpmxObject.Geometry[] = [];
        for (let i = 0; i < meshCount; ++i) {
            const name = dataDeserializer.getString(dataDeserializer.getUint32());
            let materialIndex: number | BpmxObject.Geometry.SubGeometry[] = dataDeserializer.getInt32();
            if (materialIndex === -2) { // since bpmx 2.1.0
                const subMeshCount = dataDeserializer.getUint32();
                const subGeometries: BpmxObject.Geometry.SubGeometry[] = [];
                for (let i = 0; i < subMeshCount; ++i) {
                    const materialIndex = dataDeserializer.getInt32();
                    const verticesStart = dataDeserializer.getUint32();
                    const verticesCount = dataDeserializer.getUint32();
                    const indexStart = dataDeserializer.getUint32();
                    const indexCount = dataDeserializer.getUint32();

                    subGeometries.push({
                        materialIndex,
                        verticesStart,
                        verticesCount,
                        indexStart,
                        indexCount
                    });
                }
                materialIndex = subGeometries;
            }

            const vertexCount = dataDeserializer.getUint32();

            const positions = new Float32Array(vertexCount * 3);
            dataDeserializer.getFloat32Array(positions);

            if (100 < performance.now() - time) {
                await new Promise(resolve => setTimeout(resolve, 0));
                time = performance.now();
            }

            const normals = new Float32Array(vertexCount * 3);
            dataDeserializer.getFloat32Array(normals);

            if (100 < performance.now() - time) {
                await new Promise(resolve => setTimeout(resolve, 0));
                time = performance.now();
            }

            const uvs = new Float32Array(vertexCount * 2);
            dataDeserializer.getFloat32Array(uvs);

            const additionalUvs: Float32Array[] = [];

            const additionalUvCount = dataDeserializer.getUint8();
            dataDeserializer.offset += 3; // padding
            for (let i = 0; i < additionalUvCount; ++i) {
                const additionalUv = new Float32Array(vertexCount * 4);
                dataDeserializer.getFloat32Array(additionalUv);
                additionalUvs.push(additionalUv);
            }

            if (100 < performance.now() - time) {
                await new Promise(resolve => setTimeout(resolve, 0));
                time = performance.now();
            }

            const flag = dataDeserializer.getUint8();
            dataDeserializer.offset += 3; // padding

            let indices: Int32Array | Uint32Array | Uint16Array | undefined = undefined;
            if ((flag & BpmxObject.Geometry.GeometryType.IsIndexed) !== 0) {
                const indexElementType = dataDeserializer.getUint8() as BpmxObject.Geometry.IndexElementType;
                dataDeserializer.offset += 3; // padding
                const indicesCount = dataDeserializer.getUint32();

                if (indexElementType === BpmxObject.Geometry.IndexElementType.Int32) {
                    indices = new Int32Array(indicesCount);
                    dataDeserializer.getInt32Array(indices as Int32Array);
                } else if (indexElementType === BpmxObject.Geometry.IndexElementType.Uint32) {
                    indices = new Uint32Array(indicesCount);
                    dataDeserializer.getUint32Array(indices as Uint32Array);
                } else {
                    indices = new Uint16Array(indicesCount);
                    dataDeserializer.getUint16Array(indices as Uint16Array);
                }
                dataDeserializer.offset += AlignedDataDeserializer.Padding(dataDeserializer.offset); // dynamic padding

                if (100 < performance.now() - time) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    time = performance.now();
                }
            }

            let skinning: BpmxObject.Geometry.Skinning | undefined = undefined;
            if (isSkinnedMesh) {
                const matricesIndices = new Float32Array(vertexCount * 4);
                dataDeserializer.getFloat32Array(matricesIndices);

                const matricesWeights = new Float32Array(vertexCount * 4);
                dataDeserializer.getFloat32Array(matricesWeights);

                if (100 < performance.now() - time) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    time = performance.now();
                }

                let sdef: BpmxObject.Geometry.Skinning["sdef"] | undefined = undefined;
                if ((flag & BpmxObject.Geometry.GeometryType.HasSdef) !== 0) {
                    const c = new Float32Array(vertexCount * 3);
                    const r0 = new Float32Array(vertexCount * 3);
                    const r1 = new Float32Array(vertexCount * 3);

                    dataDeserializer.getFloat32Array(c);
                    dataDeserializer.getFloat32Array(r0);
                    dataDeserializer.getFloat32Array(r1);

                    sdef = { c, r0, r1 };

                    if (100 < performance.now() - time) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                        time = performance.now();
                    }
                }

                skinning = {
                    matricesIndices,
                    matricesWeights,
                    sdef
                };
            }

            let edgeScale: Float32Array | undefined = undefined;
            if ((flag & BpmxObject.Geometry.GeometryType.HasEdgeScale) !== 0) {
                edgeScale = new Float32Array(vertexCount);
                dataDeserializer.getFloat32Array(edgeScale);
            }

            const geometry: BpmxObject.Geometry = {
                name,
                materialIndex,
                positions,
                normals,
                uvs,
                additionalUvs,
                indices,
                skinning,
                edgeScale
            };
            geometries.push(geometry);
        }
        return geometries;
    }

    private static async _ParseImagesAsync(dataDeserializer: AlignedDataDeserializer, positionToImage: number): Promise<BpmxObject.Image[]> {
        dataDeserializer.offset = positionToImage;
        let time = performance.now();

        const imageCount = dataDeserializer.getUint32();

        const images: BpmxObject.Image[] = [];
        for (let i = 0; i < imageCount; ++i) {
            const relativePath = dataDeserializer.getString(dataDeserializer.getUint32());

            const flag = dataDeserializer.getUint8();
            dataDeserializer.offset += 3; // padding

            const mimeType = ((flag & BpmxObject.Image.Flag.HasMimeType) !== 0)
                ? dataDeserializer.getString(dataDeserializer.getUint32())
                : undefined;

            const byteLength = dataDeserializer.getUint32();
            const data = new ArrayBuffer(byteLength);
            dataDeserializer.getUint8Array(new Uint8Array(data));
            dataDeserializer.offset += AlignedDataDeserializer.Padding(dataDeserializer.offset); // dynamic padding

            images.push({
                relativePath,
                mimeType,
                data
            });

            if (100 < performance.now() - time) {
                await new Promise(resolve => setTimeout(resolve, 0));
                time = performance.now();
            }
        }
        return images;
    }

    private static _ParseTexturesAsync(dataDeserializer: AlignedDataDeserializer, positionToTexture: number): BpmxObject.Texture[] {
        dataDeserializer.offset = positionToTexture;

        const textureCount = dataDeserializer.getUint32();

        const textures: BpmxObject.Texture[] = [];
        for (let i = 0; i < textureCount; ++i) {
            const flag = dataDeserializer.getUint8();
            const samplingMode = dataDeserializer.getUint8();
            dataDeserializer.offset += 2; // padding
            const imageIndex = dataDeserializer.getInt32();

            textures.push({
                flag,
                samplingMode,
                imageIndex
            });
        }
        return textures;
    }

    private static _ParseMaterials(dataDeserializer: AlignedDataDeserializer, positionToMaterial: number): BpmxObject.Material[] {
        dataDeserializer.offset = positionToMaterial;

        const materialCount = dataDeserializer.getUint32();

        const materials: BpmxObject.Material[] = [];
        for (let i = 0; i < materialCount; ++i) {
            const name = dataDeserializer.getString(dataDeserializer.getUint32());
            const englishName = dataDeserializer.getString(dataDeserializer.getUint32());

            const diffuse = dataDeserializer.getFloat32Tuple(4);
            const specular = dataDeserializer.getFloat32Tuple(3);
            const shininess = dataDeserializer.getFloat32();
            const ambient = dataDeserializer.getFloat32Tuple(3);
            const evaluatedTransparency = dataDeserializer.getUint8();

            const flag = dataDeserializer.getUint8();
            dataDeserializer.offset += 2; // padding

            const edgeColor = dataDeserializer.getFloat32Tuple(4);
            const edgeSize = dataDeserializer.getFloat32();

            const textureIndex = dataDeserializer.getInt32();
            const sphereTextureIndex = dataDeserializer.getInt32();
            const sphereTextureMode = dataDeserializer.getUint8();

            const isSharedToonTexture = dataDeserializer.getUint8() === 1;
            dataDeserializer.offset += 2; // padding
            const toonTextureIndex = dataDeserializer.getInt32();

            const comment = dataDeserializer.getString(dataDeserializer.getUint32());

            const material: BpmxObject.Material = {
                name,
                englishName,

                diffuse,
                specular,
                shininess,
                ambient,
                evaluatedTransparency,

                flag,

                edgeColor,
                edgeSize,

                textureIndex,
                sphereTextureIndex,
                sphereTextureMode,

                isSharedToonTexture,
                toonTextureIndex,

                comment
            };

            materials.push(material);
        }
        return materials;
    }

    private static _ParseBones(dataDeserializer: AlignedDataDeserializer, positionToBone: number): PmxObject.Bone[] {
        dataDeserializer.offset = positionToBone;

        const bonesCount = dataDeserializer.getUint32();

        const bones: PmxObject.Bone[] = [];
        for (let i = 0; i < bonesCount; ++i) {
            const name = dataDeserializer.getString(dataDeserializer.getUint32());
            const englishName = dataDeserializer.getString(dataDeserializer.getUint32());

            const position = dataDeserializer.getFloat32Tuple(3);
            const parentBoneIndex = dataDeserializer.getInt32();
            const transformOrder = dataDeserializer.getInt32();

            const flag = dataDeserializer.getUint16();
            dataDeserializer.offset += 2; // padding

            let tailPosition: number | Vec3;

            if (flag & PmxObject.Bone.Flag.UseBoneIndexAsTailPosition) {
                // note: bpmx 1.0.0 has stores tail bone index as float32
                tailPosition = dataDeserializer.getInt32();
            } else {
                tailPosition = dataDeserializer.getFloat32Tuple(3);
            }

            let appendTransform;

            if (flag & PmxObject.Bone.Flag.HasAppendMove || flag & PmxObject.Bone.Flag.HasAppendRotate) {
                appendTransform = {
                    parentIndex: dataDeserializer.getInt32(),
                    ratio: dataDeserializer.getFloat32()
                };
            }

            let axisLimit: Vec3 | undefined;

            if (flag & PmxObject.Bone.Flag.HasAxisLimit) {
                axisLimit = dataDeserializer.getFloat32Tuple(3);
            }

            let localVector;

            if (flag & PmxObject.Bone.Flag.HasLocalVector) {
                localVector = {
                    x: dataDeserializer.getFloat32Tuple(3),
                    z: dataDeserializer.getFloat32Tuple(3)
                };
            }

            let externalParentTransform: number | undefined;

            if (flag & PmxObject.Bone.Flag.IsExternalParentTransformed) {
                externalParentTransform = dataDeserializer.getInt32();
            }

            let ik;

            if (flag & PmxObject.Bone.Flag.IsIkEnabled) {
                const target = dataDeserializer.getInt32();
                const iteration = dataDeserializer.getInt32();
                const rotationConstraint = dataDeserializer.getFloat32();

                const links: PmxObject.Bone.IKLink[] = [];

                const linksCount = dataDeserializer.getInt32();
                for (let i = 0; i < linksCount; ++i) {
                    const ikLinkTarget = dataDeserializer.getInt32();
                    const hasLimit = dataDeserializer.getUint8() === 1;
                    dataDeserializer.offset += 3; // padding

                    const link: PmxObject.Bone.IKLink = {
                        target: ikLinkTarget,
                        limitation: hasLimit ? {
                            minimumAngle: dataDeserializer.getFloat32Tuple(3),
                            maximumAngle: dataDeserializer.getFloat32Tuple(3)
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


            const bone: BpmxObject.Bone = {
                name,
                englishName,

                position,
                parentBoneIndex,
                transformOrder,

                flag,
                tailPosition,

                appendTransform,
                axisLimit,

                localVector,
                externalParentTransform,
                ik
            };
            bones.push(bone);
        }

        return bones;
    }

    private static _ParseMorphs(dataDeserializer: AlignedDataDeserializer, positionToMorph: number): BpmxObject.Morph[] {
        dataDeserializer.offset = positionToMorph;

        const morphsCount = dataDeserializer.getUint32();

        const morphs: BpmxObject.Morph[] = [];
        for (let i = 0; i < morphsCount; ++i) {
            const name = dataDeserializer.getString(dataDeserializer.getUint32());
            const englishName = dataDeserializer.getString(dataDeserializer.getUint32());

            const category: PmxObject.Morph.Category = dataDeserializer.getUint8();
            const type: BpmxObject.Morph.Type = dataDeserializer.getUint8();
            dataDeserializer.offset += 2; // padding

            let morph: Partial<BpmxObject.Morph> = {
                name,
                englishName,
                category,
                type
            };

            switch (type) {
            case PmxObject.Morph.Type.GroupMorph:
                {
                    const elementCount = dataDeserializer.getUint32();

                    const indices = new Int32Array(elementCount);
                    dataDeserializer.getInt32Array(indices);

                    const ratios = new Float32Array(elementCount);
                    dataDeserializer.getFloat32Array(ratios);

                    morph = <PmxObject.Morph.GroupMorph>{
                        ...morph,
                        indices,
                        ratios
                    };
                }
                break;

            case PmxObject.Morph.Type.VertexMorph:
                {
                    const meshCount = dataDeserializer.getUint32();

                    const elements: BpmxObject.Morph.VertexMorphElement[] = [];
                    for (let i = 0; i < meshCount; ++i) {
                        const meshIndex = dataDeserializer.getUint32();

                        const elementCount = dataDeserializer.getUint32();

                        const indices = new Int32Array(elementCount);
                        dataDeserializer.getInt32Array(indices);

                        const offsets = new Float32Array(elementCount * 3);
                        dataDeserializer.getFloat32Array(offsets);

                        const element: BpmxObject.Morph.VertexMorphElement = {
                            meshIndex,
                            indices,
                            offsets
                        };
                        elements.push(element);
                    }

                    morph = <BpmxObject.Morph.VertexMorph>{
                        ...morph,
                        elements
                    };
                }
                break;

            case PmxObject.Morph.Type.BoneMorph:
                {
                    const elementCount = dataDeserializer.getUint32();

                    const indices = new Int32Array(elementCount);
                    dataDeserializer.getInt32Array(indices);

                    const positions = new Float32Array(elementCount * 3);
                    dataDeserializer.getFloat32Array(positions);

                    const rotations = new Float32Array(elementCount * 4);
                    dataDeserializer.getFloat32Array(rotations);

                    morph = <PmxObject.Morph.BoneMorph>{
                        ...morph,
                        indices,
                        positions,
                        rotations
                    };
                }
                break;

            case PmxObject.Morph.Type.UvMorph:
            case PmxObject.Morph.Type.AdditionalUvMorph1:
            case PmxObject.Morph.Type.AdditionalUvMorph2:
            case PmxObject.Morph.Type.AdditionalUvMorph3:
            case PmxObject.Morph.Type.AdditionalUvMorph4:
                {
                    const meshCount = dataDeserializer.getUint32();

                    const elements: BpmxObject.Morph.UvMorphElement[] = [];
                    for (let i = 0; i < meshCount; ++i) {
                        const meshIndex = dataDeserializer.getUint32();

                        const elementCount = dataDeserializer.getUint32();

                        const indices = new Int32Array(elementCount);
                        dataDeserializer.getInt32Array(indices);

                        const offsets = new Float32Array(elementCount * 4);
                        dataDeserializer.getFloat32Array(offsets);

                        const element: BpmxObject.Morph.UvMorphElement = {
                            meshIndex,
                            indices,
                            offsets
                        };
                        elements.push(element);
                    }

                    morph = <BpmxObject.Morph.UvMorph>{
                        ...morph,
                        elements
                    };
                }
                break;

            case PmxObject.Morph.Type.MaterialMorph:
                {
                    const elementCount = dataDeserializer.getUint32();

                    const elements: PmxObject.Morph.MaterialMorph["elements"] = [];
                    for (let i = 0; i < elementCount; ++i) {
                        const materialIndex = dataDeserializer.getInt32();
                        const type = dataDeserializer.getUint8();
                        dataDeserializer.offset += 3; // padding
                        const diffuse = dataDeserializer.getFloat32Tuple(4);
                        const specular = dataDeserializer.getFloat32Tuple(3);
                        const shininess = dataDeserializer.getFloat32();
                        const ambient = dataDeserializer.getFloat32Tuple(3);
                        const edgeColor = dataDeserializer.getFloat32Tuple(4);
                        const edgeSize = dataDeserializer.getFloat32();
                        const textureColor = dataDeserializer.getFloat32Tuple(4);
                        const sphereTextureColor = dataDeserializer.getFloat32Tuple(4);
                        const toonTextureColor = dataDeserializer.getFloat32Tuple(4);

                        const element: PmxObject.Morph.MaterialMorph["elements"][number] = {
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

                    morph = <PmxObject.Morph.MaterialMorph>{
                        ...morph,
                        elements
                    };
                }
                break;

            default:
                throw new Error(`Unknown morph type: ${type}`);
            }

            morphs.push(morph as BpmxObject.Morph);
        }

        return morphs;
    }

    private static _ParseDisplayFrames(dataDeserializer: AlignedDataDeserializer, positionToDisplayFrame: number): PmxObject.DisplayFrame[] {
        dataDeserializer.offset = positionToDisplayFrame;

        const displayFramesCount = dataDeserializer.getUint32();

        const displayFrames: PmxObject.DisplayFrame[] = [];
        for (let i = 0; i < displayFramesCount; ++i) {
            const name = dataDeserializer.getString(dataDeserializer.getUint32());
            const englishName = dataDeserializer.getString(dataDeserializer.getUint32());

            const isSpecialFrame = dataDeserializer.getUint8() === 1;
            dataDeserializer.offset += 3; // padding

            const elementsCount = dataDeserializer.getUint32();
            const frames: PmxObject.DisplayFrame.FrameData[] = [];
            for (let i = 0; i < elementsCount; ++i) {
                const frameType = dataDeserializer.getUint8();
                dataDeserializer.offset += 3; // padding
                const frameIndex = dataDeserializer.getInt32();

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

    private static _ParseRigidBodies(dataDeserializer: AlignedDataDeserializer, positionToRigidBody: number): PmxObject.RigidBody[] {
        dataDeserializer.offset = positionToRigidBody;

        const rigidBodiesCount = dataDeserializer.getUint32();

        const rigidBodies: PmxObject.RigidBody[] = [];
        for (let i = 0; i < rigidBodiesCount; ++i) {
            const name = dataDeserializer.getString(dataDeserializer.getUint32());
            const englishName = dataDeserializer.getString(dataDeserializer.getUint32());

            const boneIndex = dataDeserializer.getInt32();

            const collisionMask = dataDeserializer.getUint16();
            const collisionGroup = dataDeserializer.getUint8();

            const shapeType: PmxObject.RigidBody.ShapeType = dataDeserializer.getUint8();
            const shapeSize = dataDeserializer.getFloat32Tuple(3);
            const shapePosition = dataDeserializer.getFloat32Tuple(3);
            const shapeRotation = dataDeserializer.getFloat32Tuple(3);

            const mass = dataDeserializer.getFloat32();
            const linearDamping = dataDeserializer.getFloat32();
            const angularDamping = dataDeserializer.getFloat32();
            const repulsion = dataDeserializer.getFloat32();
            const friction = dataDeserializer.getFloat32();

            const physicsMode: PmxObject.RigidBody.PhysicsMode = dataDeserializer.getUint8();
            dataDeserializer.offset += 3; // padding

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

    private static _ParseJoints(dataDeserializer: AlignedDataDeserializer, positionToJoint: number): PmxObject.Joint[] {
        dataDeserializer.offset = positionToJoint;

        const jointsCount = dataDeserializer.getUint32();

        const joints: PmxObject.Joint[] = [];
        for (let i = 0; i < jointsCount; ++i) {
            const name = dataDeserializer.getString(dataDeserializer.getUint32());
            const englishName = dataDeserializer.getString(dataDeserializer.getUint32());

            const type: PmxObject.Joint.Type = dataDeserializer.getUint8();
            dataDeserializer.offset += 3; // padding
            const rigidbodyIndexA = dataDeserializer.getInt32();
            const rigidbodyIndexB = dataDeserializer.getInt32();
            const position = dataDeserializer.getFloat32Tuple(3);
            const rotation = dataDeserializer.getFloat32Tuple(3);
            const positionMin = dataDeserializer.getFloat32Tuple(3);
            const positionMax = dataDeserializer.getFloat32Tuple(3);
            const rotationMin = dataDeserializer.getFloat32Tuple(3);
            const rotationMax = dataDeserializer.getFloat32Tuple(3);
            const springPosition = dataDeserializer.getFloat32Tuple(3);
            const springRotation = dataDeserializer.getFloat32Tuple(3);

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
}
