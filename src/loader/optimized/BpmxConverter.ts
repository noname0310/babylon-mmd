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
 * indices: uint16[vertexCount] or uint32[vertexCount]
 * matricesIndices: uint32[vertexCount * 4]
 * matricesWeights: float32[vertexCount * 4]
 * hasSdef: uint8 - 0 or 1
 * sdefC: float32[vertexCount * 3]
 * sdefR0: float32[vertexCount * 3]
 * sdefR1: float32[vertexCount * 3]
 *
 * textureCount: uint32
 * textureLookupTable: uint32[textureCount] - data offset in the file
 * textures: {
 *  uint32, uint8[] - length, string
 *  uint8[texturesCount] - arraybuffer
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
 *  textureIndex: uint32
 *  sphereTextureIndex: uint32
 *  sphereTextureMode: uint8
 *  isSharedToontexture: uint8
 *  toonTextureIndex: uint8
 *  comment: uint32, uint8[] - length, string
 *  surfaceCount: uint32
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
 *  tailPosition: float32[3]
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
 *    minimumAngle: float32[3]
 *    maximumAngle: float32[3]
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
 *  collisionGroup: uint16
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

import type { Scene } from "@babylonjs/core";
import { Logger } from "@babylonjs/core";

import { MmdAsyncTextureLoader } from "../MmdAsyncTextureLoader";
import type { ILogger } from "../parser/ILogger";
import { PmxObject } from "../parser/PmxObject";
import { PmxReader } from "../parser/PmxReader";
import { ReferenceFileResolver } from "../ReferenceFileResolver";
import { TextureAlphaChecker } from "../TextureAlphaChecker";

export class BpmxConverter implements ILogger {
    public alphaThreshold: number;
    public alphaBlendThreshold: number;
    public useAlphaEvaluation: boolean;
    public alphaEvaluationResolution: number;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

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

    public async convert(
        scene: Scene,
        urlOrFileName: string,
        files?: File[]
    ): Promise<void> {
        const alphaThreshold = this.alphaThreshold;
        const alphaBlendThreshold = this.alphaBlendThreshold;
        const useAlphaEvaluation = this.useAlphaEvaluation;
        const alphaEvaluationResolution = this.alphaEvaluationResolution;

        let pmxObject: PmxObject;
        if (files === undefined) {
            const arrayBuffer = await fetch(urlOrFileName)
                .then((response) => response.arrayBuffer());

            pmxObject = await PmxReader.ParseAsync(arrayBuffer, this);
        } else {
            const pmxFile = files.find((file) => (file as any).webkitRelativePath === urlOrFileName);
            if (pmxFile === undefined) {
                throw new Error(`File ${urlOrFileName} not found`);
            }

            const arrayBuffer = await pmxFile.arrayBuffer();

            pmxObject = await PmxReader.ParseAsync(arrayBuffer, this);
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

                        const centerX = sdefWeights.c[0];
                        const centerY = sdefWeights.c[1];
                        const centerZ = sdefWeights.c[2];

                        // calculate rw0 and rw1
                        let r0X = sdefWeights.r0[0];
                        let r0Y = sdefWeights.r0[1];
                        let r0Z = sdefWeights.r0[2];

                        let r1X = sdefWeights.r1[0];
                        let r1Y = sdefWeights.r1[1];
                        let r1Z = sdefWeights.r1[2];

                        const rwX = r0X * boneWeight0 + r1X * boneWeight1;
                        const rwY = r0Y * boneWeight0 + r1Y * boneWeight1;
                        const rwZ = r0Z * boneWeight0 + r1Z * boneWeight1;

                        r0X = centerX + r0X - rwX;
                        r0Y = centerY + r0Y - rwY;
                        r0Z = centerZ + r0Z - rwZ;

                        r1X = centerX + r1X - rwX;
                        r1Y = centerY + r1Y - rwY;
                        r1Z = centerZ + r1Z - rwZ;

                        const cr0X = (centerX + r0X) * 0.5;
                        const cr0Y = (centerY + r0Y) * 0.5;
                        const cr0Z = (centerZ + r0Z) * 0.5;

                        const cr1X = (centerX + r1X) * 0.5;
                        const cr1Y = (centerY + r1Y) * 0.5;
                        const cr1Z = (centerZ + r1Z) * 0.5;

                        boneSdefC![i * 3 + 0] = centerX;
                        boneSdefC![i * 3 + 1] = centerY;
                        boneSdefC![i * 3 + 2] = centerZ;

                        boneSdefR0![i * 3 + 0] = cr0X;
                        boneSdefR0![i * 3 + 1] = cr0Y;
                        boneSdefR0![i * 3 + 2] = cr0Z;

                        boneSdefR1![i * 3 + 0] = cr1X;
                        boneSdefR1![i * 3 + 1] = cr1Y;
                        boneSdefR1![i * 3 + 2] = cr1Z;

                        hasSdef = true;
                    }
                    break;
                }
            }
        }

        const textures: (ArrayBuffer | null)[] = new Array(pmxObject.textures.length).fill(null);

        // create texture table
        {
            const rootUrl = urlOrFileName.substring(0, urlOrFileName.lastIndexOf("/") + 1);

            const textureLoader = new MmdAsyncTextureLoader();
            const referenceFileResolver = new ReferenceFileResolver(files ?? []);
            const promises: Promise<void>[] = [];

            const materials = pmxObject.materials;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
                if (diffuseTexturePath !== undefined) {
                    const diffuseTextureFullPath = rootUrl + diffuseTexturePath;

                    const file = referenceFileResolver.resolve(diffuseTextureFullPath);
                    if (file !== undefined) {
                        promises.push(textureLoader.loadTextureFromBufferAsync(
                            0,
                            diffuseTextureFullPath,
                            file,
                            scene,
                            null
                        ).then((result) => {
                            result.texture?.dispose();
                            textures[materialInfo.textureIndex] = result.arrayBuffer;
                        }));
                    } else {
                        promises.push(textureLoader.loadTextureAsync(
                            0,
                            rootUrl,
                            diffuseTexturePath,
                            scene,
                            null
                        ).then((result) => {
                            result.texture?.dispose();
                            textures[materialInfo.textureIndex] = result.arrayBuffer;
                        }));
                    }
                }

                const sphereTexturePath = pmxObject.textures[materialInfo.sphereTextureIndex];
                if (sphereTexturePath !== undefined) {
                    const sphereTextureFullPath = rootUrl + sphereTexturePath;

                    const file = referenceFileResolver.resolve(sphereTextureFullPath);
                    if (file !== undefined) {
                        promises.push(textureLoader.loadTextureFromBufferAsync(
                            0,
                            sphereTextureFullPath,
                            file,
                            scene,
                            null
                        ).then((result) => {
                            result.texture?.dispose();
                            textures[materialInfo.sphereTextureIndex] = result.arrayBuffer;
                        }));
                    } else {
                        promises.push(textureLoader.loadTextureAsync(
                            0,
                            rootUrl,
                            sphereTexturePath,
                            scene,
                            null
                        ).then((result) => {
                            result.texture?.dispose();
                            textures[materialInfo.sphereTextureIndex] = result.arrayBuffer;
                        }));
                    }
                }

                const toonTexturePath = pmxObject.textures[materialInfo.toonTextureIndex];
                if (toonTexturePath !== undefined && !materialInfo.isSharedToonTexture) {
                    const toonTextureFullPath = rootUrl + toonTexturePath;

                    const file = referenceFileResolver.resolve(toonTextureFullPath);
                    if (file !== undefined) {
                        promises.push(textureLoader.loadTextureFromBufferAsync(
                            0,
                            toonTextureFullPath,
                            file,
                            scene,
                            null
                        ).then((result) => {
                            result.texture?.dispose();
                            textures[materialInfo.toonTextureIndex] = result.arrayBuffer;
                        }));
                    } else {
                        promises.push(textureLoader.loadTextureAsync(
                            0,
                            rootUrl,
                            toonTexturePath,
                            scene,
                            null
                        ).then((result) => {
                            result.texture?.dispose();
                            textures[materialInfo.toonTextureIndex] = result.arrayBuffer;
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

        const textureAlphaEvaluateResults: number[] = new Array(pmxObject.textures.length).fill(-1);

        // evaluate texture alpha
        if (useAlphaEvaluation) {
            const textureAlphaChecker = new TextureAlphaChecker(uvs, indices, alphaEvaluationResolution);

            const materials = pmxObject.materials;
            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                const diffuseTexturePath = pmxObject.textures[materialInfo.textureIndex];
                if (diffuseTexturePath !== undefined) {
                    const textureIndex = materialInfo.textureIndex;
                    const texture = textures[textureIndex];
                    if (texture !== null) {
                        const textureAlphaEvaluateResult = await textureAlphaChecker.textureHasAlphaOnGeometry(
                            texture,
                            offset,
                            materialInfo.surfaceCount,
                            alphaThreshold,
                            alphaBlendThreshold
                        );
                        textureAlphaEvaluateResults[textureIndex] = textureAlphaEvaluateResult;
                    }
                }

                offset += materialInfo.surfaceCount;
            }

            textureAlphaChecker.dispose();
        }

        console.log(
            positions,
            normals,
            uvs,
            indices,
            boneIndices,
            boneWeights,
            hasSdef,
            boneSdefC,
            boneSdefR0,
            boneSdefR1,
            "textures", textures,
            "textureAlphaEvaluateResults", textureAlphaEvaluateResults
        );
    }

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
