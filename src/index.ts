import css from "./index.css";
css;

import * as BABYLON from "babylonjs";

import { MmdDataDeserializer } from "./loader/parser/MmdDataDeserializer";
import type { Vec3, Vec4 } from "./loader/parser/MmdTypes";
import { PmxObject } from "./loader/parser/PmxObject";
import { RuntimeBuilder } from "./runtime/base/RuntimeBuilder";
import { SceneBuilder } from "./runtime/instance/SceneBuilder";
import { TickRunner } from "./runtime/instance/TickRunner";

function engineStartup(): void {
    const canvas = document.getElementById("render-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Invalid canvas element");

    const engine = new BABYLON.WebGPUEngine(canvas, {
        powerPreference: "high-performance",
        antialias: true,
        stencil: true
    });

    const runtime = new RuntimeBuilder(canvas, engine)
        .withSceneBuilder(new SceneBuilder())
        .withTickRunner(new TickRunner())
        .make();

    runtime.run();

    Object.defineProperty(globalThis, "runtime", {
        value: runtime,
        writable: false,
        enumerable: true,
        configurable: false
    });
}

engineStartup;

async function deserializerTest(): Promise<void> {
    const data = await fetch("res/private_test/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx")
        .then((response) => response.arrayBuffer());
    const dataDeserializer = new MmdDataDeserializer(data);

    function parseHeader(): PmxObject.Header {
        const signature = dataDeserializer.getSignatureString(4);
        console.log(`signature: ${signature}`);

        const version = dataDeserializer.getFloat32();
        console.log(`version: ${version}`);

        const globalsCount = dataDeserializer.getUint8();
        console.log(`globalsCount: ${globalsCount}`);

        const encoding = dataDeserializer.getUint8();
        console.log(`encoding: ${encoding} ${encoding === PmxObject.Header.Encoding.utf8 ? "utf8" : "utf16le"}`);

        dataDeserializer.initializeTextDecoder(encoding);

        const additionalVec4Count = dataDeserializer.getUint8();
        console.log(`additionalVec4Count: ${additionalVec4Count}`);

        const vertexIndexSize = dataDeserializer.getUint8();
        console.log(`vertexIndexSize: ${vertexIndexSize}`);

        const textureIndexSize = dataDeserializer.getUint8();
        console.log(`textureIndexSize: ${textureIndexSize}`);

        const materialIndexSize = dataDeserializer.getUint8();
        console.log(`materialIndexSize: ${materialIndexSize}`);

        const boneIndexSize = dataDeserializer.getUint8();
        console.log(`boneIndexSize: ${boneIndexSize}`);

        const morphIndexSize = dataDeserializer.getUint8();
        console.log(`morphIndexSize: ${morphIndexSize}`);

        const rigidBodyIndexSize = dataDeserializer.getUint8();
        console.log(`rigidBodyIndexSize: ${rigidBodyIndexSize}`);

        if (globalsCount < 8) {
            throw new Error(`Invalid globalsCount: ${globalsCount}`);
        } else if (8 < globalsCount) {
            console.warn(`globalsCount is greater than 8: ${globalsCount} files may be corrupted or higher version`);
            for (let i = 8; i < globalsCount; ++i) {
                dataDeserializer.getUint8();
            }
        }

        const modelName = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        console.log(`modelName: ${modelName}`);

        const englishModelName = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        console.log(`englishModelName: ${englishModelName}`);

        const comment = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        console.log(`comment: ${comment}`);

        const englishComment = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        console.log(`englishComment: ${englishComment}`);

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
    const header = parseHeader();

    function getVertexIndex(): number {
        switch (header.boneIndexSize) {
        case 1:
            return dataDeserializer.getUint8();
        case 2:
            return dataDeserializer.getUint16();
        case 4:
            return dataDeserializer.getInt32();
        default:
            throw new Error(`Invalid vertexIndexSize: ${header.boneIndexSize}`);
        }
    }

    function getNonVertexIndex(indexSize: number): number {
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

    function getTextureIndex(): number {
        return getNonVertexIndex(header.textureIndexSize);
    }

    function getMaterialIndex(): number {
        return getNonVertexIndex(header.materialIndexSize);
    }

    function getBoneIndex(): number {
        return getNonVertexIndex(header.boneIndexSize);
    }

    function getMorphIndex(): number {
        return getNonVertexIndex(header.morphIndexSize);
    }

    function getRigidBodyIndex(): number {
        return getNonVertexIndex(header.rigidBodyIndexSize);
    }

    // #region parse vertices

    const verticesCount = dataDeserializer.getInt32();
    console.log(`verticesCount: ${verticesCount}`);

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
                boneIndices: [getVertexIndex()],
                boneWeights: [1.0]
            };
            boneWeight = bdef1weight;
            break;
        }
        case PmxObject.Vertex.BoneWeightType.bdef2: {
            const bdef2weight: PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef2> = {
                boneIndices: [getVertexIndex(), getVertexIndex()],
                boneWeights: [dataDeserializer.getFloat32()]
            };
            boneWeight = bdef2weight;
            break;
        }
        case PmxObject.Vertex.BoneWeightType.bdef4: {
            const bdef4weight: PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef4> = {
                boneIndices: [getVertexIndex(), getVertexIndex(), getVertexIndex(), getVertexIndex()],
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
                boneIndices: [getVertexIndex(), getVertexIndex()],
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
                boneIndices: [getVertexIndex(), getVertexIndex(), getVertexIndex(), getVertexIndex()],
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
    }

    console.log(vertices);

    // #endregion

    // #region parse faces

    const facesindicesCount = dataDeserializer.getInt32();
    console.log(`facesindicesCount: ${facesindicesCount}`);

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
        faces[i] = getVertexIndex();
    }

    console.log(faces);

    // #endregion

    // #region parse textures

    const texturesCount = dataDeserializer.getInt32();
    console.log(`texturesCount: ${texturesCount}`);

    const textures: PmxObject.Texture[] = [];
    for (let i = 0; i < texturesCount; ++i) {
        const textureName = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        textures.push(textureName);
    }

    console.log(textures);

    // #endregion

    // #region parse materials

    const materialsCount = dataDeserializer.getInt32();
    console.log(`materialsCount: ${materialsCount}`);

    const materials: PmxObject.Material[] = [];
    for (let i = 0; i < materialsCount; ++i) {
        const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32());

        const diffuse = dataDeserializer.getFloat32Array(4);
        const specular = dataDeserializer.getFloat32Array(3);
        const shininess = dataDeserializer.getFloat32();
        const ambient = dataDeserializer.getFloat32Array(3);

        const flag = dataDeserializer.getUint8();

        const edgeColor = dataDeserializer.getFloat32Array(4);
        const edgeSize = dataDeserializer.getFloat32();

        const textureIndex = getTextureIndex();
        const sphereTextureIndex = getTextureIndex();
        const sphereTextureMode = dataDeserializer.getUint8();

        const isSharedToonTexture = dataDeserializer.getUint8() === 1;
        const toonTextureIndex = isSharedToonTexture ? dataDeserializer.getUint8() : getTextureIndex();

        const comment = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
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

    console.log(materials);

    // #endregion

    // #region parse bones

    const bonesCount = dataDeserializer.getInt32();
    console.log(`bonesCount: ${bonesCount}`);

    const bones: PmxObject.Bone[] = [];
    for (let i = 0; i < bonesCount; ++i) {
        const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32());

        const position = dataDeserializer.getFloat32Array(3);
        const parentBoneIndex = getBoneIndex();
        const transformOrder = dataDeserializer.getInt32();

        const flag = dataDeserializer.getUint16();

        let tailPosition: number | Vec3;

        if (flag & PmxObject.Bone.Flag.useBoneIndexAsTailPosition) {
            tailPosition = getBoneIndex();
        } else {
            tailPosition = dataDeserializer.getFloat32Array(3);
        }

        let additionalTransform;

        if (flag & PmxObject.Bone.Flag.hasAdditionalMove || flag & PmxObject.Bone.Flag.hasAdditionalRotate) {
            additionalTransform = {
                isLocal: (flag & PmxObject.Bone.Flag.localAdditionTransform) !== 0,
                affectRotation: (flag & PmxObject.Bone.Flag.hasAdditionalRotate) !== 0,
                affectPosition: (flag & PmxObject.Bone.Flag.hasAdditionalMove) !== 0,
                parentIndex: getBoneIndex(),
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
            const target = getBoneIndex();
            const iteration = dataDeserializer.getInt32();
            const rotationConstraint = dataDeserializer.getFloat32();

            const links: PmxObject.Bone.IKLink[] = [];

            const linksCount = dataDeserializer.getInt32();
            for (let i = 0; i < linksCount; ++i) {
                const ikLinkTarget = getBoneIndex();
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

    console.log(bones);

    // #endregion

    // #region parse morphs

    const morphsCount = dataDeserializer.getInt32();
    console.log(`morphsCount: ${morphsCount}`);

    const morphs: PmxObject.Morph[] = [];
    for (let i = 0; i < morphsCount; ++i) {
        const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32());

        const category: PmxObject.Morph.Category = dataDeserializer.getInt8();
        const type: PmxObject.Morph.Type = dataDeserializer.getInt8();

        const morphOffsetCount = dataDeserializer.getInt32();

        const elements = [];

        switch (type) {
        case PmxObject.Morph.Type.groupMorph:
            for (let i = 0; i < morphOffsetCount; ++i) {
                const morphIndex = getMorphIndex();
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
                const vertexIndex = getVertexIndex();
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
                const boneIndex = getBoneIndex();
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
                const vertexIndex = getVertexIndex();
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
                const materialIndex = getMaterialIndex();
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
                const morphIndex = getMorphIndex();
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
                const rigidBodyIndex = getRigidBodyIndex();
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

    console.log(morphs);

    // #endregion

    // #region parse display frames

    const displayFramesCount = dataDeserializer.getInt32();
    console.log(`displayFramesCount: ${displayFramesCount}`);

    const displayFrames: PmxObject.DisplayFrame[] = [];
    for (let i = 0; i < displayFramesCount; ++i) {
        const name = dataDeserializer.getDecoderString(dataDeserializer.getInt32());
        const englishName = dataDeserializer.getDecoderString(dataDeserializer.getInt32());

        const isSpecialFrame = dataDeserializer.getUint8() === 1;

        const elementsCount = dataDeserializer.getInt32();
        const frames: PmxObject.DisplayFrame.FrameData[] = [];
        for (let i = 0; i < elementsCount; ++i) {
            const frameType = dataDeserializer.getUint8();
            const frameIndex = frameType === PmxObject.DisplayFrame.FrameData.FrameType.Bone
                ? getBoneIndex() : getMorphIndex();

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

    console.log(displayFrames);

    // #endregion

    // #region parse rigid bodies

    const rigidBodiesCount = dataDeserializer.getInt32();
    console.log(`rigidBodiesCount: ${rigidBodiesCount}`);

    const rigidBodies: PmxObject.RigidBody[] = [];
    for (let i = 0; i < rigidBodiesCount; ++i) {
        let a = 1;
        a++;

        rigidBodies;
        a;
    }
}

deserializerTest();
