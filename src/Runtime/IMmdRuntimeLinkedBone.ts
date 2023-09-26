import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";

export interface IMmdRuntimeLinkedBone {
    position: Vector3;
    rotationQuaternion: Quaternion;
    scaling: Vector3;

    getRestMatrix(): Matrix;
    getFinalMatrix(): Matrix;
}

export interface IMmdLinkedBoneContainer {
    bones: IMmdRuntimeLinkedBone[];
    
    prepare(): void;
}
