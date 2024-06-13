import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable } from "@babylonjs/core/types";

const tempQuaternion = new Quaternion();

/**
 * Quaternion to axis angle
 * @param q quaternion
 * @param outAxis output axis
 * @param tempQuaternion temporary quaternion
 * @returns angle
 */
export function quaternionToAxisAngle(q: DeepImmutable<Quaternion>, outAxis: Vector3): number {
    const quaternion = tempQuaternion.copyFrom(q).normalize();
    const angle = 2 * Math.acos(quaternion.w);
    const s = Math.sqrt(1 - quaternion.w * quaternion.w);
    if (s < 0.001) {
        outAxis.set(quaternion.x, quaternion.y, quaternion.z).normalize();
    } else {
        outAxis.set(quaternion.x / s, quaternion.y / s, quaternion.z / s);
    }
    return angle;
}
