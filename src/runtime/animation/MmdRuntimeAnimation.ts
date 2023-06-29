import type { Bone, Material } from "@babylonjs/core";
import { Quaternion, Space, Vector3 } from "@babylonjs/core";

import type { MmdAnimation } from "@/loader/animation/MmdAnimation";
import type { MmdAnimationTrack, MmdCameraAnimationTrack } from "@/loader/animation/MmdAnimationTrack";
import type { MmdStandardMaterial } from "@/loader/MmdStandardMaterial";
import { PmxObject } from "@/loader/parser/PmxObject";

import type { IIkSolver } from "../IkSolver";
import type { ILogger } from "../ILogger";
import type { MmdCamera } from "../MmdCamera";
import type { RuntimeMmdMesh } from "../MmdMesh";
import type { MmdModel } from "../MmdModel";
import type { MmdMorphController } from "../MmdMorphController";

type MorphIndices = readonly number[];

export abstract class MmdRuntimeAnimation {
    protected _upperBoundFrameIndex(frameTime: number, track: MmdAnimationTrack): number {
        const frameNumbers = track.frameNumbers;
        let low = 0;
        let high = frameNumbers.length;

        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (frameTime < frameNumbers[mid]) high = mid;
            else low = mid + 1;
        }

        return low;
    }
}

export class MmdRuntimeModelAnimation extends MmdRuntimeAnimation {
    public readonly animation: MmdAnimation;

    private readonly _boneBindIndexMap: (Bone | null)[];
    private readonly _moveableBoneBindIndexMap: (Bone | null)[];
    private readonly _morphController: MmdMorphController;
    private readonly _morphBindIndexMap: (MorphIndices | null)[];
    private readonly _mesh: RuntimeMmdMesh;
    private readonly _ikSolverBindIndexMap: (IIkSolver | null)[];

    private constructor(
        animation: MmdAnimation,
        boneBindIndexMap: (Bone | null)[],
        moveableBoneBindIndexMap: (Bone | null)[],
        morphController: MmdMorphController,
        morphBindIndexMap: (MorphIndices | null)[],
        mesh: RuntimeMmdMesh,
        ikSolverBindIndexMap: (IIkSolver | null)[]
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

    public animate(frameTime: number): void {
        const animation = this.animation;

        const upperBoundFrameIndex = this._upperBoundFrameIndex;

        const boneTracks = animation.boneTracks;
        if (0 < boneTracks.length) {
            const boneBindIndexMap = this._boneBindIndexMap;
            for (let i = 0; i < boneTracks.length; ++i) {
                const bone = boneBindIndexMap[i];
                if (bone === null) continue;

                const boneTrack = boneTracks[i];
                const clampedFrameTime = Math.max(boneTrack.startFrame, Math.min(boneTrack.endFrame, frameTime));
                const upperBoundIndex = upperBoundFrameIndex(clampedFrameTime, boneTrack);
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
                const upperBoundIndex = upperBoundFrameIndex(clampedFrameTime, boneTrack);
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
                const upperBoundIndex = upperBoundFrameIndex(clampedFrameTime, morphTrack);
                const upperBoundIndexMinusOne = upperBoundIndex - 1;

                const frameNumberB = morphTrack.frameNumbers[upperBoundIndex];
                if (frameNumberB === undefined) {
                    const weight = morphTrack.weights[upperBoundIndexMinusOne];
                    for (let j = 0; j < morphIndices.length; ++j) {
                        morphController.setMorphWeightFromIndex(morphIndices[j], weight);
                    }
                } else {
                    const frameNumberA = morphTrack.frameNumbers[upperBoundIndexMinusOne];
                    const relativeTime = (clampedFrameTime - frameNumberA) / (frameNumberB - frameNumberA);

                    const weightA = morphTrack.weights[upperBoundIndexMinusOne];
                    const weightB = morphTrack.weights[upperBoundIndex];

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
            const stepIndex = upperBoundFrameIndex(clampedFrameTime, propertyTrack) - 1;

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

    /**
     * bind animation to model and prepare material for morph animation
     * @param animation animation to bind
     * @param model bind target
     * @param retargetingMap model bone name to animation bone name map
     * @param logger logger
     * @returns
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
            const mappedName = retargetingMap?.[morphTrack.name] ?? morphTrack.name;
            const morphIndices = morphController.getMorphIndices(mappedName);
            if (morphIndices === undefined) {
                logger?.warn(`Binding failed: morph ${mappedName} not found`);
                morphBindIndexMap.push(null);
            } else {
                morphBindIndexMap.push(morphIndices);
            }
        }
        MmdRuntimeModelAnimation.InduceMaterialRecompile(model.mesh.material.subMaterials, morphController, morphBindIndexMap);

        const runtimeBones = model.sortedRuntimeBones;
        const runtimeBoneIndexMap = new Map<string, number>();
        if (retargetingMap === undefined) {
            for (let i = 0; i < bones.length; ++i) {
                runtimeBoneIndexMap.set(bones[i].name, i);
            }
        } else {
            for (let i = 0; i < bones.length; ++i) {
                runtimeBoneIndexMap.set(retargetingMap[bones[i].name] ?? bones[i].name, i);
            }
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

    public static InduceMaterialRecompile = (
        materials: Material[],
        morphController: MmdMorphController,
        morphIndices: (MorphIndices | null)[],
        logger?: ILogger
    ): void => {
        for (let i = 0; i < morphIndices.length; ++i) {
            const morphIndex = morphIndices[i];
            if (morphIndex === null) continue;

            let allMaterialWillBeRecompiled = false;
            const recompiledMaterials = new Set<string>();

            for (let j = 0; j < morphIndex.length; ++j) {
                const morph = morphController.morphs[morphIndex[j]];
                if (morph.type === PmxObject.Morph.Type.MaterialMorph) {
                    const elements = morph.materialElements!;
                    for (let k = 0; k < elements.length; ++k) {
                        const element = elements[k];
                        if (element.textureColor !== null) {
                            const materialIndex = element.index;
                            if (element.index === -1) {
                                for (let l = 0; l < materials.length; ++l) {
                                    (materials[l] as MmdStandardMaterial).textureColor;
                                }
                                allMaterialWillBeRecompiled = true;
                            } else {
                                (materials[materialIndex] as MmdStandardMaterial).textureColor;
                                recompiledMaterials.add(materialIndex.toString());
                            }
                        }

                        if (element.sphereTextureColor !== null) {
                            const materialIndex = element.index;
                            if (element.index === -1) {
                                for (let l = 0; l < materials.length; ++l) {
                                    (materials[l] as MmdStandardMaterial).sphereTextureColor;
                                }
                                allMaterialWillBeRecompiled = true;
                            } else {
                                (materials[materialIndex] as MmdStandardMaterial).sphereTextureColor;
                                recompiledMaterials.add(materialIndex.toString());
                            }
                        }

                        if (element.toonTextureColor !== null) {
                            const materialIndex = element.index;
                            if (element.index === -1) {
                                for (let l = 0; l < materials.length; ++l) {
                                    (materials[l] as MmdStandardMaterial).toonTextureColor;
                                }
                                allMaterialWillBeRecompiled = true;
                            } else {
                                (materials[materialIndex] as MmdStandardMaterial).toonTextureColor;
                                recompiledMaterials.add(materialIndex.toString());
                            }
                        }
                    }
                }
            }

            if (allMaterialWillBeRecompiled) {
                logger?.log("All materials could be recompiled for morph animation");
            } else {
                logger?.log(`Materials ${Array.from(recompiledMaterials).join(", ")} could be recompiled for morph animation`);
            }
        }
    };
}

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

    public animate(frameTime: number): void {
        const camera = this._camera;

        const cameraTrack = this.animation;

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

    public static Create(animation: MmdAnimation, camera: MmdCamera): MmdRuntimeCameraAnimation {
        return new MmdRuntimeCameraAnimation(animation, camera);
    }
}

export class MmdInterpolator {
    public static Interpolate(x1: number, x2: number, y1: number, y2: number, x: number): number {
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
