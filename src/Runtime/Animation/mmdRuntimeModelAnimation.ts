import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Material } from "@babylonjs/core/Materials/material";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { ILogger } from "@/Loader/Parser/ILogger";

import type { IIkSolver } from "../ikSolver";
import type { RuntimeMmdMesh } from "../mmdMesh";
import type { MmdModel } from "../mmdModel";
import type { MmdMorphController } from "../mmdMorphController";
import { BezierInterpolator } from "./bezierInterpolator";
import { induceMmdStandardMaterialRecompile } from "./Common/induceMmdStandardMaterialRecompile";
import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "./IMmdRuntimeAnimation";
import { MmdRuntimeAnimation } from "./mmdRuntimeAnimation";

type MorphIndices = readonly number[];

/**
 * Mmd runtime model animation
 *
 * An object with mmd animation and model binding information
 */
export class MmdRuntimeModelAnimation extends MmdRuntimeAnimation<MmdAnimation> implements IMmdRuntimeModelAnimation {
    /**
     * The animation data
     */
    public readonly animation: MmdAnimation;

    private readonly _boneBindIndexMap: Nullable<Bone>[];
    private readonly _moveableBoneBindIndexMap: Nullable<Bone>[];
    private readonly _morphController: MmdMorphController;
    private readonly _morphBindIndexMap: Nullable<MorphIndices>[];
    private readonly _mesh: RuntimeMmdMesh;
    private readonly _ikSolverBindIndexMap: Nullable<IIkSolver>[];

    private constructor(
        animation: MmdAnimation,
        boneBindIndexMap: Nullable<Bone>[],
        moveableBoneBindIndexMap: Nullable<Bone>[],
        morphController: MmdMorphController,
        morphBindIndexMap: Nullable<MorphIndices>[],
        mesh: RuntimeMmdMesh,
        ikSolverBindIndexMap: Nullable<IIkSolver>[]
    ) {
        super();

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
    private static readonly _BonePosition = new Vector3();
    private static readonly _BoneRotationA = new Quaternion();
    private static readonly _BoneRotationB = new Quaternion();
    // private static readonly _BoneRotation = new Quaternion();

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
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
                const upperBoundIndex = this._upperBoundFrameIndex(clampedFrameTime, boneTrack);
                const upperBoundIndexMinusOne = upperBoundIndex - 1;

                const frameNumberB = boneTrack.frameNumbers[upperBoundIndex];
                if (frameNumberB === undefined) {
                    const rotations = boneTrack.rotations;
                    // Since mmd bones all have identity quaternions, we abandon the compatibility for skeletons that don't and improve performance

                    // Quaternion.FromRotationMatrixToRef(bone.getRestMatrix(), MmdRuntimeModelAnimation._BoneRotation);
                    // bone.setRotationQuaternion(
                    //     MmdRuntimeModelAnimation._BoneRotation.multiplyInPlace(
                    //         MmdRuntimeModelAnimation._BoneRotationB.set(
                    //             rotations[upperBoundIndexMinusOne * 4],
                    //             rotations[upperBoundIndexMinusOne * 4 + 1],
                    //             rotations[upperBoundIndexMinusOne * 4 + 2],
                    //             rotations[upperBoundIndexMinusOne * 4 + 3]
                    //         )
                    //     ),
                    //     Space.LOCAL
                    // );

                    bone.setRotationQuaternion(
                        MmdRuntimeModelAnimation._BoneRotationB.set(
                            rotations[upperBoundIndexMinusOne * 4],
                            rotations[upperBoundIndexMinusOne * 4 + 1],
                            rotations[upperBoundIndexMinusOne * 4 + 2],
                            rotations[upperBoundIndexMinusOne * 4 + 3]
                        ),
                        Space.LOCAL
                    );
                } else {
                    const frameNumberA = boneTrack.frameNumbers[upperBoundIndexMinusOne];
                    const gradient = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const rotations = boneTrack.rotations;
                    const rotationInterpolations = boneTrack.rotationInterpolations;

                    const rotationA = MmdRuntimeModelAnimation._BoneRotationA.set(
                        rotations[upperBoundIndexMinusOne * 4],
                        rotations[upperBoundIndexMinusOne * 4 + 1],
                        rotations[upperBoundIndexMinusOne * 4 + 2],
                        rotations[upperBoundIndexMinusOne * 4 + 3]
                    );
                    const rotationB = MmdRuntimeModelAnimation._BoneRotationB.set(
                        rotations[upperBoundIndex * 4],
                        rotations[upperBoundIndex * 4 + 1],
                        rotations[upperBoundIndex * 4 + 2],
                        rotations[upperBoundIndex * 4 + 3]
                    );

                    const weight = BezierInterpolator.Interpolate(
                        rotationInterpolations[upperBoundIndex * 4] / 127, // x1
                        rotationInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                        rotationInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                        rotationInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                        gradient
                    );

                    Quaternion.SlerpToRef(rotationA, rotationB, weight, rotationA);

                    // Quaternion.FromRotationMatrixToRef(bone.getRestMatrix(), MmdRuntimeModelAnimation._BoneRotation);
                    // bone.setRotationQuaternion(
                    //     MmdRuntimeModelAnimation._BoneRotation.multiplyInPlace(rotationA),
                    //     Space.LOCAL
                    // );
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
                const upperBoundIndex = this._upperBoundFrameIndex(clampedFrameTime, boneTrack);
                const upperBoundIndexMinusOne = upperBoundIndex - 1;

                const frameNumberB = boneTrack.frameNumbers[upperBoundIndex];
                if (frameNumberB === undefined) {
                    const positions = boneTrack.positions;
                    bone.getRestMatrix().getTranslationToRef(MmdRuntimeModelAnimation._BonePosition);
                    bone.setPosition(
                        MmdRuntimeModelAnimation._BonePosition.addInPlaceFromFloats(
                            positions[upperBoundIndexMinusOne * 3],
                            positions[upperBoundIndexMinusOne * 3 + 1],
                            positions[upperBoundIndexMinusOne * 3 + 2]
                        ),
                        Space.LOCAL
                    );

                    const rotations = boneTrack.rotations;

                    // Quaternion.FromRotationMatrixToRef(bone.getRestMatrix(), MmdRuntimeModelAnimation._BoneRotation);
                    // bone.setRotationQuaternion(
                    //     MmdRuntimeModelAnimation._BoneRotation.multiplyInPlace(
                    //         MmdRuntimeModelAnimation._BoneRotationB.set(
                    //             rotations[upperBoundIndexMinusOne * 4],
                    //             rotations[upperBoundIndexMinusOne * 4 + 1],
                    //             rotations[upperBoundIndexMinusOne * 4 + 2],
                    //             rotations[upperBoundIndexMinusOne * 4 + 3]
                    //         )
                    //     ),
                    //     Space.LOCAL
                    // );

                    bone.setRotationQuaternion(
                        MmdRuntimeModelAnimation._BoneRotationB.set(
                            rotations[upperBoundIndexMinusOne * 4],
                            rotations[upperBoundIndexMinusOne * 4 + 1],
                            rotations[upperBoundIndexMinusOne * 4 + 2],
                            rotations[upperBoundIndexMinusOne * 4 + 3]
                        ),
                        Space.LOCAL
                    );
                } else {
                    const frameNumberA = boneTrack.frameNumbers[upperBoundIndexMinusOne];
                    const gradient = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const positions = boneTrack.positions;
                    const positionInterpolations = boneTrack.positionInterpolations;

                    const positionA = MmdRuntimeModelAnimation._BonePositionA.set(
                        positions[upperBoundIndexMinusOne * 3],
                        positions[upperBoundIndexMinusOne * 3 + 1],
                        positions[upperBoundIndexMinusOne * 3 + 2]
                    );
                    const positionB = MmdRuntimeModelAnimation._BonePositionB.set(
                        positions[upperBoundIndex * 3],
                        positions[upperBoundIndex * 3 + 1],
                        positions[upperBoundIndex * 3 + 2]
                    );

                    const xWeight = BezierInterpolator.Interpolate(
                        positionInterpolations[upperBoundIndex * 12] / 127, // x_x1
                        positionInterpolations[upperBoundIndex * 12 + 1] / 127, // x_x2
                        positionInterpolations[upperBoundIndex * 12 + 2] / 127, // x_y1
                        positionInterpolations[upperBoundIndex * 12 + 3] / 127, // x_y2
                        gradient
                    );
                    const yWeight = BezierInterpolator.Interpolate(
                        positionInterpolations[upperBoundIndex * 12 + 4] / 127, // y_x1
                        positionInterpolations[upperBoundIndex * 12 + 5] / 127, // y_x2
                        positionInterpolations[upperBoundIndex * 12 + 6] / 127, // y_y1
                        positionInterpolations[upperBoundIndex * 12 + 7] / 127, // y_y2
                        gradient
                    );
                    const zWeight = BezierInterpolator.Interpolate(
                        positionInterpolations[upperBoundIndex * 12 + 8] / 127, // z_x1
                        positionInterpolations[upperBoundIndex * 12 + 9] / 127, // z_x2
                        positionInterpolations[upperBoundIndex * 12 + 10] / 127, // z_y1
                        positionInterpolations[upperBoundIndex * 12 + 11] / 127, // z_y2
                        gradient
                    );

                    positionA.x += (positionB.x - positionA.x) * xWeight;
                    positionA.y += (positionB.y - positionA.y) * yWeight;
                    positionA.z += (positionB.z - positionA.z) * zWeight;
                    bone.getRestMatrix().getTranslationToRef(MmdRuntimeModelAnimation._BonePosition);
                    bone.setPosition(MmdRuntimeModelAnimation._BonePosition.addInPlace(positionA), Space.LOCAL);

                    const rotations = boneTrack.rotations;
                    const rotationInterpolations = boneTrack.rotationInterpolations;

                    const rotationA = MmdRuntimeModelAnimation._BoneRotationA.set(
                        rotations[upperBoundIndexMinusOne * 4],
                        rotations[upperBoundIndexMinusOne * 4 + 1],
                        rotations[upperBoundIndexMinusOne * 4 + 2],
                        rotations[upperBoundIndexMinusOne * 4 + 3]
                    );
                    const rotationB = MmdRuntimeModelAnimation._BoneRotationB.set(
                        rotations[upperBoundIndex * 4],
                        rotations[upperBoundIndex * 4 + 1],
                        rotations[upperBoundIndex * 4 + 2],
                        rotations[upperBoundIndex * 4 + 3]
                    );

                    const weight = BezierInterpolator.Interpolate(
                        rotationInterpolations[upperBoundIndex * 4] / 127, // x1
                        rotationInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                        rotationInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                        rotationInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                        gradient
                    );

                    Quaternion.SlerpToRef(rotationA, rotationB, weight, rotationA);
                    // Quaternion.FromRotationMatrixToRef(bone.getRestMatrix(), MmdRuntimeModelAnimation._BoneRotation);
                    // bone.setRotationQuaternion(
                    //     MmdRuntimeModelAnimation._BoneRotation.multiplyInPlace(rotationA),
                    //     Space.LOCAL
                    // );
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
                const upperBoundIndex = this._upperBoundFrameIndex(clampedFrameTime, morphTrack);
                const upperBoundIndexMinusOne = upperBoundIndex - 1;

                const frameNumberB = morphTrack.frameNumbers[upperBoundIndex];
                if (frameNumberB === undefined) {
                    // this clamp will be removed when morph target recompilation problem is solved
                    // ref: https://github.com/BabylonJS/Babylon.js/issues/14008
                    const weight = Math.max(morphTrack.weights[upperBoundIndexMinusOne], 1e-16);
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], weight);
                    }
                } else {
                    const frameNumberA = morphTrack.frameNumbers[upperBoundIndexMinusOne];
                    const relativeTime = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const weightA = morphTrack.weights[upperBoundIndexMinusOne];
                    const weightB = morphTrack.weights[upperBoundIndex];

                    // this clamp will be removed when morph target recompilation problem is solved
                    // ref: https://github.com/BabylonJS/Babylon.js/issues/14008
                    const weight = Math.max(weightA + (weightB - weightA) * relativeTime, 1e-16);
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], weight);
                    }
                }
            }
        }

        if (0 < animation.propertyTrack.frameNumbers.length) {
            const propertyTrack = animation.propertyTrack;

            const clampedFrameTime = Math.max(propertyTrack.startFrame, Math.min(propertyTrack.endFrame, frameTime));
            const stepIndex = this._upperBoundFrameIndex(clampedFrameTime, propertyTrack) - 1;

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

    private _materialRecompileInduced = false;

    /**
     * Induce material recompile
     *
     * This method must run once before the animation runs
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     * @param logger logger
     */
    public induceMaterialRecompile(logger?: ILogger): void {
        if (this._materialRecompileInduced) return;
        this._materialRecompileInduced = true;

        MmdRuntimeModelAnimation.InduceMaterialRecompile(
            this._mesh.material.subMaterials,
            this._morphController,
            this._morphBindIndexMap,
            logger
        );
    }

    /**
     * Bind animation to model and prepare material for morph animation
     * @param animation Animation to bind
     * @param model Bind target
     * @param retargetingMap Model bone name to animation bone name map
     * @param logger Logger
     * @return MmdRuntimeModelAnimation instance
     */
    public static Create(animation: MmdAnimation, model: MmdModel, retargetingMap?: { [key: string]: string }, logger?: ILogger): MmdRuntimeModelAnimation {
        const skeleton = model.mesh.skeleton;
        const bones = skeleton.bones;

        const boneIndexMap = new Map<string, Bone>();
        if (retargetingMap === undefined) {
            for (let i = 0; i < bones.length; ++i) {
                boneIndexMap.set(bones[i].name, bones[i]);
            }
        } else {
            for (let i = 0; i < bones.length; ++i) {
                boneIndexMap.set(retargetingMap[bones[i].name] ?? bones[i].name, bones[i]);
            }
        }

        const boneBindIndexMap: Nullable<Bone>[] = new Array(animation.boneTracks.length);
        const boneTracks = animation.boneTracks;
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            const bone = boneIndexMap.get(boneTrack.name);
            if (bone === undefined) {
                logger?.warn(`Binding failed: bone ${boneTrack.name} not found`);
                boneBindIndexMap[i] = null;
            } else {
                boneBindIndexMap[i] = bone;
            }
        }

        const moveableBoneBindIndexMap: Nullable<Bone>[] = new Array(animation.moveableBoneTracks.length);
        const moveableBoneTracks = animation.moveableBoneTracks;
        for (let i = 0; i < moveableBoneTracks.length; ++i) {
            const moveableBoneTrack = moveableBoneTracks[i];
            const bone = boneIndexMap.get(moveableBoneTrack.name);
            if (bone === undefined) {
                logger?.warn(`Binding failed: bone ${moveableBoneTrack.name} not found`);
                moveableBoneBindIndexMap[i] = null;
            } else {
                moveableBoneBindIndexMap[i] = bone;
            }
        }

        const morphController = model.morph;
        const morphBindIndexMap: Nullable<MorphIndices>[] = new Array(animation.morphTracks.length);
        const morphTracks = animation.morphTracks;
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            const mappedName = retargetingMap?.[morphTrack.name] ?? morphTrack.name;
            const morphIndices = morphController.getMorphIndices(mappedName);
            if (morphIndices === undefined) {
                logger?.warn(`Binding failed: morph ${mappedName} not found`);
                morphBindIndexMap[i] = null;
            } else {
                morphBindIndexMap[i] = morphIndices;
            }
        }

        const runtimeBones = model.sortedRuntimeBones;
        const runtimeBoneIndexMap = new Map<string, number>();
        if (retargetingMap === undefined) {
            for (let i = 0; i < bones.length; ++i) {
                runtimeBoneIndexMap.set(runtimeBones[i].name, i);
            }
        } else {
            for (let i = 0; i < bones.length; ++i) {
                runtimeBoneIndexMap.set(retargetingMap[runtimeBones[i].name] ?? runtimeBones[i].name, i);
            }
        }

        const ikSolverBindIndexMap: Nullable<IIkSolver>[] = new Array(animation.propertyTrack.ikBoneNames.length);
        const propertyTrackIkBoneNames = animation.propertyTrack.ikBoneNames;
        for (let i = 0; i < propertyTrackIkBoneNames.length; ++i) {
            const ikBoneName = propertyTrackIkBoneNames[i];
            const ikBoneIndex = runtimeBoneIndexMap.get(ikBoneName);
            if (ikBoneIndex === undefined) {
                logger?.warn(`Binding failed: IK bone ${ikBoneName} not found`);
                ikSolverBindIndexMap[i] = null;
            } else {
                const ikSolver = runtimeBones[ikBoneIndex].ikSolver;
                if (ikSolver === null) {
                    logger?.warn(`Binding failed: IK solver for bone ${ikBoneName} not found`);
                    ikSolverBindIndexMap[i] = null;
                } else {
                    ikSolverBindIndexMap[i] = ikSolver;
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

    /**
     * Induce material recompile
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     *
     * This method is exposed as public because it must be overrideable
     *
     * If you are using a material other than `MmdStandardMaterial`, you must implement this method yourself
     * @param materials Materials
     * @param morphController Morph controller
     * @param morphIndices Morph indices to induce recompile
     * @param logger logger
     */
    public static InduceMaterialRecompile: (
        materials: Material[],
        morphController: MmdMorphController,
        morphIndices: Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void = induceMmdStandardMaterialRecompile as (
        materials: Material[],
        morphController: MmdMorphController,
        morphIndices: Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void;
}

declare module "../../Loader/Animation/mmdAnimation" {
    export interface MmdAnimation extends IMmdBindableModelAnimation<MmdRuntimeModelAnimation> { }
}

/**
 * Create runtime model animation
 * @param model Bind target
 * @param retargetingMap Model bone name to animation bone name map
 * @param logger Logger
 * @returns MmdRuntimeModelAnimation instance
 */
MmdAnimation.prototype.createRuntimeModelAnimation = function(
    model: MmdModel,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdRuntimeModelAnimation {
    return MmdRuntimeModelAnimation.Create(this, model, retargetingMap, logger);
};
