import type { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable } from "@babylonjs/core/types";

/**
 * Quaternion to axis angle
 * @param q quaternion
 * @param outAxis output axis
 * @param tempQuaternion temporary quaternion
 * @returns angle
 */
export function quaternionToAxisAngle(q: DeepImmutable<Quaternion>, outAxis: Vector3): number {
    outAxis.set(q.x, q.y, q.z);
    const length = outAxis.length();
    if (length >= 1.0e-8) {
        const angle = 2.0 * Math.atan2(length, q.w);
        outAxis.scaleInPlace(1.0 / length);
        return angle;
    } else {
        outAxis.set(1, 0, 0);
        return 0;
    }
}
