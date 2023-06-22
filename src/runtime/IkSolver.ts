import { Quaternion } from "@babylonjs/core";

export class IkSolver {
    public ikRotation: Quaternion = Quaternion.Identity();
    public enabled: boolean = true;
    // public iteration: number;

    // private readonly _ikChains: readonly {
    //     readonly bone: MmdRuntimeBone;
    //     readonly minimumAngle: Vector3;
    //     readonly maximumAngle: Vector3;
    // }[];

    // public constructor(iteration: number) {
    //     this.iteration = iteration;
    // }

    // public addIkChain(bone: MmdRuntimeBone);

    // public addIkChain(bone: MmdRuntimeBone, minimumAngle: Vector3, maximumAngle: Vector3);

    // public addIkChain(bone: MmdRuntimeBone, minimumAngle?: Vector3, maximumAngle?: Vector3): void {

    // }
}
