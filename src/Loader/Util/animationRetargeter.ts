import type { AnimationGroup, TargetedAnimation } from "@babylonjs/core/Animations/animationGroup";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { Nullable } from "@babylonjs/core/types";

import { convertToAdditiveAnimation } from "./convertToAdditiveAnimation";
import { deepCopyAnimationGroup } from "./deepCopyAnimation";

/**
 * Options for AnimationRetargeter.retargetAnimation
 */
export interface RetargetOptions {
    /**
     * Clone animation group before retargeting (default: true)
     */
    cloneAnimation?: boolean;

    /**
     * Remove bone rotation offset (default: false)
     */
    removeBoneRotationOffset?: boolean;

    /**
     * Bone name to euler angle rotation offset map
     *
     * Typically used when converting from A to T pose
     */
    rotationOffsets?: { [key: string]: Vector3 };
}

/**
 * Make animation compatible with mmd model
 */
export class AnimationRetargeter {
    private _boneNameMap: Nullable<{ [key: string]: string }>;

    private _sourceSkeleton: Nullable<Skeleton>;
    private _targetSkeleton: Nullable<Skeleton>;

    private _sourceSkeletonTransformOffset: Nullable<Matrix>;
    private _sourceSkeletonAbsoluteMatrices: Nullable<Matrix[]>;

    private _targetBoneNameMap: Nullable<Map<string, Bone>>;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    /**
     * Instantiate AnimationRetargeter
     */
    public constructor() {
        this._boneNameMap = null;

        this._sourceSkeleton = null;
        this._targetSkeleton = null;

        this._sourceSkeletonTransformOffset = null;
        this._sourceSkeletonAbsoluteMatrices = null;

        this._targetBoneNameMap = null;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    /**
     * Set source bone to target bone name map
     * @param boneMap source bone to target bone name map
     * @returns this
     */
    public setBoneMap(boneMap: { [key: string]: string }): this {
        this._boneNameMap = boneMap;
        return this;
    }

    /**
     * Set source skeleton that has animation to retarget
     *
     * In general use case, the source skeleton and the target skeleton should be looking in the same direction in the world space
     *
     * And the `transformOffset` must be set to the mesh that binded to the source skeleton
     * @param skeleton source skeleton
     * @param transformOffset transform offset
     * @returns this
     */
    public setSourceSkeleton(skeleton: Skeleton, transformOffset?: TransformNode | Matrix): this {
        this._sourceSkeleton = skeleton;
        if (transformOffset === undefined) {
            this._sourceSkeletonTransformOffset = null;
        } else if ((transformOffset as TransformNode).getWorldMatrix !== undefined) {
            this._sourceSkeletonTransformOffset = (transformOffset as TransformNode).computeWorldMatrix(true).clone();
        } else {
            this._sourceSkeletonTransformOffset = (transformOffset as Matrix).clone();
        }
        this._sourceSkeletonAbsoluteMatrices = null;
        return this;
    }

    /**
     * Set target skeleton
     * @param skeleton target skeleton
     * @returns this
     */
    public setTargetSkeleton(skeleton: Skeleton): this {
        this._targetSkeleton = skeleton;
        this._targetBoneNameMap = null;
        return this;
    }

    /**
     * Remap the bone's name and modify the animation data to convert it to a rotation that matches the source skeleton
     *
     * In the current implementation, retargeting is performed assuming that all bones in the target skeleton have no rotation offset
     *
     * because that's the bone structure of the mmd model
     *
     * These limitations may be removed in the future
     *
     * @param animationGroup animation group to retarget
     * @param options rtetarget options
     * @returns retargeted animation group
     */
    public retargetAnimation(animationGroup: AnimationGroup, options?: RetargetOptions): Nullable<AnimationGroup> {
        if (!this._isSkeletonAnimation(animationGroup)) {
            this.warn("Animation is not skeleton animation. animation retargeting is aborted.");
            return null;
        }

        if (options === undefined) {
            options = {};
        }
        options.cloneAnimation ??= true;
        options.removeBoneRotationOffset ??= false;

        if (this._boneNameMap === null) {
            throw new Error("Bone map is not set");
        }

        if (this._sourceSkeleton === null) {
            throw new Error("Source skeleton is not set");
        }

        if (this._targetSkeleton === null) {
            throw new Error("Target skeleton is not set");
        }

        if (this._targetBoneNameMap === null) {
            const boneNameMap = this._targetBoneNameMap = new Map<string, Bone>();
            {
                const bones = this._targetSkeleton.bones;
                for (let i = 0; i < bones.length; ++i) {
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
        for (let i = 0; i < targetedAnimations.length; ++i) {
            this._flattenAnimationTarget(targetedAnimations[i]);
        }

        if (!animationGroup.isAdditive) {
            convertToAdditiveAnimation(animationGroup, this._sourceSkeleton);
        }

        if (options.rotationOffsets !== undefined) {
            const rotationOffsetQuaternion = new Quaternion();

            const rotationOffsets = options.rotationOffsets;
            const targetedAnimations = animationGroup.targetedAnimations;
            for (let i = 0; i < targetedAnimations.length; ++i) {
                const target = targetedAnimations[i].target;
                const targetPropertyPath = targetedAnimations[i].animation.targetPropertyPath;
                const targetProperty = targetPropertyPath[targetPropertyPath.length - 1];

                if (targetProperty === "rotationQuaternion") {
                    const boneName = target.name;
                    const rotationOffset = rotationOffsets[boneName];
                    if (rotationOffset !== undefined) {
                        Quaternion.FromEulerAnglesToRef(rotationOffset.x, rotationOffset.y, rotationOffset.z, rotationOffsetQuaternion);

                        const keys = targetedAnimations[i].animation.getKeys();
                        for (let j = 0; j < keys.length; ++j) {
                            const value = keys[j].value as Quaternion;

                            rotationOffsetQuaternion.multiplyToRef(value, value);
                        }
                    }
                }
            }
        }

        if (options.removeBoneRotationOffset) {
            const linkedTransformNodeMap = new Map<TransformNode, Bone>();
            const sourceBoneIndexMap = new Map<Bone, number>();
            {
                const bones = this._sourceSkeleton.bones;
                for (let i = 0; i < bones.length; ++i) {
                    const bone = bones[i];
                    const linkedTransformNode = bone.getTransformNode();
                    if (linkedTransformNode !== null) {
                        linkedTransformNodeMap.set(linkedTransformNode, bone);
                    }
                    sourceBoneIndexMap.set(bone, i);
                }
            }
            const animationIndexBinding = new Int32Array(targetedAnimations.length);
            for (let i = 0; i < targetedAnimations.length; ++i) {
                const target = targetedAnimations[i].target;
                let bone = linkedTransformNodeMap.get(target); // if target is linked transform node, get linked bone
                if (bone === undefined) {
                    bone = target as Bone; // target is bone
                }

                const boneIndex = sourceBoneIndexMap.get(bone);
                if (boneIndex === undefined) {
                    animationIndexBinding[i] = -1;
                    this.warn(`${bone.name} is not found in source skeleton`);
                } else {
                    animationIndexBinding[i] = boneIndex;
                }
            }

            if (this._sourceSkeletonAbsoluteMatrices === null) {
                this._sourceSkeletonAbsoluteMatrices = this._computeSkeletonAbsoluteMatrices(
                    this._sourceSkeleton,
                    this._sourceSkeletonTransformOffset,
                    sourceBoneIndexMap
                );
            }

            this._removeBoneRotationOffset(
                animationGroup,
                animationIndexBinding,
                this._sourceSkeleton,
                this._sourceSkeletonAbsoluteMatrices,
                sourceBoneIndexMap
            );
        }

        this._retargetAnimationInternal(animationGroup, this._boneNameMap, this._targetBoneNameMap);
        return animationGroup;
    }

    private _isSkeletonAnimation(animationGroup: AnimationGroup): boolean {
        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; ++i) {
            const animation = targetedAnimations[i].animation;
            const property = animation.targetPropertyPath[animation.targetPropertyPath.length - 1];

            if (property !== "position" && property !== "rotationQuaternion" && property !== "scaling") {
                return false;
            }
        }

        return true;
    }

    private static readonly _Stack: Bone[] = [];

    private _computeSkeletonAbsoluteMatrices(
        skeleton: Skeleton,
        skeletonTransformOffset: Nullable<Matrix>,
        boneIndexMap: Map<Bone, number>
    ): Matrix[] {
        const bones = skeleton.bones;

        const stack = AnimationRetargeter._Stack;
        stack.length = 0;
        for (let i = 0; i < bones.length; ++i) {
            const bone = bones[i];
            if (bone.getParent() === null) stack.push(bone);
        }

        if (skeletonTransformOffset === null) {
            skeletonTransformOffset = Matrix.Identity();
        }

        const absoluteMatrices = new Array<Matrix>(bones.length);
        while (stack.length > 0) {
            const bone = stack.pop()!;
            const parent = bone.getParent();

            const parentAbsoluteMatrix = parent === null
                ? skeletonTransformOffset
                : absoluteMatrices[boneIndexMap.get(parent)!];

            absoluteMatrices[boneIndexMap.get(bone)!] = bone.getRestMatrix().multiply(parentAbsoluteMatrix);

            const children = bone.getChildren();
            for (let i = 0; i < children.length; ++i) {
                stack.push(children[i]);
            }
        }

        return absoluteMatrices;
    }

    private _removeScaleAnimation(animationGroup: AnimationGroup): void {
        const scaleAnimationIndices: number[] = [];

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; ++i) {
            const targetedAnimation = targetedAnimations[i];

            if (!targetedAnimation.target) continue;

            const targetProperty = targetedAnimation.animation.targetProperty;
            if (targetProperty === "scaling") {
                scaleAnimationIndices.push(i);
            }
        }

        for (let i = 0, j = 0; i < targetedAnimations.length; ++i) {
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

    private _removeBoneRotationOffset(
        animationGroup: AnimationGroup,
        animationIndexBinding: Int32Array,
        skeleton: Skeleton,
        skeletonAbsoluteMatrices: Matrix[],
        boneIndexMap: Map<Bone, number>
    ): void {
        const targetedAnimations = animationGroup.targetedAnimations;

        const rotationMatrix = new Matrix();
        const absoluteMatrixInverse = new Matrix();

        const skeletonTransformOffset = this._sourceSkeletonTransformOffset;

        for (let i = 0; i < targetedAnimations.length; ++i) {
            const boneIndex = animationIndexBinding[i];
            if (boneIndex === -1) continue;

            const animation = targetedAnimations[i].animation;
            const targetProperty = animation.targetProperty;

            const bone = skeleton.bones[boneIndex];

            if (targetProperty === "rotationQuaternion") {
                const absoluteMatrix = skeletonAbsoluteMatrices[boneIndex];
                absoluteMatrix.invertToRef(absoluteMatrixInverse);

                const keys = animation.getKeys();
                for (let j = 0; j < keys.length; ++j) {
                    const value = keys[j].value as Quaternion;

                    absoluteMatrixInverse.multiplyToRef(
                        Matrix.FromQuaternionToRef(value, rotationMatrix),
                        rotationMatrix
                    );
                    rotationMatrix.multiplyToRef(absoluteMatrix, rotationMatrix);

                    Quaternion.FromRotationMatrixToRef(rotationMatrix, value);
                }
            } else if (targetProperty === "position") {
                const parentBone = bone.getParent();
                const parentIndex = parentBone !== null ? boneIndexMap.get(parentBone)! : -1;
                const boneParentAbsoluteMatrix = parentIndex !== -1 ? skeletonAbsoluteMatrices[parentIndex] : skeletonTransformOffset;

                if (boneParentAbsoluteMatrix !== null) {
                    const keys = animation.getKeys();
                    for (let j = 0; j < keys.length; ++j) {
                        const value = keys[j].value as Vector3;

                        Vector3.TransformNormalToRef(value, boneParentAbsoluteMatrix, value);
                    }
                }
            } else {
                this.warn(`Unsupported target property: ${targetProperty}`);
            }
        }
    }

    private _retargetAnimationInternal(
        animationGroup: AnimationGroup,
        sourceToTargetBoneNameMap: { [key: string]: string },
        targetBoneMap: Map<string, Bone>
    ): void {
        const unTargetedAnimationIndices: number[] = [];

        const targetedAnimations = animationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; ++i) {
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

        for (let i = 0, j = 0; i < targetedAnimations.length; ++i) {
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
