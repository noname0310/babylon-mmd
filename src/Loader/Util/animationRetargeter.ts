import type { AnimationGroup, TargetedAnimation } from "@babylonjs/core/Animations/animationGroup";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { Nullable } from "@babylonjs/core/types";

import { convertToAdditiveAnimation } from "./convertToAdditiveAnimation";
import { deepCopyAnimationGroup } from "./deepCopyAnimation";

export interface RetargetOptions {
    cloneAnimation?: boolean;
    animationScaling?: number;
    removeBoneRotationOffset?: boolean;
}

/**
 * Make animation compatible with mmd model
 */
export class AnimationRetargeter {
    private _boneNameMap: Nullable<{ [key: string]: string }>;

    private _sourceSkeleton: Nullable<Skeleton>;
    private _targetSkeleton: Nullable<Skeleton>;

    private _sourceSkeletonAbsoluteRotations: Nullable<Quaternion[]>;

    private _targetBoneMap: Nullable<Map<string, Bone>>;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    public constructor() {
        this._boneNameMap = null;

        this._sourceSkeleton = null;
        this._targetSkeleton = null;

        this._sourceSkeletonAbsoluteRotations = null;

        this._targetBoneMap = null;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    public setBoneMap(boneMap: { [key: string]: string }): this {
        this._boneNameMap = boneMap;
        return this;
    }

    public setSourceSkeleton(skeleton: Skeleton): this {
        this._sourceSkeleton = skeleton;
        this._sourceSkeletonAbsoluteRotations = null;
        return this;
    }

    public setTargetSkeleton(skeleton: Skeleton): this {
        this._targetSkeleton = skeleton;
        this._targetBoneMap = null;
        return this;
    }

    public retargetAnimation(animationGroup: AnimationGroup, options?: RetargetOptions): Nullable<AnimationGroup> {
        if (!this._isSkeletonAnimation(animationGroup)) {
            this.warn("Animation is not skeleton animation. animation retargeting is aborted.");
            return null;
        }

        if (options === undefined) {
            options = {};
        }
        options.cloneAnimation = options.cloneAnimation ?? true;
        options.animationScaling = options.animationScaling ?? 1;
        options.removeBoneRotationOffset = options.removeBoneRotationOffset ?? false;

        if (this._boneNameMap === null) {
            throw new Error("Bone map is not set");
        }

        if (this._sourceSkeleton === null) {
            throw new Error("Source skeleton is not set");
        }

        if (this._targetSkeleton === null) {
            throw new Error("Target skeleton is not set");
        }

        if (this._sourceSkeletonAbsoluteRotations === null) {
            this._sourceSkeletonAbsoluteRotations = this._computeSkeletonAbsoluteRotations(this._sourceSkeleton);
        }

        if (this._targetBoneMap === null) {
            const boneNameMap = this._targetBoneMap = new Map<string, Bone>();
            {
                const bones = this._targetSkeleton.bones;
                for (let i = 0; i < bones.length; i++) {
                    const bone = bones[i];
                    boneNameMap.set(bone.name, bone);
                }
            }
        }

        if (options.cloneAnimation) {
            animationGroup = deepCopyAnimationGroup(animationGroup, animationGroup.name + "_retargeted");
        }

        this._removeScaleAnimation(animationGroup);
        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            this._flattenAnimationTarget(targetedAnimations[i]);
        }

        if (!animationGroup.isAdditive) {
            convertToAdditiveAnimation(animationGroup, this._sourceSkeleton);
        }

        this._retargetAnimationInternal(animationGroup, this._boneNameMap, this._targetBoneMap);
        return animationGroup;
    }

    private _isSkeletonAnimation(animationGroup: AnimationGroup): boolean {
        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            const animation = targetedAnimations[i].animation;
            const property = animation.targetPropertyPath[animation.targetPropertyPath.length - 1];

            if (property !== "position" && property !== "rotationQuaternion" && property !== "scaling") {
                return false;
            }
        }

        return true;
    }

    private static readonly _Stack: Bone[] = [];

    private _computeSkeletonAbsoluteRotations(skeleton: Skeleton): Quaternion[] {
        const bones = skeleton.bones;
        const boneIndexMap = new Map<Bone, number>();

        const stack = AnimationRetargeter._Stack;
        stack.length = 0;
        for (let i = 0; i < bones.length; i++) {
            const bone = bones[i];
            boneIndexMap.set(bone, i);
            if (bone.getParent() === null) stack.push(bone);
        }

        const worldRotations = new Array<Quaternion>(bones.length);
        while (stack.length > 0) {
            const bone = stack.pop()!;
            const parent = bone.getParent();

            const parentWorldRotation = parent === null
                ? Quaternion.Identity()
                : worldRotations[boneIndexMap.get(parent)!];

            worldRotations[boneIndexMap.get(bone)!] = Quaternion.FromRotationMatrix(bone.getRestMatrix()).multiplyInPlace(parentWorldRotation);

            const children = bone.getChildren();
            for (let i = 0; i < children.length; i++) {
                stack.push(children[i]);
            }
        }

        return worldRotations;
    }

    private _removeScaleAnimation(animationGroup: AnimationGroup): void {
        const scaleAnimationIndices: number[] = [];

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            const targetedAnimation = targetedAnimations[i];

            if (!targetedAnimation.target) continue;

            const targetProperty = targetedAnimation.animation.targetProperty;
            if (targetProperty === "scaling") {
                scaleAnimationIndices.push(i);
            }
        }

        for (let i = 0, j = 0; i < targetedAnimations.length; i++) {
            if (i === scaleAnimationIndices[j]) {
                j += 1; // Skip scale animation
                continue;
            }

            targetedAnimations[i - j] = targetedAnimations[i];
        }
        targetedAnimations.length -= scaleAnimationIndices.length;
    }

    private _getFinalTarget(target: any, targetPropertyPath: string[]): any {
        if (targetPropertyPath.length > 1) {
            let property = target[targetPropertyPath[0]];

            for (let index = 1; index < targetPropertyPath.length - 1; index++) {
                property = property[targetPropertyPath[index]];
            }

            return property;
        } else {
            return target;
        }
    }

    private _flattenAnimationTarget(targetedAnimation: TargetedAnimation): void {
        const target = targetedAnimation.target;
        const targetPropertyPath = targetedAnimation.animation.targetPropertyPath;

        const finalTarget = this._getFinalTarget(target, targetPropertyPath);

        targetedAnimation.target = finalTarget;
        targetPropertyPath[0] = targetedAnimation.animation.targetPropertyPath[targetedAnimation.animation.targetPropertyPath.length - 1];
        targetPropertyPath.length = 1;
        targetedAnimation.animation.targetProperty = targetedAnimation.animation.targetPropertyPath[0];
    }

    private _retargetAnimationInternal(
        animationGroup: AnimationGroup,
        sourceToTargetBoneNameMap: { [key: string]: string },
        targetBoneMap: Map<string, Bone>
    ): void {
        const unTargetedAnimationIndices: number[] = [];

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            const targetedAnimation = targetedAnimations[i];

            if (!targetedAnimation.target) {
                unTargetedAnimationIndices.push(i);
                this.warn(`Animation target is null. Animation name: ${targetedAnimation.animation.name}`);
                continue;
            }

            const targetName = sourceToTargetBoneNameMap[targetedAnimation.target.name];
            if (targetName !== undefined) {
                const bone = targetBoneMap.get(targetName);
                if (bone !== undefined) {
                    targetedAnimation.target = bone;
                } else {
                    unTargetedAnimationIndices.push(i);
                    this.warn(`Bone not found. Bone name: ${targetedAnimation.target.name}`);
                }
            } else {
                unTargetedAnimationIndices.push(i);
                this.warn(`Bone not found. Bone name: ${targetedAnimation.target.name}`);
            }
        }

        for (let i = 0, j = 0; i < targetedAnimations.length; i++) {
            if (i === unTargetedAnimationIndices[j]) {
                j += 1; // Skip untargeted animation
                continue;
            }

            targetedAnimations[i - j] = targetedAnimations[i];
        }
        targetedAnimations.length -= unTargetedAnimationIndices.length;
    }

    /**
     * Enable or disable debug logging (default: false)
     */
    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this._logEnabled;
            this.warn = this._warnEnabled;
            this.error = this._errorEnabled;
        } else {
            this.log = this._logDisabled;
            this.warn = this._warnDisabled;
            this.error = this._errorDisabled;
        }
    }

    private _logEnabled(message: string): void {
        Logger.Log(message);
    }

    private _logDisabled(): void {
        // do nothing
    }

    private _warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private _warnDisabled(): void {
        // do nothing
    }

    private _errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private _errorDisabled(): void {
        // do nothing
    }
}
