import type { _IAnimationState } from "@babylonjs/core/Animations/animation";
import { _staticOffsetValueColor3, _staticOffsetValueColor4, _staticOffsetValueQuaternion, _staticOffsetValueSize, _staticOffsetValueVector2, _staticOffsetValueVector3, Animation } from "@babylonjs/core/Animations/animation";
import type { IAnimationKey } from "@babylonjs/core/Animations/animationKey";
import { AnimationKeyInterpolation } from "@babylonjs/core/Animations/animationKey";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { RegisterClass } from "@babylonjs/core/Misc/typeStore";

import { bezierInterpolate } from "./bezierInterpolate";

// eslint-disable-next-line @typescript-eslint/naming-convention
type AnimationKeyInterpolationBezier<PhantomType = 2> = AnimationKeyInterpolation & { readonly __type: PhantomType };

/**
 * extends of AnimationKeyInterpolation to add bezier interpolation
 */
export const AnimationKeyInterpolationBezier = 2 as number as AnimationKeyInterpolationBezier;

/**
 * Partial implementation of cubic bezier interpolated animation
 */
export class BezierAnimation extends Animation {
    /**
     * Slerped tangent quaternion animation type
     */
    public static readonly ANIMATIONTYPE_SLERP_TANGENT_QUATERNION = 8;

    /**
     * @internal Internal use only
     */
    public override _interpolate(currentFrame: number, state: _IAnimationState, searchClosestKeyOnly = false): any {
        if (state.loopMode === Animation.ANIMATIONLOOPMODE_CONSTANT && state.repeatCount > 0) {
            return state.highLimitValue.clone ? state.highLimitValue.clone() : state.highLimitValue;
        }

        const keys = (this as any)._keys as IAnimationKey[];
        const keysLength = keys.length;

        let key = state.key;

        while (key >= 0 && currentFrame < keys[key].frame) {
            key -= 1;
        }

        while (key + 1 <= keysLength - 1 && currentFrame >= keys[key + 1].frame) {
            key += 1;
        }

        state.key = key;

        if (key < 0) {
            return searchClosestKeyOnly ? undefined : this._getKeyValue(keys[0].value);
        } else if (key + 1 > keysLength - 1) {
            return searchClosestKeyOnly ? undefined : this._getKeyValue(keys[keysLength - 1].value);
        }

        const startKey = keys[key];
        const endKey = keys[key + 1];

        if (searchClosestKeyOnly && (currentFrame === startKey.frame || currentFrame === endKey.frame)) {
            return undefined;
        }

        const startValue = this._getKeyValue(startKey.value);
        const endValue = this._getKeyValue(endKey.value);
        if (startKey.interpolation === AnimationKeyInterpolation.STEP) {
            if (endKey.frame > currentFrame) {
                return startValue;
            } else {
                return endValue;
            }
        }

        const useTangent = startKey.outTangent !== undefined && endKey.inTangent !== undefined;
        const frameDelta = endKey.frame - startKey.frame;

        // gradient : percent of currentFrame between the frame inf and the frame sup
        let gradient = (currentFrame - startKey.frame) / frameDelta;

        // check for easingFunction and correction of gradient
        const easingFunction = startKey.easingFunction || this.getEasingFunction();
        if (easingFunction !== null) {
            gradient = easingFunction.ease(gradient);
        }

        if (startKey.interpolation === AnimationKeyInterpolation.NONE) {
            switch (this.dataType) {
            // Float
            case Animation.ANIMATIONTYPE_FLOAT: {
                const floatValue = useTangent
                    ? this.floatInterpolateFunctionWithTangents(startValue, startKey.outTangent * frameDelta, endValue, endKey.inTangent * frameDelta, gradient)
                    : this.floatInterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return floatValue;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return (state.offsetValue ?? 0) * state.repeatCount + floatValue;
                }
                break;
            }
            // Quaternion
            case Animation.ANIMATIONTYPE_QUATERNION: {
                const quatValue = useTangent
                    ? this.quaternionInterpolateFunctionWithTangents(startValue, startKey.outTangent.scale(frameDelta), endValue, endKey.inTangent.scale(frameDelta), gradient)
                    : this.quaternionInterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return quatValue;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return quatValue.addInPlace((state.offsetValue || _staticOffsetValueQuaternion).scale(state.repeatCount));
                }

                return quatValue;
            }
            // Vector3
            case Animation.ANIMATIONTYPE_VECTOR3: {
                const vec3Value = useTangent
                    ? this.vector3InterpolateFunctionWithTangents(startValue, startKey.outTangent.scale(frameDelta), endValue, endKey.inTangent.scale(frameDelta), gradient)
                    : this.vector3InterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return vec3Value;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return vec3Value.add((state.offsetValue || _staticOffsetValueVector3).scale(state.repeatCount));
                }
                break;
            }
            // Vector2
            case Animation.ANIMATIONTYPE_VECTOR2: {
                const vec2Value = useTangent
                    ? this.vector2InterpolateFunctionWithTangents(startValue, startKey.outTangent.scale(frameDelta), endValue, endKey.inTangent.scale(frameDelta), gradient)
                    : this.vector2InterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return vec2Value;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return vec2Value.add((state.offsetValue || _staticOffsetValueVector2).scale(state.repeatCount));
                }
                break;
            }
            // Size
            case Animation.ANIMATIONTYPE_SIZE: {
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return this.sizeInterpolateFunction(startValue, endValue, gradient);
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return this.sizeInterpolateFunction(startValue, endValue, gradient).add((state.offsetValue || _staticOffsetValueSize).scale(state.repeatCount));
                }
                break;
            }
            // Color3
            case Animation.ANIMATIONTYPE_COLOR3: {
                const color3Value = useTangent
                    ? this.color3InterpolateFunctionWithTangents(startValue, startKey.outTangent.scale(frameDelta), endValue, endKey.inTangent.scale(frameDelta), gradient)
                    : this.color3InterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return color3Value;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return color3Value.add((state.offsetValue || _staticOffsetValueColor3).scale(state.repeatCount));
                }
                break;
            }
            // Color4
            case Animation.ANIMATIONTYPE_COLOR4: {
                const color4Value = useTangent
                    ? this.color4InterpolateFunctionWithTangents(startValue, startKey.outTangent.scale(frameDelta), endValue, endKey.inTangent.scale(frameDelta), gradient)
                    : this.color4InterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return color4Value;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return color4Value.add((state.offsetValue || _staticOffsetValueColor4).scale(state.repeatCount));
                }
                break;
            }
            // Matrix
            case Animation.ANIMATIONTYPE_MATRIX: {
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO: {
                    if (Animation.AllowMatricesInterpolation) {
                        return this.matrixInterpolateFunction(startValue, endValue, gradient, state.workValue);
                    }
                    return startValue;
                }
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT: {
                    return startValue;
                }
                }
                break;
            }
            }
        } else { // bezier
            switch (this.dataType) {
            // Float
            case Animation.ANIMATIONTYPE_FLOAT: {
                const floatValue = useTangent
                    ? this.floatInterpolateFunctionWithControlPoints(startValue, startKey.outTangent, endValue, endKey.inTangent, gradient)
                    : this.floatInterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return floatValue;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return (state.offsetValue ?? 0) * state.repeatCount + floatValue;
                }
                break;
            }
            // Quaternion
            case Animation.ANIMATIONTYPE_QUATERNION: {
                const quatValue = useTangent
                    ? this.quaternionInterpolateFunctionWithControlPoints(startValue, startKey.outTangent, endValue, endKey.inTangent, gradient)
                    : this.quaternionInterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return quatValue;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return quatValue.addInPlace((state.offsetValue || _staticOffsetValueQuaternion).scale(state.repeatCount));
                }

                return quatValue;
            }
            // Quaternion using slerp
            case BezierAnimation.ANIMATIONTYPE_SLERP_TANGENT_QUATERNION: {
                const quatValue = useTangent
                    ? this.quaternionInterpolateFunctionWithSlerpControlPoints(startValue, startKey.outTangent, endValue, endKey.inTangent, gradient)
                    : this.quaternionInterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return quatValue;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return quatValue.addInPlace((state.offsetValue || _staticOffsetValueQuaternion).scale(state.repeatCount));
                }

                return quatValue;
            }
            // Vector3
            case Animation.ANIMATIONTYPE_VECTOR3: {
                const vec3Value = useTangent
                    ? this.vector3InterpolateFunctionWithControlPoints(startValue, startKey.outTangent, endValue, endKey.inTangent, gradient)
                    : this.vector3InterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return vec3Value;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return vec3Value.add((state.offsetValue || _staticOffsetValueVector3).scale(state.repeatCount));
                }
                break;
            }
            // Vector2
            case Animation.ANIMATIONTYPE_VECTOR2: {
                const vec2Value = useTangent
                    ? this.vector2InterpolateFunctionWithControlPoints(startValue, startKey.outTangent, endValue, endKey.inTangent, gradient)
                    : this.vector2InterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return vec2Value;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return vec2Value.add((state.offsetValue || _staticOffsetValueVector2).scale(state.repeatCount));
                }
                break;
            }
            // Size
            case Animation.ANIMATIONTYPE_SIZE: {
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return this.sizeInterpolateFunction(startValue, endValue, gradient);
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return this.sizeInterpolateFunction(startValue, endValue, gradient).add((state.offsetValue || _staticOffsetValueSize).scale(state.repeatCount));
                }
                break;
            }
            // Color3
            case Animation.ANIMATIONTYPE_COLOR3: {
                const color3Value = useTangent
                    ? this.color3InterpolateFunctionWithControlPoints(startValue, startKey.outTangent, endValue, endKey.inTangent, gradient)
                    : this.color3InterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return color3Value;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return color3Value.add((state.offsetValue || _staticOffsetValueColor3).scale(state.repeatCount));
                }
                break;
            }
            // Color4
            case Animation.ANIMATIONTYPE_COLOR4: {
                const color4Value = useTangent
                    ? this.color4InterpolateFunctionWithControlPoints(startValue, startKey.outTangent, endValue, endKey.inTangent, gradient)
                    : this.color4InterpolateFunction(startValue, endValue, gradient);
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO:
                    return color4Value;
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT:
                    return color4Value.add((state.offsetValue || _staticOffsetValueColor4).scale(state.repeatCount));
                }
                break;
            }
            // Matrix
            case Animation.ANIMATIONTYPE_MATRIX: {
                switch (state.loopMode) {
                case Animation.ANIMATIONLOOPMODE_CYCLE:
                case Animation.ANIMATIONLOOPMODE_CONSTANT:
                case Animation.ANIMATIONLOOPMODE_YOYO: {
                    if (Animation.AllowMatricesInterpolation) {
                        return this.matrixInterpolateFunction(startValue, endValue, gradient, state.workValue);
                    }
                    return startValue;
                }
                case Animation.ANIMATIONLOOPMODE_RELATIVE:
                case Animation.ANIMATIONLOOPMODE_RELATIVE_FROM_CURRENT: {
                    return startValue;
                }
                }
                break;
            }
            }
        }

        return 0;
    }

    /**
     * Interpolates a scalar cubically from control points
     * @param startValue Start value of the animation curve
     * @param outTangent End tangent of the animation
     * @param endValue End value of the animation curve
     * @param inTangent Start tangent of the animation curve
     * @param gradient Scalar amount to interpolate
     * @returns Interpolated scalar value
     */
    public floatInterpolateFunctionWithControlPoints(startValue: number, outTangent: Vector2, endValue: number, inTangent: Vector2, gradient: number): number {
        const weight = bezierInterpolate(outTangent.x, inTangent.x, outTangent.y, inTangent.y, gradient);
        return startValue * (1 - weight) + endValue * weight;
    }

    /**
     * Interpolates a quaternion cubically from control points
     * @param startValue Start value of the animation curve
     * @param outTangent End tangent of the animation curve
     * @param endValue End value of the animation curve
     * @param inTangent Start tangent of the animation curve
     * @param gradient Scalar amount to interpolate
     * @returns Interpolated quaternion value
     */
    public quaternionInterpolateFunctionWithControlPoints(startValue: Quaternion, outTangent: [Vector2, Vector2, Vector2, Vector2], endValue: Quaternion, inTangent: [Vector2, Vector2, Vector2, Vector2], gradient: number): Quaternion {
        const weightX = bezierInterpolate(outTangent[0].x, inTangent[0].x, outTangent[0].y, inTangent[0].y, gradient);
        const weightY = bezierInterpolate(outTangent[1].x, inTangent[1].x, outTangent[1].y, inTangent[1].y, gradient);
        const weightZ = bezierInterpolate(outTangent[2].x, inTangent[2].x, outTangent[2].y, inTangent[2].y, gradient);
        const weightW = bezierInterpolate(outTangent[3].x, inTangent[3].x, outTangent[3].y, inTangent[3].y, gradient);
        return new Quaternion(
            startValue.x * (1 - weightX) + endValue.x * weightX,
            startValue.y * (1 - weightY) + endValue.y * weightY,
            startValue.z * (1 - weightZ) + endValue.z * weightZ,
            startValue.w * (1 - weightW) + endValue.w * weightW
        );
    }

    /**
     * Interpolates a quaternion cubically from control points with slerp
     * @param startValue Start value of the animation curve
     * @param outTangent End tangent of the animation curve
     * @param endValue End value of the animation curve
     * @param inTangent Start tangent of the animation curve
     * @param gradient Scalar amount to interpolate
     * @returns Interpolated quaternion value
     */
    public quaternionInterpolateFunctionWithSlerpControlPoints(startValue: Quaternion, outTangent: Vector2, endValue: Quaternion, inTangent: Vector2, gradient: number): Quaternion {
        const weight = bezierInterpolate(outTangent.x, inTangent.x, outTangent.y, inTangent.y, gradient);
        return Quaternion.Slerp(startValue, endValue, weight);
    }

    /**
     * Interpolates a Vector3 cubically from control points
     * @param startValue Start value of the animation curve
     * @param outTangent End tangent of the animation
     * @param endValue End value of the animation curve
     * @param inTangent Start tangent of the animation curve
     * @param gradient Scalar amount to interpolate (value between 0 and 1)
     * @returns InterpolatedVector3 value
     */
    public vector3InterpolateFunctionWithControlPoints(startValue: Vector3, outTangent: [Vector2, Vector2, Vector2], endValue: Vector3, inTangent: [Vector2, Vector2, Vector2], gradient: number): Vector3 {
        const weightX = bezierInterpolate(outTangent[0].x, inTangent[0].x, outTangent[0].y, inTangent[0].y, gradient);
        const weightY = bezierInterpolate(outTangent[1].x, inTangent[1].x, outTangent[1].y, inTangent[1].y, gradient);
        const weightZ = bezierInterpolate(outTangent[2].x, inTangent[2].x, outTangent[2].y, inTangent[2].y, gradient);
        return new Vector3(
            startValue.x * (1 - weightX) + endValue.x * weightX,
            startValue.y * (1 - weightY) + endValue.y * weightY,
            startValue.z * (1 - weightZ) + endValue.z * weightZ
        );
    }

    /**
     * Interpolates a Vector2 cubically from control points
     * @param startValue Start value of the animation curve
     * @param outTangent End tangent of the animation
     * @param endValue End value of the animation curve
     * @param inTangent Start tangent of the animation curve
     * @param gradient Scalar amount to interpolate (value between 0 and 1)
     * @returns Interpolated Vector2 value
     */
    public vector2InterpolateFunctionWithControlPoints(startValue: Vector2, outTangent: [Vector2, Vector2], endValue: Vector2, inTangent: [Vector2, Vector2], gradient: number): Vector2 {
        const weightX = bezierInterpolate(outTangent[0].x, inTangent[0].x, outTangent[0].y, inTangent[0].y, gradient);
        const weightY = bezierInterpolate(outTangent[1].x, inTangent[1].x, outTangent[1].y, inTangent[1].y, gradient);
        return new Vector2(
            startValue.x * (1 - weightX) + endValue.x * weightX,
            startValue.y * (1 - weightY) + endValue.y * weightY
        );
    }

    /**
     * Interpolates a Color3 cubically from control points
     * @param startValue Start value of the animation curve
     * @param outTangent End tangent of the animation
     * @param endValue End value of the animation curve
     * @param inTangent Start tangent of the animation curve
     * @param gradient Scalar amount to interpolate
     * @returns interpolated value
     */
    public color3InterpolateFunctionWithControlPoints(startValue: Color3, outTangent: [Vector2, Vector2, Vector2], endValue: Color3, inTangent: [Vector2, Vector2, Vector2], gradient: number): Color3 {
        const weightR = bezierInterpolate(outTangent[0].x, inTangent[0].x, outTangent[0].y, inTangent[0].y, gradient);
        const weightG = bezierInterpolate(outTangent[1].x, inTangent[1].x, outTangent[1].y, inTangent[1].y, gradient);
        const weightB = bezierInterpolate(outTangent[2].x, inTangent[2].x, outTangent[2].y, inTangent[2].y, gradient);
        return new Color3(
            startValue.r * (1 - weightR) + endValue.r * weightR,
            startValue.g * (1 - weightG) + endValue.g * weightG,
            startValue.b * (1 - weightB) + endValue.b * weightB
        );
    }

    /**
     * Interpolates a Color4 cubically from control points
     * @param startValue Start value of the animation curve
     * @param outTangent End tangent of the animation
     * @param endValue End value of the animation curve
     * @param inTangent Start tangent of the animation curve
     * @param gradient Scalar amount to interpolate
     * @returns interpolated value
     */
    public color4InterpolateFunctionWithControlPoints(startValue: Color4, outTangent: Color4, endValue: Color4, inTangent: Color4, gradient: number): Color4 {
        const weightR = bezierInterpolate(outTangent.r, inTangent.r, outTangent.g, inTangent.g, gradient);
        const weightG = bezierInterpolate(outTangent.b, inTangent.b, outTangent.g, inTangent.g, gradient);
        const weightB = bezierInterpolate(outTangent.b, inTangent.b, outTangent.g, inTangent.g, gradient);
        const weightA = bezierInterpolate(outTangent.a, inTangent.a, outTangent.g, inTangent.g, gradient);
        return new Color4(
            startValue.r * (1 - weightR) + endValue.r * weightR,
            startValue.g * (1 - weightG) + endValue.g * weightG,
            startValue.b * (1 - weightB) + endValue.b * weightB,
            startValue.a * (1 - weightA) + endValue.a * weightA
        );
    }

    // NOTE: clone method is just a copy of the original method with a different return type. becareful to babylon.js internal changes
    /**
     * Makes a copy of the animation
     * @returns Cloned animation
     */
    public override clone(): BezierAnimation {
        const clone = new BezierAnimation(this.name, this.targetPropertyPath.join("."), this.framePerSecond, this.dataType, this.loopMode);

        clone.enableBlending = this.enableBlending;
        clone.blendingSpeed = this.blendingSpeed;

        if ((this as any)._keys) {
            clone.setKeys((this as any)._keys);
        }

        if ((this as any)._ranges) {
            (clone as any)._ranges = {};
            for (const name in (this as any)._ranges) {
                const range = (this as any)._ranges[name];
                if (!range) {
                    continue;
                }
                (clone as any)._ranges[name] = range.clone();
            }
        }

        return clone;
    }

    // NOTE: currently there is no way to override Animation.Parse method
}

RegisterClass("BABYLON.BezierAnimation", BezierAnimation);
