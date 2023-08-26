import { Animation } from "@babylonjs/core/Animations/animation";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";

import type { MmdModel } from "@/Runtime/mmdModel";

import type { IMmdAnimation } from "./IMmdAnimation";
import type { MmdAnimation } from "./mmdAnimation";
import type { MmdBoneAnimationTrack, MmdMorphAnimationTrack, MmdPropertyAnimationTrack } from "./mmdAnimationTrack";

/**
 * A container type that stores mmd model animations using the `Animation` container in babylon.js
 *
 * It aims to utilize the animation runtime of babylon.js
 */
export class MmdModelAnimationGroup implements IMmdAnimation {
    /**
     * Animation name for identification
     */
    public readonly name: string;

    /**
     * Bone animation tracks for one `mesh.skeleton`
     */
    public readonly boneAnimations: Animation[];

    /**
     * Morph animation tracks for one `mesh.morphTargetManager`
     */
    public readonly morphAnimations: Animation[];

    /**
     * Property animation track(a.k.a. IK toggle animation) for one `mmdModel`
     */
    public readonly propertyAnimations: Animation[];

    /**
     * Visibility animation track for one `mesh`
     */
    public readonly visibilityAnimation: Animation;

    /**
     * The start frame of this animation
     */
    public readonly startFrame: number;

    /**
     * The end frame of this animation
     */
    public readonly endFrame: number;

    /**
     * Create a unbinded mmd model animation group
     * @param mmdAnimation The mmd animation data
     */
    public constructor(
        mmdAnimation: MmdAnimation
    ) {
        this.name = mmdAnimation.name;

        const boneAnimations: Animation[] = this.boneAnimations = new Array(mmdAnimation.boneTracks.length);
        for (let i = 0; i < mmdAnimation.boneTracks.length; ++i) {
            boneAnimations[i] = this._createBoneAnimation(mmdAnimation.boneTracks[i]);
        }

        const morphAnimations: Animation[] = this.morphAnimations = new Array(mmdAnimation.morphTracks.length);
        for (let i = 0; i < mmdAnimation.morphTracks.length; ++i) {
            morphAnimations[i] = this._createMorphAnimation(mmdAnimation.morphTracks[i]);
        }

        this.propertyAnimations = this._createPropertyAnimation(mmdAnimation.propertyTrack);
        this.visibilityAnimation = this._createVisibilityAnimation(mmdAnimation.propertyTrack);

        this.startFrame = mmdAnimation.startFrame;
        this.endFrame = mmdAnimation.endFrame;
    }

    private _createBoneAnimation(mmdAnimationTrack: MmdBoneAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "_matrix", 30, Animation.ANIMATIONTYPE_MATRIX, Animation.ANIMATIONLOOPMODE_CYCLE);

        return animation;
    }

    private _createMorphAnimation(mmdAnimationTrack: MmdMorphAnimationTrack): Animation {
        const animation = new Animation(mmdAnimationTrack.name, "_matrix", 30, Animation.ANIMATIONTYPE_MATRIX, Animation.ANIMATIONLOOPMODE_CYCLE);

        return animation;
    }

    private _createPropertyAnimation(mmdAnimationTrack: MmdPropertyAnimationTrack): Animation[] {
        mmdAnimationTrack;
        throw new Error("Not implemented");
    }

    private _createVisibilityAnimation(mmdAnimationTrack: MmdPropertyAnimationTrack): Animation {
        mmdAnimationTrack;
        throw new Error("Not implemented");
    }

    /**
     * Create a binded mmd model animation group for the given `MmdModel`
     * @param mmdModel The mmd model to bind
     * @returns The binded mmd model animation group
     */
    public createAnimationGroup(mmdModel: MmdModel): AnimationGroup {
        mmdModel;
        throw new Error("Not implemented");
    }
}

/**
 * Mmd model animation builder for constructing mmd model animation group
 */
export interface IMmdModelAnimationGroupBuilder {

}
