// import type { DeepImmutable, Scene} from "@babylonjs/core";
// import { Quaternion, Vector3 } from "@babylonjs/core";
// import { Camera, Matrix } from "@babylonjs/core";

// export class MmdCamera extends Camera {
//     public ignoreParentScaling = false;

//     public rotation = new Vector3();
//     public distance = 0;

//     public constructor(name: string, position: Vector3, scene?: Scene, setActiveOnSceneIfNoneActive = true) {
//         super(name, position, scene, setActiveOnSceneIfNoneActive);
//     }

//     private static readonly _Scale: DeepImmutable<Vector3> = new Vector3(1, 1, 1);
//     private static readonly _CenterMatrix = new Matrix();
//     private static readonly _CenterQuaternion = new Quaternion();
//     private static readonly _DistanceMatrix = new Matrix();
//     private static readonly _FinalMatrix = new Matrix();
//     private static readonly _FinalPosition = new Vector3();

//     public override _getViewMatrix(): Matrix {
//         // compute center local matrix
//         const centerMatrix = Matrix.ComposeToRef(
//             MmdCamera._Scale,
//             Quaternion.RotationYawPitchRollToRef(this.rotation.y, this.rotation.x, this.rotation.z, MmdCamera._CenterQuaternion),
//             this.position,
//             MmdCamera._CenterMatrix
//         );

//         // compute distance local matrix
//         const distanceMatrix = Matrix.IdentityToRef(MmdCamera._DistanceMatrix).setTranslationFromFloats(0, 0, this.distance);

//         // compute final local matrix
//         const finalMatrix = distanceMatrix.multiplyToRef(centerMatrix, MmdCamera._FinalMatrix);

//         if (this.ignoreParentScaling) {
//             if (this.parent) {
//                 const parentWorldMatrix = this.parent.getWorldMatrix();
//                 Vector3.TransformCoordinatesToRef(
//                     finalMatrix.getTranslationToRef(MmdCamera._FinalPosition),
//                     parentWorldMatrix,
//                     MmdCamera._FinalPosition
//                 );
//             } else {

//             }
//             return;
//         }


//     }
// }
