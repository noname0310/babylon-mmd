import type { Material } from "@babylonjs/core/Materials/material";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Nullable } from "@babylonjs/core/types";

import { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { ILogger } from "@/Loader/Parser/ILogger";

import type { IMmdModel } from "../IMmdModel";
import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { MmdMorphControllerBase } from "../mmdMorphControllerBase";
import { BezierInterpolator } from "./bezierInterpolator";
import { induceMmdStandardMaterialRecompile } from "./Common/induceMmdStandardMaterialRecompile";
import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimationWithBindingInfo } from "./IMmdRuntimeAnimation";
import { MmdRuntimeAnimation } from "./mmdRuntimeAnimation";

type MorphIndices = readonly number[];

/**
 * Mmd runtime model animation
 *
 * An object with mmd animation and model binding information
 */
export class MmdRuntimeModelAnimation extends MmdRuntimeAnimation<MmdAnimation> implements IMmdRuntimeModelAnimationWithBindingInfo {
    /**
     * The animation data
     */
    public readonly animation: MmdAnimation;

    /**
     * Bone bind index map
     */
    public readonly boneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[];

    /**
     * Movable bone bind index map
     */
    public readonly movableBoneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[];

    private readonly _morphController: MmdMorphControllerBase;

    /**
     * Morph bind index map
     */
    public readonly morphBindIndexMap: readonly Nullable<MorphIndices>[];

    private readonly _meshes: readonly Mesh[];

    /**
     * IK solver bind index map
     */
    public readonly ikSolverBindIndexMap: Int32Array;

    private readonly _ikSolverStates: Uint8Array;

    private _materialRecompileInduceInfo: Material[] | null;

    private constructor(
        animation: MmdAnimation,
        boneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[],
        movableBoneBindIndexMap: readonly Nullable<IMmdRuntimeLinkedBone>[],
        morphController: MmdMorphControllerBase,
        morphBindIndexMap: readonly Nullable<MorphIndices>[],
        meshes: readonly Mesh[],
        ikSolverBindIndexMap: Int32Array,
        ikSolverStates: Uint8Array,
        materialRecompileInduceInfo: Material[]
    ) {
        super();

        this.animation = animation;

        this.boneBindIndexMap = boneBindIndexMap;
        this.movableBoneBindIndexMap = movableBoneBindIndexMap;
        this._morphController = morphController;
        this.morphBindIndexMap = morphBindIndexMap;
        this._meshes = meshes;
        this.ikSolverBindIndexMap = ikSolverBindIndexMap;
        this._ikSolverStates = ikSolverStates;

        this._materialRecompileInduceInfo = materialRecompileInduceInfo;
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
            const boneBindIndexMap = this.boneBindIndexMap;
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

        const movableBoneTracks = animation.movableBoneTracks;
        if (0 < movableBoneTracks.length) {
            const boneBindIndexMap = this.movableBoneBindIndexMap;
            for (let i = 0; i < movableBoneTracks.length; ++i) {
                const bone = boneBindIndexMap[i];
                if (bone === null) continue;

                const boneTrack = movableBoneTracks[i];
                const clampedFrameTime = Math.max(boneTrack.startFrame, Math.min(boneTrack.endFrame, frameTime));
                const upperBoundIndex = this._upperBoundFrameIndex(clampedFrameTime, boneTrack);
                const upperBoundIndexMinusOne = upperBoundIndex - 1;

                const frameNumberB = boneTrack.frameNumbers[upperBoundIndex];
                if (frameNumberB === undefined) {
                    const positions = boneTrack.positions;
                    bone.getRestMatrix().getTranslationToRef(MmdRuntimeModelAnimation._BonePosition);
                    bone.position = MmdRuntimeModelAnimation._BonePosition.addInPlaceFromFloats(
                        positions[upperBoundIndexMinusOne * 3],
                        positions[upperBoundIndexMinusOne * 3 + 1],
                        positions[upperBoundIndexMinusOne * 3 + 2]
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
                    bone.position = MmdRuntimeModelAnimation._BonePosition.addInPlace(positionA);

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
            const morphBindIndexMap = this.morphBindIndexMap;
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

            const visibility = propertyTrack.visibles[stepIndex];
            const meshes = this._meshes;
            for (let i = 0; i < meshes.length; ++i) {
                meshes[i].visibility = visibility;
            }

            const ikSolverStates = this._ikSolverStates;
            const ikSolverBindIndexMap = this.ikSolverBindIndexMap;
            const propertyTrackIkStates = propertyTrack.ikStates;
            for (let i = 0; i < ikSolverBindIndexMap.length; ++i) {
                const ikSolverIndex = ikSolverBindIndexMap[i];
                if (ikSolverIndex === -1) continue;

                const ikState = propertyTrackIkStates[i];
                ikSolverStates[ikSolverIndex] = ikState[stepIndex];
            }
        }
    }

    /**
     * Induce material recompile
     *
     * This method must run once before the animation runs
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     * @param logger logger
     */
    public induceMaterialRecompile(logger?: ILogger): void {
        if (this._materialRecompileInduceInfo === null) return;

        MmdRuntimeModelAnimation.InduceMaterialRecompile(
            this._materialRecompileInduceInfo,
            this._morphController,
            this.morphBindIndexMap,
            logger
        );
        this._materialRecompileInduceInfo = null;
    }

    /**
     * Bind animation to model and prepare material for morph animation
     * @param animation Animation to bind
     * @param model Bind target
     * @param retargetingMap Model bone name to animation bone name map
     * @param logger Logger
     * @return MmdRuntimeModelAnimation instance
     */
    public static Create(animation: MmdAnimation, model: IMmdModel, retargetingMap?: { [key: string]: string }, logger?: ILogger): MmdRuntimeModelAnimation {
        const skeleton = model.skeleton;
        const bones = skeleton.bones;

        const boneIndexMap = new Map<string, number>();
        if (retargetingMap === undefined) {
            for (let i = 0; i < bones.length; ++i) {
                boneIndexMap.set(bones[i].name, i);
            }
        } else {
            for (let i = 0; i < bones.length; ++i) {
                boneIndexMap.set(retargetingMap[bones[i].name] ?? bones[i].name, i);
            }
        }

        const boneBindIndexMap: Nullable<IMmdRuntimeLinkedBone>[] = new Array(animation.boneTracks.length);
        const boneTracks = animation.boneTracks;
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            const boneIndex = boneIndexMap.get(boneTrack.name);
            if (boneIndex === undefined) {
                logger?.warn(`Binding failed: bone ${boneTrack.name} not found`);
                boneBindIndexMap[i] = null;
            } else {
                boneBindIndexMap[i] = bones[boneIndex];
            }
        }

        const movableBoneBindIndexMap: Nullable<IMmdRuntimeLinkedBone>[] = new Array(animation.movableBoneTracks.length);
        const movableBoneTracks = animation.movableBoneTracks;
        for (let i = 0; i < movableBoneTracks.length; ++i) {
            const movableBoneTrack = movableBoneTracks[i];
            const boneIndex = boneIndexMap.get(movableBoneTrack.name);
            if (boneIndex === undefined) {
                logger?.warn(`Binding failed: bone ${movableBoneTrack.name} not found`);
                movableBoneBindIndexMap[i] = null;
            } else {
                movableBoneBindIndexMap[i] = bones[boneIndex];
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

        const runtimeBones = model.runtimeBones;
        const ikSolverBindIndexMap = new Int32Array(animation.propertyTrack.ikBoneNames.length);
        const propertyTrackIkBoneNames = animation.propertyTrack.ikBoneNames;
        for (let i = 0; i < propertyTrackIkBoneNames.length; ++i) {
            const ikBoneName = propertyTrackIkBoneNames[i];
            const ikBoneIndex = boneIndexMap.get(ikBoneName);
            if (ikBoneIndex === undefined) {
                logger?.warn(`Binding failed: IK bone ${ikBoneName} not found`);
                ikSolverBindIndexMap[i] = -1;
            } else {
                const ikSolverIndex = runtimeBones[ikBoneIndex].ikSolverIndex;
                if (ikSolverIndex === -1) {
                    logger?.warn(`Binding failed: IK solver for bone ${ikBoneName} not found`);
                    ikSolverBindIndexMap[i] = -1;
                } else {
                    ikSolverBindIndexMap[i] = ikSolverIndex;
                }
            }
        }

        return new MmdRuntimeModelAnimation(
            animation,
            boneBindIndexMap,
            movableBoneBindIndexMap,
            morphController,
            morphBindIndexMap,
            model.mesh.metadata.meshes,
            ikSolverBindIndexMap,
            model.ikSolverStates,
            model.mesh.metadata.materials
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
        morphController: MmdMorphControllerBase,
        morphIndices: readonly Nullable<MorphIndices>[],
        logger?: ILogger
    ) => void = induceMmdStandardMaterialRecompile as (
        materials: Material[],
        morphController: MmdMorphControllerBase,
        morphIndices: readonly Nullable<MorphIndices>[],
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
    model: IMmdModel,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdRuntimeModelAnimation {
    return MmdRuntimeModelAnimation.Create(this, model, retargetingMap, logger);
};
