import type { _IAnimationState, Animation } from "@babylonjs/core/Animations/animation";
import type { AnimationGroup, TargetedAnimation } from "@babylonjs/core/Animations/animationGroup";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { Nullable } from "@babylonjs/core/types";

import { createAnimationState } from "@/Runtime/Animation/Common/createAnimationState";

import { convertToAdditiveAnimation } from "./convertToAdditiveAnimation";
import { deepCopyAnimationGroup } from "./deepCopyAnimation";

class AnimationEvaluationContext {
    private readonly _animation: Animation;
    private readonly _animationState: _IAnimationState;

    public constructor(animation: Animation) {
        this._animation = animation;
        this._animationState = createAnimationState();
    }

    private _upperBoundFrameIndex(currentFrame: number): number {
        const keys = this._animation.getKeys();
        const keysLength = keys.length;

        let key = this._animationState.key;

        while (0 < key && currentFrame < keys[key - 1].frame) key -= 1;
        while (key < keysLength && keys[key].frame <= currentFrame) key += 1;

        this._animationState.key = key;

        return key;
    }

    public hasKeyAtFrame(currentFrame: number): boolean {
        const keys = this._animation.getKeys();
        const upperBoundIndex = this._upperBoundFrameIndex(currentFrame);
        return keys[upperBoundIndex - 1].frame === currentFrame;
    }

    public evaluate(currentFrame: number): any {
        return this._animation._interpolate(currentFrame, this._animationState);
    }
}

class VirtualBone {
    public name: string;
    public parent: Nullable<VirtualBone>;
    public readonly children: VirtualBone[];
    public retargetBone: Nullable<VirtualBone>;

    public readonly restQuaternion: Quaternion;
    public readonly localQuaternion: Quaternion;
    public readonly worldQuaternion: Quaternion;

    public isDirty: boolean;

    public constructor(
        name: string,
        restQuaternion: Quaternion
    ) {
        this.name = name;
        this.parent = null;
        this.children = [];
        this.retargetBone = null;

        this.restQuaternion = restQuaternion;
        this.localQuaternion = restQuaternion.clone();
        this.worldQuaternion = restQuaternion.clone();

        this.isDirty = false;
    }

    public markAsDirty(): void {
        this.retargetBone?.markAsDirty();

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let bone: Nullable<VirtualBone> = this;
        while (bone !== null && !bone.isDirty) {
            bone.isDirty = true;
            bone = bone.parent;
        }
    }
}

class VirtualSkeleton {
    public bones: readonly VirtualBone[];
    public rootBones: readonly VirtualBone[];

    public constructor(
        skeleton: Skeleton,
        retargetSkeleton: Nullable<VirtualSkeleton>,
        sourceToTargetBoneNameMap?: { [key: string]: string }
    ) {
        const sourceBones = skeleton.bones;
        const sourceBoneIndexMap = new Map<Bone, number>();
        const bones = this.bones = new Array<VirtualBone>(sourceBones.length);
        for (let i = 0; i < sourceBones.length; i++) {
            const sourceBone = sourceBones[i];
            sourceBoneIndexMap.set(sourceBone, i);
            bones[i] = new VirtualBone(
                sourceBone.name,
                Quaternion.FromRotationMatrix(sourceBone.getRestMatrix())
            );
        }

        const rootBones: VirtualBone[] = this.rootBones = [];
        for (let i = 0; i < sourceBones.length; i++) {
            const sourceBone = sourceBones[i];
            const bone = bones[i];

            const parentBone = sourceBone.getParent();
            if (parentBone) {
                const parentBoneIndex = sourceBoneIndexMap.get(parentBone)!;
                const parent = bones[parentBoneIndex];
                bone.parent = parent;
                parent.children.push(bone);
            } else {
                rootBones.push(bone);
            }
        }

        if (retargetSkeleton !== null) {
            const retargetBoneNameMap = new Map<string, VirtualBone>();
            {
                const bones = retargetSkeleton.bones;
                for (let i = 0; i < bones.length; i++) {
                    const bone = bones[i];
                    retargetBoneNameMap.set(bone.name, bone);
                }
            }

            if (sourceToTargetBoneNameMap === undefined) {
                for (let i = 0; i < bones.length; i++) {
                    const bone = bones[i];
                    const retargetBone = retargetBoneNameMap.get(bone.name);
                    if (retargetBone !== undefined) {
                        bone.retargetBone = retargetBone;
                    }
                }
            } else {
                for (let i = 0; i < bones.length; i++) {
                    const bone = bones[i];
                    const retargetBoneName = sourceToTargetBoneNameMap[bone.name];
                    if (retargetBoneName !== undefined) {
                        const retargetBone = retargetBoneNameMap.get(retargetBoneName);
                        if (retargetBone !== undefined) {
                            bone.retargetBone = retargetBone;
                        }
                    }
                }
            }
        }
    }

    private static readonly _Stack: VirtualBone[] = [];

    public partialUpdateWorldQuaternion(): void {
        const stack = VirtualSkeleton._Stack;
        stack.length = 0;
        stack.push(...this.rootBones);

        while (stack.length > 0) {
            const bone = stack.pop()!;

            if (bone.parent) {
                bone.parent.worldQuaternion.multiplyToRef(bone.localQuaternion, bone.worldQuaternion);
            } else {
                bone.worldQuaternion.copyFrom(bone.localQuaternion);
            }

            const childrenBones = bone.children;
            for (let i = 0, l = childrenBones.length; i < l; ++i) {
                if (childrenBones[i].isDirty) {
                    stack.push(childrenBones[i]);
                }
            }
        }
    }
}

/**
 * Make animation compatible with mmd model
 */
export class AnimationRetargeter {
    private _boneNameMap: Nullable<{ [key: string]: string }>;

    private _sourceSkeleton: Nullable<Skeleton>;
    private _targetSkeleton: Nullable<Skeleton>;

    private _sourceVirtualSkeleton: Nullable<VirtualSkeleton>;
    private _targetVirtualSkeleton: Nullable<VirtualSkeleton>;

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

        this._sourceVirtualSkeleton = null;
        this._targetVirtualSkeleton = null;

        this._targetBoneMap = null;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    public setBoneMap(boneMap: { [key: string]: string }): this {
        this._boneNameMap = boneMap;
        this._sourceVirtualSkeleton = null;
        return this;
    }

    public setSourceSkeleton(skeleton: Skeleton): this {
        this._sourceSkeleton = skeleton;
        this._sourceVirtualSkeleton = null;
        return this;
    }

    public setTargetSkeleton(skeleton: Skeleton): this {
        this._targetSkeleton = skeleton;
        this._sourceVirtualSkeleton = null;
        this._targetVirtualSkeleton = null;
        this._targetBoneMap = null;
        return this;
    }

    public retargetAnimation(animationGroup: AnimationGroup): Nullable<AnimationGroup> {
        if (!this._isSkeletonAnimation(animationGroup)) {
            this.warn("Animation is not skeleton animation. animation retargeting is aborted.");
            return null;
        }

        if (!this._boneNameMap) {
            throw new Error("Bone map is not set");
        }

        if (!this._sourceSkeleton) {
            throw new Error("Source skeleton is not set");
        }

        if (!this._targetSkeleton) {
            throw new Error("Target skeleton is not set");
        }

        if (this._targetVirtualSkeleton === null) {
            this._targetVirtualSkeleton = new VirtualSkeleton(this._targetSkeleton, null);
        }

        if (this._sourceVirtualSkeleton === null) {
            this._sourceVirtualSkeleton = new VirtualSkeleton(this._sourceSkeleton, this._targetVirtualSkeleton, this._boneNameMap);
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

        const additiveAnimationGroup = animationGroup.isAdditive
            ? animationGroup.clone(animationGroup.name)
            : deepCopyAnimationGroup(animationGroup, animationGroup.name);

        this._removeScaleAnimation(additiveAnimationGroup);
        const targetedAnimations = additiveAnimationGroup.targetedAnimations;
        for (let i = 0; i < targetedAnimations.length; i++) {
            this._flattenAnimationTarget(targetedAnimations[i]);
        }

        if (!additiveAnimationGroup.isAdditive) {
            convertToAdditiveAnimation(additiveAnimationGroup, this._sourceSkeleton);
        }

        const linkedTransformNodeMap = new Map<TransformNode, Bone>();
        const sourceBoneIndexMap = new Map<Bone, number>();
        {
            const bones = this._sourceSkeleton.bones;
            for (let i = 0; i < bones.length; i++) {
                const bone = bones[i];
                const linkedTransformNode = bone.getTransformNode();
                if (linkedTransformNode !== null) {
                    linkedTransformNodeMap.set(linkedTransformNode, bone);
                }
                sourceBoneIndexMap.set(bone, i);
            }
        }
        const animationIndexBinding = new Int32Array(targetedAnimations.length);
        for (let i = 0; i < targetedAnimations.length; i++) {
            const target = targetedAnimations[i].target;
            let bone = linkedTransformNodeMap.get(target); // if target is linked transform node, get linked bone
            if (bone === undefined) {
                bone = target as Bone; // target is bone
            }

            animationIndexBinding[i] = sourceBoneIndexMap.get(bone)!;
        }

        const newAnimationGroup = this._changeAnimationRestPose(additiveAnimationGroup, animationIndexBinding, this._sourceVirtualSkeleton, this._targetVirtualSkeleton);
        additiveAnimationGroup.dispose();

        this._retargetAnimationInternal; //(newAnimationGroup, this._boneNameMap, this._targetBoneMap);

        return newAnimationGroup;
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

    private _changeAnimationRestPose(
        sourceAnimationGroup: AnimationGroup,
        animationIndexBinding: Int32Array,
        sourceSkeleton: VirtualSkeleton,
        targetSkeleton: VirtualSkeleton
    ): AnimationGroup {
        const destinationAnimationGroup = deepCopyAnimationGroup(sourceAnimationGroup, sourceAnimationGroup.name);

        const targetedAnimations = sourceAnimationGroup.targetedAnimations;

        const startFrame = sourceAnimationGroup.from;
        const endFrame = sourceAnimationGroup.to;

        const sourceBones = sourceSkeleton.bones;
        const targetBones = targetSkeleton.bones;

        destinationAnimationGroup;
        targetedAnimations;
        animationIndexBinding;
        startFrame;
        endFrame;
        sourceBones;
        targetBones;

        AnimationEvaluationContext;

        return destinationAnimationGroup;

        // const keys = animation.getKeys();
        // keys;

        // TODO: for change rest pose, we need to
        //
        // for quaternion:
        // 1. evaluate each keyframe for get world animated rotation (use animation and originalRestPose)
        // 2. calculate local rotation from world rotation (use newRestPose)
        // 3. apply local transform to keyframe
        //
        // - worldRotation -> localRotation -> localRotationOffset
        //
        //
        // for vector3:
        // 1. evaluate each keyframe for get world animated rotation (use animation and originalRestPose)
        // 2. calculate world position offset from animation and rotate it by world animated rotation
        // 3. calculate retargeted local position offset from newRestPose
        //
        // - originalLocalPositionOffset -> worldPositionOffset -> newLocalPositionOffset

        // switch (animation.dataType) {
        // // Quaternion
        // case Animation.ANIMATIONTYPE_QUATERNION: {
        //     // const originalRestPoseValueInversed = (originalRestPoseValue as Quaternion).clone().invertInPlace();
        //     // for (let i = 0; i < keys.length; i++) {
        //     //     keys[i].value.multiplyToRef(
        //     //         originalRestPoseValueInversed.multiply(newRestPoseValue as Quaternion),
        //     //         keys[i].value
        //     //     );
        //     // }
        //     break;
        // }

        // // Vector3
        // case Animation.ANIMATIONTYPE_VECTOR3: {
        //     // for (let i = 0; i < keys.length; i++) {
        //     //     (keys[i].value as Vector3);
        //     //     // .subtractInPlace(originalRestPoseValue)
        //     //     // .addInPlace(newRestPoseValue);
        //     // }
        //     break;
        // }

        // default: {
        //     this.warn("Animation data type is not supported");
        //     break;
        // }
        // }
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
