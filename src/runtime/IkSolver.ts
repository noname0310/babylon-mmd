import { Quaternion, Vector3 } from "@babylonjs/core";

import type { MmdRuntimeBone } from "./MmdRuntimeBone";

class IkChain {
    public bone: MmdRuntimeBone;
    public minimumAngle: Vector3 | null;
    public maximumAngle: Vector3 | null;
    public prevAngle: Vector3;
    public savedIkRotation: Quaternion;
    public planeModeAngle: number;

    public constructor(
        bone: MmdRuntimeBone,
        minimumAngle: Vector3 | null,
        maximumAngle: Vector3 | null
    ) {
        this.bone = bone;
        this.minimumAngle = minimumAngle;
        this.maximumAngle = maximumAngle;
        this.prevAngle = Vector3.Zero();
        this.savedIkRotation = Quaternion.Identity();
        this.planeModeAngle = 0;
    }
}

export class IkSolver {
    public enabled: boolean;

    public iteration: number;
    public limitAngle: number;

    public readonly ikBone: MmdRuntimeBone;
    public readonly targetBone: MmdRuntimeBone;
    private readonly _ikChains: IkChain[];

    public constructor(ikBone: MmdRuntimeBone, targetBone: MmdRuntimeBone) {
        this.enabled = true;

        this.iteration = 0;
        this.limitAngle = 0;

        this.ikBone = ikBone;
        this.targetBone = targetBone;
        this._ikChains = [];

        this.ikBone.ikRotation = Quaternion.Identity();
    }

    public addIkChain(bone: MmdRuntimeBone, minimumAngle: Vector3 | null, maximumAngle: Vector3 | null): void {
        bone.ikRotation = Quaternion.Identity();
        const ikChain = new IkChain(bone, minimumAngle, maximumAngle);
        this._ikChains.push(ikChain);
    }

    private static readonly _TargetPosition = new Vector3();
    private static readonly _IkPosition = new Vector3();

    public solve(): void {
        if (!this.enabled) return;

        const ikBone = this.ikBone;
        const targetBone = this.targetBone;
        const chains = this._ikChains;
        for (let i = 0; i < chains.length; ++i) {
            const chain = chains[i];
            chain.prevAngle.setAll(0);
            ikBone.ikRotation!.set(0, 0, 0, 1);
            chain.planeModeAngle = 0;

            const bone = chain.bone;
            bone.updateLocalMatrix();
            bone.updateWorldMatrix();
        }

        let maxDistance = Number.MAX_VALUE;
        for (let i = 0; i < this.iteration; ++i) {
            this._solveCore(i);

            const targetPosition = targetBone.worldMatrix.getTranslationToRef(IkSolver._TargetPosition);
            const ikPosition = ikBone.worldMatrix.getTranslationToRef(IkSolver._IkPosition);
            const distance = Vector3.Distance(targetPosition, ikPosition);
            if (distance < maxDistance) {
                maxDistance = distance;
                for (let j = 0; j < chains.length; ++j) {
                    const chain = chains[j];
                    chain.savedIkRotation.copyFrom(chain.bone.ikRotation!);
                }
            } else {
                for (let j = 0; j < chains.length; ++j) {
                    const chain = chains[j];
                    chain.bone.ikRotation!.copyFrom(chain.savedIkRotation);
                    chain.bone.updateLocalMatrix();
                    chain.bone.updateWorldMatrix();
                }
                break;
            }
        }
    }

    private _solveCore(iteration: number): void {
        iteration;
    }
}
