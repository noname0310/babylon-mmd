import { Animation, _IAnimationState } from "@babylonjs/core/Animations/animation";
import { AnimationKeyInterpolation, IAnimationKey } from "@babylonjs/core/Animations/animationKey";

/**
 * Partial implementation of cubic bezier interpolated animation
 */
export class BezierAnimation extends Animation {
    /**
     * @internal Internal use only
     */
    public override _interpolate(currentFrame: number, state: _IAnimationState): any {
        if (state.loopMode === Animation.ANIMATIONLOOPMODE_CONSTANT && state.repeatCount > 0) {
            return state.highLimitValue.clone ? state.highLimitValue.clone() : state.highLimitValue;
        }

        const keys = (this as any)._keys as IAnimationKey[];
        const keysLength = keys.length;

        let key = state.key;

        while (key >= 0 && currentFrame < keys[key].frame) {
            --key;
        }

        while (key + 1 <= keysLength - 1 && currentFrame >= keys[key + 1].frame) {
            ++key;
        }

        state.key = key;

        if (key < 0) {
            return this._getKeyValue(keys[0].value);
        } else if (key + 1 > keysLength - 1) {
            return this._getKeyValue(keys[keysLength - 1].value);
        }

        const startKey = keys[key];
        const endKey = keys[key + 1];
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
        const easingFunction = this.getEasingFunction();
        if (easingFunction !== null) {
            gradient = easingFunction.ease(gradient);
        }

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
                        return state.offsetValue * state.repeatCount + floatValue;
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
                        return quatValue.addInPlace(state.offsetValue.scale(state.repeatCount));
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
                        return vec3Value.add(state.offsetValue.scale(state.repeatCount));
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
                        return vec2Value.add(state.offsetValue.scale(state.repeatCount));
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
                        return this.sizeInterpolateFunction(startValue, endValue, gradient).add(state.offsetValue.scale(state.repeatCount));
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
                        return color3Value.add(state.offsetValue.scale(state.repeatCount));
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
                        return color4Value.add(state.offsetValue.scale(state.repeatCount));
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
                    case Animation.ANIMATIONLOOPMODE_RELATIVE: {
                        return startValue;
                    }
                }
                break;
            }
        }

        return 0;
    }
}
