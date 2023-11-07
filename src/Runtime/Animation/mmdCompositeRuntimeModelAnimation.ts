import type { Quaternion} from "@babylonjs/core/Maths/math.vector";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

import type { IIkSolver } from "../ikSolver";
import type { ILogger } from "../ILogger";
import type { IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import type { RuntimeMmdMesh } from "../mmdMesh";
import type { MmdModel } from "../mmdModel";
import type { MmdMorphController } from "../mmdMorphController";
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

    private readonly _morphController: MmdMorphController;
    private readonly _mesh: RuntimeMmdMesh;

    private readonly _runtimeAnimations: Nullable<IMmdRuntimeModelAnimationWithBindingInfo>[];
    private _onSpanAdded: Nullable<(span: MmdAnimationSpan) => void>;
    private _onSpanRemoved: Nullable<(removeIndex: number) => void>;

    private constructor(
        animation: MmdCompositeAnimation,
        morphController: MmdMorphController,
        mesh: RuntimeMmdMesh,
        runtimeAnimations: Nullable<IMmdRuntimeModelAnimationWithBindingInfo>[],
        onSpanAdded: (span: MmdAnimationSpan) => void,
        onSpanRemoved: (removeIndex: number) => void
    ) {
        this.animation = animation;

        this._morphController = morphController;
        this._mesh = mesh;
        this._runtimeAnimations = runtimeAnimations;
        this._onSpanAdded = onSpanAdded;
        this._onSpanRemoved = onSpanRemoved;

        animation.onSpanAddedObservable.add(onSpanAdded);
        animation.onSpanRemovedObservable.add(onSpanRemoved);
    }

    private static readonly _ActiveAnimationSpans: MmdAnimationSpan[] = [];
    private static readonly _ActiveRuntimeAnimations: IMmdRuntimeModelAnimationWithBindingInfo[] = [];

    private readonly _boneResultMap = new Map<IMmdRuntimeLinkedBone, Quaternion>();
    private readonly _moveableBoneResultMap = new Map<IMmdRuntimeLinkedBone, [Vector3, Quaternion]>();
    private readonly _morphResultMap = new Map<number, number>();
    private readonly _ikSolverResultMap = new Map<IIkSolver, boolean>();

    private _lastSingleRuntimeAnimation: Nullable<IMmdRuntimeModelAnimationWithBindingInfo> = null;

    private readonly _boneRestPosition = new Vector3();

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    public animate(frameTime: number): void {
        frameTime = Math.max(this.animation.startFrame, Math.min(this.animation.endFrame, frameTime));

        const spans = this.animation.spans;
        const runtimeAnimations = this._runtimeAnimations;

        const activeAnimationSpans = MmdCompositeRuntimeModelAnimation._ActiveAnimationSpans;
        const activeRuntimeAnimations = MmdCompositeRuntimeModelAnimation._ActiveRuntimeAnimations;

        for (let i = 0; i < spans.length; ++i) {
            const span = spans[i];
            const runtimeAnimation = runtimeAnimations[i];
            if (runtimeAnimation !== null && 0 < span.weight && span.isInSpan(frameTime)) {
                activeAnimationSpans.push(spans[i]);
                activeRuntimeAnimations.push(runtimeAnimation);
            }
        }

        let totalWeight = 0;
        for (let i = 0; i < activeAnimationSpans.length; ++i) totalWeight += activeAnimationSpans[i].weight;

        const morphController = this._morphController;
        const mesh = this._mesh;

        const boneResultMap = this._boneResultMap;
        const moveableBoneResultMap = this._moveableBoneResultMap;
        const morphResultMap = this._morphResultMap;
        const ikSolverResultMap = this._ikSolverResultMap;

        // restore initial state
        if (this._lastSingleRuntimeAnimation !== null) {
            const lastSingleRuntimeAnimation = this._lastSingleRuntimeAnimation;

            // if last single animation is same as current single animation, we don't need to restore
            if (!(totalWeight === 1 && activeRuntimeAnimations.length === 1 && activeRuntimeAnimations[0] === lastSingleRuntimeAnimation)) {
                const boneBindIndexMap = lastSingleRuntimeAnimation.boneBindIndexMap;
                for (let i = 0; i < boneBindIndexMap.length; ++i) {
                    const bone = boneBindIndexMap[i];
                    if (bone !== null) bone.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
                }

                const moveableBoneBindIndexMap = lastSingleRuntimeAnimation.moveableBoneBindIndexMap;
                for (let i = 0; i < moveableBoneBindIndexMap.length; ++i) {
                    const bone = moveableBoneBindIndexMap[i];
                    if (bone !== null) {
                        bone.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
                        bone.getRestMatrix().getTranslationToRef(bone.position);
                    }
                }

                const morphBindIndexMap = lastSingleRuntimeAnimation.morphBindIndexMap;
                for (let i = 0; i < morphBindIndexMap.length; ++i) {
                    const morphIndices = morphBindIndexMap[i];
                    if (morphIndices !== null) {
                        for (let j = 0; j < morphIndices.length; ++j) {
                            const morphIndex = morphIndices[j];
                            morphController.setMorphWeightFromIndex(morphIndex, 0);
                        }
                    }
                }

                mesh.visibility = 1;

                const ikSolverBindIndexMap = lastSingleRuntimeAnimation.ikSolverBindIndexMap;
                for (let i = 0; i < ikSolverBindIndexMap.length; ++i) {
                    const ikSolver = ikSolverBindIndexMap[i];
                    if (ikSolver !== null) ikSolver.enabled = true;
                }

                this._lastSingleRuntimeAnimation = null;
            }
        } else {
            for (const [bone, _result] of boneResultMap) {
                bone.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
            }
            boneResultMap.clear();
            for (const [bone, _result] of moveableBoneResultMap) {
                bone.rotationQuaternion.copyFromFloats(0, 0, 0, 1);
            }
            moveableBoneResultMap.clear();
            for (const [morphIndex, _result] of morphResultMap) {
                morphController.setMorphWeightFromIndex(morphIndex, 0);
            }
            morphResultMap.clear();
            mesh.visibility = 1;
            for (const [ikSolver, _result] of ikSolverResultMap) {
                ikSolver.enabled = true;
            }
            ikSolverResultMap.clear();
        }

        if (totalWeight === 0) { // avoid divide by zero
            activeAnimationSpans.length = 0;
            activeRuntimeAnimations.length = 0;
            return;
        }

        if (totalWeight === 1 && activeAnimationSpans.length === 1) { // for one animation, just animate it
            const span = activeAnimationSpans[0];
            const runtimeAnimation = activeRuntimeAnimations[0];

            runtimeAnimation.animate(span.getFrameTime(frameTime));

            this._lastSingleRuntimeAnimation = runtimeAnimation;

            activeAnimationSpans.length = 0;
            activeRuntimeAnimations.length = 0;
            return;
        }

        let visibility: Nullable<number> = null;

        for (let i = 0; i < activeAnimationSpans.length; ++i) {
            const span = activeAnimationSpans[i];
            const runtimeAnimation = activeRuntimeAnimations[i];

            runtimeAnimation.animate(span.getFrameTime(frameTime));

            const weight = span.weight / totalWeight;

            const boneBindIndexMap = runtimeAnimation.boneBindIndexMap;
            for (let i = 0; i < boneBindIndexMap.length; ++i) {
                const bone = boneBindIndexMap[i];
                if (bone !== null) {
                    const result = boneResultMap.get(bone);
                    if (result === undefined) {
                        boneResultMap.set(bone, bone.rotationQuaternion.clone().scaleInPlace(weight));
                    } else {
                        result.scaleAndAddToRef(weight, bone.rotationQuaternion);
                    }
                }
            }

            const moveableBoneBindIndexMap = runtimeAnimation.moveableBoneBindIndexMap;
            for (let i = 0; i < moveableBoneBindIndexMap.length; ++i) {
                const bone = moveableBoneBindIndexMap[i];
                if (bone !== null) {
                    const boneRestPosition = bone.getRestMatrix().getTranslationToRef(this._boneRestPosition);

                    const result = moveableBoneResultMap.get(bone);
                    if (result === undefined) {
                        moveableBoneResultMap.set(bone, [
                            bone.position.clone().subtractInPlace(boneRestPosition).scaleInPlace(weight),
                            bone.rotationQuaternion.clone().scaleInPlace(weight)
                        ]);
                    } else {
                        result[0].scaleAndAddToRef(weight, bone.position);
                        result[1].scaleAndAddToRef(weight, bone.rotationQuaternion);
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
                const ikSolver = ikSolverBindIndexMap[i];
                if (ikSolver !== null) {
                    const result = ikSolverResultMap.get(ikSolver);
                    if (result === undefined) {
                        ikSolverResultMap.set(ikSolver, ikSolver.enabled);
                    } else {
                        ikSolverResultMap.set(ikSolver, result && ikSolver.enabled);
                    }
                }
            }

            if (visibility === null) {
                visibility = mesh.visibility * weight;
            } else {
                visibility += mesh.visibility * weight;
            }
        }

        for (const [bone, result] of boneResultMap) {
            bone.rotationQuaternion.copyFrom(result);
        }

        for (const [bone, result] of moveableBoneResultMap) {
            bone.rotationQuaternion.copyFrom(result[1]);
            bone.getRestMatrix().getTranslationToRef(bone.position).addInPlace(result[0]);
        }

        for (const [morphIndex, result] of morphResultMap) {
            morphController.setMorphWeightFromIndex(morphIndex, result);
        }

        if (visibility === null || Math.abs(visibility - 1) < 1e-6) {
            mesh.visibility = 1;
        } else {
            mesh.visibility = visibility;
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
     * @param logger logger
     */
    public induceMaterialRecompile(logger?: ILogger): void {
        const runtimeAnimations = this._runtimeAnimations;
        for (let i = 0; i < runtimeAnimations.length; ++i) {
            runtimeAnimations[i]?.induceMaterialRecompile(logger);
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
     * @param retargetingMap Model bone name to animation bone name map
     * @param logger Logger
     * @return MmdCompositeRuntimeModelAnimation instance
     */
    public static Create(animation: MmdCompositeAnimation, model: MmdModel, retargetingMap?: { [key: string]: string }, logger?: ILogger): MmdCompositeRuntimeModelAnimation {
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

        return new MmdCompositeRuntimeModelAnimation(animation, model.morph, model.mesh, runtimeAnimations, onSpanAdded, onSpanRemoved);
    }
}

declare module "./mmdCompositeAnimation" {
    export interface MmdCompositeAnimation extends IMmdBindableModelAnimation<MmdCompositeRuntimeModelAnimation> { }
}

/**
 * Create runtime camera animation
 * @param camera bind target
 * @returns MmdRuntimeCameraAnimation instance
 */
MmdCompositeAnimation.prototype.createRuntimeModelAnimation = function(
    model: MmdModel,
    retargetingMap?: { [key: string]: string },
    logger?: ILogger
): MmdCompositeRuntimeModelAnimation {
    return MmdCompositeRuntimeModelAnimation.Create(this, model, retargetingMap, logger);
};
