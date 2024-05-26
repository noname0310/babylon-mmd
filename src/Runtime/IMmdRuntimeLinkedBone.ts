import type { Space } from "@babylonjs/core/Maths/math.axis";
import type { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

/**
 * Interface for duck typing Bone in Babylon.js
 */
export interface IMmdRuntimeLinkedBone {
    /**
     * The name of the bone
     */
    name: string;

    /**
     * Local position of the bone
     *
     * This value is read by the animation runtime
     */
    get position(): Vector3;
    set position(value: Vector3);

    /**
     * Local rotation of the bone
     *
     * This value is read by the animation runtime
     */
    get rotationQuaternion(): Quaternion;
    set rotationQuaternion(value: Quaternion);

    /**
     * Local scaling of the bone
     *
     * This value is read by the animation runtime
     */
    get scaling(): Vector3;
    set scaling(value: Vector3);

    /**
     * Gets the rest matrix of the bone
     *
     * The rest matrix in the MMD model is always Identity and only the position values are different, so only the 12, 13, 14 components(which are the position) are meaningful
     */
    getRestMatrix(): Matrix;

    /**
     * Gets the inverse of the bind matrix, in world space (relative to the skeleton root)
     * @returns the inverse bind matrix, in world space
     */
    getAbsoluteInverseBindMatrix(): Matrix;

    /**
     * Set the quaternion rotation of the bone in local or world space
     *
     * This method is faster than using the rotationQuaternion property
     * @param quat The quaternion rotation that the bone should be set to
     * @param space The space that the rotation is in
     * @param tNode A TransformNode whose world matrix is to be applied to the calculated absolute matrix. In most cases, you'll want to pass the mesh associated with the skeleton from which this bone comes. Used only when space=Space.WORLD
     */
    setRotationQuaternion(quat: Quaternion, space: Space, tNode?: TransformNode): void;
}

/**
 * Interface for duck typing Skeleton in Babylon.js
 *
 * The MmdModel will receive a duct-taped proxy skeleton as well as a Babylon.js skeleton, allowing it to work with multiple types of bone-hierarchy structures
 *
 * For example, HumanoidMmd makes it possible to bind Mmd animations to a humanoid model by using a proxy to create an instance of MmdModel instead of a Babylon.js skeleton
 */
export interface IMmdLinkedBoneContainer {
    /**
     * The bones of the skeleton
     */
    bones: IMmdRuntimeLinkedBone[];

    /**
     * This method is called once by the MmdModel to trigger a world matrix update before building the mmd runtime bones
     *
     * You need to understand the intended use of this method for implementing a custom skeleton proxy
     *
     * @see MmdModel.constructor
     */
    prepare(): void;

    // _computeTransformMatrices: any;
}
