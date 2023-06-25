import { BezierCurve, type Bone, Quaternion, Space, Vector3 } from "@babylonjs/core";

import type { MmdAnimationTrack } from "@/libIndex";
import type { MmdModelAnimation } from "@/loader/animation/MmdAnimation";

import type { IIkSolver } from "../IkSolver";
import type { ILogger } from "../ILogger";
import type { RuntimeMmdMesh } from "../MmdMesh";
import type { MmdModel } from "../MmdModel";
import type { MmdMorphController } from "../MmdMorphController";

type MorphIndices = readonly number[];

export class MmdRuntimeModelAnimation {
    public readonly animation: MmdModelAnimation;

    private readonly _boneBindIndexMap: (Bone | null)[];
    private readonly _moveableBoneBindIndexMap: (Bone | null)[];
    private readonly _morphController: MmdMorphController;
    private readonly _morphBindIndexMap: (MorphIndices | null)[];
    private readonly _mesh: RuntimeMmdMesh;
    private readonly _ikSolverBindIndexMap: (IIkSolver | null)[];

    private constructor(
        animation: MmdModelAnimation,
        boneBindIndexMap: (Bone | null)[],
        moveableBoneBindIndexMap: (Bone | null)[],
        morphController: MmdMorphController,
        morphBindIndexMap: (MorphIndices | null)[],
        mesh: RuntimeMmdMesh,
        ikSolverBindIndexMap: (IIkSolver | null)[]
    ) {
        this.animation = animation;

        this._boneBindIndexMap = boneBindIndexMap;
        this._moveableBoneBindIndexMap = moveableBoneBindIndexMap;
        this._morphController = morphController;
        this._morphBindIndexMap = morphBindIndexMap;
        this._mesh = mesh;
        this._ikSolverBindIndexMap = ikSolverBindIndexMap;
    }

    private static readonly _BonePositionA = new Vector3();
    private static readonly _BonePositionB = new Vector3();
    private static readonly _BoneRotationA = new Quaternion();
    private static readonly _BoneRotationB = new Quaternion();

    public animate(frameTime: number): void {
        const animation = this.animation;

        const boneTracks = animation.boneTracks;
        if (0 < boneTracks.length) {
            const boneBindIndexMap = this._boneBindIndexMap;
            for (let i = 0; i < boneTracks.length; ++i) {
                const bone = boneBindIndexMap[i];
                if (bone === null) continue;

                const boneTrack = boneTracks[i];
                const clampedFrameTime = Math.max(boneTrack.startFrame, Math.min(boneTrack.endFrame, frameTime));
                const lowerBoundIndex = this._lowerBoundFrameIndex(clampedFrameTime, boneTrack);

                const frameNumberB = boneTrack.frameNumbers[lowerBoundIndex];
                if (frameNumberB === clampedFrameTime) {
                    const rotations = boneTrack.rotations;
                    bone.setRotationQuaternion(
                        MmdRuntimeModelAnimation._BoneRotationB.set(
                            rotations[lowerBoundIndex * 4],
                            rotations[lowerBoundIndex * 4 + 1],
                            rotations[lowerBoundIndex * 4 + 2],
                            rotations[lowerBoundIndex * 4 + 3]
                        ),
                        Space.LOCAL
                    );
                } else {
                    const frameNumberA = boneTrack.frameNumbers[lowerBoundIndex - 1];
                    const interpolateTime = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const rotations = boneTrack.rotations;
                    const rotationInterpolations = boneTrack.rotationInterpolations;

                    const rotationA = MmdRuntimeModelAnimation._BoneRotationA.set(
                        rotations[(lowerBoundIndex - 1) * 4],
                        rotations[(lowerBoundIndex - 1) * 4 + 1],
                        rotations[(lowerBoundIndex - 1) * 4 + 2],
                        rotations[(lowerBoundIndex - 1) * 4 + 3]
                    );
                    const rotationB = MmdRuntimeModelAnimation._BoneRotationB.set(
                        rotations[lowerBoundIndex * 4],
                        rotations[lowerBoundIndex * 4 + 1],
                        rotations[lowerBoundIndex * 4 + 2],
                        rotations[lowerBoundIndex * 4 + 3]
                    );

                    const weight = BezierCurve.Interpolate(
                        interpolateTime,
                        rotationInterpolations[lowerBoundIndex * 4] / 127, // x1
                        rotationInterpolations[lowerBoundIndex * 4 + 2] / 127, // y1
                        rotationInterpolations[lowerBoundIndex * 4 + 1] / 127, // x2
                        rotationInterpolations[lowerBoundIndex * 4 + 3] / 127 // y2
                    );

                    Quaternion.SlerpToRef(rotationA, rotationB, weight, rotationA);
                    bone.setRotationQuaternion(rotationA, Space.LOCAL);
                }
            }
        }

        const moveableBoneTracks = animation.moveableBoneTracks;
        if (0 < moveableBoneTracks.length) {
            const boneBindIndexMap = this._moveableBoneBindIndexMap;
            for (let i = 0; i < moveableBoneTracks.length; ++i) {
                const bone = boneBindIndexMap[i];
                if (bone === null) continue;

                const boneTrack = moveableBoneTracks[i];
                const clampedFrameTime = Math.max(boneTrack.startFrame, Math.min(boneTrack.endFrame, frameTime));
                const lowerBoundIndex = this._lowerBoundFrameIndex(clampedFrameTime, boneTrack);

                const frameNumberB = boneTrack.frameNumbers[lowerBoundIndex];
                if (frameNumberB === frameTime) {
                    const positions = boneTrack.positions;
                    bone.setPosition(
                        MmdRuntimeModelAnimation._BonePositionB.set(
                            positions[lowerBoundIndex * 3],
                            positions[lowerBoundIndex * 3 + 1],
                            positions[lowerBoundIndex * 3 + 2]
                        ),
                        Space.LOCAL
                    );

                    const rotations = boneTrack.rotations;
                    bone.setRotationQuaternion(
                        MmdRuntimeModelAnimation._BoneRotationB.set(
                            rotations[lowerBoundIndex * 4],
                            rotations[lowerBoundIndex * 4 + 1],
                            rotations[lowerBoundIndex * 4 + 2],
                            rotations[lowerBoundIndex * 4 + 3]
                        ),
                        Space.LOCAL
                    );
                } else {
                    const frameNumberA = boneTrack.frameNumbers[lowerBoundIndex - 1];
                    const interpolateTime = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const positions = boneTrack.positions;
                    const positionInterpolations = boneTrack.positionInterpolations;

                    const positionA = MmdRuntimeModelAnimation._BonePositionA.set(
                        positions[(lowerBoundIndex - 1) * 3],
                        positions[(lowerBoundIndex - 1) * 3 + 1],
                        positions[(lowerBoundIndex - 1) * 3 + 2]
                    );
                    const positionB = MmdRuntimeModelAnimation._BonePositionB.set(
                        positions[lowerBoundIndex * 3],
                        positions[lowerBoundIndex * 3 + 1],
                        positions[lowerBoundIndex * 3 + 2]
                    );

                    const xWeight = BezierCurve.Interpolate(
                        interpolateTime,
                        positionInterpolations[lowerBoundIndex * 12] / 127, // x_x1
                        positionInterpolations[lowerBoundIndex * 12 + 2] / 127, // x_y1
                        positionInterpolations[lowerBoundIndex * 12 + 1] / 127, // x_x2
                        positionInterpolations[lowerBoundIndex * 12 + 3] / 127 // x_y2
                    );
                    const yWeight = BezierCurve.Interpolate(
                        interpolateTime,
                        positionInterpolations[lowerBoundIndex * 12 + 4] / 127, // y_x1
                        positionInterpolations[lowerBoundIndex * 12 + 6] / 127, // y_y1
                        positionInterpolations[lowerBoundIndex * 12 + 5] / 127, // y_x2
                        positionInterpolations[lowerBoundIndex * 12 + 7] / 127 // y_y2
                    );
                    const zWeight = BezierCurve.Interpolate(
                        interpolateTime,
                        positionInterpolations[lowerBoundIndex * 12 + 8] / 127, // z_x1
                        positionInterpolations[lowerBoundIndex * 12 + 10] / 127, // z_y1
                        positionInterpolations[lowerBoundIndex * 12 + 9] / 127, // z_x2
                        positionInterpolations[lowerBoundIndex * 12 + 11] / 127 // z_y2
                    );

                    positionA.x = positionA.x + (positionB.x - positionA.x) * xWeight;
                    positionA.y = positionA.y + (positionB.y - positionA.y) * yWeight;
                    positionA.z = positionA.z + (positionB.z - positionA.z) * zWeight;
                    bone.setPosition(positionA, Space.LOCAL);

                    const rotations = boneTrack.rotations;
                    const rotationInterpolations = boneTrack.rotationInterpolations;

                    const rotationA = MmdRuntimeModelAnimation._BoneRotationA.set(
                        rotations[(lowerBoundIndex - 1) * 4],
                        rotations[(lowerBoundIndex - 1) * 4 + 1],
                        rotations[(lowerBoundIndex - 1) * 4 + 2],
                        rotations[(lowerBoundIndex - 1) * 4 + 3]
                    );
                    const rotationB = MmdRuntimeModelAnimation._BoneRotationB.set(
                        rotations[lowerBoundIndex * 4],
                        rotations[lowerBoundIndex * 4 + 1],
                        rotations[lowerBoundIndex * 4 + 2],
                        rotations[lowerBoundIndex * 4 + 3]
                    );

                    const weight = BezierCurve.Interpolate(
                        interpolateTime,
                        rotationInterpolations[lowerBoundIndex * 4] / 127, // x1
                        rotationInterpolations[lowerBoundIndex * 4 + 2] / 127, // y1
                        rotationInterpolations[lowerBoundIndex * 4 + 1] / 127, // x2
                        rotationInterpolations[lowerBoundIndex * 4 + 3] / 127 // y2
                    );

                    Quaternion.SlerpToRef(rotationA, rotationB, weight, rotationA);
                    bone.setRotationQuaternion(rotationA, Space.LOCAL);
                }
            }
        }

        const morphTracks = animation.morphTracks;
        if (0 < morphTracks.length) {
            const morphController = this._morphController;
            const morphBindIndexMap = this._morphBindIndexMap;
            for (let i = 0; i < morphTracks.length; ++i) {
                const morphIndices = morphBindIndexMap[i];
                if (morphIndices === null) continue;

                const morphTrack = morphTracks[i];

                const clampedFrameTime = Math.max(morphTrack.startFrame, Math.min(morphTrack.endFrame, frameTime));
                const lowerBoundIndex = this._lowerBoundFrameIndex(clampedFrameTime, morphTrack);

                const frameNumberB = morphTrack.frameNumbers[lowerBoundIndex];
                if (frameNumberB === clampedFrameTime) {
                    const weight = morphTrack.weights[lowerBoundIndex];
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], weight);
                    }
                } else {
                    const frameNumberA = morphTrack.frameNumbers[lowerBoundIndex - 1];
                    const relativeTime = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const weightA = morphTrack.weights[lowerBoundIndex - 1];
                    const weightB = morphTrack.weights[lowerBoundIndex];

                    const weight = weightA + (weightB - weightA) * relativeTime;
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], weight);
                    }
                }
            }
        }

        if (0 < animation.propertyTrack.frameNumbers.length) {
            const propertyTrack = animation.propertyTrack;

            const clampedFrameTime = Math.max(propertyTrack.startFrame, Math.min(propertyTrack.endFrame, frameTime));
            const lowerBoundIndex = this._lowerBoundFrameIndex(clampedFrameTime, propertyTrack);
            let stepIndex = lowerBoundIndex;
            if (propertyTrack.frameNumbers[lowerBoundIndex] !== clampedFrameTime) {
                stepIndex = lowerBoundIndex - 1;
            }

            this._mesh.visibility = propertyTrack.visibles[stepIndex];

            const ikSolverBindIndexMap = this._ikSolverBindIndexMap;
            const propertyTrackIkStates = propertyTrack.ikStates;
            for (let i = 0; i < ikSolverBindIndexMap.length; ++i) {
                const ikSolver = ikSolverBindIndexMap[i];
                if (ikSolver === null) continue;

                const ikState = propertyTrackIkStates[i];
                ikSolver.enabled = ikState[stepIndex] !== 0;
            }
        }
    }

    private _lowerBoundFrameIndex(frameTime: number, track: MmdAnimationTrack): number {
        const frameNumbers = track.frameNumbers;
        let low = 0;
        let high = frameNumbers.length;

        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (frameTime <= frameNumbers[mid]) high = mid;
            else low = mid + 1;
        }

        return low;
    }

    public static Create(animation: MmdModelAnimation, model: MmdModel, logger?: ILogger): MmdRuntimeModelAnimation {
        const skeleton = model.mesh.skeleton;
        const bones = skeleton.bones;

        const boneIndexMap = new Map<string, Bone>();
        for (let i = 0; i < bones.length; ++i) {
            boneIndexMap.set(bones[i].name, bones[i]);
        }

        const boneBindIndexMap: (Bone | null)[] = [];
        const boneTracks = animation.boneTracks;
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            const bone = boneIndexMap.get(boneTrack.name);
            if (bone === undefined) {
                logger?.warn(`Binding failed: bone ${boneTrack.name} not found`);
                boneBindIndexMap.push(null);
            } else {
                boneBindIndexMap.push(bone);
            }
        }

        const moveableBoneBindIndexMap: (Bone | null)[] = [];
        const moveableBoneTracks = animation.moveableBoneTracks;
        for (let i = 0; i < moveableBoneTracks.length; ++i) {
            const moveableBoneTrack = moveableBoneTracks[i];
            const bone = boneIndexMap.get(moveableBoneTrack.name);
            if (bone === undefined) {
                logger?.warn(`Binding failed: bone ${moveableBoneTrack.name} not found`);
                moveableBoneBindIndexMap.push(null);
            } else {
                moveableBoneBindIndexMap.push(bone);
            }
        }

        const morphController = model.morph;
        const morphBindIndexMap: (MorphIndices | null)[] = [];
        const morphTracks = animation.morphTracks;
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            const morphIndices = morphController.getMorphIndices(morphTrack.name);
            if (morphIndices === undefined) {
                logger?.warn(`Binding failed: morph ${morphTrack.name} not found`);
                morphBindIndexMap.push(null);
            } else {
                morphBindIndexMap.push(morphIndices);
            }
        }

        const runtimeBones = model.sortedRuntimeBones;
        const runtimeBoneIndexMap = new Map<string, number>();
        for (let i = 0; i < bones.length; ++i) {
            runtimeBoneIndexMap.set(runtimeBones[i].name, i);
        }

        const ikSolverBindIndexMap: (IIkSolver | null)[] = [];
        const propertyTrackIkBoneNames = animation.propertyTrack.ikBoneNames;
        for (let i = 0; i < propertyTrackIkBoneNames.length; ++i) {
            const ikBoneName = propertyTrackIkBoneNames[i];
            const ikBoneIndex = runtimeBoneIndexMap.get(ikBoneName);
            if (ikBoneIndex === undefined) {
                logger?.warn(`Binding failed: IK bone ${ikBoneName} not found`);
                ikSolverBindIndexMap.push(null);
            } else {
                const ikSolver = runtimeBones[ikBoneIndex].ikSolver;
                if (ikSolver === null) {
                    logger?.warn(`Binding failed: IK solver for bone ${ikBoneName} not found`);
                    ikSolverBindIndexMap.push(null);
                } else {
                    ikSolverBindIndexMap.push(ikSolver);
                }
            }
        }

        return new MmdRuntimeModelAnimation(
            animation,
            boneBindIndexMap,
            moveableBoneBindIndexMap,
            morphController,
            morphBindIndexMap,
            model.mesh,
            ikSolverBindIndexMap
        );
    }
}
