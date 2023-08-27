import { Animation } from "@babylonjs/core/Animations/animation";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";

/**
 * Animation that uses spherical linear interpolation for Quaternion
 */
export class SlerpQuaternionAnimation extends Animation {
    public override quaternionInterpolateFunctionWithTangents(startValue: Quaternion, outTangent: Quaternion, endValue: Quaternion, inTangent: Quaternion, gradient: number): Quaternion {
        let weight = (startValue.w - Scalar.Hermite(startValue.w, outTangent.w, endValue.w, inTangent.w, gradient)) / (startValue.w - endValue.w);
        if (!isFinite(weight)) weight = 0;
        return Quaternion.Slerp(startValue, endValue, weight);
    }
}
