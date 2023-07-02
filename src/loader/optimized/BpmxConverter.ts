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
 * textures: uint8[texturesCount][] - arraybuffers
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

import { Logger } from "@babylonjs/core";

import type { ILogger } from "../parser/ILogger";
import type { PmxObject } from "../parser/PmxObject";
import { PmxReader } from "../parser/PmxReader";

export class BpmxConverter implements ILogger {
    public alphaThreshold: number;
    public alphaBlendThreshold: number;
    public useAlphaEvaluation: boolean;

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

        this._loggingEnabled = true;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    public async convert(
        scene: Screen,
        urlOrFileName: string,
        files?: File[]
    ): Promise<void> {
        const alphaThreshold = this.alphaThreshold;
        const alphaBlendThreshold = this.alphaBlendThreshold;
        const useAlphaEvaluation = this.useAlphaEvaluation;

        let pmxObject: PmxObject;
        if (files === undefined) {
            const arrayBuffer = await fetch(urlOrFileName)
                .then((response) => response.arrayBuffer());

            pmxObject = await PmxReader.ParseAsync(arrayBuffer, this);
        } else {
            const pmxFile = files.find((file) => file.name === urlOrFileName);
            if (pmxFile === undefined) {
                throw new Error(`File ${urlOrFileName} not found`);
            }

            const arrayBuffer = await pmxFile.arrayBuffer();

            pmxObject = await PmxReader.ParseAsync(arrayBuffer, this);
        }

        pmxObject;
        scene;
        alphaThreshold;
        alphaBlendThreshold;
        useAlphaEvaluation;
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
