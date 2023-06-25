/**
 * code based on
 * https://github.com/benikabocha/saba/blob/master/src/Saba/Model/MMD/MMDIkSolver.cpp
 */

import type { DeepImmutable } from "@babylonjs/core";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core";

import type { MmdRuntimeBone } from "./MmdRuntimeBone";

class IkChain {
    public bone: MmdRuntimeBone;
    public minimumAngle: DeepImmutable<Vector3> | null;
    public maximumAngle: DeepImmutable<Vector3> | null;
    public prevAngle: Vector3;
    public savedIkRotation: Quaternion;
    public planeModeAngle: number;

    public constructor(
        bone: MmdRuntimeBone,
        minimumAngle: DeepImmutable<Vector3> | null,
        maximumAngle: DeepImmutable<Vector3> | null
    ) {
        this.bone = bone;
        this.minimumAngle = minimumAngle;
        this.maximumAngle = maximumAngle;
        this.prevAngle = Vector3.Zero();
        this.savedIkRotation = Quaternion.Identity();
        this.planeModeAngle = 0;
    }
}

enum SolveAxis {
    X,
    Y,
    Z,
}

export interface IIkSolver {
    enabled: boolean;

    iteration: number;
}

export class IkSolver implements IIkSolver {
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
            const chainbone = chain.bone;
            chain.prevAngle.setAll(0);
            chainbone.ikRotation!.set(0, 0, 0, 1);
            chain.planeModeAngle = 0;

            chainbone.updateLocalMatrix();
            chainbone.updateWorldMatrix();
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

    private static readonly _TargetPosition2 = new Vector3();
    private static readonly _IkPosition2 = new Vector3();
    private static readonly _InversedChain = new Matrix();
    private static readonly _ChainCross = new Vector3();
    private static readonly _Rotation = new Quaternion();
    private static readonly _ChainRotation = new Quaternion();
    private static readonly _AnimatedRotation = new Quaternion();
    private static readonly _ChainRotationMatrix = new Matrix();
    private static readonly _DecomposedRotation = new Vector3();
    private static readonly _ClampedRotation = new Vector3();
    private static readonly _FinalRotationA = new Quaternion();
    private static readonly _FinalRotationB = new Quaternion();
    private static readonly _Right: DeepImmutable<Vector3> = Vector3.Right();
    private static readonly _Up: DeepImmutable<Vector3> = Vector3.Up();
    private static readonly _Forward: DeepImmutable<Vector3> = Vector3.Forward();
    private static readonly _InversedAnimatedRotation = new Quaternion();

    private static readonly _RadToDeg = 180 / Math.PI;

    private _solveCore(iteration: number): void {
        const ikPosition = this.ikBone.worldMatrix.getTranslationToRef(IkSolver._IkPosition2);

        const chains = this._ikChains;
        for (let chainIndex = 0; chainIndex < chains.length; ++chainIndex) {
            const chain = chains[chainIndex];
            const chainBone = chain.bone;
            if (chainBone === this.targetBone) continue;

            if (chain.minimumAngle !== null /* && chain.minimumAngle !== null */) {
                if ((chain.minimumAngle.x !== 0 || chain.maximumAngle!.x !== 0) &&
                    (chain.minimumAngle.y === 0 || chain.maximumAngle!.y === 0) &&
                    (chain.minimumAngle.z === 0 || chain.maximumAngle!.z === 0)
                ) {
                    this._solvePlane(iteration, chainIndex, SolveAxis.X);
                    continue;
                } else if ((chain.minimumAngle.y !== 0 || chain.maximumAngle!.y !== 0) &&
                    (chain.minimumAngle.x === 0 || chain.maximumAngle!.x === 0) &&
                    (chain.minimumAngle.z === 0 || chain.maximumAngle!.z === 0)
                ) {
                    this._solvePlane(iteration, chainIndex, SolveAxis.Y);
                    continue;
                } else if ((chain.minimumAngle.z !== 0 || chain.maximumAngle!.z !== 0) &&
                    (chain.minimumAngle.x === 0 || chain.maximumAngle!.x === 0) &&
                    (chain.minimumAngle.y === 0 || chain.maximumAngle!.y === 0)
                ) {
                    this._solvePlane(iteration, chainIndex, SolveAxis.Z);
                    continue;
                }
            }

            const targetPosition = this.targetBone.worldMatrix.getTranslationToRef(IkSolver._TargetPosition2);

            const inverseChain = IkSolver._InversedChain.copyFrom(chainBone.worldMatrix).invert();

            const chainIkPosition = Vector3.TransformCoordinatesToRef(ikPosition, inverseChain, IkSolver._IkPosition);
            const chainTargetPosition = Vector3.TransformCoordinatesToRef(targetPosition, inverseChain, IkSolver._TargetPosition);

            const chainIkVector = chainIkPosition.normalize();
            const chainTargetVector = chainTargetPosition.normalize();

            let dot = Vector3.Dot(chainTargetVector, chainIkVector);
            dot = Math.max(-1.0, Math.min(1.0, dot));

            let angle = Math.acos(dot);
            const angleDeg = angle * IkSolver._RadToDeg;
            if (angleDeg < 1.0e-3) continue;
            angle = Math.max(-this.limitAngle, Math.min(this.limitAngle, angle));
            const cross = Vector3.CrossToRef(chainTargetVector, chainIkVector, IkSolver._ChainCross).normalize();
            const rotation = Quaternion.RotationAxisToRef(cross, angle, IkSolver._Rotation);

            const chainRotation = IkSolver._ChainRotation.copyFrom(chainBone.ikRotation!);
            const animatedRotation = chainBone.getAnimatedRotationToRef(IkSolver._AnimatedRotation);
            chainRotation.multiplyInPlace(animatedRotation).multiplyInPlace(rotation);
            if (chain.minimumAngle !== null /* && chain.minimumAngle !== null */) {
                const chainRotationMatrix = chainRotation.toRotationMatrix(IkSolver._ChainRotationMatrix);
                const rotXYZ = this._decomposeToRef(chainRotationMatrix, chain.prevAngle, IkSolver._DecomposedRotation);
                const clampXYZ = Vector3.ClampToRef(rotXYZ, chain.minimumAngle, chain.maximumAngle!, IkSolver._ClampedRotation).subtractInPlace(chain.prevAngle);

                clampXYZ.set(
                    Math.max(-this.limitAngle, Math.min(this.limitAngle, clampXYZ.x)) + chain.prevAngle.x,
                    Math.max(-this.limitAngle, Math.min(this.limitAngle, clampXYZ.y)) + chain.prevAngle.y,
                    Math.max(-this.limitAngle, Math.min(this.limitAngle, clampXYZ.z)) + chain.prevAngle.z
                );
                const rA = Quaternion.RotationAxisToRef(IkSolver._Right, clampXYZ.x, IkSolver._FinalRotationA);
                const rB = IkSolver._FinalRotationB;
                Quaternion.RotationAxisToRef(IkSolver._Up, clampXYZ.y, rB);
                rA.multiplyInPlace(rB);
                Quaternion.RotationAxisToRef(IkSolver._Forward, clampXYZ.z, rB);
                rA.multiplyInPlace(rB);
                Matrix.FromQuaternionToRef(rA, chainRotationMatrix);
                chain.prevAngle.copyFrom(clampXYZ);

                chainRotation.copyFrom(rotation);
            }

            chainRotation.multiplyToRef(
                Quaternion.InverseToRef(animatedRotation, IkSolver._InversedAnimatedRotation),
                chainBone.ikRotation!
            );

            chainBone.updateLocalMatrix();
            chainBone.updateWorldMatrix();
        }
    }

    private static readonly _Plane = new Vector3();
    private static readonly _IkPosition3 = new Vector3();
    private static readonly _TargetPosition3 = new Vector3();
    private static readonly _InversedChain2 = new Matrix();
    private static readonly _ChainIkPosition = new Vector3();
    private static readonly _ChainTargetPosition = new Vector3();
    private static readonly _Rotation2 = new Quaternion();
    private static readonly _RotationMatrix = new Matrix();
    private static readonly _TargetVector = new Vector3();
    private static readonly _InversedAnimatedRotation2 = new Quaternion();

    private _solvePlane(iteration: number, chainIndex: number, solveAxis: SolveAxis): void {
        let minimumAngle: number;
        let maximumAngle: number;
        let rotateAxis: DeepImmutable<Vector3>;
        const plane = IkSolver._Plane;

        const chain = this._ikChains[chainIndex];

        switch (solveAxis) {
        case SolveAxis.X:
            minimumAngle = chain.minimumAngle!.x;
            maximumAngle = chain.maximumAngle!.x;
            rotateAxis = IkSolver._Right;
            plane.set(0, 1, 1);
            break;
        case SolveAxis.Y:
            minimumAngle = chain.minimumAngle!.y;
            maximumAngle = chain.maximumAngle!.y;
            rotateAxis = IkSolver._Up;
            plane.set(1, 0, 1);
            break;
        case SolveAxis.Z:
            minimumAngle = chain.minimumAngle!.z;
            maximumAngle = chain.maximumAngle!.z;
            rotateAxis = IkSolver._Forward;
            plane.set(1, 1, 0);
            break;
        default:
            throw new Error("Invalid solve axis");
        }

        const ikPosition = this.ikBone.worldMatrix.getTranslationToRef(IkSolver._IkPosition3);

        const targetPosition = this.targetBone.worldMatrix.getTranslationToRef(IkSolver._TargetPosition3);

        const inverseChain = IkSolver._InversedChain2.copyFrom(chain.bone.worldMatrix).invert();

        const chainIkPosition = Vector3.TransformCoordinatesToRef(ikPosition, inverseChain, IkSolver._ChainIkPosition);
        const chainTargetPosition = Vector3.TransformCoordinatesToRef(targetPosition, inverseChain, IkSolver._ChainTargetPosition);

        const chainIkVector = chainIkPosition.normalize();
        const chainTargetVector = chainTargetPosition.normalize();

        let dot = Vector3.Dot(chainTargetVector, chainIkVector);
        dot = Math.max(-1.0, Math.min(1.0, dot));

        let angle = Math.acos(dot);

        angle = Math.max(-this.limitAngle, Math.min(this.limitAngle, angle));

        const rot1 = Quaternion.RotationAxisToRef(rotateAxis, angle, IkSolver._Rotation2);
        const rot1Matrix = rot1.toRotationMatrix(IkSolver._RotationMatrix);
        const targetVec1 = Vector3.TransformCoordinatesToRef(chainTargetVector, rot1Matrix, IkSolver._TargetVector);
        const dot1 = Vector3.Dot(targetVec1, chainIkVector);

        const rot2 = Quaternion.RotationAxisToRef(rotateAxis, -angle, IkSolver._Rotation2);
        const rot2Matrix = rot2.toRotationMatrix(IkSolver._RotationMatrix);
        const targetVec2 = Vector3.TransformCoordinatesToRef(chainTargetVector, rot2Matrix, IkSolver._TargetVector);
        const dot2 = Vector3.Dot(targetVec2, chainIkVector);

        let newAngle = chain.planeModeAngle;
        if (dot1 > dot2) newAngle += angle;
        else newAngle -= angle;

        if (iteration === 0) {
            if (newAngle < minimumAngle || newAngle > maximumAngle) {
                if (-newAngle > minimumAngle && -newAngle < maximumAngle) newAngle *= -1;
                else {
                    const halfRad = (minimumAngle + maximumAngle) * 0.5;
                    if (Math.abs(halfRad - newAngle) > Math.abs(halfRad + newAngle)) newAngle *= -1;
                }
            }
        }

        newAngle = Math.max(minimumAngle, Math.min(maximumAngle, newAngle));
        chain.planeModeAngle = newAngle;

        const inversedAnimatedRotation = Quaternion.InverseToRef(
            chain.bone.getAnimatedRotationToRef(IkSolver._InversedAnimatedRotation2),
            IkSolver._InversedAnimatedRotation2
        );
        const ikRotation = Quaternion.RotationAxisToRef(rotateAxis, newAngle, chain.bone.ikRotation!);
        ikRotation.multiplyInPlace(inversedAnimatedRotation);

        chain.bone.updateLocalMatrix();
        chain.bone.updateWorldMatrix();
    }

    private static readonly _TwoPi = Math.PI * 2;

    private _normalizeAngle(angle: number): number {
        while (angle >= IkSolver._TwoPi) angle -= IkSolver._TwoPi;
        while (angle < 0) angle += IkSolver._TwoPi;
        return angle;
    }

    private _diffAngle(a: number, b: number): number {
        const diff = this._normalizeAngle(a) - this._normalizeAngle(b);
        if (diff > Math.PI) return diff - IkSolver._TwoPi;
        else if (diff < -Math.PI) return diff + IkSolver._TwoPi;
        return diff;
    }

    private static readonly _Tests = [
        new Vector3(),
        new Vector3(),
        new Vector3(),
        new Vector3(),
        new Vector3(),
        new Vector3(),
        new Vector3(),
        new Vector3()
    ] as const;

    private _decomposeToRef(
        m: DeepImmutable<Matrix>,
        before: DeepImmutable<Vector3>,
        result: Vector3
    ): Vector3 {
        const r = result;

        const sy = -m.m[2];
        const e = 1.0e-6;

        if (Math.abs(1.0 - Math.abs(sy)) < e) {
            r.y = Math.asin(sy);
            const sx = Math.sin(before.x);
            const sz = Math.sin(before.z);
            if (Math.abs(sx) < Math.abs(sz)) {
                const cx = Math.cos(before.x);
                if (cx > 0) {
                    r.x = 0;
                    r.z = Math.asin(-m.m[1]);
                } else {
                    r.x = Math.PI;
                    r.z = Math.asin(m.m[1]);
                }
            } else {
                const cz = Math.cos(before.z);
                if (cz > 0) {
                    r.z = 0;
                    r.x = Math.asin(-m.m[6]);
                } else {
                    r.z = Math.PI;
                    r.x = Math.asin(m.m[6]);
                }
            }
        } else {
            r.x = Math.atan2(m.m[9], m.m[10]);
            r.y = Math.asin(-m.m[8]);
            r.z = Math.atan2(m.m[4], m.m[0]);
        }

        const pi = Math.PI;
        const tests = IkSolver._Tests;
        tests[0].set(r.x + pi, pi - r.y, r.z + pi);
        tests[1].set(r.x + pi, pi - r.y, r.z - pi);
        tests[2].set(r.x + pi, -pi - r.y, r.z + pi);
        tests[3].set(r.x + pi, -pi - r.y, r.z - pi);
        tests[4].set(r.x - pi, pi - r.y, r.z + pi);
        tests[5].set(r.x - pi, pi - r.y, r.z - pi);
        tests[6].set(r.x - pi, -pi - r.y, r.z + pi);
        tests[7].set(r.x - pi, -pi - r.y, r.z - pi);

        const errX = Math.abs(this._diffAngle(r.x, before.x));
        const errY = Math.abs(this._diffAngle(r.y, before.y));
        const errZ = Math.abs(this._diffAngle(r.z, before.z));
        let minErr = errX + errY + errZ;

        for (let i = 0; i < tests.length; ++i) {
            const test = tests[i];
            const err = Math.abs(this._diffAngle(test.x, before.x))
                + Math.abs(this._diffAngle(test.y, before.y))
                + Math.abs(this._diffAngle(test.z, before.z));
            if (err < minErr) {
                minErr = err;
                r.copyFrom(test);
            }
        }
        return r;
    }
}
