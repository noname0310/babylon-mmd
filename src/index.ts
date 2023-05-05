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
    const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
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

    (globalThis as any).runtime = runtime;
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

        const textIncoding = dataDeserializer.getUint8();
        console.log(`textIncoding: ${textIncoding} ${textIncoding === PmxObject.Header.Encoding.utf8 ? "utf8" : "utf16le"}`);

        dataDeserializer.initializeTextDecoder(textIncoding);

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

        const modelNameEn = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        console.log(`modelNameEn: ${modelNameEn}`);

        const comment = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        console.log(`comment: ${comment}`);

        const commentEn = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        console.log(`commentEn: ${commentEn}`);

        const header: PmxObject.Header = {
            signature: signature,
            version: version,

            encoding: textIncoding,
            additionalVec4Count: additionalVec4Count,

            vertexIndexSize: vertexIndexSize,
            textureIndexSize: textureIndexSize,
            materialIndexSize: materialIndexSize,
            boneIndexSize: boneIndexSize,
            morphIndexSize: morphIndexSize,
            rigidBodyIndexSize: rigidBodyIndexSize,

            modelName: modelName,
            englishModelName: modelNameEn,
            comment: comment,
            englishComment: commentEn
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

    // function getBoneIndex(): number {
    //     return getNonVertexIndex(header.boneIndexSize);
    // }

    // function getMorphIndex(): number {
    //     return getNonVertexIndex(header.morphIndexSize);
    // }

    // function getRigidBodyIndex(): number {
    //     return getNonVertexIndex(header.rigidBodyIndexSize);
    // }

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
        const weightDeformType = dataDeserializer.getUint8() as PmxObject.Vertex.BoneWeightType;

        let boneWeight: PmxObject.Vertex.BoneWeight;

        switch (weightDeformType) {
        case PmxObject.Vertex.BoneWeightType.bdef1:
            boneWeight = {
                boneIndices: [getVertexIndex()],
                boneWeights: [1.0]
            } as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef1>;
            break;

        case PmxObject.Vertex.BoneWeightType.bdef2:
            boneWeight = {
                boneIndices: [getVertexIndex(), getVertexIndex()],
                boneWeights: [dataDeserializer.getFloat32()]
            } as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef2>;
            break;

        case PmxObject.Vertex.BoneWeightType.bdef4:
            boneWeight = {
                boneIndices: [getVertexIndex(), getVertexIndex(), getVertexIndex(), getVertexIndex()],
                boneWeights: [
                    dataDeserializer.getFloat32(),
                    dataDeserializer.getFloat32(),
                    dataDeserializer.getFloat32(),
                    dataDeserializer.getFloat32()
                ]
            } as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef4>;
            break;

        case PmxObject.Vertex.BoneWeightType.sdef:
            boneWeight = {
                boneIndices: [getVertexIndex(), getVertexIndex()],
                boneWeights: {
                    boneWeight0: dataDeserializer.getFloat32(),
                    c: dataDeserializer.getFloat32Array(3),
                    r0: dataDeserializer.getFloat32Array(3),
                    r1: dataDeserializer.getFloat32Array(3)
                }
            } as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.sdef>;
            break;
        case PmxObject.Vertex.BoneWeightType.qdef:
            boneWeight = {
                boneIndices: [getVertexIndex(), getVertexIndex(), getVertexIndex(), getVertexIndex()],
                boneWeights: [
                    dataDeserializer.getFloat32(),
                    dataDeserializer.getFloat32(),
                    dataDeserializer.getFloat32(),
                    dataDeserializer.getFloat32()
                ]
            } as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.qdef>;
            break;
        default:
            throw new Error(`Invalid weightDeformType: ${weightDeformType}`);
        }

        const edgeScale = dataDeserializer.getFloat32();

        vertices.push({
            position: position,
            normal: normal,
            uv: uv,
            additionalVec4: additionalVec4,
            weightType: weightDeformType,
            boneWeight: boneWeight,
            edgeRatio: edgeScale
        });
    }

    console.log(vertices);

    const facesCount = dataDeserializer.getUint32();
    console.log(`facesCount: ${facesCount}`);

    const faces: PmxObject.Face[] = [];
    for (let i = 0; i < facesCount; i += 3) {
        faces.push([getVertexIndex(), getVertexIndex(), getVertexIndex()]);
    }

    console.log(faces);

    const texturesCount = dataDeserializer.getUint32();
    console.log(`texturesCount: ${texturesCount}`);

    const textures: PmxObject.Texture[] = [];
    for (let i = 0; i < texturesCount; i++) {
        const textureName = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        textures.push(textureName);
    }

    console.log(textures);

    const materialsCount = dataDeserializer.getUint32();
    console.log(`materialsCount: ${materialsCount}`);

    const materials: PmxObject.Material[] = [];
    for (let i = 0; i < materialsCount; i++) {
        const materialName = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        const materialNameEn = dataDeserializer.getDecoderString(dataDeserializer.getUint32());

        const diffuse = dataDeserializer.getFloat32Array(4);
        const specular = dataDeserializer.getFloat32Array(3);
        const shininess = dataDeserializer.getFloat32();
        const ambient = dataDeserializer.getFloat32Array(3);

        const drawFlag = dataDeserializer.getUint8();

        const edgeColor = dataDeserializer.getFloat32Array(4);
        const edgeSize = dataDeserializer.getFloat32();

        const textureIndex = getTextureIndex();
        const sphereTextureIndex = getTextureIndex();
        const sphereMode = dataDeserializer.getUint8();

        const isSharedToonTexture = dataDeserializer.getUint8() === 1;
        const toonTextureIndex = isSharedToonTexture ? dataDeserializer.getUint8() : getTextureIndex();

        const comment = dataDeserializer.getDecoderString(dataDeserializer.getUint32());
        const faceCount = dataDeserializer.getUint32();

        const material: PmxObject.Material = {
            name: materialName,
            englishName: materialNameEn,

            diffuse: diffuse,
            specular: specular,
            shininess: shininess,
            ambient: ambient,

            flag: drawFlag,

            edgeColor: edgeColor,
            edgeSize: edgeSize,

            textureIndex: textureIndex,
            sphereTextureIndex: sphereTextureIndex,
            sphereTextureMode: sphereMode,

            isSharedToonTexture: isSharedToonTexture,
            toonTextureIndex: toonTextureIndex,

            comment: comment,
            faceCount: faceCount
        };
        materials.push(material);
    }

    console.log(materials);
}

deserializerTest();
