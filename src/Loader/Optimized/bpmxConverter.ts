/**
 * BabylonPMX(BPMX) representation
 *
 * signature: uint8[4] "BPMX"
 * version: int8[3] - major, minor, patch
 *
 * modelName: uint32, uint8[] - length, string
 * englishModelName: uint32, uint8[] - length, string
 * comment: uint32, uint8[] - length, string
 * englishComment: uint32, uint8[] - length, string
 *
 * vertexCount: uint32
 * positions: float32[vertexCount * 3]
 * normals: float32[vertexCount * 3]
 * uvs: float32[vertexCount * 2]
 * indicesBytePerElement: uint8
 * indicesCount: uint32
 * indices: uint16[vertexCount] or uint32[vertexCount]
 * matricesIndices: float32[vertexCount * 4]
 * matricesWeights: float32[vertexCount * 4]
 * hasSdef: uint8 - 0 or 1
 * { // if hasSdef
 *  sdefC: float32[vertexCount * 3]
 *  sdefR0: float32[vertexCount * 3]
 *  sdefR1: float32[vertexCount * 3]
 * }
 *
 * textureCount: uint32
 * textures: {
 *  uint32, uint8[] - length, string
 *  uint32 - byteLength
 *  uint8[texturesCount] - arrayBuffer
 * }[textureCount]
 *
 * materialCount: uint32
 * {
 *  materialName: uint32, uint8[] - length, string
 *  englishMaterialName: uint32, uint8[] - length, string
 *  diffuse: float32[4];
 *  specular: float32[3]
 *  shininess: float32
 *  ambient: float32[3]
 *  evauatedTransparency: int8 - -1: not evaluated, 0: opaque, 1: alphatest, 2: alphablend
 *  flag: uint8
 *  edgeColor: float32[4]
 *  edgeSize: float32
 *  textureIndex: int32
 *  sphereTextureIndex: int32
 *  sphereTextureMode: uint8
 *  isSharedToontexture: uint8
 *  toonTextureIndex: int32
 *  comment: uint32, uint8[] - length, string
 *  indexCount: uint32
 * }[materialCount]
 *
 * boneCount: uint32
 * {
 *  boneName: uint32, uint8[] - length, string
 *  englishBoneName: uint32, uint8[] - length, string
 *  position: float32[3]
 *  parentBoneIndex: int32
 *  transformOrder: int32
 *  flag: uint16
 *  tailPosition: float32[3] | int32
 *  appendTransform: { // if has appendTransform
 *    parentIndex: int32
 *    ratio: float32
 *  }
 *  axisLimit: float32[3] // if has axisLimit
 *  localVectorX: float32[3] // if has localVector
 *  localVectorZ: float32[3] // if has localVector
 *  externalParentTransform: int32 // if has externalParentBoneIndex
 *  ikInfo: { // if has ikInfo
 *   target: int32
 *   iteration: int32
 *   rotationConstraint: float32
 *   linkCount: int32
 *   links: {
 *    target: int32
 *    hasLimit: uint8
 *    minimumAngle: float32[3] // if hasLimit
 *    maximumAngle: float32[3] // if hasLimit
 *   }[linkCount]
 *  }
 * }[boneCount]
 *
 * morphCount: uint32
 * {
 *  morphName: uint32, uint8[] - length, string
 *  englishMorphName: uint32, uint8[] - length, string
 *  category: uint8
 *  type: uint8
 *
 *  elementCount: uint32
 *
 *  { // if type is material
 *   index: int32
 *   type: uint8
 *   diffuse: float32[4]
 *   specular: float32[3]
 *   shininess: float32
 *   ambient: float32[3]
 *   edgeColor: float32[4]
 *   edgeSize: float32
 *   textureColor: float32[4]
 *   sphereTextureColor: float32[4]
 *   toonTextureColor: float32[4]
 *  }[elementCount]
 *
 *  { // if type is group
 *   indices: int32[elementCount]
 *   ratios: float32[elementCount]
 *  }
 *
 *  { // if type is bone
 *   indices: int32[elementCount]
 *   positions: float32[elementCount * 3]
 *   rotations: float32[elementCount * 4]
 *  }
 *
 *  { // if type is uv
 *   indices: int32[elementCount]
 *   uvs: float32[elementCount * 4]
 *  }
 *
 *  { // if type is vertex
 *   indices: int32[elementCount]
 *   positions: float32[elementCount * 3]
 *  }
 * }[morphCount]
 *
 * displayFrameCount: uint32
 * {
 *  name: uint32, uint8[] - length, string
 *  englishName: uint32, uint8[] - length, string
 *  isSpecialFrame: uint8
 *  elementCount: uint32
 *  elements: {
 *   frameType: uint8
 *   frameIndex: int32
 *  }[elementCount]
 * }[displayFrameCount]
 *
 * rigidBodyCount: uint32
 * {
 *  name: uint32, uint8[] - length, string
 *  englishName: uint32, uint8[] - length, string
 *  boneIndex: int32
 *  collisionGroup: uint8
 *  collisionMask: uint16
 *  shapeType: uint8
 *  shapeSize: float32[3]
 *  shapePosition: float32[3]
 *  shapeRotation: float32[3]
 *  mass: float32
 *  linearDamping: float32
 *  angularDamping: float32
 *  repulsion: float32
 *  friction: float32
 *  physicsMode: uint8
 * }[rigidBodyCount]
 *
 * jointCount: uint32
 * {
 *  name: uint32, uint8[] - length, string
 *  englishName: uint32, uint8[] - length, string
 *  type: uint8
 *  rigidBodyIndexA: int32
 *  rigidBodyIndexB: int32
 *  position: float32[3]
 *  rotation: float32[3]
 *  positionMin: float32[3]
 *  positionMax: float32[3]
 *  rotationMin: float32[3]
 *  rotationMax: float32[3]
 *  springPosition: float32[3]
 *  springRotation: float32[3]
 * }[jointCount]
 */
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import { MmdAsyncTextureLoader } from "../mmdAsyncTextureLoader";
import type { ILogger } from "../Parser/ILogger";
import type { IPmxReaderConstructor } from "../Parser/IPmxReaderConstructor";
import { PmxObject } from "../Parser/pmxObject";
import { ReferenceFileResolver } from "../referenceFileResolver";
import { TextureAlphaChecker } from "../textureAlphaChecker";
import { MmdDataSerializer } from "./mmdDataSerializer";

/**
 * BPMX converter
 */
export class BpmxConverter implements ILogger {
    /**
     * The threshold of material alpha to use transparency mode. (default: 195)
     *
     * lower value is more likely to use transparency mode. (0 - 255)
     */
    public alphaThreshold: number;

    /**
     * The threshold of transparency mode to use alpha blend. (default: 100)
     *
     * lower value is more likely to use alpha test mode. otherwise use alpha blemd mode
     */
    public alphaBlendThreshold: number;

    /**
     * Whether to use alpha evaluation (default: true)
     *
     * If true, evaluate the alpha of the texture to automatically determine the blending method of the material
     *
     * This automatic blend mode decision is not perfect and is quite costly
     *
     * For load time optimization, it is recommended to turn off this feature and set the blending mode for the material manually
     */
    public useAlphaEvaluation: boolean;

    /**
     * The canvas resolution to evaluate alpha (default: 512)
     *
     * Resolution of the render canvas used to evaluate alpha internally
     *
     * The higher the resolution, the higher the accuracy and the longer the load time
     */
    public alphaEvaluationResolution: number;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    /**
     * Create a BPMX converter
     */
    public constructor() {
        this.alphaThreshold = 195;
        this.alphaBlendThreshold = 100;
        this.useAlphaEvaluation = true;
        this.alphaEvaluationResolution = 512;

        this._loggingEnabled = true;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    /**
     * Convert PMX to BPMX
     * @param scene Scene
     * @param reader PMX reader static class (PmxReader or PmdReader)
     * @param urlOrFileName if files is undefined, urlOrFileName is url of PMX file. if files is defined, urlOrFileName is file name of PMX file.
     * @param files Dependency files of PMX file (textures, sphere textures, toon textures)
     * @param overrideMaterialTransparency Override alpha evaluation result function
     * @returns BPMX data as ArrayBuffer
     * @throws {Error} if PMX file not found
     */
    public async convert(
        scene: Scene,
        reader: IPmxReaderConstructor,
        urlOrFileName: string,
        files?: File[],
        overrideMaterialTransparency?: (materialsName: readonly string[], textureAlphaEvaluateResults: number[]) => void
    ): Promise<ArrayBuffer> {
        const alphaThreshold = this.alphaThreshold;
        const alphaBlendThreshold = this.alphaBlendThreshold;
        const useAlphaEvaluation = this.useAlphaEvaluation;
        const alphaEvaluationResolution = this.alphaEvaluationResolution;

        let pmxObject: PmxObject;
        if (files === undefined) {
            const arrayBuffer = await scene._loadFileAsync(urlOrFileName, undefined, true, true);

            pmxObject = await reader.ParseAsync(arrayBuffer as ArrayBuffer, this);
        } else {
            const pmxFile = files.find((file) => file.webkitRelativePath === urlOrFileName);
            if (pmxFile === undefined) {
                throw new Error(`File ${urlOrFileName} not found`);
            }

            const arrayBuffer = await pmxFile.arrayBuffer();

            pmxObject = await reader.ParseAsync(arrayBuffer, this);
        }

        const vertices = pmxObject.vertices;

        const positions = new Float32Array(vertices.length * 3);
        const normals = new Float32Array(vertices.length * 3);
        const uvs = new Float32Array(vertices.length * 2);

        let indices;
        if (pmxObject.faces instanceof Uint8Array || pmxObject.faces instanceof Uint16Array) {
            indices = new Uint16Array(pmxObject.faces.length);
        } else {
            indices = new Uint32Array(pmxObject.faces.length);
        }

        const boneIndices = new Float32Array(vertices.length * 4);
        const boneWeights = new Float32Array(vertices.length * 4);
        let hasSdef = false;
        const boneSdefC = new Float32Array(pmxObject.vertices.length * 3);
        const boneSdefR0 = new Float32Array(pmxObject.vertices.length * 3);
        const boneSdefR1 = new Float32Array(pmxObject.vertices.length * 3);

        // prepare geometry buffers
        {
            const vertices = pmxObject.vertices;
            {
                const faces = pmxObject.faces;
                for (let i = 0; i < indices.length; i += 3) { // reverse winding order
                    indices[i + 0] = faces[i + 0];
                    indices[i + 1] = faces[i + 2];
                    indices[i + 2] = faces[i + 1];
                }
            }

            for (let i = 0; i < vertices.length; ++i) {
                const vertex = vertices[i];
                positions[i * 3 + 0] = vertex.position[0];
                positions[i * 3 + 1] = vertex.position[1];
                positions[i * 3 + 2] = vertex.position[2];

                normals[i * 3 + 0] = vertex.normal[0];
                normals[i * 3 + 1] = vertex.normal[1];
                normals[i * 3 + 2] = vertex.normal[2];

                uvs[i * 2 + 0] = vertex.uv[0];
                uvs[i * 2 + 1] = 1 - vertex.uv[1]; // flip y axis

                switch (vertex.weightType) {
                case PmxObject.Vertex.BoneWeightType.Bdef1:
                    {
                        const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef1>;

                        boneIndices[i * 4 + 0] = boneWeight.boneIndices;
                        boneIndices[i * 4 + 1] = 0;
                        boneIndices[i * 4 + 2] = 0;
                        boneIndices[i * 4 + 3] = 0;

                        boneWeights[i * 4 + 0] = 1;
                        boneWeights[i * 4 + 1] = 0;
                        boneWeights[i * 4 + 2] = 0;
                        boneWeights[i * 4 + 3] = 0;
                    }
                    break;

                case PmxObject.Vertex.BoneWeightType.Bdef2:
                    {
                        const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef2>;

                        boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                        boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                        boneIndices[i * 4 + 2] = 0;
                        boneIndices[i * 4 + 3] = 0;

                        boneWeights[i * 4 + 0] = boneWeight.boneWeights;
                        boneWeights[i * 4 + 1] = 1 - boneWeight.boneWeights;
                        boneWeights[i * 4 + 2] = 0;
                        boneWeights[i * 4 + 3] = 0;
                    }
                    break;

                case PmxObject.Vertex.BoneWeightType.Bdef4:
                case PmxObject.Vertex.BoneWeightType.Qdef: // pmx 2.1 not support fallback to bdef4
                    {
                        const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef4>;

                        boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                        boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                        boneIndices[i * 4 + 2] = boneWeight.boneIndices[2];
                        boneIndices[i * 4 + 3] = boneWeight.boneIndices[3];

                        boneWeights[i * 4 + 0] = boneWeight.boneWeights[0];
                        boneWeights[i * 4 + 1] = boneWeight.boneWeights[1];
                        boneWeights[i * 4 + 2] = boneWeight.boneWeights[2];
                        boneWeights[i * 4 + 3] = boneWeight.boneWeights[3];
                    }
                    break;

                case PmxObject.Vertex.BoneWeightType.Sdef:
                    {
                        const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Sdef>;

                        boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                        boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                        boneIndices[i * 4 + 2] = 0;
                        boneIndices[i * 4 + 3] = 0;

                        const sdefWeights = boneWeight.boneWeights;
                        const boneWeight0 = sdefWeights.boneWeight0;
                        const boneWeight1 = 1 - boneWeight0;

                        boneWeights[i * 4 + 0] = boneWeight0;
                        boneWeights[i * 4 + 1] = boneWeight1;
                        boneWeights[i * 4 + 2] = 0;
                        boneWeights[i * 4 + 3] = 0;

                        boneSdefC[i * 3 + 0] = sdefWeights.c[0];
                        boneSdefC[i * 3 + 1] = sdefWeights.c[1];
                        boneSdefC[i * 3 + 2] = sdefWeights.c[2];

                        boneSdefR0[i * 3 + 0] = sdefWeights.r0[0];
                        boneSdefR0[i * 3 + 1] = sdefWeights.r0[1];
                        boneSdefR0[i * 3 + 2] = sdefWeights.r0[2];

                        boneSdefR1[i * 3 + 0] = sdefWeights.r1[0];
                        boneSdefR1[i * 3 + 1] = sdefWeights.r1[1];
                        boneSdefR1[i * 3 + 2] = sdefWeights.r1[2];

                        hasSdef = true;
                    }
                    break;
                }
            }
        }

        const textureLoadResults: Nullable<Texture>[] = new Array(pmxObject.textures.length);

        // create texture table
        {
            const rootUrl = urlOrFileName.substring(0, urlOrFileName.lastIndexOf("/") + 1);

            const textureLoader = new MmdAsyncTextureLoader();
            const referenceFileResolver = new ReferenceFileResolver<File>(files ?? [], rootUrl, "");
            const promises: Promise<void>[] = [];

            const materials = pmxObject.materials;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
                if (diffuseTexturePath !== undefined) {
                    const file = referenceFileResolver.resolve(diffuseTexturePath);
                    if (file !== undefined) {
                        promises.push(textureLoader.loadTextureFromBufferAsync(
                            0,
                            diffuseTexturePath,
                            file,
                            scene,
                            null
                        ).then((result) => {
                            textureLoadResults[materialInfo.textureIndex] = result;
                        }));
                    } else {
                        promises.push(textureLoader.loadTextureAsync(
                            0,
                            rootUrl,
                            diffuseTexturePath,
                            scene,
                            null
                        ).then((result) => {
                            textureLoadResults[materialInfo.textureIndex] = result;
                        }));
                    }
                }

                const sphereTexturePath = pmxObject.textures[materialInfo.sphereTextureIndex];
                if (sphereTexturePath !== undefined) {
                    const file = referenceFileResolver.resolve(sphereTexturePath);
                    if (file !== undefined) {
                        promises.push(textureLoader.loadTextureFromBufferAsync(
                            0,
                            sphereTexturePath,
                            file,
                            scene,
                            null
                        ).then((result) => {
                            textureLoadResults[materialInfo.sphereTextureIndex] = result;
                        }));
                    } else {
                        promises.push(textureLoader.loadTextureAsync(
                            0,
                            rootUrl,
                            sphereTexturePath,
                            scene,
                            null
                        ).then((result) => {
                            textureLoadResults[materialInfo.sphereTextureIndex] = result;
                        }));
                    }
                }

                const toonTexturePath = pmxObject.textures[materialInfo.toonTextureIndex];
                if (toonTexturePath !== undefined && !materialInfo.isSharedToonTexture) {
                    const file = referenceFileResolver.resolve(toonTexturePath);
                    if (file !== undefined) {
                        promises.push(textureLoader.loadTextureFromBufferAsync(
                            0,
                            toonTexturePath,
                            file,
                            scene,
                            null
                        ).then((result) => {
                            textureLoadResults[materialInfo.toonTextureIndex] = result;
                        }));
                    } else {
                        promises.push(textureLoader.loadTextureAsync(
                            0,
                            rootUrl,
                            toonTexturePath,
                            scene,
                            null
                        ).then((result) => {
                            textureLoadResults[materialInfo.toonTextureIndex] = result;
                        }));
                    }
                }
            }

            textureLoader.loadModelTexturesEnd(0);

            await Promise.all(promises);

            const onModelTextureLoadedObservable = textureLoader.onModelTextureLoadedObservable.get(0);
            if (onModelTextureLoadedObservable !== undefined) {
                await new Promise<void>((resolve) => {
                    onModelTextureLoadedObservable.addOnce(() => {
                        resolve();
                    });
                });
            }
        }

        const textureAlphaEvaluateResults: number[] = new Array(pmxObject.materials.length).fill(-1);

        // evaluate texture alpha
        if (useAlphaEvaluation) {
            // todo: pass submeshes
            const textureAlphaChecker = new TextureAlphaChecker(scene, alphaEvaluationResolution);

            const materials = pmxObject.materials;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
                if (diffuseTexturePath !== undefined) {
                    const textureIndex = materialInfo.textureIndex;
                    const texture = textureLoadResults[textureIndex];
                    if (texture !== undefined && texture?._buffer !== null) {
                        // todo: pass submeshes
                        // const textureAlphaEvaluateResult = await textureAlphaChecker.textureHasAlphaOnGeometry(
                        //     textureData.texture!,
                        //     mesh,
                        //     alphaThreshold,
                        //     alphaBlendThreshold
                        // );
                        alphaThreshold;
                        alphaBlendThreshold;
                        textureAlphaEvaluateResults[i] = 0;// textureAlphaEvaluateResult;
                    }
                }
            }

            textureAlphaChecker.dispose();
        }

        // override material transparency
        if (overrideMaterialTransparency !== undefined) {
            const materials = pmxObject.materials;
            const materialsName: string[] = new Array(materials.length);
            for (let i = 0; i < materials.length; ++i) {
                materialsName[i] = materials[i].name;
            }

            overrideMaterialTransparency(materialsName, textureAlphaEvaluateResults);
        }

        const encoder = new TextEncoder();

        let dataLength =
            4 + // signature
            3; // version

        { // compute dataLength
            const pmxObjectHeader = pmxObject.header;
            dataLength += 4 + encoder.encode(pmxObjectHeader.modelName).length; // modelName
            dataLength += 4 + encoder.encode(pmxObjectHeader.englishModelName).length; // englishModelName
            dataLength += 4 + encoder.encode(pmxObjectHeader.comment).length; // comment
            dataLength += 4 + encoder.encode(pmxObjectHeader.englishComment).length; // englishComment

            dataLength += 4; // vertexCount
            dataLength += vertices.length * 3 * 4; // positions
            dataLength += vertices.length * 3 * 4; // normals
            dataLength += vertices.length * 2 * 4; // uvs
            dataLength += 1; // indicesBytePerElement
            dataLength += 4; // indicesCount
            dataLength += indices.byteLength; // indices
            dataLength += vertices.length * 4 * 4; // boneIndices
            dataLength += vertices.length * 4 * 4; // boneWeights
            dataLength += 1; // hasSdef
            if (hasSdef) {
                dataLength += vertices.length * 3 * 4; // sdefC
                dataLength += vertices.length * 3 * 4; // sdefR0
                dataLength += vertices.length * 3 * 4; // sdefR1
            }

            dataLength += 4; // textureCount
            const pmxObjectTextures = pmxObject.textures;
            for (let i = 0; i < pmxObjectTextures.length; ++i) {
                const texture = textureLoadResults[i]?._buffer;
                if (!(texture instanceof ArrayBuffer)) {
                    throw new Error(`Texture ${pmxObjectTextures[i]} not found`);
                    // todo: check this
                }
                if (texture !== undefined && texture !== null) {
                    dataLength += 4 + encoder.encode(pmxObjectTextures[i]).length; // textureName
                    dataLength += 4; // textureByteLength
                    dataLength += texture.byteLength; // textureData
                } else {
                    dataLength += 4; // textureName
                    dataLength += 4; // textureByteLength
                }
            }

            dataLength += 4; // materialCount
            const pmxObjectMaterials = pmxObject.materials;
            for (let i = 0; i < pmxObjectMaterials.length; ++i) {
                const materialInfo = pmxObjectMaterials[i];

                dataLength += 4 + encoder.encode(materialInfo.name).length; // materialName
                dataLength += 4 + encoder.encode(materialInfo.englishName).length; // englishMaterialName
                dataLength += 4 * 4; // diffuse
                dataLength += 3 * 4; // specular
                dataLength += 4; // shininess
                dataLength += 3 * 4; // ambient
                dataLength += 1; // evauatedTransparency
                dataLength += 1; // flag
                dataLength += 4 * 4; // edgeColor
                dataLength += 4; // edgeSize
                dataLength += 4; // textureIndex
                dataLength += 4; // sphereTextureIndex
                dataLength += 1; // sphereTextureMode
                dataLength += 1; // isSharedToontexture
                dataLength += 4; // toonTextureIndex
                dataLength += 4 + encoder.encode(materialInfo.comment).length; // comment
                dataLength += 4; // indexCount
            }

            dataLength += 4; // boneCount
            const pmxObjectBones = pmxObject.bones;
            for (let i = 0; i < pmxObjectBones.length; ++i) {
                const boneInfo = pmxObjectBones[i];

                dataLength += 4 + encoder.encode(boneInfo.name).length; // boneName
                dataLength += 4 + encoder.encode(boneInfo.englishName).length; // englishBoneName
                dataLength += 3 * 4; // position
                dataLength += 4; // parentBoneIndex
                dataLength += 4; // transformOrder
                dataLength += 2; // flag
                if (typeof boneInfo.tailPosition === "number") {
                    dataLength += 4; // tailPosition
                } else {
                    dataLength += 3 * 4; // tailPosition
                }
                if (boneInfo.appendTransform !== undefined) {
                    dataLength += 4; // appendTransform.parentIndex
                    dataLength += 4; // appendTransform.ratio
                }
                if (boneInfo.axisLimit !== undefined) {
                    dataLength += 3 * 4; // axisLimit
                }
                if (boneInfo.localVector !== undefined) {
                    dataLength += 3 * 4; // localVectorX
                    dataLength += 3 * 4; // localVectorZ
                }
                if (boneInfo.externalParentTransform !== undefined) {
                    dataLength += 4; // externalParentTransform
                }
                if (boneInfo.ik !== undefined) {
                    dataLength += 4; // ik.target
                    dataLength += 4; // ik.iteration
                    dataLength += 4; // ik.rotationConstraint
                    dataLength += 4; // ik.linkCount

                    const ikLinks = boneInfo.ik.links;
                    for (let j = 0; j < ikLinks.length; ++j) {
                        const ikLink = ikLinks[j];

                        dataLength += 4; // ik.link.target
                        dataLength += 1; // ik.link.hasLimit
                        if (ikLink.limitation !== undefined) {
                            dataLength += 3 * 4; // ik.link.minimumAngle
                            dataLength += 3 * 4; // ik.link.maximumAngle
                        }
                    }
                }
            }

            dataLength += 4; // morphCount
            const pmxObjectMorphs = pmxObject.morphs;
            for (let i = 0; i < pmxObjectMorphs.length; ++i) {
                const morphInfo = pmxObjectMorphs[i];

                dataLength += 4 + encoder.encode(morphInfo.name).length; // morphName
                dataLength += 4 + encoder.encode(morphInfo.englishName).length; // englishMorphName
                dataLength += 1; // category
                dataLength += 1; // type
                dataLength += 4; // elementCount
                switch (morphInfo.type) {
                case PmxObject.Morph.Type.GroupMorph:
                    dataLength += (
                        4 + // group.indices
                        4 // group.ratios
                    ) * morphInfo.indices.length;
                    break;

                case PmxObject.Morph.Type.VertexMorph:
                    dataLength += (
                        4 + // vertex.indices
                        3 * 4 // vertex.positions
                    ) * morphInfo.indices.length;
                    break;

                case PmxObject.Morph.Type.BoneMorph:
                    dataLength += (
                        4 + // bone.indices
                        3 * 4 + // bone.positions
                        4 * 4 // bone.rotations
                    ) * morphInfo.indices.length;
                    break;

                case PmxObject.Morph.Type.UvMorph:
                case PmxObject.Morph.Type.AdditionalUvMorph1:
                case PmxObject.Morph.Type.AdditionalUvMorph2:
                case PmxObject.Morph.Type.AdditionalUvMorph3:
                case PmxObject.Morph.Type.AdditionalUvMorph4:
                    dataLength += (
                        4 + // uv.indices
                        4 * 4 // uv.uvs
                    ) * morphInfo.indices.length;
                    break;

                case PmxObject.Morph.Type.MaterialMorph:
                    dataLength += (
                        4 + // material.index
                        1 + // material.type
                        4 * 4 + // material.diffuse
                        3 * 4 + // material.specular
                        4 + // material.shininess
                        3 * 4 + // material.ambient
                        4 * 4 + // material.edgeColor
                        4 + // material.edgeSize
                        4 * 4 + // material.textureColor
                        4 * 4 + // material.sphereTextureColor
                        4 * 4 // material.toonTextureColor
                    ) * morphInfo.elements.length;
                    break;
                }
            }

            dataLength += 4; // displayFrameCount
            const pmxObjectDisplayFrames = pmxObject.displayFrames;
            for (let i = 0; i < pmxObjectDisplayFrames.length; ++i) {
                const displayFrameInfo = pmxObjectDisplayFrames[i];

                dataLength += 4 + encoder.encode(displayFrameInfo.name).length; // name
                dataLength += 4 + encoder.encode(displayFrameInfo.englishName).length; // englishName
                dataLength += 1; // isSpecialFrame
                dataLength += 4; // elementCount
                dataLength += (
                    1 + // element.frameType
                    4 // element.frameIndex
                ) * displayFrameInfo.frames.length;
            }

            dataLength += 4; // rigidBodyCount
            const pmxObjectRigidBodies = pmxObject.rigidBodies;
            for (let i = 0; i < pmxObjectRigidBodies.length; ++i) {
                const rigidBodyInfo = pmxObjectRigidBodies[i];

                dataLength += 4 + encoder.encode(rigidBodyInfo.name).length; // name
                dataLength += 4 + encoder.encode(rigidBodyInfo.englishName).length; // englishName
                dataLength += 4; // boneIndex
                dataLength += 1; // collisionGroup
                dataLength += 2; // collisionMask
                dataLength += 1; // shapeType
                dataLength += 3 * 4; // shapeSize
                dataLength += 3 * 4; // shapePosition
                dataLength += 3 * 4; // shapeRotation
                dataLength += 4; // mass
                dataLength += 4; // linearDamping
                dataLength += 4; // angularDamping
                dataLength += 4; // repulsion
                dataLength += 4; // friction
                dataLength += 1; // physicsMode
            }

            dataLength += 4; // jointCount
            const pmxObjectJoints = pmxObject.joints;
            for (let i = 0; i < pmxObjectJoints.length; ++i) {
                const jointInfo = pmxObjectJoints[i];

                dataLength += 4 + encoder.encode(jointInfo.name).length; // name
                dataLength += 4 + encoder.encode(jointInfo.englishName).length; // englishName
                dataLength += 1; // type
                dataLength += 4; // rigidBodyIndexA
                dataLength += 4; // rigidBodyIndexB
                dataLength += 3 * 4; // position
                dataLength += 3 * 4; // rotation
                dataLength += 3 * 4; // positionMin
                dataLength += 3 * 4; // positionMax
                dataLength += 3 * 4; // rotationMin
                dataLength += 3 * 4; // rotationMax
                dataLength += 3 * 4; // springPosition
                dataLength += 3 * 4; // springRotation
            }
        }

        const data = new ArrayBuffer(dataLength);
        const serializer = new MmdDataSerializer(data);

        serializer.setUint8Array(encoder.encode("BPMX")); // signature
        serializer.setInt8Array([1, 1, 0]); // version

        serializer.setString(pmxObject.header.modelName); // modelName
        serializer.setString(pmxObject.header.englishModelName); // englishModelName
        serializer.setString(pmxObject.header.comment); // comment
        serializer.setString(pmxObject.header.englishComment); // englishComment

        serializer.setUint32(vertices.length); // vertexCount
        serializer.setFloat32Array(positions); // positions
        serializer.setFloat32Array(normals); // normals
        serializer.setFloat32Array(uvs); // uvs
        if (indices instanceof Uint16Array) {
            serializer.setUint8(2); // indicesBytePerElement
            serializer.setUint32(indices.length); // indicesCount
            serializer.setUint16Array(indices); // indices
        } else {
            serializer.setUint8(4); // indicesBytePerElement
            serializer.setUint32(indices.length); // indicesCount
            serializer.setUint32Array(indices); // indices
        }
        serializer.setFloat32Array(boneIndices); // boneIndices
        serializer.setFloat32Array(boneWeights); // boneWeights
        serializer.setUint8(hasSdef ? 1 : 0); // hasSdef
        if (hasSdef) {
            serializer.setFloat32Array(boneSdefC); // sdefC
            serializer.setFloat32Array(boneSdefR0); // sdefR0
            serializer.setFloat32Array(boneSdefR1); // sdefR1
        }

        serializer.setUint32(pmxObject.textures.length); // textureCount
        const pmxObjectTextures = pmxObject.textures;
        for (let i = 0; i < textureLoadResults.length; ++i) {
            const texture = textureLoadResults[i]?._buffer;
            if (!(texture instanceof ArrayBuffer)) {
                throw new Error(`Texture ${pmxObjectTextures[i]} not found`);
                // todo: check this
            }
            if (textureLoadResults[i] !== undefined && texture !== null) {
                serializer.setString(pmxObjectTextures[i]); // textureName
                serializer.setUint32(texture.byteLength); // textureDataLength
                serializer.setUint8Array(new Uint8Array(texture)); // textureData
            } else {
                serializer.setUint32(0); // textureName
                serializer.setUint32(0); // textureDataLength
            }
        }

        serializer.setUint32(pmxObject.materials.length); // materialCount
        const pmxObjectMaterials = pmxObject.materials;
        for (let i = 0; i < pmxObjectMaterials.length; ++i) {
            const materialInfo = pmxObjectMaterials[i];

            serializer.setString(materialInfo.name); // materialName
            serializer.setString(materialInfo.englishName); // englishMaterialName
            serializer.setFloat32Array(materialInfo.diffuse); // diffuse
            serializer.setFloat32Array(materialInfo.specular); // specular
            serializer.setFloat32(materialInfo.shininess); // shininess
            serializer.setFloat32Array(materialInfo.ambient); // ambient
            serializer.setInt8(textureAlphaEvaluateResults[i]); // evauatedTransparency
            serializer.setUint8(materialInfo.flag); // flag
            serializer.setFloat32Array(materialInfo.edgeColor); // edgeColor
            serializer.setFloat32(materialInfo.edgeSize); // edgeSize
            serializer.setInt32(materialInfo.textureIndex); // textureIndex
            serializer.setInt32(materialInfo.sphereTextureIndex); // sphereTextureIndex
            serializer.setUint8(materialInfo.sphereTextureMode); // sphereTextureMode
            serializer.setUint8(materialInfo.isSharedToonTexture ? 1 : 0); // isSharedToontexture
            serializer.setInt32(materialInfo.toonTextureIndex); // toonTextureIndex
            serializer.setString(materialInfo.comment); // comment
            serializer.setUint32(materialInfo.indexCount); // indexCount
        }

        serializer.setUint32(pmxObject.bones.length); // boneCount
        const pmxObjectBones = pmxObject.bones;
        for (let i = 0; i < pmxObjectBones.length; ++i) {
            const boneInfo = pmxObjectBones[i];

            serializer.setString(boneInfo.name); // boneName
            serializer.setString(boneInfo.englishName); // englishBoneName
            serializer.setFloat32Array(boneInfo.position); // position
            serializer.setInt32(boneInfo.parentBoneIndex); // parentBoneIndex
            serializer.setInt32(boneInfo.transformOrder); // transformOrder
            serializer.setUint16(boneInfo.flag); // flag
            if (typeof boneInfo.tailPosition === "number") {
                serializer.setInt32(boneInfo.tailPosition); // tailPosition
            } else {
                serializer.setFloat32Array(boneInfo.tailPosition); // tailPosition
            }
            if (boneInfo.appendTransform !== undefined) {
                serializer.setInt32(boneInfo.appendTransform.parentIndex); // appendTransform.parentIndex
                serializer.setFloat32(boneInfo.appendTransform.ratio); // appendTransform.ratio
            }
            if (boneInfo.axisLimit !== undefined) {
                serializer.setFloat32Array(boneInfo.axisLimit); // axisLimit
            }
            if (boneInfo.localVector !== undefined) {
                serializer.setFloat32Array(boneInfo.localVector.x); // localVectorX
                serializer.setFloat32Array(boneInfo.localVector.z); // localVectorZ
            }
            if (boneInfo.externalParentTransform !== undefined) {
                serializer.setInt32(boneInfo.externalParentTransform); // externalParentTransform
            }
            if (boneInfo.ik !== undefined) {
                const ik = boneInfo.ik;
                serializer.setInt32(ik.target); // ik.target
                serializer.setInt32(ik.iteration); // ik.iteration
                serializer.setFloat32(ik.rotationConstraint); // ik.rotationConstraint
                const links = ik.links;
                serializer.setInt32(links.length); // ik.linkCount
                for (let j = 0; j < links.length; ++j) {
                    const link = links[j];
                    serializer.setInt32(link.target); // ik.links.target
                    serializer.setUint8(link.limitation !== undefined ? 1 : 0); // ik.links.hasLimit
                    if (link.limitation !== undefined) {
                        serializer.setFloat32Array(link.limitation.minimumAngle); // ik.links.minimumAngle
                        serializer.setFloat32Array(link.limitation.maximumAngle); // ik.links.maximumAngle
                    }
                }
            }
        }

        serializer.setUint32(pmxObject.morphs.length); // morphCount
        const pmxObjectMorphs = pmxObject.morphs;
        for (let i = 0; i < pmxObjectMorphs.length; ++i) {
            const morphInfo = pmxObjectMorphs[i];

            serializer.setString(morphInfo.name); // morphName
            serializer.setString(morphInfo.englishName); // englishMorphName
            serializer.setUint8(morphInfo.category); // category
            serializer.setUint8(morphInfo.type); // type
            switch (morphInfo.type) {
            case PmxObject.Morph.Type.GroupMorph:
                {
                    serializer.setUint32(morphInfo.indices.length); // elementCount
                    serializer.setInt32Array(morphInfo.indices); // group.indices
                    serializer.setFloat32Array(morphInfo.ratios); // group.ratios
                }
                break;

            case PmxObject.Morph.Type.VertexMorph:
                {
                    serializer.setUint32(morphInfo.indices.length); // elementCount
                    serializer.setInt32Array(morphInfo.indices); // vertex.indices
                    serializer.setFloat32Array(morphInfo.positions); // vertex.positions
                }
                break;

            case PmxObject.Morph.Type.BoneMorph:
                {
                    serializer.setUint32(morphInfo.indices.length); // elementCount
                    serializer.setInt32Array(morphInfo.indices); // bone.indices
                    serializer.setFloat32Array(morphInfo.positions); // bone.positions
                    serializer.setFloat32Array(morphInfo.rotations); // bone.rotations
                }
                break;

            case PmxObject.Morph.Type.UvMorph:
            case PmxObject.Morph.Type.AdditionalUvMorph1:
            case PmxObject.Morph.Type.AdditionalUvMorph2:
            case PmxObject.Morph.Type.AdditionalUvMorph3:
            case PmxObject.Morph.Type.AdditionalUvMorph4:
                {
                    serializer.setUint32(morphInfo.indices.length); // elementCount
                    serializer.setInt32Array(morphInfo.indices); // uv.indices
                    serializer.setFloat32Array(morphInfo.offsets); // uv.uvs
                }
                break;

            case PmxObject.Morph.Type.MaterialMorph:
                {
                    serializer.setUint32(morphInfo.elements.length); // elementCount
                    const elements = morphInfo.elements;
                    for (let j = 0; j < elements.length; ++j) {
                        const element = elements[j];
                        serializer.setInt32(element.index); // material.index
                        serializer.setUint8(element.type); // material.type
                        serializer.setFloat32Array(element.diffuse); // material.diffuse
                        serializer.setFloat32Array(element.specular); // material.specular
                        serializer.setFloat32(element.shininess); // material.shininess
                        serializer.setFloat32Array(element.ambient); // material.ambient
                        serializer.setFloat32Array(element.edgeColor); // material.edgeColor
                        serializer.setFloat32(element.edgeSize); // material.edgeSize
                        serializer.setFloat32Array(element.textureColor); // material.textureColor
                        serializer.setFloat32Array(element.sphereTextureColor); // material.sphereTextureColor
                        serializer.setFloat32Array(element.toonTextureColor); // material.toonTextureColor
                    }
                }
                break;

            default:
                serializer.setUint32(0); // elementCount
                // ignore unsupported morph type
                break;
            }
        }

        serializer.setUint32(pmxObject.displayFrames.length); // displayFrameCount
        const pmxObjectDisplayFrames = pmxObject.displayFrames;
        for (let i = 0; i < pmxObjectDisplayFrames.length; ++i) {
            const displayFrameInfo = pmxObjectDisplayFrames[i];

            serializer.setString(displayFrameInfo.name); // name
            serializer.setString(displayFrameInfo.englishName); // englishName
            serializer.setUint8(displayFrameInfo.isSpecialFrame ? 1 : 0); // isSpecialFrame
            serializer.setUint32(displayFrameInfo.frames.length); // elementCount
            const frames = displayFrameInfo.frames;
            for (let j = 0; j < frames.length; ++j) {
                const frame = frames[j];
                serializer.setUint8(frame.type); // element.frameType
                serializer.setInt32(frame.index); // element.frameIndex
            }
        }

        serializer.setUint32(pmxObject.rigidBodies.length); // rigidBodyCount
        const pmxObjectRigidBodies = pmxObject.rigidBodies;
        for (let i = 0; i < pmxObjectRigidBodies.length; ++i) {
            const rigidBodyInfo = pmxObjectRigidBodies[i];

            serializer.setString(rigidBodyInfo.name); // name
            serializer.setString(rigidBodyInfo.englishName); // englishName
            serializer.setInt32(rigidBodyInfo.boneIndex); // boneIndex
            serializer.setUint8(rigidBodyInfo.collisionGroup); // collisionGroup
            serializer.setUint16(rigidBodyInfo.collisionMask); // collisionMask
            serializer.setUint8(rigidBodyInfo.shapeType); // shapeType
            serializer.setFloat32Array(rigidBodyInfo.shapeSize); // shapeSize
            serializer.setFloat32Array(rigidBodyInfo.shapePosition); // shapePosition
            serializer.setFloat32Array(rigidBodyInfo.shapeRotation); // shapeRotation
            serializer.setFloat32(rigidBodyInfo.mass); // mass
            serializer.setFloat32(rigidBodyInfo.linearDamping); // linearDamping
            serializer.setFloat32(rigidBodyInfo.angularDamping); // angularDamping
            serializer.setFloat32(rigidBodyInfo.repulsion); // repulsion
            serializer.setFloat32(rigidBodyInfo.friction); // friction
            serializer.setUint8(rigidBodyInfo.physicsMode); // physicsMode
        }

        serializer.setUint32(pmxObject.joints.length); // jointCount
        const pmxObjectJoints = pmxObject.joints;
        for (let i = 0; i < pmxObjectJoints.length; ++i) {
            const jointInfo = pmxObjectJoints[i];

            serializer.setString(jointInfo.name); // name
            serializer.setString(jointInfo.englishName); // englishName
            serializer.setUint8(jointInfo.type); // type
            serializer.setInt32(jointInfo.rigidbodyIndexA); // rigidBodyIndexA
            serializer.setInt32(jointInfo.rigidbodyIndexB); // rigidBodyIndexB
            serializer.setFloat32Array(jointInfo.position); // position
            serializer.setFloat32Array(jointInfo.rotation); // rotation
            serializer.setFloat32Array(jointInfo.positionMin); // positionMin
            serializer.setFloat32Array(jointInfo.positionMax); // positionMax
            serializer.setFloat32Array(jointInfo.rotationMin); // rotationMin
            serializer.setFloat32Array(jointInfo.rotationMax); // rotationMax
            serializer.setFloat32Array(jointInfo.springPosition); // springPosition
            serializer.setFloat32Array(jointInfo.springRotation); // springRotation
        }

        // dispose textures
        for (let i = 0; i < textureLoadResults.length; ++i) {
            textureLoadResults[i]?.dispose();
        }

        return data;
    }

    /**
     * Enable or disable debug logging (default: false)
     */
    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this._logEnabled;
            this.warn = this._warnEnabled;
            this.error = this._errorEnabled;
        } else {
            this.log = this._logDisabled;
            this.warn = this._warnDisabled;
            this.error = this._errorDisabled;
        }
    }

    private _logEnabled(message: string): void {
        Logger.Log(message);
    }

    private _logDisabled(): void {
        // do nothing
    }

    private _warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private _warnDisabled(): void {
        // do nothing
    }

    private _errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private _errorDisabled(): void {
        // do nothing
    }
}
