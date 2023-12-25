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
 * meshFlag: uint8 // 0x01: isSkinnedMesh
 * meshCount: uint32
 * {
 *  meshName: uint32, uint8[] - length, string
 *  vertexCount: uint32
 *  positions: float32[vertexCount * 3]
 *  normals: float32[vertexCount * 3]
 *  uvs: float32[vertexCount * 2]
 *  additionalUvCount: uint8
 *  {
 *   uvs: float32[vertexCount * 4]
 *  }[additionalUvCount]
 *  flag: uint8 // 0x01: hasSdef, 0x02: isIndexedMesh, 0x04: hasEdgeScale
 *  { // if isIndexedMesh
 *   indexElementType: uint8 // 0: int32, 1: uint32, 2: uint16
 *   indicesCount: uint32
 *   indices: uint16[indicesCount] or int32[indicesCount] or uint32[indicesCount]
 *  }
 *  { // if meshType is skinned
 *   matricesIndices: float32[vertexCount * 4]
 *   matricesWeights: float32[vertexCount * 4]
 *   { // if hasSdef
 *    sdefC: float32[vertexCount * 3]
 *    sdefR0: float32[vertexCount * 3]
 *    sdefR1: float32[vertexCount * 3]
 *   }
 *  }
 *  { // if hasEdgeScale
 *   edgeScale: float32[vertexCount]
 *  }
 * }[meshCount]
 *
 * textureCount: uint32
 * textures: {
 *  uint32, uint8[] - length, string
 *  uint32 - byteLength
 *  uint8[texturesCount] - arrayBuffer
 * }[textureCount]
 *
 * {
 *  materialName: uint32, uint8[] - length, string
 *  englishMaterialName: uint32, uint8[] - length, string
 *  diffuse: float32[4];
 *  specular: float32[3]
 *  shininess: float32
 *  ambient: float32[3]
 *  evauatedTransparency: int8 - -1: not evaluated, 0: opaque, 1: alphatest, 2: alphablend, 3: alphatest and blend
 *  flag: uint8 - 0x01: isDoubleSided, 0x10: EnabledToonEdge
 *  edgeColor: float32[4]
 *  edgeSize: float32
 *  textureIndex: int32
 *  sphereTextureIndex: int32
 *  sphereTextureMode: uint8
 *  isSharedToontexture: uint8
 *  toonTextureIndex: int32
 *  comment: uint32, uint8[] - length, string
 * }[meshCount]
 *
 * { // if hasBone
 *  boneCount: uint32
 *  {
 *   boneName: uint32, uint8[] - length, string
 *   englishBoneName: uint32, uint8[] - length, string
 *   position: float32[3]
 *   parentBoneIndex: int32
 *   transformOrder: int32
 *   flag: uint16
 *   tailPosition: float32[3] | int32
 *   appendTransform: { // if has appendTransform
 *     parentIndex: int32
 *     ratio: float32
 *   }
 *   axisLimit: float32[3] // if has axisLimit
 *   localVectorX: float32[3] // if has localVector
 *   localVectorZ: float32[3] // if has localVector
 *   externalParentTransform: int32 // if has externalParentBoneIndex
 *   ikInfo: { // if has ikInfo
 *    target: int32
 *    iteration: int32
 *    rotationConstraint: float32
 *    linkCount: int32
 *    links: {
 *     target: int32
 *     hasLimit: uint8
 *     minimumAngle: float32[3] // if hasLimit
 *     maximumAngle: float32[3] // if hasLimit
 *    }[linkCount]
 *   }
 *  }[boneCount]
 * }
 *
 * morphCount: uint32
 * {
 *  morphName: uint32, uint8[] - length, string
 *  englishMorphName: uint32, uint8[] - length, string
 *  category: uint8
 *  type: uint8
 *
 *  { // if type is material
 *   elementCount: uint32
 *   {
 *    materialIndex: int32
 *    type: uint8
 *    diffuse: float32[4]
 *    specular: float32[3]
 *    shininess: float32
 *    ambient: float32[3]
 *    edgeColor: float32[4]
 *    edgeSize: float32
 *    textureColor: float32[4]
 *    sphereTextureColor: float32[4]
 *    toonTextureColor: float32[4]
 *   }[elementCount]
 *  }
 *
 *  { // if type is group
 *   elementCount: uint32
 *   indices: int32[elementCount]
 *   ratios: float32[elementCount]
 *  }
 *
 *  { // if type is bone
 *   elementCount: uint32
 *   indices: int32[elementCount]
 *   positions: float32[elementCount * 3]
 *   rotations: float32[elementCount * 4]
 *  }
 *
 *  { // if type is uv
 *   meshCount: uint32
 *   {
 *    meshIndex: uint32
 *    elementCount: uint32
 *    indices: int32[elementCount]
 *    uvs: float32[elementCount * 4]
 *   }[meshCount]
 *  }
 *
 *  { // if type is vertex
 *   meshCount: uint32
 *   {
 *    meshIndex: uint32
 *    elementCount: uint32
 *    indices: int32[elementCount]
 *    positions: float32[elementCount * 3]
 *   }[meshCount]
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
import type { Bone } from "@babylonjs/core/Bones/bone";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { Material } from "@babylonjs/core/Materials/material";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { DeepImmutable, FloatArray, Nullable } from "@babylonjs/core/types";

import { MmdMesh } from "@/Runtime/mmdMesh";

import { MmdBufferKind } from "../mmdBufferKind";
import { MmdModelMetadata } from "../mmdModelMetadata";
import type{ MmdStandardMaterial } from "../mmdStandardMaterial";
import type { ILogger } from "../Parser/ILogger";
import type { Vec3 } from "../Parser/mmdTypes";
import { PmxObject } from "../Parser/pmxObject";
import { MmdDataSerializer } from "./mmdDataSerializer";
import { BpmxObject } from "./Parser/bpmxObject";

/**
 * BPMX convert options
 */
export interface BpmxConvertOptions {
    /**
     * Include skinning data into BPMX data (default: true)
     */
    includeSkinningData?: boolean;

    /**
     * Include morph data into BPMX data (default: true)
     */
    includeMorphData?: boolean;
}

type RemoveReadonly<T> = {
    -readonly [P in keyof T]: T[P];
};

/**
 * BPMX converter
 */
export class BpmxConverter implements ILogger {
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
        this._loggingEnabled = true;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    /**
     * Convert MmdMesh into BPMX data
     *
     * For convert MmdMesh into BPMX data, you must load MmdMesh with preserveSerilizationData option
     * @param mmdMesh Serializeable MmdMesh
     * @param options Convert options
     * @returns BPMX data as ArrayBuffer
     * @throws {Error} Failed to convert BPMX
     */
    public convert(mmdMesh: Mesh, options: BpmxConvertOptions = {}): ArrayBuffer {
        if (!MmdMesh.isMmdMesh(mmdMesh)) {
            throw new Error(`${mmdMesh.name} is not MmdMesh`);
        }

        const {
            includeSkinningData = true,
            includeMorphData = true
        } = options;

        const mmdModelMetadata = mmdMesh.metadata;
        const containsSerializationData = MmdModelMetadata.isSerializationMetadata(mmdModelMetadata);

        if (includeSkinningData && mmdModelMetadata.skeleton === null) {
            this.log("MmdMesh has no skeleton. Skinning data will not be included");
        }

        // build bone metadata
        const bonesMetadataToSerialize: RemoveReadonly<PmxObject.Bone>[] = [];
        const boneMetadataIndexRemapper: Int32Array = new Int32Array(mmdModelMetadata.bones.length).fill(-1);

        let maxBoneIndex = -1;
        const skeletonBones = mmdModelMetadata.skeleton?.bones ?? [];
        for (let i = 0; i < skeletonBones.length; ++i) maxBoneIndex = Math.max(maxBoneIndex, skeletonBones[i].getIndex());
        const boneIndexRemapper: Int32Array = new Int32Array(maxBoneIndex + 1).fill(-1);

        if (includeSkinningData && mmdModelMetadata.skeleton !== null) {
            const bonesMetadata = mmdModelMetadata.bones;

            const metadataToBoneMap = new Map<MmdModelMetadata.Bone, Bone>();
            {
                const boneNameMap = new Map<string, Bone>();
                for (let i = 0; i < skeletonBones.length; ++i) {
                    const bone = skeletonBones[i];
                    if (boneNameMap.has(bone.name)) continue;
                    boneNameMap.set(bone.name, bone);
                }

                for (let i = 0; i < bonesMetadata.length; ++i) {
                    const boneMetadata = bonesMetadata[i];
                    const bone = boneNameMap.get(boneMetadata.name);
                    if (bone === undefined) continue;
                    metadataToBoneMap.set(boneMetadata, bone);
                }
            }

            const boneToMetadataMap = new Map<Bone, MmdModelMetadata.Bone>();
            {
                const metadataNameMap = new Map<string, MmdModelMetadata.Bone>();
                for (let i = 0; i < bonesMetadata.length; ++i) {
                    const boneMetadata = bonesMetadata[i];
                    if (metadataNameMap.has(boneMetadata.name)) continue;
                    metadataNameMap.set(boneMetadata.name, boneMetadata);
                }

                for (let i = 0; i < skeletonBones.length; ++i) {
                    const bone = skeletonBones[i];
                    const boneMetadata = metadataNameMap.get(bone.name);
                    if (boneMetadata === undefined) continue;
                    boneToMetadataMap.set(bone, boneMetadata);
                }
            }

            const boneMetadataChildrenMap = new Map<MmdModelMetadata.Bone, MmdModelMetadata.Bone[]>();
            for (let i = 0; i < bonesMetadata.length; ++i) {
                const boneMetadata = bonesMetadata[i];
                let chindren = boneMetadataChildrenMap.get(bonesMetadata[boneMetadata.parentBoneIndex]);
                if (chindren === undefined && 0 <= boneMetadata.parentBoneIndex && boneMetadata.parentBoneIndex < bonesMetadata.length) {
                    chindren = [];
                    boneMetadataChildrenMap.set(bonesMetadata[boneMetadata.parentBoneIndex], chindren);
                }
                chindren?.push(boneMetadata);
            }

            const boneWorldRestMatrices = new Map<Bone, DeepImmutable<Matrix>>();
            for (let i = 0; i < skeletonBones.length; ++i) {
                if (skeletonBones[i].getParent() !== null) continue;

                const stack = [skeletonBones[i]];
                boneWorldRestMatrices.set(skeletonBones[i], skeletonBones[i].getRestMatrix());

                while (stack.length > 0) {
                    const bone = stack.pop()!;
                    const boneWorldRestMatrix = boneWorldRestMatrices.get(bone)!;

                    const children = bone.children;
                    for (let i = 0; i < children.length; ++i) {
                        const child = children[i];
                        boneWorldRestMatrices.set(child, child.getRestMatrix().multiply(boneWorldRestMatrix));
                        stack.push(child);
                    }
                }
            }

            const metadataFinalParents = new Map<MmdModelMetadata.Bone, number>();
            for (let i = 0; i < bonesMetadata.length; ++i) {
                const boneMetadata = bonesMetadata[i] as MmdModelMetadata.Bone & Partial<Omit<MmdModelMetadata.SerializationBone, keyof MmdModelMetadata.Bone>>;

                // find best match correspond bone
                let correspondBone = metadataToBoneMap.get(boneMetadata); // 1. try to find exact match

                // collect bones between bone which has correspond bone.
                // set final parent bone index
                const collectedBones: Bone[] = [];
                const dfsCollectBones = (bone: Bone): void => {
                    const children = bone.children;
                    for (let i = 0; i < children.length; ++i) {
                        const child = children[i];
                        const childMetadata = boneToMetadataMap.get(child);
                        if (childMetadata !== undefined) {
                            if (!metadataFinalParents.has(childMetadata)) {
                                metadataFinalParents.set(childMetadata, bonesMetadataToSerialize.length + collectedBones.length);
                            }
                            continue;
                        }
                        collectedBones.push(bone);
                        dfsCollectBones(child);
                    }
                };
                if (correspondBone !== undefined) dfsCollectBones(correspondBone);
                else {
                    const boneMetadataChildren = boneMetadataChildrenMap.get(boneMetadata);
                    if (boneMetadataChildren !== undefined) {
                        for (let i = 0; i < boneMetadataChildren.length; ++i) {
                            const child = boneMetadataChildren[i];
                            metadataFinalParents.set(child, bonesMetadataToSerialize.length + collectedBones.length); // is closest link obiviously. so we need overwrite here
                        }
                    }
                }

                const isFallbackBone = correspondBone === undefined;
                const dfsFindChildBone = (boneMetadata: MmdModelMetadata.Bone): Bone | undefined => {
                    const children = boneMetadataChildrenMap.get(boneMetadata);
                    if (children === undefined) return undefined;
                    for (let i = 0; i < children.length; ++i) {
                        const child = children[i];

                        let fallbackBone = metadataToBoneMap.get(child);
                        if (fallbackBone !== undefined) return fallbackBone;

                        fallbackBone = dfsFindChildBone(child);
                        if (fallbackBone !== undefined) return fallbackBone;
                    }
                    return undefined;
                };
                if (isFallbackBone) correspondBone = dfsFindChildBone(boneMetadata); // 2. find closest child bone
                if (correspondBone === undefined) { // 3. find closest parent bone
                    let parentMetadata = bonesMetadata[boneMetadata.parentBoneIndex];
                    while (parentMetadata !== undefined) {
                        correspondBone = metadataToBoneMap.get(parentMetadata);
                        if (correspondBone !== undefined) break;
                        parentMetadata = bonesMetadata[parentMetadata.parentBoneIndex];
                    }
                }
                // 4. it's special case. use default value to fill bone data

                const name = boneMetadata.name;
                const englishName = boneMetadata.englishName;

                const position = (correspondBone !== undefined ? boneWorldRestMatrices.get(correspondBone)!.getTranslation().asArray() : [0, 0, 0]) as Vec3;
                const parentBoneIndex = -1; // resolved later

                const transformOrder = boneMetadata.transformOrder;

                const tailPosition = boneMetadata.tailPosition ?? -2; // resolved later
                const appendTransform = boneMetadata.appendTransform; // remapped later
                const axisLimit = boneMetadata.axisLimit;
                const localVector = boneMetadata.localVector;
                const externalParentTransform = boneMetadata.externalParentTransform;
                const ik = boneMetadata.ik; // remapped later

                let flag = (boneMetadata.flag ?? 0) &
                    (!Array.isArray(tailPosition) ? 0 : ~PmxObject.Bone.Flag.UseBoneIndexAsTailPosition) &
                    (appendTransform ? 0 : (~PmxObject.Bone.Flag.HasAppendRotate | ~PmxObject.Bone.Flag.HasAppendMove)) &
                    (axisLimit ? 0 : ~PmxObject.Bone.Flag.HasAxisLimit) &
                    (localVector ? 0 : ~PmxObject.Bone.Flag.HasLocalVector) &
                    (externalParentTransform ? 0 : ~PmxObject.Bone.Flag.IsExternalParentTransformed) &
                    (ik ? 0 : ~PmxObject.Bone.Flag.IsIkEnabled);
                flag |=
                    (!Array.isArray(tailPosition) ? PmxObject.Bone.Flag.UseBoneIndexAsTailPosition : 0) |
                    (appendTransform ? PmxObject.Bone.Flag.HasAppendRotate | PmxObject.Bone.Flag.HasAppendMove : 0) |
                    (axisLimit ? PmxObject.Bone.Flag.HasAxisLimit : 0) |
                    (localVector ? PmxObject.Bone.Flag.HasLocalVector : 0) |
                    (externalParentTransform ? PmxObject.Bone.Flag.IsExternalParentTransformed : 0) |
                    (ik ? PmxObject.Bone.Flag.IsIkEnabled : 0);

                const boneMetadataToSerialize: RemoveReadonly<PmxObject.Bone> = {
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
                const rootBoneIndex = boneMetadataIndexRemapper[i] = bonesMetadataToSerialize.length;
                if (correspondBone !== undefined) boneIndexRemapper[correspondBone.getIndex()] = rootBoneIndex;
                bonesMetadataToSerialize.push(boneMetadataToSerialize);

                const collectedBoneFlag = PmxObject.Bone.Flag.UseBoneIndexAsTailPosition |
                    PmxObject.Bone.Flag.IsRotatable |
                    PmxObject.Bone.Flag.IsVisible |
                    PmxObject.Bone.Flag.IsControllable;

                for (let i = 0; i < collectedBones.length; ++i) {
                    const collectedBone = collectedBones[i];

                    boneIndexRemapper[collectedBone.getIndex()] = bonesMetadataToSerialize.length;

                    let collectedBoneParentIndex = -1;
                    const collectedBoneParent = collectedBone.getParent();
                    if (collectedBoneParent !== null) {
                        const collectedBoneParentMetadata = boneToMetadataMap.get(collectedBoneParent);
                        if (collectedBoneParentMetadata === boneMetadata) {
                            collectedBoneParentIndex = rootBoneIndex;
                        } else {
                            collectedBoneParentIndex = boneIndexRemapper[collectedBoneParent.getIndex()]; // because parent bone is already remapped. value is valid
                        }
                    }

                    bonesMetadataToSerialize.push({
                        name: collectedBone.name,
                        englishName: "",
                        position: boneWorldRestMatrices.get(collectedBone)!.getTranslation().asArray() as Vec3,
                        parentBoneIndex: collectedBoneParentIndex,
                        transformOrder: 0,
                        flag: collectedBoneFlag,
                        tailPosition: collectedBoneParentIndex,
                        appendTransform: undefined,
                        axisLimit: undefined,
                        localVector: undefined,
                        externalParentTransform: undefined,
                        ik: undefined
                    });
                }
            }

            // resolve parentBoneIndex, tailPosition, appendTransform, ik
            for (let i = 0; i < bonesMetadata.length; ++i) {
                const boneMetadata = bonesMetadata[i];
                const boneFinalMetadata = bonesMetadataToSerialize[boneMetadataIndexRemapper[i]];

                const parentBoneIndex = boneFinalMetadata.parentBoneIndex = metadataFinalParents.get(boneMetadata) ?? -1;
                if (boneFinalMetadata.tailPosition === -2) boneFinalMetadata.tailPosition = parentBoneIndex;
                else if (typeof boneFinalMetadata.tailPosition === "number" && 0 <= boneFinalMetadata.tailPosition && boneFinalMetadata.tailPosition < bonesMetadata.length) {
                    boneFinalMetadata.tailPosition = boneMetadataIndexRemapper[boneFinalMetadata.tailPosition];
                }

                const appendTransform = boneFinalMetadata.appendTransform;
                if (appendTransform !== undefined) {
                    boneFinalMetadata.appendTransform = {
                        parentIndex: boneMetadataIndexRemapper[appendTransform.parentIndex] ?? appendTransform.parentIndex,
                        ratio: appendTransform.ratio
                    };
                }

                const ik = boneFinalMetadata.ik;
                if (ik !== undefined) {
                    const newIkLinks: PmxObject.Bone.IKLink[] = [];
                    boneFinalMetadata.ik = {
                        target: boneMetadataIndexRemapper[ik.target] ?? ik.target,
                        iteration: ik.iteration,
                        rotationConstraint: ik.rotationConstraint,
                        links: newIkLinks
                    };

                    const links = ik.links;
                    for (let i = 0; i < links.length; ++i) {
                        const link = links[i];
                        newIkLinks.push({
                            target: boneMetadataIndexRemapper[link.target] ?? link.target,
                            limitation: link.limitation
                        });
                    }
                }
            }
        }

        const meshesToSerialize: Mesh[] = [];
        const meshIndexRemapper = new Map<number, number>();

        const materialsToSerialize: (Material | undefined)[] = [];
        const materialsMetadataToSerialize: (MmdModelMetadata.MaterialMetadata | undefined)[] = [];
        // validate mesh
        {
            const meshes = mmdModelMetadata.meshes;
            const materials = mmdModelMetadata.materials;
            const materialsMetadata = containsSerializationData ? mmdModelMetadata.materialsMetadata : null;
            for (let i = 0; i < meshes.length; ++i) {
                const mesh = meshes[i];

                if (mesh.geometry === null) {
                    this.warn(`mesh ${mesh.name} has no geometry. skippping`);
                    continue;
                }
                const geometry = mesh.geometry!;
                if (geometry.getVerticesData(VertexBuffer.PositionKind) === null) {
                    this.warn(`mesh ${mesh.name} has no position data. skippping`);
                    continue;
                }
                if (geometry.getVerticesData(VertexBuffer.NormalKind) === null) {
                    this.warn(`mesh ${mesh.name} has no normal data. skippping`);
                    continue;
                }
                if (geometry.getVerticesData(VertexBuffer.UVKind) === null) {
                    this.warn(`mesh ${mesh.name} has no uv data. skippping`);
                    continue;
                }
                if (!mesh.isUnIndexed && geometry.getIndices() === null) {
                    this.warn(`mesh ${mesh.name} has no indices data. skippping`);
                    continue;
                }
                if (mmdModelMetadata.skeleton !== null && mmdModelMetadata.skeleton !== mesh.skeleton) {
                    this.warn(`mesh ${mesh.name} has different skeleton. skippping`);
                    continue;
                }

                meshIndexRemapper.set(i, meshesToSerialize.length);
                meshesToSerialize.push(mesh);

                let material = materials[i] as Material | undefined;
                if (material === undefined) {
                    if (mesh.material === null) {
                        this.warn(`mesh ${mesh.name} has no material.`);
                    } else {
                        this.log(`mesh ${mesh.name} has no material metadata. use material from mesh`);
                        material = mesh.material;
                    }
                }
                materialsToSerialize.push(material);

                const materialMetadata = materialsMetadata?.[i];
                if (materialMetadata === undefined) {
                    this.log(`mesh ${mesh.name} has no additional material metadata`);
                }
                materialsMetadataToSerialize.push(materialMetadata);
            }
        }

        const texturesToSerialize: Texture[] = [];
        const textureNameMap = containsSerializationData
            ? mmdModelMetadata.textureNameMap
            : null;
        if (textureNameMap === null) {
            this.warn("metadata.textureNameMap is not defined. texture names will be fallback to converted string by loader");
        }

        // geather textures
        {
            const textureSet = new Set<BaseTexture>();
            for (let i = 0; i < materialsToSerialize.length; ++i) {
                const material = materialsToSerialize[i];

                if ((material as MmdStandardMaterial).diffuseTexture) {
                    textureSet.add((material as MmdStandardMaterial).diffuseTexture!);
                } else if ((material as PBRMaterial).albedoTexture) {
                    textureSet.add((material as PBRMaterial).albedoTexture!);
                }

                if ((material as MmdStandardMaterial).sphereTexture) {
                    textureSet.add((material as MmdStandardMaterial).sphereTexture!);
                }
                if ((material as MmdStandardMaterial).toonTexture) {
                    const toonTextureName = (material as MmdStandardMaterial).toonTexture!.name;
                    if (!(toonTextureName.startsWith("file:shared_toon_texture_") &&
                        toonTextureName.length <= 27 && // format: file:shared_toon_texture_0 or file:shared_toon_texture_00
                        !isNaN(Number(toonTextureName.substring(25)))
                    )) {
                        textureSet.add((material as MmdStandardMaterial).toonTexture!);
                    }
                }
            }
            for (const texture of textureSet) {
                const textureBuffer = (texture as Texture)._buffer as typeof Texture.prototype._buffer | undefined;
                if (textureBuffer instanceof ArrayBuffer) {
                    texturesToSerialize.push(texture as Texture);
                } else if (textureBuffer === undefined || textureBuffer === null) {
                    this.warn(`texture ${texture.name} has no texture buffer. make sure load model with materialBuilder.deleteTextureBufferAfterLoad = false`);
                } else {
                    this.warn(`texture ${texture.name} has unsupported type of texture buffer. only ArrayBuffer is supported`);
                }
            }
        }

        // create morph data
        const vertexUvMorphs: Nullable<{
            meshIndex: number;
            indices: Int32Array;
            offsets: Float32Array;
        }[]>[] = new Array(mmdModelMetadata.morphs.length).fill(null); // vertexUvMorphs[morphIndex][meshIndex]
        for (let i = 0; i < vertexUvMorphs.length; ++i) vertexUvMorphs[i] = [];
        if (includeMorphData) {
            if (containsSerializationData) {
                const morphs = mmdModelMetadata.morphs;
                for (let morphIndex = 0; morphIndex < morphs.length; ++morphIndex) {
                    const morph = morphs[morphIndex];
                    switch (morph.type) {
                    case PmxObject.Morph.Type.VertexMorph:
                    case PmxObject.Morph.Type.UvMorph:
                    case PmxObject.Morph.Type.AdditionalUvMorph1:
                    case PmxObject.Morph.Type.AdditionalUvMorph2:
                    case PmxObject.Morph.Type.AdditionalUvMorph3:
                    case PmxObject.Morph.Type.AdditionalUvMorph4:
                        {
                            const elements: MmdModelMetadata.SerializationVertexMorphElement[] | MmdModelMetadata.SerializationUvMorphElement[] = [];
                            const morphElements = morph.elements;
                            for (let i = 0; i < morphElements.length; ++i) {
                                const element = morphElements[i];
                                const meshIndex = meshIndexRemapper.get(element.meshIndex);
                                if (meshIndex === undefined) {
                                    this.warn(`morph ${morph.name} has invalid mesh. skipping`);
                                    continue;
                                }
                                elements.push({
                                    meshIndex,
                                    indices: element.indices,
                                    offsets: element.offsets
                                });
                            }
                            vertexUvMorphs[morphIndex] = elements;
                        }
                        break;
                    }
                }
            } else {
                this.warn("metadata.morphsMetadata is not defined. UV morphs will be lossy converted");

                const morphs = mmdModelMetadata.morphs;
                for (let morphIndex = 0; morphIndex < morphs.length; ++morphIndex) {
                    const morph = morphs[morphIndex];
                    let isVertexUvMorph = false;
                    switch (morph.type) {
                    case PmxObject.Morph.Type.VertexMorph:
                    case PmxObject.Morph.Type.UvMorph:
                    case PmxObject.Morph.Type.AdditionalUvMorph1:
                    case PmxObject.Morph.Type.AdditionalUvMorph2:
                    case PmxObject.Morph.Type.AdditionalUvMorph3:
                    case PmxObject.Morph.Type.AdditionalUvMorph4:
                        isVertexUvMorph = true;
                        break;
                    }
                    if (!isVertexUvMorph) continue;

                    const morphsForMesh = (vertexUvMorphs[morphIndex] = [] as typeof vertexUvMorphs[number])!;

                    const morphTargets = (morph as MmdModelMetadata.VertexMorph | MmdModelMetadata.UvMorph).morphTargets;
                    for (let i = 0; i < morphTargets.length; ++i) {
                        let morphMeshIndex = -1;
                        const morphTarget = morphTargets[i];

                        findMorphTargets: for (let meshIndex = 0; meshIndex < meshesToSerialize.length; ++meshIndex) {
                            const morphTargetManager = meshesToSerialize[meshIndex].morphTargetManager;
                            if (morphTargetManager === null) continue;
                            const numTargets = morphTargetManager.numTargets;
                            for (let j = 0; j < numTargets; ++j) {
                                if (morphTargetManager.getTarget(j) === morphTarget) {
                                    morphMeshIndex = meshIndex;
                                    break findMorphTargets;
                                }
                            }
                        }
                        if (morphMeshIndex === -1) {
                            this.warn(`morph ${morph.name} has no target mesh. skipping`);
                            continue;
                        }

                        let elementCount = 0;
                        let indices: Int32Array;
                        let elements: Float32Array;

                        if (morph.type === PmxObject.Morph.Type.VertexMorph) {
                            const positions = meshesToSerialize[morphMeshIndex].geometry!.getVerticesData(VertexBuffer.PositionKind)!;
                            const morpedPositions = morphTarget.getPositions();

                            if (morpedPositions === null) {
                                this.warn(`morph ${morph.name} has no positions data. skipping`);
                                continue;
                            }

                            if (positions.length !== morpedPositions.length) {
                                this.warn(`morph ${morph.name} has different number of positions. skipping`);
                                continue;
                            }

                            for (let j = 0; j < positions.length; j += 3) {
                                if (positions[j + 0] !== morpedPositions[j + 0] ||
                                    positions[j + 1] !== morpedPositions[j + 1] ||
                                    positions[j + 2] !== morpedPositions[j + 2]
                                ) {
                                    elementCount += 1;
                                }
                            }

                            indices = new Int32Array(elementCount);
                            elements = new Float32Array(elementCount * 3);
                            const positionCount = positions.length / 3;
                            for (let j = 0, k = 0; j < positionCount; ++j) {
                                if (
                                    positions[j * 3 + 0] !== morpedPositions[j * 3 + 0] ||
                                    positions[j * 3 + 1] !== morpedPositions[j * 3 + 1] ||
                                    positions[j * 3 + 2] !== morpedPositions[j * 3 + 2]
                                ) {
                                    indices[k] = j;
                                    elements[k * 3 + 0] = morpedPositions[j * 3 + 0] - positions[j * 3 + 0];
                                    elements[k * 3 + 1] = morpedPositions[j * 3 + 1] - positions[j * 3 + 1];
                                    elements[k * 3 + 2] = morpedPositions[j * 3 + 2] - positions[j * 3 + 2];
                                    k += 1;
                                }
                            }
                        } else {
                            const uvs = meshesToSerialize[morphMeshIndex].geometry!.getVerticesData(VertexBuffer.UVKind)!;
                            const morpedUvs = morphTarget.getUVs();

                            if (morpedUvs === null) {
                                this.warn(`morph ${morph.name} has no uvs data. skipping`);
                                continue;
                            }

                            if (uvs.length !== morpedUvs.length) {
                                this.warn(`morph ${morph.name} has different number of uvs. skipping`);
                                continue;
                            }

                            for (let j = 0; j < uvs.length; j += 2) {
                                if (uvs[j + 0] !== morpedUvs[j + 0] ||
                                    uvs[j + 1] !== morpedUvs[j + 1]
                                ) {
                                    elementCount += 1;
                                }
                            }

                            indices = new Int32Array(elementCount);
                            elements = new Float32Array(elementCount * 4);
                            const uvCount = uvs.length / 2;
                            for (let j = 0, k = 0; j < uvCount; ++j) {
                                if (
                                    uvs[j * 2 + 0] !== morpedUvs[j * 2 + 0] ||
                                    uvs[j * 2 + 1] !== morpedUvs[j * 2 + 1]
                                ) {
                                    indices[k] = j;
                                    elements[k * 4 + 0] = morpedUvs[j * 2 + 0] - uvs[j * 2 + 0];
                                    elements[k * 4 + 1] = morpedUvs[j * 2 + 1] - uvs[j * 2 + 1];
                                    k += 1;
                                }
                            }
                        }

                        morphsForMesh.push({
                            meshIndex: morphMeshIndex,
                            indices,
                            offsets: elements
                        });
                    }
                }
            }
        }

        const encoder = new TextEncoder();

        let dataLength =
            4 + // signature
            3; // version

        { // compute dataLength
            const header = mmdModelMetadata.header;
            dataLength += 4 + encoder.encode(header.modelName).length; // modelName
            dataLength += 4 + encoder.encode(header.englishModelName).length; // englishModelName
            dataLength += 4 + encoder.encode(header.comment).length; // comment
            dataLength += 4 + encoder.encode(header.englishComment).length; // englishComment

            dataLength += 1; // meshFlag
            dataLength += 4; // meshCount
            for (let i = 0; i < meshesToSerialize.length; ++i) {
                const mesh = meshesToSerialize[i];
                const geometry = mesh.geometry!;

                dataLength += 4 + encoder.encode(mesh.name).length; // meshName
                dataLength += 4; // vertexCount

                const positions = geometry.getVerticesData(VertexBuffer.PositionKind)!;
                dataLength += positions.length * 4; // positions

                const vertexCount = positions.length / 3;
                dataLength += vertexCount * 3 * 4; // normals
                dataLength += vertexCount * 2 * 4; // uvs

                dataLength += 1; // additionalUvCount
                if (geometry.getVerticesData(MmdBufferKind.AdditionalUV1Kind) !== null) dataLength += vertexCount * 4 * 4; // additionalUv1
                if (geometry.getVerticesData(MmdBufferKind.AdditionalUV2Kind) !== null) dataLength += vertexCount * 4 * 4; // additionalUv2
                if (geometry.getVerticesData(MmdBufferKind.AdditionalUV3Kind) !== null) dataLength += vertexCount * 4 * 4; // additionalUv3
                if (geometry.getVerticesData(MmdBufferKind.AdditionalUV4Kind) !== null) dataLength += vertexCount * 4 * 4; // additionalUv4

                dataLength += 1; // flag

                if (!mesh.isUnIndexed) {
                    dataLength += 1; // indexElementType
                    dataLength += 4; // indicesCount

                    const indices = geometry.getIndices()!;
                    dataLength += Array.isArray(indices)
                        ? indices.length * 4
                        : indices.byteLength; // indices
                }

                if (bonesMetadataToSerialize.length !== 0) {
                    if (geometry.getVerticesData(VertexBuffer.MatricesIndicesKind) === null) {
                        this.warn(`mesh ${mesh.name} has no matricesIndices data. falling back to zero matricesIndices`);
                    }
                    dataLength += vertexCount * 4 * 4; // boneIndices
                    if (geometry.getVerticesData(VertexBuffer.MatricesWeightsKind) === null) {
                        this.warn(`mesh ${mesh.name} has no matricesWeights data. falling back to zero matricesWeights`);
                    }
                    dataLength += vertexCount * 4 * 4; // boneWeights
                }

                const sdefC = geometry.getVerticesData(MmdBufferKind.MatricesSdefCKind);
                const sdefR0 = geometry.getVerticesData(MmdBufferKind.MatricesSdefR0Kind);
                const sdefR1 = geometry.getVerticesData(MmdBufferKind.MatricesSdefR1Kind);
                if (sdefC !== null && sdefR0 !== null && sdefR1 !== null) {
                    dataLength += vertexCount * 3 * 4; // sdefC
                    dataLength += vertexCount * 3 * 4; // sdefR0
                    dataLength += vertexCount * 3 * 4; // sdefR1
                } else if ((sdefC === null || sdefR0 === null || sdefR1 === null) && (sdefC !== null || sdefR0 !== null || sdefR1 !== null)) {
                    this.warn(`mesh ${mesh.name} has incomplete sdef data. sdefC, sdefR0, sdefR1 must be all defined or all undefined. falling back to linear blend skinning`);
                }

                // edgeScale will be implemented in the future
                const edgeScale = geometry.getVerticesData(MmdBufferKind.EdgeScaleKind);
                if (edgeScale !== null) {
                    dataLength += vertexCount * 4; // edgeScale
                }
            }

            dataLength += 4; // textureCount
            for (let i = 0; i < texturesToSerialize.length; ++i) {
                const texture = texturesToSerialize[i] as Texture;
                const textureBuffer = texture._buffer as ArrayBuffer;
                let textureName = textureNameMap !== null
                    ? textureNameMap.get(texturesToSerialize[i])
                    : texturesToSerialize[i].name;
                if (textureName === undefined) {
                    this.warn(`texture ${texture.name} has no name in textureNameMap. falling back to converted string by loader`);
                    textureName = texturesToSerialize[i].name;
                }
                dataLength += 4 + encoder.encode(textureName).length; // textureName
                dataLength += 4; // textureByteLength
                dataLength += textureBuffer.byteLength; // textureData
            }

            for (let i = 0; i < meshesToSerialize.length; ++i) { // material count must be equal to mesh count
                const materialInfo = materialsToSerialize[i];
                const materialMetadata = materialsMetadataToSerialize[i];

                dataLength += 4 + (materialInfo !== undefined ? encoder.encode(materialInfo.name).length : 0); // materialName
                dataLength += 4 + (materialMetadata !== undefined ? encoder.encode(materialMetadata.englishName).length : 0); // englishMaterialName
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
                dataLength += 4 + (materialMetadata !== undefined ? encoder.encode(materialMetadata.comment).length : 0); // comment
            }

            if (bonesMetadataToSerialize.length !== 0) {
                dataLength += 4; // boneCount
                if (!containsSerializationData) {
                    this.warn("metadata.bones has following missing properties: tailPosition, axisLimit, localVector, externalParentTransform. lossy conversion will be applied");
                }
                for (let i = 0; i < bonesMetadataToSerialize.length; ++i) {
                    const bone = bonesMetadataToSerialize[i];

                    dataLength += 4 + encoder.encode(bone.name).length; // boneName
                    dataLength += 4 + encoder.encode(bone.englishName).length; // englishBoneName
                    dataLength += 3 * 4; // position
                    dataLength += 4; // parentBoneIndex
                    dataLength += 4; // transformOrder
                    dataLength += 2; // flag
                    if (containsSerializationData) {
                        if (typeof bone.tailPosition === "number") {
                            dataLength += 4; // tailPosition
                        } else {
                            dataLength += 3 * 4; // tailPosition
                        }
                    } else {
                        dataLength += 4; // tailPosition
                    }
                    if (bone.appendTransform !== undefined) {
                        dataLength += 4; // appendTransform.parentIndex
                        dataLength += 4; // appendTransform.ratio
                    }
                    if (bone.axisLimit !== undefined) {
                        dataLength += 3 * 4; // axisLimit
                    }
                    if (bone.localVector !== undefined) {
                        dataLength += 3 * 4; // localVectorX
                        dataLength += 3 * 4; // localVectorZ
                    }
                    if (bone.externalParentTransform !== undefined) {
                        dataLength += 4; // externalParentTransform
                    }
                    if (bone.ik !== undefined) {
                        dataLength += 4; // ik.target
                        dataLength += 4; // ik.iteration
                        dataLength += 4; // ik.rotationConstraint
                        dataLength += 4; // ik.linkCount

                        const ikLinks = bone.ik.links;
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
            }

            dataLength += 4; // morphCount
            const mmdModelMetadataMorphs = mmdModelMetadata.morphs;
            for (let i = 0; i < mmdModelMetadataMorphs.length; ++i) {
                const morphInfo = mmdModelMetadataMorphs[i];

                dataLength += 4 + encoder.encode(morphInfo.name).length; // morphName
                dataLength += 4 + encoder.encode(morphInfo.englishName).length; // englishMorphName
                dataLength += 1; // category
                dataLength += 1; // type
                switch (morphInfo.type) {
                case PmxObject.Morph.Type.GroupMorph:
                    dataLength +=
                        4 + // elementCount
                        (
                            4 + // group.indices
                            4 // group.ratios
                        ) * morphInfo.indices.length;
                    break;

                case PmxObject.Morph.Type.VertexMorph:
                    {
                        dataLength += 4; // meshCount
                        const morphs = vertexUvMorphs[i]!;
                        for (let j = 0; j < morphs.length; ++j) {
                            const morph = morphs[j];
                            dataLength +=
                                4 + // vertex.meshIndex
                                4 + // vertex.elementCount
                                morph.indices.length * 4 + // vertex.indices
                                morph.offsets.length * 4; // vertex.positions
                        }
                    }
                    break;

                case PmxObject.Morph.Type.BoneMorph:
                    dataLength +=
                        4 + // elementCount
                        (
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
                    {
                        dataLength += 4; // meshCount
                        const morphs = vertexUvMorphs[i]!;
                        for (let j = 0; j < morphs.length; ++j) {
                            const morph = morphs[j];
                            dataLength +=
                                4 + // uv.meshIndex
                                4 + // uv.elementCount
                                morph.indices.length * 4 + // uv.indices
                                morph.offsets.length * 4; // uv.uvs
                        }
                    }
                    break;

                case PmxObject.Morph.Type.MaterialMorph:
                    dataLength +=
                        4 + // elementCount
                        (
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
            if (containsSerializationData && mmdModelMetadata.displayFrames !== null) {
                const mmdModelMetadataDisplayFrames = mmdModelMetadata.displayFrames;
                for (let i = 0; i < mmdModelMetadataDisplayFrames.length; ++i) {
                    const displayFrameInfo = mmdModelMetadataDisplayFrames[i];

                    dataLength += 4 + encoder.encode(displayFrameInfo.name).length; // name
                    dataLength += 4 + encoder.encode(displayFrameInfo.englishName).length; // englishName
                    dataLength += 1; // isSpecialFrame
                    dataLength += 4; // elementCount
                    dataLength += (
                        1 + // element.frameType
                        4 // element.frameIndex
                    ) * displayFrameInfo.frames.length;
                }
            }

            dataLength += 4; // rigidBodyCount
            const mmdModelMetadataRigidBodies = mmdModelMetadata.rigidBodies;
            for (let i = 0; i < mmdModelMetadataRigidBodies.length; ++i) {
                const rigidBodyInfo = mmdModelMetadataRigidBodies[i];

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
            const mmdModelMetadataJoints = mmdModelMetadata.joints;
            for (let i = 0; i < mmdModelMetadataJoints.length; ++i) {
                const jointInfo = mmdModelMetadataJoints[i];

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
        serializer.setInt8Array([2, 0, 0]); // version

        {
            const header = mmdModelMetadata.header;
            serializer.setString(header.modelName); // modelName
            serializer.setString(header.englishModelName); // englishModelName
            serializer.setString(header.comment); // comment
            serializer.setString(header.englishComment); // englishComment
        }

        const meshFlag = (bonesMetadataToSerialize.length !== 0 ? BpmxObject.Geometry.MeshType.IsSkinnedMesh : 0);
        serializer.setUint8(meshFlag); // meshFlag
        serializer.setUint32(meshesToSerialize.length); // meshCount
        for (let i = 0; i < meshesToSerialize.length; ++i) {
            const mesh = meshesToSerialize[i];
            const geometry = mesh.geometry!;

            serializer.setString(mesh.name); // meshName

            const positions = geometry.getVerticesData(VertexBuffer.PositionKind)!;
            const vertexCount = positions.length / 3;
            serializer.setUint32(vertexCount); // vertexCount
            serializer.setFloat32Array(positions); // positions

            let normals = geometry.getVerticesData(VertexBuffer.NormalKind)!;
            if (normals.length !== vertexCount * 3) {
                this.warn(`mesh ${mesh.name} normals vertex count is different from positions vertex count`);
                const newNormals = new Float32Array(vertexCount * 3);
                newNormals.set(normals);
                normals = newNormals;
            }
            serializer.setFloat32Array(normals); // normals

            let uvs = geometry.getVerticesData(VertexBuffer.UVKind)!;
            if (uvs.length !== vertexCount * 2) {
                this.warn(`mesh ${mesh.name} uv vertex count is different from positions vertex count`);
                const newUvs = new Float32Array(vertexCount * 2);
                newUvs.set(uvs);
                uvs = newUvs;
            }
            serializer.setFloat32Array(uvs); // uvs

            const additionalUvs: FloatArray[] = [];
            {
                const additionalUv1 = geometry.getVerticesData(MmdBufferKind.AdditionalUV1Kind);
                if (additionalUv1 !== null) additionalUvs.push(additionalUv1);
                const additionalUv2 = geometry.getVerticesData(MmdBufferKind.AdditionalUV2Kind);
                if (additionalUv2 !== null) additionalUvs.push(additionalUv2);
                const additionalUv3 = geometry.getVerticesData(MmdBufferKind.AdditionalUV3Kind);
                if (additionalUv3 !== null) additionalUvs.push(additionalUv3);
                const additionalUv4 = geometry.getVerticesData(MmdBufferKind.AdditionalUV4Kind);
                if (additionalUv4 !== null) additionalUvs.push(additionalUv4);
            }
            serializer.setUint8(additionalUvs.length); // additionalUvCount

            for (let j = 0; j < additionalUvs.length; ++j) {
                const additionalUv = additionalUvs[j];
                if (additionalUv.length !== vertexCount * 4) {
                    this.warn(`mesh ${mesh.name} additional uv vertex count is different from positions vertex count`);
                    const newAdditionalUv = new Float32Array(vertexCount * 4);
                    newAdditionalUv.set(additionalUv);
                    additionalUvs[j] = newAdditionalUv;
                }
                serializer.setFloat32Array(additionalUv); // additionalUv
            }

            let sdefC = geometry.getVerticesData(MmdBufferKind.MatricesSdefCKind);
            let sdefR0 = geometry.getVerticesData(MmdBufferKind.MatricesSdefR0Kind);
            let sdefR1 = geometry.getVerticesData(MmdBufferKind.MatricesSdefR1Kind);

            const hasSdef = sdefC !== null && sdefR0 !== null && sdefR1 !== null;

            let edgeScale = geometry.getVerticesData(MmdBufferKind.EdgeScaleKind);

            const geometryType = (hasSdef ? BpmxObject.Geometry.GeometryType.HasSdef : 0) |
                (!mesh.isUnIndexed ? BpmxObject.Geometry.GeometryType.IsIndexed : 0) |
                (edgeScale !== null ? BpmxObject.Geometry.GeometryType.HasEdgeScale : 0);
            serializer.setUint8(geometryType); // flag

            if (!mesh.isUnIndexed) {
                const indices = geometry.getIndices()!;
                serializer.setUint8(
                    indices instanceof Uint32Array ? BpmxObject.Geometry.IndexElementType.Uint32 :
                        indices instanceof Uint16Array ? BpmxObject.Geometry.IndexElementType.Uint16 :
                            BpmxObject.Geometry.IndexElementType.Int32
                ); // indexElementType
                serializer.setUint32(indices.length); // indicesCount
                if (indices instanceof Uint16Array) {
                    serializer.setUint16Array(indices); // indices
                } else if (indices instanceof Uint32Array) {
                    serializer.setUint32Array(indices); // indices
                } else {
                    serializer.setInt32Array(indices); // indices
                }
            }

            if (bonesMetadataToSerialize.length !== 0) {
                const boneIndices = new Float32Array(vertexCount * 4);
                {
                    const originalBoneIndices = geometry.getVerticesData(VertexBuffer.MatricesIndicesKind);
                    if (originalBoneIndices === null || originalBoneIndices.length !== vertexCount * 4) {
                        this.warn(`mesh ${mesh.name} bone indices vertex count is different from positions vertex count`);
                    }
                    if (originalBoneIndices !== null) {
                        for (let j = 0; j < boneIndices.length; ++j) boneIndices[j] = boneIndexRemapper[originalBoneIndices[j]] ?? originalBoneIndices[j]; // remap bone indices
                    }
                }
                serializer.setFloat32Array(boneIndices); // boneIndices

                let boneWeights = geometry.getVerticesData(VertexBuffer.MatricesWeightsKind);
                if (boneWeights === null) boneWeights = new Float32Array(vertexCount * 4);
                if (boneWeights.length !== vertexCount * 4) {
                    this.warn(`mesh ${mesh.name} bone weights vertex count is different from positions vertex count`);
                    const newBoneWeights = new Float32Array(vertexCount * 4);
                    newBoneWeights.set(boneWeights);
                    boneWeights = newBoneWeights;
                }
                serializer.setFloat32Array(boneWeights); // boneWeights

                if (hasSdef) {
                    if (sdefC!.length !== vertexCount * 3) {
                        this.warn(`mesh ${mesh.name} sdefC vertex count is different from positions vertex count`);
                        const newSdefC = new Float32Array(vertexCount * 3);
                        newSdefC.set(sdefC!);
                        sdefC = newSdefC;
                    }
                    if (sdefR0!.length !== vertexCount * 3) {
                        this.warn(`mesh ${mesh.name} sdefR0 vertex count is different from positions vertex count`);
                        const newSdefR0 = new Float32Array(vertexCount * 3);
                        newSdefR0.set(sdefR0!);
                        sdefR0 = newSdefR0;
                    }
                    if (sdefR1!.length !== vertexCount * 3) {
                        this.warn(`mesh ${mesh.name} sdefR1 vertex count is different from positions vertex count`);
                        const newSdefR1 = new Float32Array(vertexCount * 3);
                        newSdefR1.set(sdefR1!);
                        sdefR1 = newSdefR1;
                    }
                    serializer.setFloat32Array(sdefC!); // sdefC
                    serializer.setFloat32Array(sdefR0!); // sdefR0
                    serializer.setFloat32Array(sdefR1!); // sdefR1
                }
            }

            if (edgeScale !== null) {
                if (edgeScale.length !== vertexCount) {
                    this.warn(`mesh ${mesh.name} edgeScale vertex count is different from positions vertex count`);
                    const newEdgeScale = new Float32Array(vertexCount);
                    newEdgeScale.set(edgeScale);
                    edgeScale = newEdgeScale;
                }
                serializer.setFloat32Array(edgeScale); // edgeScale
            }
        }

        serializer.setUint32(texturesToSerialize.length); // textureCount
        for (let i = 0; i < texturesToSerialize.length; ++i) {
            const textureBuffer = texturesToSerialize[i]._buffer as ArrayBuffer;
            const textureName = textureNameMap !== null
                ? (textureNameMap.get(texturesToSerialize[i]) ?? texturesToSerialize[i].name)
                : texturesToSerialize[i].name;
            serializer.setString(textureName); // textureName
            serializer.setUint32(textureBuffer.byteLength); // textureByteLength
            serializer.setUint8Array(new Uint8Array(textureBuffer)); // textureData
        }

        for (let i = 0; i < meshesToSerialize.length; ++i) {
            const material = materialsToSerialize[i] as (Partial<MmdStandardMaterial> & Partial<PBRMaterial>) | undefined;
            const materialMetadata = materialsMetadataToSerialize[i];

            serializer.setString(material?.name ?? ""); // materialName
            serializer.setString(materialMetadata?.englishName ?? ""); // englishMaterialName

            const diffuse = material?.diffuseColor?.asArray() ?? material?.albedoColor?.asArray() ?? [1, 1, 1];
            diffuse.length = 4; // ensure length
            diffuse[3] = material?.alpha ?? 1;
            serializer.setFloat32Array(diffuse); // diffuse

            const specular = material?.specularColor?.asArray() ?? material?.reflectivityColor?.asArray() ?? [0, 0, 0];
            specular.length = 3; // ensure length
            serializer.setFloat32Array(specular); // specular

            serializer.setFloat32(material?.specularPower ?? 0); // shininess

            const ambient = material?.ambientColor?.asArray() ?? [0, 0, 0];
            ambient.length = 3; // ensure length
            serializer.setFloat32Array(ambient); // ambient

            serializer.setInt8(material?.transparencyMode ?? Material.MATERIAL_OPAQUE); // evauatedTransparency

            const flag = ((materialMetadata?.isDoubleSided ?? material?.backFaceCulling === false) ? PmxObject.Material.Flag.IsDoubleSided : 0) |
                ((material?.renderOutline ?? false) ? PmxObject.Material.Flag.EnabledToonEdge : 0);
            serializer.setUint8(flag); // flag

            const edgeColor = material?.outlineColor?.asArray() ?? [0, 0, 0];
            edgeColor.length = 4; // ensure length
            edgeColor[3] = material?.outlineAlpha ?? 1;
            serializer.setFloat32Array(edgeColor); // edgeColor

            serializer.setFloat32(material?.outlineWidth ?? 0); // edgeSize

            const diffuseTexture = material?.diffuseTexture ?? material?.albedoTexture;
            serializer.setInt32(diffuseTexture ? texturesToSerialize.indexOf(diffuseTexture as Texture) : -1); // textureIndex

            serializer.setInt32(material?.sphereTexture ? texturesToSerialize.indexOf(material.sphereTexture as Texture) : -1); // sphereTextureIndex
            serializer.setUint8(material?.sphereTextureBlendMode ?? 0); // sphereTextureMode

            const isSharedToonTexture = material?.toonTexture &&
                material.toonTexture.name.startsWith("file:shared_toon_texture_") &&
                material.toonTexture.name.length <= 27 &&
                !isNaN(Number(material.toonTexture.name.substring(25)));
            serializer.setUint8(isSharedToonTexture ? 1 : 0); // isSharedToontexture

            serializer.setInt32(material?.toonTexture ? texturesToSerialize.indexOf(material.toonTexture as Texture) : -1); // toonTextureIndex
            serializer.setString(materialMetadata?.comment ?? ""); // comment
        }

        if (bonesMetadataToSerialize.length !== 0) {
            serializer.setUint32(bonesMetadataToSerialize.length); // boneCount
            for (let i = 0; i < bonesMetadataToSerialize.length; ++i) {
                const bone = bonesMetadataToSerialize[i];

                serializer.setString(bone.name); // boneName
                serializer.setString(bone.englishName); // englishBoneName
                serializer.setFloat32Array(bone.position); // position

                serializer.setInt32(bone.parentBoneIndex); // parentBoneIndex
                serializer.setInt32(bone.transformOrder); // transformOrder

                serializer.setUint16(bone.flag); // flag

                if (typeof bone.tailPosition === "number") {
                    serializer.setInt32(bone.tailPosition); // tailPosition
                } else {
                    serializer.setFloat32Array(bone.tailPosition); // tailPosition
                }
                if (bone.appendTransform !== undefined) {
                    serializer.setInt32(bone.appendTransform.parentIndex); // appendTransform.parentIndex
                    serializer.setFloat32(bone.appendTransform.ratio); // appendTransform.ratio
                }
                if (bone.axisLimit !== undefined) {
                    serializer.setFloat32Array(bone.axisLimit); // axisLimit
                }
                if (bone.localVector !== undefined) {
                    serializer.setFloat32Array(bone.localVector.x); // localVectorX
                    serializer.setFloat32Array(bone.localVector.z); // localVectorZ
                }
                if (bone.externalParentTransform !== undefined) {
                    serializer.setInt32(bone.externalParentTransform); // externalParentTransform
                }
                if (bone.ik !== undefined) {
                    const ik = bone.ik;

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
        }

        serializer.setUint32(mmdModelMetadata.morphs.length); // morphCount
        const mmdModelMetadataMorphs = mmdModelMetadata.morphs;
        for (let i = 0; i < mmdModelMetadataMorphs.length; ++i) {
            const morphInfo = mmdModelMetadataMorphs[i];

            serializer.setString(morphInfo.name); // morphName
            serializer.setString(morphInfo.englishName); // englishMorphName
            serializer.setUint8(morphInfo.category); // category
            serializer.setUint8(morphInfo.type); // type
            switch (morphInfo.type) {
            case PmxObject.Morph.Type.GroupMorph:
                {
                    serializer.setUint32(morphInfo.indices.length); // elementCount
                    serializer.setInt32Array(morphInfo.indices); // group.indices

                    let ratios = morphInfo.ratios;
                    if (ratios.length !== morphInfo.indices.length) {
                        this.warn(`morph ${morphInfo.name} group morph ratio count is different from indices count`);
                        const newRatios = new Float32Array(morphInfo.indices.length);
                        newRatios.set(ratios);
                        ratios = newRatios;
                    }
                    serializer.setFloat32Array(ratios); // group.ratios
                }
                break;

            case PmxObject.Morph.Type.VertexMorph:
            case PmxObject.Morph.Type.UvMorph:
            case PmxObject.Morph.Type.AdditionalUvMorph1:
            case PmxObject.Morph.Type.AdditionalUvMorph2:
            case PmxObject.Morph.Type.AdditionalUvMorph3:
            case PmxObject.Morph.Type.AdditionalUvMorph4:
                {
                    const morphs = vertexUvMorphs[i]!;
                    serializer.setUint32(morphs.length); // meshCount
                    for (let j = 0; j < morphs.length; ++j) {
                        const morph = morphs[j];
                        serializer.setUint32(morph.meshIndex); // vertex.meshIndex or uv.meshIndex
                        serializer.setUint32(morph.indices.length); // vertex.elementCount or uv.elementCount
                        serializer.setInt32Array(morph.indices); // vertex.indices or uv.indices

                        let offsets = morph.offsets;
                        const elementCount = morphInfo.type === PmxObject.Morph.Type.VertexMorph ? 3 : 4;
                        if (offsets.length !== morph.indices.length * elementCount) {
                            this.warn(`morph ${morphInfo.name} vertex/uv morph offset count is different from indices count`);
                            const newOffsets = new Float32Array(morph.indices.length * elementCount);
                            newOffsets.set(offsets);
                            offsets = newOffsets;
                        }
                        serializer.setFloat32Array(offsets); // vertex.positions
                    }
                }
                break;

            case PmxObject.Morph.Type.BoneMorph:
                {
                    const indices = new Int32Array(morphInfo.indices.length);
                    {
                        const originalIndices = morphInfo.indices;
                        for (let j = 0; j < originalIndices.length; ++j) indices[j] = boneMetadataIndexRemapper[originalIndices[j]] ?? originalIndices[j]; // remap bone indices
                    }
                    serializer.setUint32(indices.length); // elementCount
                    serializer.setInt32Array(indices); // bone.indices

                    let positions = morphInfo.positions;
                    if (positions.length !== indices.length * 3) {
                        this.warn(`morph ${morphInfo.name} bone morph position count is different from indices count`);
                        const newPositions = new Float32Array(indices.length * 3);
                        newPositions.set(positions);
                        positions = newPositions;
                    }
                    serializer.setFloat32Array(positions); // bone.positions

                    let rotations = morphInfo.rotations;
                    if (rotations.length !== indices.length * 4) {
                        this.warn(`morph ${morphInfo.name} bone morph rotation count is different from indices count`);
                        const newRotations = new Float32Array(indices.length * 4);
                        newRotations.set(rotations);
                        rotations = newRotations;
                    }
                    serializer.setFloat32Array(rotations); // bone.rotations
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

        if (containsSerializationData && mmdModelMetadata.displayFrames !== null) {
            serializer.setUint32(mmdModelMetadata.displayFrames.length); // displayFrameCount
            const mmdModelMetadataDisplayFrames = mmdModelMetadata.displayFrames;
            for (let i = 0; i < mmdModelMetadataDisplayFrames.length; ++i) {
                const displayFrameInfo = mmdModelMetadataDisplayFrames[i];

                serializer.setString(displayFrameInfo.name); // name
                serializer.setString(displayFrameInfo.englishName); // englishName
                serializer.setUint8(displayFrameInfo.isSpecialFrame ? 1 : 0); // isSpecialFrame
                serializer.setUint32(displayFrameInfo.frames.length); // elementCount
                const frames = displayFrameInfo.frames;
                for (let j = 0; j < frames.length; ++j) {
                    const frame = frames[j];
                    serializer.setUint8(frame.type); // element.frameType
                    const index = frame.type === PmxObject.DisplayFrame.FrameData.FrameType.Bone
                        ? (boneMetadataIndexRemapper[frame.index] ?? frame.index) // remap bone indices
                        : frame.index;
                    serializer.setInt32(index); // element.frameIndex
                }
            }
        } else {
            serializer.setUint32(0); // displayFrameCount
        }

        serializer.setUint32(mmdModelMetadata.rigidBodies.length); // rigidBodyCount
        const mmdModelMetadataRigidBodies = mmdModelMetadata.rigidBodies;
        for (let i = 0; i < mmdModelMetadataRigidBodies.length; ++i) {
            const rigidBodyInfo = mmdModelMetadataRigidBodies[i];

            serializer.setString(rigidBodyInfo.name); // name
            serializer.setString(rigidBodyInfo.englishName); // englishName
            serializer.setInt32(boneMetadataIndexRemapper[rigidBodyInfo.boneIndex] ?? rigidBodyInfo.boneIndex); // boneIndex - remap bone indices
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

        serializer.setUint32(mmdModelMetadata.joints.length); // jointCount
        const mmdModelMetadataJoints = mmdModelMetadata.joints;
        for (let i = 0; i < mmdModelMetadataJoints.length; ++i) {
            const jointInfo = mmdModelMetadataJoints[i];

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

        if (serializer.bytesAvailable !== 0) {
            this.error(`unexpected bytes available: ${serializer.bytesAvailable}`);
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
