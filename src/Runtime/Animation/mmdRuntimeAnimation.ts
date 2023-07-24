import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Material } from "@babylonjs/core/Materials/material";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdAnimationTrack, MmdCameraAnimationTrack } from "@/Loader/Animation/mmdAnimationTrack";
import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { IIkSolver } from "../ikSolver";
import type { ILogger } from "../ILogger";
import type { MmdCamera } from "../mmdCamera";
import type { RuntimeMmdMesh } from "../mmdMesh";
import type { MmdModel } from "../mmdModel";
import type { MmdMorphController } from "../mmdMorphController";

type MorphIndices = readonly number[];

/**
 * Mmd runtime animation base class
 */
export abstract class MmdRuntimeAnimation {
    private readonly _lastResults = new Map<MmdAnimationTrack, [number, number]>(); // [frameTime, frameIndex]

    /**
     * find frame index B to interpolate between frame A and frame B
     *
     * frame time must be clamped to [startFrame, endFrame]
     *
     * @param frameTime frame time in 30fps
     * @param track animation track
     * @returns
     */
    protected _upperBoundFrameIndex(frameTime: number, track: MmdAnimationTrack): number {
        const frameNumbers = track.frameNumbers;

        let lastResult = this._lastResults.get(track);
        if (lastResult === undefined) {
            lastResult = [Number.NEGATIVE_INFINITY, 0];
            this._lastResults.set(track, lastResult);
        }

        const diff = frameTime - lastResult[0];

        if (Math.abs(diff) < 6) { // if frame time is close to last frame time, use iterative search
            let frameIndex = lastResult[1];
            while (0 < frameIndex && frameTime < frameNumbers[frameIndex - 1]) frameIndex -= 1;
            while (frameIndex < frameNumbers.length && frameNumbers[frameIndex] <= frameTime) frameIndex += 1;

            lastResult[0] = frameTime;
            lastResult[1] = frameIndex;

            return frameIndex;
        } else { // if frame time is far from last frame time, use binary search
            let low = 0;
            let high = frameNumbers.length;

            while (low < high) {
                const mid = low + ((high - low) >> 1);
                if (frameTime < frameNumbers[mid]) high = mid;
                else low = mid + 1;
            }

            lastResult[0] = frameTime;
            lastResult[1] = low;

            return low;
        }
    }
}

/**
 * Mmd runtime model animation
 *
 * An object with mmd animation and model binding information
 */
export class MmdRuntimeModelAnimation extends MmdRuntimeAnimation {
    /**
     * Mmd animation
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
    private static readonly _BoneOriginalPosition = new Vector3();
    private static readonly _BoneRotationA = new Quaternion();
    private static readonly _BoneRotationB = new Quaternion();
    private static readonly _BoneOriginalRotation = new Quaternion();

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
                    bone.getRotationQuaternionToRef(Space.LOCAL, null, MmdRuntimeModelAnimation._BoneOriginalRotation);
                    bone.setRotationQuaternion(
                        MmdRuntimeModelAnimation._BoneOriginalRotation.multiply(
                            MmdRuntimeModelAnimation._BoneRotationB.set(
                                rotations[upperBoundIndexMinusOne * 4],
                                rotations[upperBoundIndexMinusOne * 4 + 1],
                                rotations[upperBoundIndexMinusOne * 4 + 2],
                                rotations[upperBoundIndexMinusOne * 4 + 3]
                            )
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

                    const weight = MmdInterpolator.Interpolate(
                        rotationInterpolations[upperBoundIndex * 4] / 127, // x1
                        rotationInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                        rotationInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                        rotationInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                        gradient
                    );

                    Quaternion.SlerpToRef(rotationA, rotationB, weight, rotationA);
                    bone.getRotationQuaternionToRef(Space.LOCAL, null, MmdRuntimeModelAnimation._BoneOriginalRotation);
                    bone.setRotationQuaternion(
                        MmdRuntimeModelAnimation._BoneOriginalRotation.multiply(rotationA),
                        Space.LOCAL
                    );
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
                    bone.getPositionToRef(Space.LOCAL, null, MmdRuntimeModelAnimation._BoneOriginalPosition);
                    bone.setPosition(
                        MmdRuntimeModelAnimation._BoneOriginalPosition.add(
                            MmdRuntimeModelAnimation._BonePositionB.set(
                                positions[upperBoundIndexMinusOne * 3],
                                positions[upperBoundIndexMinusOne * 3 + 1],
                                positions[upperBoundIndexMinusOne * 3 + 2]
                            )
                        ),
                        Space.LOCAL
                    );

                    const rotations = boneTrack.rotations;
                    bone.getRotationQuaternionToRef(Space.LOCAL, null, MmdRuntimeModelAnimation._BoneOriginalRotation);
                    bone.setRotationQuaternion(
                        MmdRuntimeModelAnimation._BoneOriginalRotation.multiply(
                            MmdRuntimeModelAnimation._BoneRotationB.set(
                                rotations[upperBoundIndexMinusOne * 4],
                                rotations[upperBoundIndexMinusOne * 4 + 1],
                                rotations[upperBoundIndexMinusOne * 4 + 2],
                                rotations[upperBoundIndexMinusOne * 4 + 3]
                            )
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

                    const xWeight = MmdInterpolator.Interpolate(
                        positionInterpolations[upperBoundIndex * 12] / 127, // x_x1
                        positionInterpolations[upperBoundIndex * 12 + 1] / 127, // x_x2
                        positionInterpolations[upperBoundIndex * 12 + 2] / 127, // x_y1
                        positionInterpolations[upperBoundIndex * 12 + 3] / 127, // x_y2
                        gradient
                    );
                    const yWeight = MmdInterpolator.Interpolate(
                        positionInterpolations[upperBoundIndex * 12 + 4] / 127, // y_x1
                        positionInterpolations[upperBoundIndex * 12 + 5] / 127, // y_x2
                        positionInterpolations[upperBoundIndex * 12 + 6] / 127, // y_y1
                        positionInterpolations[upperBoundIndex * 12 + 7] / 127, // y_y2
                        gradient
                    );
                    const zWeight = MmdInterpolator.Interpolate(
                        positionInterpolations[upperBoundIndex * 12 + 8] / 127, // z_x1
                        positionInterpolations[upperBoundIndex * 12 + 9] / 127, // z_x2
                        positionInterpolations[upperBoundIndex * 12 + 10] / 127, // z_y1
                        positionInterpolations[upperBoundIndex * 12 + 11] / 127, // z_y2
                        gradient
                    );

                    positionA.x += (positionB.x - positionA.x) * xWeight;
                    positionA.y += (positionB.y - positionA.y) * yWeight;
                    positionA.z += (positionB.z - positionA.z) * zWeight;
                    bone.getPositionToRef(Space.LOCAL, null, MmdRuntimeModelAnimation._BoneOriginalPosition);
                    bone.setPosition(MmdRuntimeModelAnimation._BoneOriginalPosition.add(positionA), Space.LOCAL);

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

                    const weight = MmdInterpolator.Interpolate(
                        rotationInterpolations[upperBoundIndex * 4] / 127, // x1
                        rotationInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                        rotationInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                        rotationInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                        gradient
                    );

                    Quaternion.SlerpToRef(rotationA, rotationB, weight, rotationA);
                    bone.getRotationQuaternionToRef(Space.LOCAL, null, MmdRuntimeModelAnimation._BoneOriginalRotation);
                    bone.setRotationQuaternion(
                        MmdRuntimeModelAnimation._BoneOriginalRotation.multiply(rotationA),
                        Space.LOCAL
                    );
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

        const boneBindIndexMap: Nullable<Bone>[] = [];
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

        const moveableBoneBindIndexMap: Nullable<Bone>[] = [];
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
        const morphBindIndexMap: Nullable<MorphIndices>[] = [];
        const morphTracks = animation.morphTracks;
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            const mappedName = retargetingMap?.[morphTrack.name] ?? morphTrack.name;
            const morphIndices = morphController.getMorphIndices(mappedName);
            if (morphIndices === undefined) {
                logger?.warn(`Binding failed: morph ${mappedName} not found`);
                morphBindIndexMap.push(null);
            } else {
                morphBindIndexMap.push(morphIndices);
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

        const ikSolverBindIndexMap: Nullable<IIkSolver>[] = [];
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
    public static InduceMaterialRecompile = (
        materials: Material[],
        morphController: MmdMorphController,
        morphIndices: Nullable<MorphIndices>[],
        logger?: ILogger
    ): void => {
        let allTextureColorPropertiesAreRecompiled = false;
        let allSphereTextureColorPropertiesAreRecompiled = false;
        let allToonTextureColorPropertiesAreRecompiled = false;
        const recompiledMaterials = new Set<string>();

        for (let i = 0; i < morphIndices.length; ++i) {
            const morphIndex = morphIndices[i];
            if (morphIndex === null) continue;

            for (let j = 0; j < morphIndex.length; ++j) {
                const morph = morphController.morphs[morphIndex[j]];
                if (morph.type === PmxObject.Morph.Type.MaterialMorph) {
                    const elements = morph.materialElements!;
                    for (let k = 0; k < elements.length; ++k) {
                        const element = elements[k];
                        if (element.textureColor !== null && !allTextureColorPropertiesAreRecompiled) {
                            const materialIndex = element.index;
                            if (element.index === -1) {
                                for (let l = 0; l < materials.length; ++l) {
                                    (materials[l] as MmdStandardMaterial).textureColor;
                                }
                                allTextureColorPropertiesAreRecompiled = true;
                            } else {
                                (materials[materialIndex] as MmdStandardMaterial).textureColor;
                                recompiledMaterials.add(materialIndex.toString());
                            }
                        }

                        if (element.sphereTextureColor !== null && !allSphereTextureColorPropertiesAreRecompiled) {
                            const materialIndex = element.index;
                            if (element.index === -1) {
                                for (let l = 0; l < materials.length; ++l) {
                                    (materials[l] as MmdStandardMaterial).sphereTextureColor;
                                }
                                allSphereTextureColorPropertiesAreRecompiled = true;
                            } else {
                                (materials[materialIndex] as MmdStandardMaterial).sphereTextureColor;
                                recompiledMaterials.add(materialIndex.toString());
                            }
                        }

                        if (element.toonTextureColor !== null && !allToonTextureColorPropertiesAreRecompiled) {
                            const materialIndex = element.index;
                            if (element.index === -1) {
                                for (let l = 0; l < materials.length; ++l) {
                                    (materials[l] as MmdStandardMaterial).toonTextureColor;
                                }
                                allToonTextureColorPropertiesAreRecompiled = true;
                            } else {
                                (materials[materialIndex] as MmdStandardMaterial).toonTextureColor;
                                recompiledMaterials.add(materialIndex.toString());
                            }
                        }
                    }
                }
            }

            if (allTextureColorPropertiesAreRecompiled
                && allSphereTextureColorPropertiesAreRecompiled
                && allToonTextureColorPropertiesAreRecompiled) {
                break;
            }
        }

        if (allTextureColorPropertiesAreRecompiled
            || allSphereTextureColorPropertiesAreRecompiled
            || allToonTextureColorPropertiesAreRecompiled) {
            logger?.log("All materials could be recompiled for morph animation");
        } else if (0 < recompiledMaterials.size) {
            logger?.log(`Materials ${Array.from(recompiledMaterials).join(", ")} could be recompiled for morph animation`);
        }
    };
}

/**
 * Mmd runtime camera animation
 *
 * An object with mmd animation and camera binding information
 */
export class MmdRuntimeCameraAnimation extends MmdRuntimeAnimation {
    public readonly animation: MmdCameraAnimationTrack;

    private readonly _camera: MmdCamera;

    private constructor(
        animation: MmdAnimation,
        camera: MmdCamera
    ) {
        super();

        this.animation = animation.cameraTrack;
        this._camera = camera;
    }

    private static readonly _CameraPositionA = new Vector3();
    private static readonly _CameraPositionB = new Vector3();
    private static readonly _CameraRotationA = new Vector3();
    private static readonly _CameraRotationB = new Vector3();

    private static readonly _DegToRad = Math.PI / 180;

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    public animate(frameTime: number): void {
        const cameraTrack = this.animation;
        if (cameraTrack.frameNumbers.length === 0) return;

        const camera = this._camera;

        const clampedFrameTime = Math.max(cameraTrack.startFrame, Math.min(cameraTrack.endFrame, frameTime));
        const upperBoundIndex = this._upperBoundFrameIndex(clampedFrameTime, cameraTrack);
        const upperBoundIndexMinusOne = upperBoundIndex - 1;

        const frameNumberA = cameraTrack.frameNumbers[upperBoundIndexMinusOne];
        const frameNumberB = cameraTrack.frameNumbers[upperBoundIndex];

        if (frameNumberB === undefined || frameNumberA + 1 === frameNumberB) {
            const positions = cameraTrack.positions;
            camera.position.set(
                positions[upperBoundIndexMinusOne * 3],
                positions[upperBoundIndexMinusOne * 3 + 1],
                positions[upperBoundIndexMinusOne * 3 + 2]
            );

            const rotations = cameraTrack.rotations;
            camera.rotation.set(
                rotations[upperBoundIndexMinusOne * 3],
                rotations[upperBoundIndexMinusOne * 3 + 1],
                rotations[upperBoundIndexMinusOne * 3 + 2]
            );

            camera.distance = cameraTrack.distances[upperBoundIndexMinusOne];
            camera.fov = cameraTrack.fovs[upperBoundIndexMinusOne] * MmdRuntimeCameraAnimation._DegToRad;
        } else {
            const gradient = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

            const positions = cameraTrack.positions;
            const positionInterpolations = cameraTrack.positionInterpolations;

            const positionA = MmdRuntimeCameraAnimation._CameraPositionA.set(
                positions[upperBoundIndexMinusOne * 3],
                positions[upperBoundIndexMinusOne * 3 + 1],
                positions[upperBoundIndexMinusOne * 3 + 2]
            );
            const positionB = MmdRuntimeCameraAnimation._CameraPositionB.set(
                positions[upperBoundIndex * 3],
                positions[upperBoundIndex * 3 + 1],
                positions[upperBoundIndex * 3 + 2]
            );

            const xWeight = MmdInterpolator.Interpolate(
                positionInterpolations[upperBoundIndex * 12] / 127, // x_x1
                positionInterpolations[upperBoundIndex * 12 + 1] / 127, // x_x2
                positionInterpolations[upperBoundIndex * 12 + 2] / 127, // x_y1
                positionInterpolations[upperBoundIndex * 12 + 3] / 127, // x_y2
                gradient
            );
            const yWeight = MmdInterpolator.Interpolate(
                positionInterpolations[upperBoundIndex * 12 + 4] / 127, // y_x1
                positionInterpolations[upperBoundIndex * 12 + 5] / 127, // y_x2
                positionInterpolations[upperBoundIndex * 12 + 6] / 127, // y_y1
                positionInterpolations[upperBoundIndex * 12 + 7] / 127, // y_y2
                gradient
            );
            const zWeight = MmdInterpolator.Interpolate(
                positionInterpolations[upperBoundIndex * 12 + 8] / 127, // z_x1
                positionInterpolations[upperBoundIndex * 12 + 9] / 127, // z_x2
                positionInterpolations[upperBoundIndex * 12 + 10] / 127, // z_y1
                positionInterpolations[upperBoundIndex * 12 + 11] / 127, // z_y2
                gradient
            );

            camera.position.set(
                positionA.x + (positionB.x - positionA.x) * xWeight,
                positionA.y + (positionB.y - positionA.y) * yWeight,
                positionA.z + (positionB.z - positionA.z) * zWeight
            );

            const rotations = cameraTrack.rotations;
            const rotationInterpolations = cameraTrack.rotationInterpolations;

            const rotationA = MmdRuntimeCameraAnimation._CameraRotationA.set(
                rotations[upperBoundIndexMinusOne * 3],
                rotations[upperBoundIndexMinusOne * 3 + 1],
                rotations[upperBoundIndexMinusOne * 3 + 2]
            );
            const rotationB = MmdRuntimeCameraAnimation._CameraRotationB.set(
                rotations[upperBoundIndex * 3],
                rotations[upperBoundIndex * 3 + 1],
                rotations[upperBoundIndex * 3 + 2]
            );

            const rotationWeight = MmdInterpolator.Interpolate(
                rotationInterpolations[upperBoundIndex * 4] / 127, // x1
                rotationInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                rotationInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                rotationInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                gradient
            );
            const oneMinusRotationWeight = 1 - rotationWeight;

            camera.rotation.set(
                rotationA.x * oneMinusRotationWeight + rotationB.x * rotationWeight,
                rotationA.y * oneMinusRotationWeight + rotationB.y * rotationWeight,
                rotationA.z * oneMinusRotationWeight + rotationB.z * rotationWeight
            );

            const distanceA = cameraTrack.distances[upperBoundIndexMinusOne];
            const distanceB = cameraTrack.distances[upperBoundIndex];

            const distanceWeight = MmdInterpolator.Interpolate(
                cameraTrack.distanceInterpolations[upperBoundIndex * 4] / 127, // x1
                cameraTrack.distanceInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                cameraTrack.distanceInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                cameraTrack.distanceInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                gradient
            );

            camera.distance = distanceA + (distanceB - distanceA) * distanceWeight;

            const fovA = cameraTrack.fovs[upperBoundIndexMinusOne];
            const fovB = cameraTrack.fovs[upperBoundIndex];

            const fovWeight = MmdInterpolator.Interpolate(
                cameraTrack.fovInterpolations[upperBoundIndex * 4] / 127, // x1
                cameraTrack.fovInterpolations[upperBoundIndex * 4 + 1] / 127, // x2
                cameraTrack.fovInterpolations[upperBoundIndex * 4 + 2] / 127, // y1
                cameraTrack.fovInterpolations[upperBoundIndex * 4 + 3] / 127, // y2
                gradient
            );

            camera.fov = (fovA + (fovB - fovA) * fovWeight) * MmdRuntimeCameraAnimation._DegToRad;
        }
    }

    /**
     * bind animation to camera
     * @param animation animation to bind
     * @param camera bind target
     * @returns MmdRuntimeCameraAnimation instance
     */
    public static Create(animation: MmdAnimation, camera: MmdCamera): MmdRuntimeCameraAnimation {
        return new MmdRuntimeCameraAnimation(animation, camera);
    }
}

/**
 * Mmd Interpolator for MMD animation interpolation
 */
export class MmdInterpolator {
    /**
     * Cubic Bezier interpolation
     * @param x1 X1
     * @param x2 X2
     * @param y1 Y1
     * @param y2 Y2
     * @param x Weight
     * @returns Interpolated value
     */
    public static Interpolate(x1: number, x2: number, y1: number, y2: number, x: number): number {
        /*
        Cubic Bezier curves
        https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B.C3.A9zier_curves

        B(t) = ( 1 - t ) ^ 3 * P0
            + 3 * ( 1 - t ) ^ 2 * t * P1
            + 3 * ( 1 - t ) * t^2 * P2
            + t ^ 3 * P3
            ( 0 <= t <= 1 )

        MMD uses Cubic Bezier curves for bone and camera animation interpolation.
        http://d.hatena.ne.jp/edvakf/20111016/1318716097

        x = ( 1 - t ) ^ 3 * x0
            + 3 * ( 1 - t ) ^ 2 * t * x1
            + 3 * ( 1 - t ) * t^2 * x2
            + t ^ 3 * x3
        y = ( 1 - t ) ^ 3 * y0
            + 3 * ( 1 - t ) ^ 2 * t * y1
            + 3 * ( 1 - t ) * t^2 * y2
            + t ^ 3 * y3
            ( x0 = 0, y0 = 0 )
            ( x3 = 1, y3 = 1 )
            ( 0 <= t, x1, x2, y1, y2 <= 1 )

        Here solves this equation with Bisection method,
        https://en.wikipedia.org/wiki/Bisection_method
        gets t, and then calculate y.

        f(t) = 3 * ( 1 - t ) ^ 2 * t * x1
            + 3 * ( 1 - t ) * t^2 * x2
            + t ^ 3 - x = 0

        (Another option: Newton's method https://en.wikipedia.org/wiki/Newton%27s_method)
        */
        let c = 0.5;
        let t = c;
        let s = 1.0 - t;
        const loop = 15;
        const eps = 1e-5;
        const math = Math;

        let sst3: number, stt3: number, ttt: number;

        for (let i = 0; i < loop; ++i) {
            sst3 = 3.0 * s * s * t;
            stt3 = 3.0 * s * t * t;
            ttt = t * t * t;

            const ft = (sst3 * x1) + (stt3 * x2) + (ttt) - x;

            if (math.abs(ft) < eps) break;

            c /= 2.0;

            t += (ft < 0) ? c : -c;
            s = 1.0 - t;
        }
        return (sst3! * y1) + (stt3! * y2) + ttt!;
    }
}
