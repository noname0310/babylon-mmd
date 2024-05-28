import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * Ik chain information for solving IK
 */
export class IkChainInfo {
    /**
     * Local rotation of the bone for solving IK
     */
    public readonly localRotation: Quaternion;

    /**
     * Local position of the bone for solving IK
     */
    public readonly localPosition: Vector3;

    /**
     * The rotation offset value to be moved by the IK solver
     */
    public readonly ikRotation: Quaternion;

    /**
     * Creates IK chain information
     */
    public constructor() {
        this.localRotation = Quaternion.Identity();
        this.localPosition = Vector3.Zero();
        this.ikRotation = Quaternion.Identity();
    }
}
