import type { Bone } from "@babylonjs/core";

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
    private readonly _morphController: MmdMorphController;
    private readonly _morphBindIndexMap: (MorphIndices | null)[];
    private readonly _mesh: RuntimeMmdMesh;
    private readonly _ikSolverBindIndexMap: (IIkSolver | null)[];

    private constructor(
        animation: MmdModelAnimation,
        boneBindIndexMap: (Bone | null)[],
        morphController: MmdMorphController,
        morphBindIndexMap: (MorphIndices | null)[],
        mesh: RuntimeMmdMesh,
        ikSolverBindIndexMap: (IIkSolver | null)[]
    ) {
        this.animation = animation;

        this._boneBindIndexMap = boneBindIndexMap;
        this._morphController = morphController;
        this._morphBindIndexMap = morphBindIndexMap;
        this._mesh = mesh;
        this._ikSolverBindIndexMap = ikSolverBindIndexMap;
    }

    public animate(frameTime: number): void {
        frameTime;
        this._boneBindIndexMap;
        this._morphController;
        this._morphBindIndexMap;
        this._mesh;
        this._ikSolverBindIndexMap;
        throw new Error("Not implemented");
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
            morphController,
            morphBindIndexMap,
            model.mesh,
            ikSolverBindIndexMap
        );
    }
}
