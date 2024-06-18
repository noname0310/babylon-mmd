import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { MmdDataSerializer } from "@/Loader/Optimized/mmdDataSerializer";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { MmdMesh } from "../mmdMesh";
import type { CreateMmdWasmModelPhysicsOptions } from "./mmdWasmRuntime";

/**
 * mmd model metadata representation in binary
 *
 * boneCount: uint32
 * appendTransformCount: uint32
 * ikCount: uint32
 * {
 *  restPosition: float32[3]
 *  absoluteInverseBindMatrix: float32[16]
 *  parentBoneIndex: int32
 *  transformOrder: int32
 *  flag: uint16
 *  -- padding: uint16
 *  appendTransform: { // optional
 *   parentIndex: int32
 *   ratio: float32
 *  }
 *  axisLimit: { // optional
 *   axis: float32[3]
 *  }
 *  ik: { // optional
 *   target: int32
 *   iteration: int32
 *   rotationConstraint: float32
 *   linkCount: uint32
 *   {
 *    target: int32
 *    hasLimitation: uint8
 *    -- padding: uint8
 *    -- padding: uint16
 *    limitation: { // optional
 *     minimumAngle: float32[3]
 *     maximumAngle: float32[3]
 *    }
 *   }[linkCount]
 *  }
 * }[boneCount]
 *
 * morphCount: uint32
 * { // if boneMorph
 *  kind: uint8
 *  -- padding: uint8
 *  -- padding: uint16
 *  boneCount: uint32
 *  indices: int32[boneCount]
 *  positions: float32[boneCount * 3]
 *  rotations: float32[boneCount * 4]
 * } | { // if groupMorph
 *  kind: uint8
 *  -- padding: uint8
 *  -- padding: uint16
 *  indexCount: uint32
 *  indices: int32[indexCount]
 *  ratios: float32[indexCount]
 * }[morphCount]
 *
 * physicsInfoKind: uint8 // 0: no physics, 1: striped rigid bodies, 2: full physics
 * -- padding: uint8
 * -- padding: uint16
 *
 * { // if physicsInfoKind === 1
 *  rigidBodyCount: uint32
 *  {
 *   boneIndex: int32
 *   physicsMode: uint8
 *   -- padding: uint8
 *   -- padding: uint16
 *  }[rigidBodyCount]
 * }
 * { // if physicsInfoKind === 2
 *  physicsWorldId: uint32
 *  kinematicSharedPhysicsWorldIdCount: uint32
 *  kinematicSharedPhysicsWorldIds: uint32[kinematicSharedPhysicsWorldIdCount]
 *  modelInitialWorldMatrix: float32[16]
 *
 *  rigidBodyCount: uint32
 *  {
 *   boneIndex: int32
 *   collisionGroup: uint8
 *   shapeType: uint8
 *   collisionMask: uint16
 *   shapeSize: float32[3]
 *   shapePosition: float32[3]
 *   shapeRotation: float32[3]
 *   mass: float32
 *   linearDamping: float32
 *   angularDamping: float32
 *   repulsion: float32
 *   friction: float32
 *   physicsMode: uint8
 *   -- padding: uint8
 *   -- padding: uint16
 *  }[rigidBodyCount]
 *
 *  jointCount: uint32
 *  {
 *   type: uint8
 *   -- padding: uint8
 *   -- padding: uint16
 *   rigidBodyIndexA: int32
 *   rigidBodyIndexB: int32
 *   position: float32[3]
 *   rotation: float32[3]
 *   positionMin: float32[3]
 *   positionMax: float32[3]
 *   rotationMin: float32[3]
 *   rotationMax: float32[3]
 *   springPosition: float32[3]
 *   springRotation: float32[3]
 *  }[jointCount]
 * }
 */

/**
 * @internal
 */
export class MmdMetadataEncoder {
    protected _encodePhysicsOptions: CreateMmdWasmModelPhysicsOptions | boolean;

    public constructor() {
        this._encodePhysicsOptions = true;
    }

    public setEncodePhysicsOptions(options: CreateMmdWasmModelPhysicsOptions | boolean): void {
        if (typeof options === "boolean") {
            this._encodePhysicsOptions = options;
        } else {
            let validatedWorldId = options.worldId;
            if (validatedWorldId !== undefined) {
                if (validatedWorldId < 0 || 0xFFFFFFFF < validatedWorldId) {
                    validatedWorldId = undefined;
                }
            }

            const validatedKinematicSharedWorldIds: number[] = [];

            const kinematicSharedWorldIds = options.kinematicSharedWorldIds;
            if (kinematicSharedWorldIds !== undefined) {
                for (let i = 0; i < kinematicSharedWorldIds.length; ++i) {
                    const worldId = kinematicSharedWorldIds[i];
                    if (0 <= worldId && worldId <= 0xFFFFFFFF) {
                        validatedKinematicSharedWorldIds.push(worldId);
                    }
                }
            }

            this._encodePhysicsOptions = {
                worldId: validatedWorldId,
                kinematicSharedWorldIds: validatedKinematicSharedWorldIds
            };
        }
    }

    protected _computeBonesSize(metadata: MmdModelMetadata): number {
        let dataLength = 4 // boneCount
            + 4 // appendTransformCount
            + 4; // ikCount

        const bones = metadata.bones;
        for (let i = 0; i < bones.length; ++i) {
            dataLength += 4 * 3 // restPosition
                + 4 * 16 // absoluteInverseBindMatrix
                + 4 // parentBoneIndex
                + 4 // transformOrder
                + 2 // flag
                + 2; // padding

            const bone = bones[i];
            if (bone.appendTransform) {
                dataLength += 4 // parentIndex
                    + 4; // ratio
            }
            if (bone.axisLimit) {
                dataLength += 4 * 3; // axis
            }
            if (bone.ik) {
                dataLength += 4 // target
                    + 4 // iteration
                    + 4 // rotationConstraint
                    + 4; // linkCount

                const links = bone.ik.links;
                for (let j = 0; j < links.length; ++j) {
                    dataLength += 4 // target
                        + 1 // hasLimitation
                        + 3; // padding

                    const link = links[j];
                    if (link.limitation) {
                        dataLength += 4 * 3 // minimumAngle
                            + 4 * 3; // maximumAngle
                    }
                }
            }
        }

        return dataLength;
    }

    protected _computeMorphsSize(metadata: MmdModelMetadata): number {
        let dataLength = 4; // morphCount
        const morphs = metadata.morphs;
        for (let i = 0; i < morphs.length; ++i) {
            const morph = morphs[i];

            switch (morph.type) {
            case PmxObject.Morph.Type.BoneMorph: {
                const indices = morph.indices;
                dataLength += 1 // kind
                    + 3 // padding
                    + 4 // boneCount
                    + 4 * indices.length // indices
                    + 4 * 3 * indices.length // positions
                    + 4 * 4 * indices.length; // rotations
                break;
            }
            case PmxObject.Morph.Type.GroupMorph: {
                const indices = morph.indices;
                dataLength += 1 // kind
                    + 3 // padding
                    + 4 // indexCount
                    + 4 * indices.length // indices
                    + 4 * indices.length; // ratios
                break;
            }
            }
        }

        return dataLength;
    }

    protected _computePhysicsSize(metadata: Nullable<MmdModelMetadata>): number {
        if (metadata === null) {
            return 1 // physicsInfoKind
                + 3; // padding
        }

        let dataLength = 1 // physicsInfoKind
            + 3 // padding
            + 4; // rigidBodyCount

        const rigidBodies = metadata.rigidBodies;
        for (let i = 0; i < rigidBodies.length; ++i) {
            dataLength += 4 // boneIndex
                + 1 // physicsMode
                + 3; // padding
        }

        return dataLength;
    }

    public computeSize(mmdMesh: MmdMesh): number {
        const metadata = mmdMesh.metadata;

        const dataLength = this._computeBonesSize(metadata)
            + this._computeMorphsSize(metadata)
            + this._computePhysicsSize(this._encodePhysicsOptions ? metadata : null);

        return dataLength;
    }

    protected _encodeBones(serializer: MmdDataSerializer, metadata: MmdModelMetadata, linkedBones: IMmdRuntimeLinkedBone[]): void {
        const restPosition = new Vector3();

        const bones = metadata.bones;
        serializer.setUint32(bones.length); // boneCount
        let appendTransformCount = 0;
        let ikCount = 0;
        for (let i = 0; i < bones.length; ++i) {
            const bone = bones[i];
            if (bone.appendTransform) {
                appendTransformCount += 1;
            }
            if (bone.ik) {
                ikCount += 1;
            }
        }
        serializer.setUint32(appendTransformCount); // appendTransformCount
        serializer.setUint32(ikCount); // ikCount
        for (let i = 0; i < bones.length; ++i) {
            const bone = bones[i];
            const linkedBone = linkedBones[i];

            let flag = bone.flag;
            flag &=
                (bone.appendTransform === undefined
                    ? ~(PmxObject.Bone.Flag.HasAppendMove & PmxObject.Bone.Flag.HasAppendRotate)
                    : ~0)
                & ~PmxObject.Bone.Flag.HasAxisLimit
                & ~PmxObject.Bone.Flag.IsIkEnabled;
            if (bone.axisLimit) {
                flag |= PmxObject.Bone.Flag.HasAxisLimit;
            }
            if (bone.ik) {
                flag |= PmxObject.Bone.Flag.IsIkEnabled;
            }

            serializer.setFloat32Array(linkedBone.getRestMatrix().getTranslationToRef(restPosition).asArray()); // restPosition
            serializer.setFloat32Array(linkedBone.getAbsoluteInverseBindMatrix().m); // absoluteInverseBindMatrix
            serializer.setInt32(bone.parentBoneIndex); // parentBoneIndex
            serializer.setInt32(bone.transformOrder); // transformOrder
            serializer.setUint16(bone.flag); // flag
            serializer.offset += 2; // padding

            if (bone.appendTransform) {
                serializer.setInt32(bone.appendTransform.parentIndex); // parentIndex
                serializer.setFloat32(bone.appendTransform.ratio); // ratio
            }

            if (bone.axisLimit) {
                serializer.setFloat32Array(bone.axisLimit); // axis
            }

            if (bone.ik) {
                serializer.setInt32(bone.ik.target); // target
                serializer.setInt32(bone.ik.iteration); // iteration
                serializer.setFloat32(bone.ik.rotationConstraint); // rotationConstraint
                serializer.setUint32(bone.ik.links.length); // linkCount

                const links = bone.ik.links;
                for (let j = 0; j < links.length; ++j) {
                    const link = links[j];
                    serializer.setInt32(link.target); // target
                    serializer.setUint8(link.limitation ? 1 : 0); // hasLimitation
                    serializer.offset += 3; // padding

                    if (link.limitation) {
                        serializer.setFloat32Array(link.limitation.minimumAngle); // minimumAngle
                        serializer.setFloat32Array(link.limitation.maximumAngle); // maximumAngle
                    }
                }
            }
        }
    }

    protected _encodeMorphs(serializer: MmdDataSerializer, metadata: MmdModelMetadata): Int32Array {
        const morphs = metadata.morphs;
        let morphCount = 0;
        for (let i = 0; i < morphs.length; ++i) {
            const morph = morphs[i];

            switch (morph.type) {
            case PmxObject.Morph.Type.BoneMorph:
            case PmxObject.Morph.Type.GroupMorph:
                morphCount += 1;
                break;
            }
        }

        const wasmMorphMap = new Int32Array(morphs.length).fill(-1);
        for (let i = 0, nextIndex = 0; i < morphs.length; ++i) {
            const morph = morphs[i];
            if (
                morph.type !== PmxObject.Morph.Type.BoneMorph &&
                morph.type !== PmxObject.Morph.Type.GroupMorph
            ) {
                continue;
            }

            wasmMorphMap[i] = nextIndex;
            nextIndex += 1;
        }

        serializer.setUint32(morphCount); // morphCount
        for (let i = 0; i < morphs.length; ++i) {
            const morph = morphs[i];


            switch (morph.type) {
            case PmxObject.Morph.Type.BoneMorph:
                {
                    serializer.setUint8(morph.type); // kind
                    serializer.offset += 3; // padding
                    serializer.setUint32(morph.indices.length); // boneCount
                    serializer.setInt32Array(morph.indices); // indices
                    serializer.setFloat32Array(morph.positions); // positions
                    serializer.setFloat32Array(morph.rotations); // rotations
                }
                break;
            case PmxObject.Morph.Type.GroupMorph:
                {
                    serializer.setUint8(morph.type); // kind
                    serializer.offset += 3; // padding
                    serializer.setUint32(morph.indices.length); // indexCount

                    const indices = morph.indices;
                    const remappedIndices = new Int32Array(indices.length);
                    for (let j = 0; j < remappedIndices.length; ++j) {
                        remappedIndices[j] = wasmMorphMap[indices[j]];
                    }
                    serializer.setInt32Array(remappedIndices); // indices
                    serializer.setFloat32Array(morph.ratios); // ratios
                }
                break;
            }
        }

        return wasmMorphMap;
    }

    protected _encodePhysics(serializer: MmdDataSerializer, metadata: Nullable<MmdModelMetadata>, _rootTransform: TransformNode): void {
        if (metadata === null) {
            serializer.setUint8(0); // physicsInfoKind
            serializer.offset += 3; // padding
            return;
        }

        serializer.setUint8(1); // physicsInfoKind
        serializer.offset += 3; // padding

        const bones = metadata.bones;
        const boneNameMap = new Map<string, number>();
        for (let i = 0; i < bones.length; ++i) {
            boneNameMap.set(bones[i].name, i);
        }

        const rigidBodies = metadata.rigidBodies;
        serializer.setUint32(rigidBodies.length); // rigidBodyCount
        for (let i = 0; i < rigidBodies.length; ++i) {
            const rigidBody = rigidBodies[i];

            const boneIndex = rigidBody.boneIndex < 0 || bones.length <= rigidBody.boneIndex
                ? boneNameMap.get(rigidBody.name) ?? -1 // fallback to name
                : rigidBody.boneIndex;

            serializer.setInt32(boneIndex); // boneIndex
            serializer.setUint8(rigidBody.physicsMode); // physicsMode
            serializer.offset += 3; // padding
        }
    }

    public encode(mmdMesh: MmdMesh, linkedBones: IMmdRuntimeLinkedBone[], buffer: Uint8Array): Int32Array {
        const metadata = mmdMesh.metadata;

        const serializer = new MmdDataSerializer(buffer.buffer);
        serializer.offset = buffer.byteOffset;

        this._encodeBones(serializer, metadata, linkedBones);
        const wasmMorphMap = this._encodeMorphs(serializer, metadata);
        this._encodePhysics(serializer, this._encodePhysicsOptions ? metadata : null, mmdMesh);

        return wasmMorphMap;
    }
}
