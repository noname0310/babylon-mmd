import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import type { MmdDataSerializer } from "@/Loader/Optimized/mmdDataSerializer";

import { MmdMetadataEncoder } from "../mmdMetadataEncoder";
import type { CreateMmdWasmModelPhysicsOptions } from "../mmdWasmRuntime";
import type { MmdWasmPhysicsRuntime } from "./mmdWasmPhysicsRuntime";

/**
 * @internal
 */
export class MmdWasmPhysicsMetadataEncoder extends MmdMetadataEncoder {
    private readonly _physicsRuntime: MmdWasmPhysicsRuntime;

    public constructor(physicsRuntime: MmdWasmPhysicsRuntime) {
        super();
        this._physicsRuntime = physicsRuntime;
    }

    protected override _computePhysicsSize(metadata: Nullable<MmdModelMetadata>): number {
        if (metadata === null) {
            return 1 // physicsInfoKind
                + 3; // padding
        }

        let dataLength = 1 // physicsInfoKind
            + 3 // padding
            + 4; // physicsWorldId

        dataLength += 4; // kinematicSharedPhysicsWorldIdCount
        const kinematicSharedPhysicsWorldIds = (this._encodePhysicsOptions as CreateMmdWasmModelPhysicsOptions).kinematicSharedWorldIds;
        if (kinematicSharedPhysicsWorldIds !== undefined) {
            const kinematicSharedPhysicsWorldIdsSet = new Set(kinematicSharedPhysicsWorldIds);
            const worldId = (this._encodePhysicsOptions as CreateMmdWasmModelPhysicsOptions).worldId ?? this._physicsRuntime.nextWorldId;
            kinematicSharedPhysicsWorldIdsSet.delete(worldId);
            dataLength += kinematicSharedPhysicsWorldIdsSet.size * 4; // kinematicSharedPhysicsWorldIds
        }

        dataLength += 4; // rigidBodyCount

        const rigidBodies = metadata.rigidBodies;
        for (let i = 0; i < rigidBodies.length; ++i) {
            dataLength += 4 // boneIndex
                + 1 // collisionGroup
                + 1 // shapeType
                + 2 // collisionMask
                + 4 * 3 // shapeSize
                + 4 * 3 // shapePosition
                + 4 * 3 // shapeRotation
                + 4 // mass
                + 4 // linearDamping
                + 4 // angularDamping
                + 4 // repulsion
                + 4 // friction
                + 1 // physicsMode
                + 3; // padding
        }

        dataLength += 4; // jointCount

        const joints = metadata.joints;
        for (let i = 0; i < joints.length; ++i) {
            dataLength += 1 // type
                + 3 // padding
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

        return dataLength;
    }

    protected override _encodePhysics(serializer: MmdDataSerializer, metadata: Nullable<MmdModelMetadata>): void {
        if (metadata === null) {
            serializer.setUint8(0); // physicsInfoKind
            serializer.offset += 3; // padding
            return;
        }

        serializer.setUint8(2); // physicsInfoKind
        serializer.offset += 3; // padding

        let physicsWorldId = (this._encodePhysicsOptions as CreateMmdWasmModelPhysicsOptions).worldId;
        if (physicsWorldId === undefined) {
            physicsWorldId = this._physicsRuntime.nextWorldId;
            this._physicsRuntime.nextWorldId += 1;
        }
        serializer.setUint32(physicsWorldId); // physicsWorldId

        const kinematicSharedPhysicsWorldIds = (this._encodePhysicsOptions as CreateMmdWasmModelPhysicsOptions).kinematicSharedWorldIds;
        if (kinematicSharedPhysicsWorldIds === undefined) {
            serializer.setUint32(0); // kinematicSharedPhysicsWorldIdCount
        } else {
            const kinematicSharedPhysicsWorldIdsSet = new Set(kinematicSharedPhysicsWorldIds);
            kinematicSharedPhysicsWorldIdsSet.delete(physicsWorldId);

            serializer.setUint32(kinematicSharedPhysicsWorldIdsSet.size); // kinematicSharedPhysicsWorldIdCount
            for (const worldId of kinematicSharedPhysicsWorldIdsSet) {
                serializer.setUint32(worldId); // kinematicSharedPhysicsWorldIds
            }
        }

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
            serializer.setUint8(rigidBody.collisionGroup); // collisionGroup
            serializer.setUint8(rigidBody.shapeType); // shapeType
            serializer.setUint16(rigidBody.collisionMask); // collisionMask
            serializer.setFloat32Array(rigidBody.shapeSize); // shapeSize
            serializer.setFloat32Array(rigidBody.shapePosition); // shapePosition
            serializer.setFloat32Array(rigidBody.shapeRotation); // shapeRotation
            serializer.setFloat32(rigidBody.mass); // mass
            serializer.setFloat32(rigidBody.linearDamping); // linearDamping
            serializer.setFloat32(rigidBody.angularDamping); // angularDamping
            serializer.setFloat32(rigidBody.repulsion); // repulsion
            serializer.setFloat32(rigidBody.friction); // friction
            serializer.setUint8(rigidBody.physicsMode); // physicsMode
            serializer.offset += 3; // padding
        }

        const joints = metadata.joints;
        serializer.setUint32(joints.length); // jointCount
        for (let i = 0; i < joints.length; ++i) {
            const joint = joints[i];
            serializer.setUint8(joint.type); // type
            serializer.offset += 3; // padding
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
    }
}
