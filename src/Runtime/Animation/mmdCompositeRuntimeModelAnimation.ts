import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { ILogger } from "../ILogger";
import type { IMmdModel } from "../IMmdModel";
import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { MmdMorphControllerBase } from "../mmdMorphControllerBase";
import { SetMorphTargetManagersNumMaxInfluencers } from "./Common/induceMmdStandardMaterialRecompile";
import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation, IMmdRuntimeModelAnimationWithBindingInfo } from "./IMmdRuntimeAnimation";
import type { MmdAnimationSpan } from "./mmdCompositeAnimation";
import { MmdCompositeAnimation } from "./mmdCompositeAnimation";

/**
 * Mmd composite runtime model animation
 *
 * An object with mmd composite animation and model binding information
 */
export class MmdCompositeRuntimeModelAnimation implements IMmdRuntimeModelAnimation {
    /**
     * The animation data
     */
    public animation: MmdCompositeAnimation;

    private readonly _ikSolverStates: Uint8Array;
    private readonly _morphController: MmdMorphControllerBase;
    private readonly _meshes: readonly Mesh[];

    private readonly _runtimeAnimations: Nullable<IMmdRuntimeModelAnimationWithBindingInfo>[];
    private _onSpanAdded: Nullable<(span: MmdAnimationSpan) => void>;
    private _onSpanRemoved: Nullable<(removeIndex: number) => void>;

    private constructor(
        animation: MmdCompositeAnimation,
        ikSolverStates: Uint8Array,
        morphController: MmdMorphControllerBase,
        meshes: readonly Mesh[],
        runtimeAnimations: Nullable<IMmdRuntimeModelAnimationWithBindingInfo>[],
        onSpanAdded: (span: MmdAnimationSpan) => void,
        onSpanRemoved: (removeIndex: number) => void
    ) {
        this.animation = animation;

        this._ikSolverStates = ikSolverStates;
        this._morphController = morphController;
        this._meshes = meshes;
        this._runtimeAnimations = runtimeAnimations;
        this._onSpanAdded = onSpanAdded;
        this._onSpanRemoved = onSpanRemoved;

        animation.onSpanAddedObservable.add(onSpanAdded);
        animation.onSpanRemovedObservable.add(onSpanRemoved);
    }

    private static readonly _RuntimeAnimationIdMap = new WeakMap<IMmdRuntimeModelAnimationWithBindingInfo, number>();
    private static _RuntimeAnimationIdCounter = 0;

    private static _GetRuntimeAnimationId(runtimeAnimation: IMmdRuntimeModelAnimationWithBindingInfo): number {
        let id = MmdCompositeRuntimeModelAnimation._RuntimeAnimationIdMap.get(runtimeAnimation);
        if (id === undefined) {
            id = MmdCompositeRuntimeModelAnimation._RuntimeAnimationIdCounter += 1;
            MmdCompositeRuntimeModelAnimation._RuntimeAnimationIdMap.set(runtimeAnimation, id);
        }
        return id;
    }

    private readonly _boneResultMap = new Map<IMmdRuntimeLinkedBone, [Quaternion, number, number]>(); // [result, accWeight, accCount]
    private readonly _movableBoneResultMap = new Map<IMmdRuntimeLinkedBone, [Vector3, Quaternion, number, number]>(); // [positionResult, rotationResult, accWeight, accCount]
    private readonly _morphResultMap = new Map<number, number>();
    private readonly _ikSolverResultMap = new Map<number, boolean>();

    private readonly _activeAnimationSpans: MmdAnimationSpan[] = [];
    private readonly _activeRuntimeAnimations: IMmdRuntimeModelAnimationWithBindingInfo[] = [];
    private _activeRuntimeAnimationIds: number[] = [];
    private _lastActiveRuntimeAnimationIds: number[] = [];

    private readonly _boneRestPosition = new Vector3();
    private static readonly _IdentityQuaternion: DeepImmutable<Quaternion> = Quaternion.Identity();

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    public animate(frameTime: number): void {
        frameTime = Math.max(this.animation.startFrame, Math.min(this.animation.endFrame, frameTime));

        const spans = this.animation.spans;
        const runtimeAnimations = this._runtimeAnimations;

        const activeAnimationSpans = this._activeAnimationSpans;
        const activeRuntimeAnimations = this._activeRuntimeAnimations;

        const morphController = this._morphController;

        for (let i = 0; i < spans.length; ++i) {
            const span = spans[i];
            const runtimeAnimation = runtimeAnimations[i];
            if (runtimeAnimation !== null && 0 < span.weight && span.isInSpan(frameTime)) {
                activeAnimationSpans.push(span);
                activeRuntimeAnimations.push(runtimeAnimation);
            }
        }

        let totalWeight = 0;
        for (let i = 0; i < activeAnimationSpans.length; ++i) {
            totalWeight += activeAnimationSpans[i].getEasedWeight(activeAnimationSpans[i].getFrameTime(frameTime));
        }

        const meshes = this._meshes;
        const ikSolverStates = this._ikSolverStates;

        const boneResultMap = this._boneResultMap;
        const movableBoneResultMap = this._movableBoneResultMap;
        const morphResultMap = this._morphResultMap;
        const ikSolverResultMap = this._ikSolverResultMap;

        let bindingIsSameWithPrevious = true;
        const activeRuntimeAnimationIds = this._activeRuntimeAnimationIds;
        const lastActiveRuntimeAnimationIds = this._lastActiveRuntimeAnimationIds;
        if (lastActiveRuntimeAnimationIds.length !== activeRuntimeAnimations.length) {
            bindingIsSameWithPrevious = false;
            for (let i = 0; i < activeRuntimeAnimations.length; ++i) {
                activeRuntimeAnimationIds.push(MmdCompositeRuntimeModelAnimation._GetRuntimeAnimationId(activeRuntimeAnimations[i]));
            }
        } else {
            for (let i = 0; i < activeRuntimeAnimations.length; ++i) {
                const activeRuntimeAnimationId = MmdCompositeRuntimeModelAnimation._GetRuntimeAnimationId(activeRuntimeAnimations[i]);
                activeRuntimeAnimationIds.push(activeRuntimeAnimationId);
                if (lastActiveRuntimeAnimationIds[i] !== activeRuntimeAnimationId) bindingIsSameWithPrevious = false;
            }
        }
        this._lastActiveRuntimeAnimationIds = activeRuntimeAnimationIds;
        this._activeRuntimeAnimationIds = lastActiveRuntimeAnimationIds;
        lastActiveRuntimeAnimationIds.length = 0;

        // restore initial state
        if (bindingIsSameWithPrevious) {
            if (totalWeight === 0) {
                for (const [bone, result] of boneResultMap) {
                    bone.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
                    result[1] = 0;
                    result[2] = 0;
                }
                for (const [bone, result] of movableBoneResultMap) {
                    bone.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
                    bone.getRestMatrix().getTranslationToRef(this._boneRestPosition);
                    result[0].copyFromFloats(0, 0, 0);
                    result[2] = 0;
                    result[3] = 0;
                }
                for (const [morphIndex, _result] of morphResultMap) {
                    morphController.setMorphWeightFromIndex(morphIndex, 0);
                    morphResultMap.set(morphIndex, 0);
                }
                for (let i = 0; i < meshes.length; ++i) {
                    meshes[i].visibility = 1;
                }
                for (const [ikSolverIndex, _result] of ikSolverResultMap) {
                    ikSolverStates[ikSolverIndex] = 0;
                    ikSolverResultMap.set(ikSolverIndex, true);
                }
            } else {
                for (const [_bone, result] of boneResultMap) {
                    result[1] = 0;
                    result[2] = 0;
                }
                for (const [_bone, result] of movableBoneResultMap) {
                    result[0].copyFromFloats(0, 0, 0);
                    result[2] = 0;
                    result[3] = 0;
                }
                for (const [morphIndex, _result] of morphResultMap) {
                    morphResultMap.set(morphIndex, 0);
                }
                for (const [ikSolver, _result] of ikSolverResultMap) {
                    ikSolverResultMap.set(ikSolver, true);
                }
            }
        } else {
            for (const [bone, _result] of boneResultMap) {
                bone.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
            }
            for (const [bone, _result] of movableBoneResultMap) {
                bone.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
                bone.getRestMatrix().getTranslationToRef(this._boneRestPosition);
            }
            for (const [morphIndex, _result] of morphResultMap) {
                morphController.setMorphWeightFromIndex(morphIndex, 0);
            }
            for (let i = 0; i < meshes.length; ++i) {
                meshes[i].visibility = 1;
            }
            for (const [ikSolver, _result] of ikSolverResultMap) {
                ikSolverStates[ikSolver] = 1;
            }
            boneResultMap.clear();
            movableBoneResultMap.clear();
            morphResultMap.clear();
            ikSolverResultMap.clear();
        }

        if (totalWeight === 0) { // do not animate
            activeAnimationSpans.length = 0;
            activeRuntimeAnimations.length = 0;
            return;
        }

        if (totalWeight === 1 && activeAnimationSpans.length === 1) { // for one animation, just animate it
            const span = activeAnimationSpans[0];
            const runtimeAnimation = activeRuntimeAnimations[0];

            runtimeAnimation.animate(span.getFrameTime(frameTime));

            // just copy bind info purpose
            const boneBindIndexMap = runtimeAnimation.boneBindIndexMap;
            for (let i = 0; i < boneBindIndexMap.length; ++i) {
                const bone = boneBindIndexMap[i];
                if (bone !== null) {
                    const result = boneResultMap.get(bone);
                    if (result === undefined) boneResultMap.set(bone, [new Quaternion(), 0, 0]);
                }
            }
            const movableBoneBindIndexMap = runtimeAnimation.movableBoneBindIndexMap;
            for (let i = 0; i < movableBoneBindIndexMap.length; ++i) {
                const bone = movableBoneBindIndexMap[i];
                if (bone !== null) {
                    const result = movableBoneResultMap.get(bone);
                    if (result === undefined) {
                        movableBoneResultMap.set(bone, [new Vector3(), new Quaternion(), 0, 0]);
                    }
                }
            }
            const morphBindIndexMap = runtimeAnimation.morphBindIndexMap;
            for (let i = 0; i < morphBindIndexMap.length; ++i) {
                const morphIndices = morphBindIndexMap[i];
                if (morphIndices !== null) {
                    for (let j = 0; j < morphIndices.length; ++j) {
                        const morphIndex = morphIndices[j];
                        const result = morphResultMap.get(morphIndex);
                        if (result === undefined) morphResultMap.set(morphIndex, 0);
                    }
                }
            }
            const ikSolverBindIndexMap = runtimeAnimation.ikSolverBindIndexMap;
            for (let i = 0; i < ikSolverBindIndexMap.length; ++i) {
                const ikSolver = ikSolverBindIndexMap[i];
                if (ikSolver !== null) {
                    const result = ikSolverResultMap.get(ikSolver);
                    if (result === undefined) ikSolverResultMap.set(ikSolver, true);
                }
            }

            activeAnimationSpans.length = 0;
            activeRuntimeAnimations.length = 0;
            return;
        }

        let normalizer: number;
        let visibility: number;

        if (totalWeight < 1.0) {
            normalizer = 1.0;
            visibility = 1 - totalWeight;
        } else {
            normalizer = 1.0 / totalWeight;
            visibility = 0;
        }

        // ref: https://www.gamedev.net/forums/topic/645242-quaternions-and-animation-blending-questions/5076696/
        for (let i = 0; i < activeAnimationSpans.length; ++i) {
            const span = activeAnimationSpans[i];
            const runtimeAnimation = activeRuntimeAnimations[i];

            if (meshes.length !== 0) {
                meshes[0].visibility = 1;
            }

            const frameTimeInSpan = span.getFrameTime(frameTime);
            runtimeAnimation.animate(frameTimeInSpan);
            const weight = span.getEasedWeight(frameTimeInSpan) * normalizer;

            const boneBindIndexMap = runtimeAnimation.boneBindIndexMap;
            for (let i = 0; i < boneBindIndexMap.length; ++i) {
                const bone = boneBindIndexMap[i];
                if (bone !== null) {
                    const result = boneResultMap.get(bone);
                    if (result === undefined) {
                        boneResultMap.set(bone, [bone.rotationQuaternion.clone(), weight, 1]);
                    } else {
                        if (result[2] === 0) {
                            result[0].copyFrom(bone.rotationQuaternion);
                            result[1] = weight;
                        } else {
                            Quaternion.SlerpToRef(result[0], bone.rotationQuaternion, weight / (result[1] + weight), result[0]);
                            result[1] += weight;
                        }
                        result[2] += 1;
                    }
                }
            }

            const movableBoneBindIndexMap = runtimeAnimation.movableBoneBindIndexMap;
            for (let i = 0; i < movableBoneBindIndexMap.length; ++i) {
                const bone = movableBoneBindIndexMap[i];
                if (bone !== null) {
                    const boneRestPosition = bone.getRestMatrix().getTranslationToRef(this._boneRestPosition);

                    const result = movableBoneResultMap.get(bone);
                    if (result === undefined) {
                        movableBoneResultMap.set(bone, [
                            bone.position.clone().subtractInPlace(boneRestPosition).scaleInPlace(weight),
                            bone.rotationQuaternion.clone(),
                            weight,
                            1
                        ]);
                    } else {
                        bone.position.subtractInPlace(boneRestPosition).scaleAndAddToRef(weight, result[0]);
                        if (result[3] === 0) {
                            result[1].copyFrom(bone.rotationQuaternion);
                            result[2] = weight;
                        } else {
                            Quaternion.SlerpToRef(result[1], bone.rotationQuaternion, weight / (result[2] + weight), result[1]);
                            result[2] += weight;
                        }
                        result[3] += 1;
                    }
                }
            }

            const morphBindIndexMap = runtimeAnimation.morphBindIndexMap;
            for (let i = 0; i < morphBindIndexMap.length; ++i) {
                const morphIndices = morphBindIndexMap[i];
                if (morphIndices !== null) {
                    for (let j = 0; j < morphIndices.length; ++j) {
                        const morphIndex = morphIndices[j];
                        const result = morphResultMap.get(morphIndex);
                        if (result === undefined) {
                            morphResultMap.set(morphIndex, morphController.getMorphWeightFromIndex(morphIndex) * weight);
                        } else {
                            morphResultMap.set(morphIndex, result + morphController.getMorphWeightFromIndex(morphIndex) * weight);
                        }
                    }
                }
            }

            const ikSolverBindIndexMap = runtimeAnimation.ikSolverBindIndexMap;
            for (let i = 0; i < ikSolverBindIndexMap.length; ++i) {
                const ikSolverIndex = ikSolverBindIndexMap[i];
                if (ikSolverIndex !== -1) {
                    const result = ikSolverResultMap.get(ikSolverIndex);
                    if (result === undefined) {
                        ikSolverResultMap.set(ikSolverIndex, ikSolverStates[ikSolverIndex] !== 0);
                    } else {
                        ikSolverResultMap.set(ikSolverIndex, result && ikSolverStates[ikSolverIndex] !== 0);
                    }
                }
            }

            if (meshes.length !== 0) {
                visibility += meshes[0].visibility * weight;
            }
        }

        for (const [bone, result] of boneResultMap) {
            if (totalWeight < 1) {
                Quaternion.SlerpToRef(MmdCompositeRuntimeModelAnimation._IdentityQuaternion, result[0], result[1], bone.rotationQuaternion);
            } else {
                bone.rotationQuaternion.copyFrom(result[0]);
            }
        }

        for (const [bone, result] of movableBoneResultMap) {
            bone.getRestMatrix().getTranslationToRef(bone.position).addInPlace(result[0]);
            if (totalWeight < 1) {
                Quaternion.SlerpToRef(MmdCompositeRuntimeModelAnimation._IdentityQuaternion, result[1], result[2], bone.rotationQuaternion);
            } else {
                bone.rotationQuaternion.copyFrom(result[1]);
            }
        }

        for (const [morphIndex, result] of morphResultMap) {
            morphController.setMorphWeightFromIndex(morphIndex, result);
        }

        if (Math.abs(visibility - 1) < 1e-6) {
            for (let i = 0; i < meshes.length; ++i) {
                meshes[i].visibility = 1;
            }
        } else {
            for (let i = 0; i < meshes.length; ++i) {
                meshes[i].visibility = visibility;
            }
        }

        for (const [ikSolverIndex, result] of ikSolverResultMap) {
            ikSolverStates[ikSolverIndex] = result ? 1 : 0;
        }

        activeAnimationSpans.length = 0;
        activeRuntimeAnimations.length = 0;
    }

    /**
     * Induce material recompile
     *
     * This method must run once before the animation runs
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     * @param updateMorphTarget Whether to update morph target manager numMaxInfluencers
     * @param logger Logger
     */
    public induceMaterialRecompile(updateMorphTarget: boolean, logger?: ILogger): void {
        const runtimeAnimations = this._runtimeAnimations;
        for (let i = 0; i < runtimeAnimations.length; ++i) {
            runtimeAnimations[i]?.induceMaterialRecompile(false, logger);
        }
        if (updateMorphTarget) {
            const mergedMorphIndices: Nullable<readonly number[]>[] = [];
            for (let i = 0; i < runtimeAnimations.length; ++i) {
                const runtimeAnimation = runtimeAnimations[i];
                if (runtimeAnimation !== null) {
                    const morphBindIndexMap = runtimeAnimation.morphBindIndexMap;
                    mergedMorphIndices.push(...morphBindIndexMap);
                }
            }
            SetMorphTargetManagersNumMaxInfluencers(this._morphController, mergedMorphIndices);
        }
    }

    /**
     * Dispose. remove all event listeners
     */
    public dispose(): void {
        if (this._onSpanAdded !== null) {
            this.animation.onSpanAddedObservable.removeCallback(this._onSpanAdded);
            this.animation.onSpanRemovedObservable.removeCallback(this._onSpanRemoved!);
            this._onSpanAdded = null;
            this._onSpanRemoved = null;
        }
    }

    /**
     * Bind animation to model and prepare material for morph animation
     * @param animation Animation to bind
     * @param model Bind target
     * @param retargetingMap Animation bone name to model bone name map
     * @param logger Logger
     * @return MmdCompositeRuntimeModelAnimation instance
     */
    public static Create(animation: MmdCompositeAnimation, model: IMmdModel, retargetingMap?: { [key: string]: string }, logger?: ILogger): MmdCompositeRuntimeModelAnimation {
        const runtimeAnimations: Nullable<IMmdRuntimeModelAnimationWithBindingInfo>[] = new Array(animation.spans.length).fill(null);
        const spans = animation.spans;

        for (let i = 0; i < spans.length; ++i) {
            const animation = spans[i].animation;
            if ((animation as IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>).createRuntimeModelAnimation !== undefined) {
                const runtimeAnimation = (animation as IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>).createRuntimeModelAnimation(model, retargetingMap, logger);
                runtimeAnimations[i] = runtimeAnimation;
            } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation === undefined) {
                throw new Error(`animation ${animation.name} is not bindable. are you missing import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation" or "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationGroup"?`);
            }
        }

        const onSpanAdded = (span: MmdAnimationSpan): void => {
            const animation = span.animation;
            if ((animation as IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>).createRuntimeModelAnimation !== undefined) {
                const runtimeAnimation = (animation as IMmdBindableModelAnimation<IMmdRuntimeModelAnimationWithBindingInfo>).createRuntimeModelAnimation(model, retargetingMap, logger);
                runtimeAnimations.push(runtimeAnimation);
            } else if ((animation as IMmdBindableModelAnimation).createRuntimeModelAnimation === undefined) {
                throw new Error(`animation ${animation.name} is not bindable. are you missing import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation" or "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimationGroup"?`);
            } else {
                runtimeAnimations.push(null);
            }
        };

        const onSpanRemoved = (removeIndex: number): void => {
            runtimeAnimations.splice(removeIndex, 1);
        };

        return new MmdCompositeRuntimeModelAnimation(animation, model.ikSolverStates, model.morph, model.mesh.metadata.meshes, runtimeAnimations, onSpanAdded, onSpanRemoved);
    }
}

declare module "./mmdCompositeAnimation" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdCompositeAnimation extends IMmdBindableModelAnimation<MmdCompositeRuntimeModelAnimation> { }
}

/**
 * Create runtime camera animation
 * @param camera Bind target
 * @returns MmdRuntimeCameraAnimation instance
 */
MmdCompositeAnimation.prototype.createRuntimeModelAnimation = function(
    model: IMmdModel,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdCompositeRuntimeModelAnimation {
    return MmdCompositeRuntimeModelAnimation.Create(this, model, retargetingMap, logger);
};
