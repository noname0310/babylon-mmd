/**
 * BabylonVMD(BVMD) representation
 * prerequisite: frames are sorted by frameNumber
 * condition: padding is inserted between data for create zero-copy typed array
 *
 * signature: uint8[4] "BVMD"
 * version: int8[3] - major, minor, patch
 *
 * boneTrackCount: uint32
 * {
 *  trackName: uint32, uint8[] - length, string
 *  frameCount: uint32
 *  frameNumbers: uint32[frameCount]
 *  rotations: float32[frameCount * 4] - [..., x, y, z, w, ...]
 *  rotationInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 *  physicsToggle: uint8[frameCount] - [..., physicsTogle, ...]
 * }[boneTrackCount]
 *
 * movableBoneTrackCount: uint32
 * {
 *  trackName: uint32, uint8[] - length, string
 *  frameCount: uint32
 *  frameNumbers: uint32[frameCount]
 *  positions: float32[frameCount * 3] - [..., x, y, z, ...]
 *  positionInterpolations: uint8[frameCount * 12] - [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]
 *  rotations: float32[frameCount * 4] - [..., x, y, z, w, ...]
 *  rotationInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 *  physicsToggle: uint8[frameCount] - [..., physicsTogle, ...]
 * }[movableBoneTrackCount]
 *
 * morphTrackCount: uint32
 * {
 *  trackName: uint32, uint8[] - length, string
 *  frameCount: uint32
 *  frameNumbers: uint32[frameCount]
 *  weights: float32[frameCount] - [..., weight, ...]
 * }[morphTrackCount]
 *
 * propertyFrameCount: uint32
 * ikBoneNameCount: uint32
 * frameNumbers: uint32[frameCount]
 * visibles: uint8[frameCount] - [..., visible, ...]
 * {
 *  ikBoneName: uint32 - uint8[] - length, string
 *  ikState: uint8[frameCount] - [..., ikState, ...]
 * }[ikBoneNameCount]
 *
 * cameraFrameCount: uint32
 * frameNumbers: uint32[frameCount]
 * positions: float32[frameCount * 3] - [..., x, y, z, ...]
 * positionInterpolations: uint8[frameCount * 12] - [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]
 * rotations: float32[frameCount * 3] - [..., x, y, z, ...]
 * rotationInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 * distances: float32[frameCount] - [..., distance, ...]
 * distanceInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 * fovs: float32[frameCount] - [..., fov, ...]
 * fovInterpolations: uint8[frameCount * 4] - [..., x1, x2, y1, y2, ...]
 */

import type { MmdAnimationBase } from "../Animation/mmdAnimationBase";
import { MmdDataSerializer } from "./mmdDataSerializer";

/**
 * BVMD converter
 */
export class BvmdConverter {
    private constructor() { /* block constructor */ }

    /**
     * Convert mmd animation to BVMD
     * @param animation mmd animation from VMD/BVMD
     * @returns converted BVMD
     */
    public static Convert(animation: MmdAnimationBase): ArrayBuffer {
        const encoder = new TextEncoder();

        let dataLength =
            4 + // signature
            3; // version

        { // compute dataLength
            dataLength += 4; // boneTrackCount
            const boneTrackCount = animation.boneTracks.length;
            for (let i = 0; i < boneTrackCount; ++i) {
                const boneTrack = animation.boneTracks[i];

                const trackNameBytes = encoder.encode(boneTrack.name);
                dataLength += 4 + trackNameBytes.length; // trackName
                dataLength += 4; // frameCount
                dataLength += 4 * boneTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // frameNumbers
                dataLength += 4 * 4 * boneTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // rotations
                dataLength += 1 * 4 * boneTrack.frameNumbers.length; // rotationInterpolations
                dataLength += 1 * boneTrack.frameNumbers.length; // physicsToggles
            }

            dataLength += 4; // movableBoneTrackCount
            const movableBoneTrackCount = animation.movableBoneTracks.length;
            for (let i = 0; i < movableBoneTrackCount; ++i) {
                const movableBoneTrack = animation.movableBoneTracks[i];

                const trackNameBytes = encoder.encode(movableBoneTrack.name);
                dataLength += 4 + trackNameBytes.length; // trackName
                dataLength += 4; // frameCount
                dataLength += 4 * movableBoneTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // frameNumbers
                dataLength += 4 * 3 * movableBoneTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // positions
                dataLength += 1 * 12 * movableBoneTrack.frameNumbers.length; // positionInterpolations
                dataLength += 4 * 4 * movableBoneTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // rotations
                dataLength += 1 * 4 * movableBoneTrack.frameNumbers.length; // rotationInterpolations
                dataLength += 1 * movableBoneTrack.frameNumbers.length; // physicsToggles
            }

            dataLength += 4; // morphTrackCount
            const morphTrackCount = animation.morphTracks.length;
            for (let i = 0; i < morphTrackCount; ++i) {
                const morphTrack = animation.morphTracks[i];

                const trackNameBytes = encoder.encode(morphTrack.name);
                dataLength += 4 + trackNameBytes.length; // trackName
                dataLength += 4; // frameCount
                dataLength += 4 * morphTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // frameNumbers
                dataLength += 4 * morphTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // weights
            }

            dataLength += 4; // property frameCount
            dataLength += 4 * animation.propertyTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // frameNumbers
            dataLength += 1 * animation.propertyTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // visibles
            dataLength += 4; // ikBoneNameCount
            const ikBoneNameCount = animation.propertyTrack.ikBoneNames.length;
            for (let i = 0; i < ikBoneNameCount; ++i) {
                const ikBoneName = animation.propertyTrack.ikBoneNames[i];

                const ikBoneNameBytes = encoder.encode(ikBoneName);
                dataLength += 4 + ikBoneNameBytes.length; // ikBoneName
            }
            dataLength += 1 * ikBoneNameCount * animation.propertyTrack.frameNumbers.length; // ikStates

            dataLength += 4; // camera frameCount
            dataLength += 4 * animation.cameraTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // frameNumbers
            dataLength += 4 * 3 * animation.cameraTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // positions
            dataLength += 1 * 12 * animation.cameraTrack.frameNumbers.length; // positionInterpolations
            dataLength += 4 * 3 * animation.cameraTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // rotations
            dataLength += 1 * 4 * animation.cameraTrack.frameNumbers.length; // rotationInterpolations
            dataLength += 4 * animation.cameraTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // distances
            dataLength += 1 * 4 * animation.cameraTrack.frameNumbers.length; // distanceInterpolations
            dataLength += 4 * animation.cameraTrack.frameNumbers.length + MmdDataSerializer.Padding(dataLength, 4); // fovs
            dataLength += 1 * 4 * animation.cameraTrack.frameNumbers.length; // fovInterpolations
        }

        const data = new ArrayBuffer(dataLength);
        const serializer = new MmdDataSerializer(data);

        serializer.setUint8Array(encoder.encode("BVMD")); // signature
        serializer.setInt8Array([2, 1, 0]); // version

        const boneTracks = animation.boneTracks;
        serializer.setUint32(boneTracks.length); // boneTrackCount
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];

            serializer.setString(boneTrack.name); // trackName
            serializer.setUint32(boneTrack.frameNumbers.length); // frameCount

            serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
            serializer.setUint32Array(boneTrack.frameNumbers); // frameNumbers

            serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
            serializer.setFloat32Array(boneTrack.rotations); // rotations

            serializer.setUint8Array(boneTrack.rotationInterpolations); // rotationInterpolations

            serializer.setUint8Array(boneTrack.physicsToggles); // physicsToggles
        }

        const movableBoneTracks = animation.movableBoneTracks;
        serializer.setUint32(movableBoneTracks.length); // movableBoneTrackCount
        for (let i = 0; i < movableBoneTracks.length; ++i) {
            const movableBoneTrack = movableBoneTracks[i];

            serializer.setString(movableBoneTrack.name); // trackName
            serializer.setUint32(movableBoneTrack.frameNumbers.length); // frameCount

            serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
            serializer.setUint32Array(movableBoneTrack.frameNumbers); // frameNumbers

            serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
            serializer.setFloat32Array(movableBoneTrack.positions); // positions

            serializer.setUint8Array(movableBoneTrack.positionInterpolations); // positionInterpolations

            serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
            serializer.setFloat32Array(movableBoneTrack.rotations); // rotations

            serializer.setUint8Array(movableBoneTrack.rotationInterpolations); // rotationInterpolations

            serializer.setUint8Array(movableBoneTrack.physicsToggles); // physicsToggles
        }

        const morphTracks = animation.morphTracks;
        serializer.setUint32(morphTracks.length); // morphTrackCount
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];

            serializer.setString(morphTrack.name); // trackName
            serializer.setUint32(morphTrack.frameNumbers.length); // frameCount

            serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
            serializer.setUint32Array(morphTrack.frameNumbers); // frameNumbers

            serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
            serializer.setFloat32Array(morphTrack.weights); // weights
        }

        serializer.setUint32(animation.propertyTrack.frameNumbers.length); // propertyFrameCount
        serializer.setUint32(animation.propertyTrack.ikBoneNames.length); // ikBoneNameCount

        serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
        serializer.setUint32Array(animation.propertyTrack.frameNumbers); // frameNumbers

        serializer.setUint8Array(animation.propertyTrack.visibles); // visibles
        const ikBoneNames = animation.propertyTrack.ikBoneNames;
        for (let i = 0; i < ikBoneNames.length; ++i) {
            const ikBoneName = ikBoneNames[i];

            serializer.setString(ikBoneName); // ikBoneName

            serializer.setUint8Array(animation.propertyTrack.getIkState(i)); // ikStates
        }

        serializer.setUint32(animation.cameraTrack.frameNumbers.length); // cameraFrameCount

        serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
        serializer.setUint32Array(animation.cameraTrack.frameNumbers); // frameNumbers

        serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
        serializer.setFloat32Array(animation.cameraTrack.positions); // positions

        serializer.setUint8Array(animation.cameraTrack.positionInterpolations); // positionInterpolations

        serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
        serializer.setFloat32Array(animation.cameraTrack.rotations); // rotations

        serializer.setUint8Array(animation.cameraTrack.rotationInterpolations); // rotationInterpolations

        serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
        serializer.setFloat32Array(animation.cameraTrack.distances); // distances

        serializer.setUint8Array(animation.cameraTrack.distanceInterpolations); // distanceInterpolations

        serializer.offset += MmdDataSerializer.Padding(serializer.offset, 4); // padding
        serializer.setFloat32Array(animation.cameraTrack.fovs); // fovs

        serializer.setUint8Array(animation.cameraTrack.fovInterpolations); // fovInterpolations

        return data;
    }
}
