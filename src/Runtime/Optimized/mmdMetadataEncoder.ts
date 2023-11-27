import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { MmdDataSerializer } from "@/Loader/Optimized/mmdDataSerializer";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";

/**
 * mmd model metadata representation in binary
 *
 * boneCount: uint32
 * appendTransformCount: uint32
 * ikCount: uint32
 * {
 *  restPosition: float32[3]
 *  parentBoneIndex: int32
 *  transformOrder: int32
 *  flag: uint16
 *  appendTransform: { // optional
 *   parentIndex: int32
 *   ratio: float32
 *  }
 *  ik: { // optional
 *   target: int32
 *   iteration: int32
 *   rotationConstraint: float32
 *   linkCount: uint32
 *   {
 *    target: int32
 *    hasLimitation: uint8
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
 *  boneCount: uint32
 *  indices: int32[boneCount]
 *  positions: float32[boneCount * 3]
 *  rotations: float32[boneCount * 4]
 * } | { // if groupMorph
 *  kind: uint8
 *  indexCount: uint32
 *  indices: int32[indexCount]
 *  ratios: float32[indexCount]
 * }[morphCount]
 *
 * rigidBodyCount: uint32
 * {
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

export class MmdMetadataEncoder {
    public encodePhysics: boolean;

    public constructor() {
        this.encodePhysics = true;
    }

    public computeSize(metadata: MmdModelMetadata): number {
        let dataLength = 4 // boneCount
            + 4 // appendTransformCount
            + 4; // ikCount

        const bones = metadata.bones;
        for (let i = 0; i < bones.length; ++i) {
            dataLength += 4 * 3 // restPosition
                + 4 // parentBoneIndex
                + 4 // transformOrder
                + 2; // flag

            const bone = bones[i];
            if (bone.appendTransform) {
                dataLength += 4 // parentIndex
                    + 4; // ratio
            }
            if (bone.ik) {
                dataLength += 4 // target
                    + 4 // iteration
                    + 4 // rotationConstraint
                    + 4; // linkCount

                const links = bone.ik.links;
                for (let j = 0; j < links.length; ++j) {
                    dataLength += 4 // target
                        + 1; // hasLimitation

                    const link = links[j];
                    if (link.limitation) {
                        dataLength += 4 * 3 // minimumAngle
                            + 4 * 3; // maximumAngle
                    }
                }
            }
        }

        dataLength += 4; // morphCount
        const morphs = metadata.morphs;
        for (let i = 0; i < morphs.length; ++i) {
            const morph = morphs[i];

            switch (morph.type) {
            case PmxObject.Morph.Type.BoneMorph: {
                const indices = morph.indices;
                dataLength += 1 // kind
                    + 4 // boneCount
                    + 4 * indices.length // indices
                    + 4 * 3 * indices.length // positions
                    + 4 * 4 * indices.length; // rotations
                break;
            }
            case PmxObject.Morph.Type.GroupMorph: {
                const indices = morph.indices;
                dataLength += 1 // kind
                    + 4 // indexCount
                    + 4 * indices.length // indices
                    + 4 * indices.length; // ratios
                break;
            }
            }
        }

        if (this.encodePhysics) {
            dataLength += 4; // rigidBodyCount

            const rigidBodies = metadata.rigidBodies;
            for (let i = 0; i < rigidBodies.length; ++i) {
                dataLength += 4 // boneIndex
                    + 1 // collisionGroup
                    + 2 // collisionMask
                    + 1 // shapeType
                    + 4 * 3 // shapeSize
                    + 4 * 3 // shapePosition
                    + 4 * 3 // shapeRotation
                    + 4 // mass
                    + 4 // linearDamping
                    + 4 // angularDamping
                    + 4 // repulsion
                    + 4 // friction
                    + 1; // physicsMode
            }

            dataLength += 4; // jointCount

            const joints = metadata.joints;
            for (let i = 0; i < joints.length; ++i) {
                dataLength += 1 // type
                    + 4 // rigidBodyIndexA
                    + 4 // rigidBodyIndexB
                    + 4 * 3 // position
                    + 4 * 3 // rotation
                    + 4 * 3 // positionMin
                    + 4 * 3 // positionMax
                    + 4 * 3 // rotationMin
                    + 4 * 3 // rotationMax
                    + 4 * 3 // springPosition
                    + 4 * 3; // springRotation
            }
        } else {
            dataLength += 4 // rigidBodyCount
                + 4; // jointCount
        }

        return dataLength;
    }

    public encode(metadata: MmdModelMetadata, linkedBone: IMmdRuntimeLinkedBone[], buffer: Uint8Array): Int32Array {
        const serializer = new MmdDataSerializer(buffer.buffer);
        serializer.offset = buffer.byteOffset;

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
            serializer.setFloat32Array(linkedBone[i].getRestMatrix().getTranslationToRef(restPosition).asArray()); // restPosition
            serializer.setInt32(bone.parentBoneIndex); // parentBoneIndex
            serializer.setInt32(bone.transformOrder); // transformOrder
            serializer.setUint16(bone.flag); // flag

            if (bone.appendTransform) {
                serializer.setInt32(bone.appendTransform.parentIndex); // parentIndex
                serializer.setFloat32(bone.appendTransform.ratio); // ratio
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

                    if (link.limitation) {
                        serializer.setFloat32Array(link.limitation.minimumAngle); // minimumAngle
                        serializer.setFloat32Array(link.limitation.maximumAngle); // maximumAngle
                    }
                }
            }
        }

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
                    serializer.setUint32(morph.indices.length); // boneCount
                    serializer.setInt32Array(morph.indices); // indices
                    serializer.setFloat32Array(morph.positions); // positions
                    serializer.setFloat32Array(morph.rotations); // rotations
                }
                break;
            case PmxObject.Morph.Type.GroupMorph:
                {
                    serializer.setUint8(morph.type); // kind
                    serializer.setUint32(morph.indices.length); // indexCount
                    const remappedIndices = new Int32Array(morph.indices.length);
                    remappedIndices.set(morph.indices);
                    for (let j = 0; j < remappedIndices.length; ++j) {
                        remappedIndices[j] = wasmMorphMap[remappedIndices[j]];
                    }
                    serializer.setInt32Array(morph.indices); // indices
                    serializer.setFloat32Array(morph.ratios); // ratios
                }
                break;
            }
        }

        if (this.encodePhysics) {
            const rigidBodies = metadata.rigidBodies;
            serializer.setUint32(rigidBodies.length); // rigidBodyCount
            for (let i = 0; i < rigidBodies.length; ++i) {
                const rigidBody = rigidBodies[i];
                serializer.setInt32(rigidBody.boneIndex); // boneIndex
                serializer.setUint8(rigidBody.collisionGroup); // collisionGroup
                serializer.setUint16(rigidBody.collisionMask); // collisionMask
                serializer.setUint8(rigidBody.shapeType); // shapeType
                serializer.setFloat32Array(rigidBody.shapeSize); // shapeSize
                serializer.setFloat32Array(rigidBody.shapePosition); // shapePosition
                serializer.setFloat32Array(rigidBody.shapeRotation); // shapeRotation
                serializer.setFloat32(rigidBody.mass); // mass
                serializer.setFloat32(rigidBody.linearDamping); // linearDamping
                serializer.setFloat32(rigidBody.angularDamping); // angularDamping
                serializer.setFloat32(rigidBody.repulsion); // repulsion
                serializer.setFloat32(rigidBody.friction); // friction
                serializer.setUint8(rigidBody.physicsMode); // physicsMode
            }

            const joints = metadata.joints;
            serializer.setUint32(joints.length); // jointCount
            for (let i = 0; i < joints.length; ++i) {
                const joint = joints[i];
                serializer.setUint8(joint.type); // type
                serializer.setInt32(joint.rigidbodyIndexA); // rigidBodyIndexA
                serializer.setInt32(joint.rigidbodyIndexB); // rigidBodyIndexB
                serializer.setFloat32Array(joint.position); // position
                serializer.setFloat32Array(joint.rotation); // rotation
                serializer.setFloat32Array(joint.positionMin); // positionMin
                serializer.setFloat32Array(joint.positionMax); // positionMax
                serializer.setFloat32Array(joint.rotationMin); // rotationMin
                serializer.setFloat32Array(joint.rotationMax); // rotationMax
                serializer.setFloat32Array(joint.springPosition); // springPosition
                serializer.setFloat32Array(joint.springRotation); // springRotation
            }
        } else {
            serializer.setUint32(0); // rigidBodyCount
            serializer.setUint32(0); // jointCount
        }

        return wasmMorphMap;
    }
}
