import css from "./index.css";
css;

import * as BABYLON from "babylonjs";

import { MmdDataDeserializer } from "./loader/parser/MmdDataDeserializer";
import type { Vec4 } from "./loader/parser/MmdTypes";
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

        const modelName = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        console.log(`modelName: ${modelName}`);

        const englishModelName = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        console.log(`englishModelName: ${englishModelName}`);

        const comment = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        console.log(`comment: ${comment}`);

        const englishComment = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
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
            throw new Error(`Invalid boneIndexSize: ${header.boneIndexSize}`);
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

    // function getMaterialIndex(): number {
    //     return getNonVertexIndex(header.materialIndexSize);
    // }

    function getBoneIndex(): number {
        return getNonVertexIndex(header.boneIndexSize);
    }

    // function getMorphIndex(): number {
    //     return getNonVertexIndex(header.morphIndexSize);
    // }

    // function getRigidBodyIndex(): number {
    //     return getNonVertexIndex(header.rigidBodyIndexSize);
    // }

    // #region parse vertices

    const verticesCount = dataDeserializer.getUint32();
    console.log(`verticesCount: ${verticesCount}`);

    const vertices: PmxObject.Vertex[] = [];

    for (let i = 0; i < verticesCount; i++) {
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

    const facesCount = dataDeserializer.getUint32();
    console.log(`facesCount: ${facesCount}`);

    const faces: PmxObject.Face[] = [];
    for (let i = 0; i < facesCount; i += 3) {
        faces.push([getVertexIndex(), getVertexIndex(), getVertexIndex()]);
    }

    console.log(faces);

    // #endregion

    // #region parse textures

    const texturesCount = dataDeserializer.getUint32();
    console.log(`texturesCount: ${texturesCount}`);

    const textures: PmxObject.Texture[] = [];
    for (let i = 0; i < texturesCount; i++) {
        const textureName = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        textures.push(textureName);
    }

    console.log(textures);

    // #endregion

    // #region parse materials

    const materialsCount = dataDeserializer.getUint32();
    console.log(`materialsCount: ${materialsCount}`);

    const materials: PmxObject.Material[] = [];
    for (let i = 0; i < materialsCount; i++) {
        const name = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        const englishName = dataDeserializer.getDecoderString(dataDeserializer.getUint32());

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

        const comment = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        const faceCount = dataDeserializer.getUint32();

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

    const bonesCount = dataDeserializer.getUint32();
    console.log(`bonesCount: ${bonesCount}`);

    const bones: PmxObject.Bone[] = [];
    for (let i = 0; i < bonesCount; i++) {
        const boneName = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        const boneNameEn = dataDeserializer.getDecoderString(dataDeserializer.getUint32());

        const bonePosition = dataDeserializer.getFloat32Array(3);
        const parentBoneIndex = getBoneIndex();
        const boneLevel = dataDeserializer.getUint32();

        const boneFlag = dataDeserializer.getUint16();

        boneName;
        boneNameEn;
        bonePosition;
        parentBoneIndex;
        boneLevel;
        boneFlag;
    }

    console.log(bones);

    // #endregion
}

deserializerTest();
