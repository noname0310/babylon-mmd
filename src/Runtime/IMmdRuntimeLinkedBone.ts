import type { Space } from "@babylonjs/core/Maths/math.axis";
import type { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export interface IMmdRuntimeLinkedBone {
    name: string;

    position: Vector3;
    rotationQuaternion: Quaternion;
    scaling: Vector3;

    getRestMatrix(): Matrix;
    getFinalMatrix(): Matrix;

    setRotationQuaternion(quat: Quaternion, space: Space, tNode?: TransformNode): void;
}

export interface IMmdLinkedBoneContainer {
    bones: IMmdRuntimeLinkedBone[];

    prepare(): void;

    // _computeTransformMatrices: any;
}
