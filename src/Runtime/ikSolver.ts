/**
 * code based on
 * https://github.com/benikabocha/saba/blob/master/src/Saba/Model/MMD/MMDIkSolver.cpp
 */

import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { PmxObject } from "@/Loader/Parser/pmxObject";

import { IkChainInfo } from "./ikChainInfo";
import type { MmdRuntimeBone } from "./mmdRuntimeBone";

const enum EulerRotationOrder {
    YXZ,
    ZYX,
    XZY
}

const enum SolveAxis {
    None,
    Fixed,
    X,
    Y,
    Z
}

class IkChain {
    public readonly bone: MmdRuntimeBone;
    public readonly minimumAngle: Nullable<DeepImmutable<Vector3>>;
    public readonly maximumAngle: Nullable<DeepImmutable<Vector3>>;
    public readonly rotationOrder: EulerRotationOrder;
    public readonly solveAxis: SolveAxis;

    public constructor(
        bone: MmdRuntimeBone,
        limitation?: PmxObject.Bone.IKLink["limitation"]
    ) {
        this.bone = bone;

        if (limitation !== undefined) {
            {
                const minimumAngle = limitation.minimumAngle;
                const maximumAngle = limitation.maximumAngle;
                const minX = Math.min(minimumAngle[0], maximumAngle[0]);
                const minY = Math.min(minimumAngle[1], maximumAngle[1]);
                const minZ = Math.min(minimumAngle[2], maximumAngle[2]);
                const maxX = Math.max(minimumAngle[0], maximumAngle[0]);
                const maxY = Math.max(minimumAngle[1], maximumAngle[1]);
                const maxZ = Math.max(minimumAngle[2], maximumAngle[2]);
                this.minimumAngle = new Vector3(minX, minY, minZ);
                this.maximumAngle = new Vector3(maxX, maxY, maxZ);
            }
            const min = this.minimumAngle;
            const max = this.maximumAngle;

            const halfPi = Math.PI * 0.5;
            if (-halfPi < min.x && max.x < halfPi) {
                this.rotationOrder = EulerRotationOrder.YXZ;
            } else if (-halfPi < min.y && max.y < halfPi) {
                this.rotationOrder = EulerRotationOrder.ZYX;
            } else {
                this.rotationOrder = EulerRotationOrder.XZY;
            }

            if (min.x === 0 && max.x === 0 && min.y === 0 && max.y === 0 && min.z === 0 && max.z === 0) {
                this.solveAxis = SolveAxis.Fixed;
            } else if (min.y === 0 && max.y === 0 && min.z === 0 && max.z === 0) {
                this.solveAxis = SolveAxis.X;
            } else if (min.x === 0 && max.x === 0 && min.z === 0 && max.z === 0) {
                this.solveAxis = SolveAxis.Y;
            } else if (min.x === 0 && max.x === 0 && min.y === 0 && max.y === 0) {
                this.solveAxis = SolveAxis.Z;
            } else {
                this.solveAxis = SolveAxis.None;
            }
        } else {
            this.minimumAngle = null;
            this.maximumAngle = null;

            this.rotationOrder = EulerRotationOrder.XZY; // not used
            this.solveAxis = SolveAxis.None;
        }
    }
}

/**
 * IK solver
 */
export class IkSolver {
    /**
     * Ik solver index
     */
    public readonly index: number;

    /**
     * Iteration count
     *
     * The higher the value, the more accurate the IK solver will be, but the more expensive it will be
     */
    public get iteration(): number {
        return this._iteration;
    }

    public set iteration(value: number) {
        this._iteration = Math.min(value, 256);
    }

    /**
     * Limit angle
     */
    public limitAngle: number;

    /**
     * The bone to which the IK solver is attached
     */
    public readonly ikBone: MmdRuntimeBone;

    /**
     * Ik target bone
     */
    public readonly targetBone: MmdRuntimeBone;

    private _iteration: number;
    private readonly _ikChains: IkChain[];
    private _canSkipWhenPhysicsEnabled: boolean;

    /**
     * Create a new IK solver
     * @param index Ik solver index
     * @param ikBone Attach bone
     * @param targetBone Ik target bone
     */
    public constructor(index: number, ikBone: MmdRuntimeBone, targetBone: MmdRuntimeBone) {
        this.index = index;

        this._iteration = 1;
        this.limitAngle = Math.PI;

        this.ikBone = ikBone;
        this.targetBone = targetBone;
        this._ikChains = [];
        this._canSkipWhenPhysicsEnabled = true;
    }

    /**
     * Add an IK chain
     *
     * The angle constraint must be either both min max or neither
     *
     * For better performance, we do not constrain this to a type
     * @param bone Bone to add
     * @param isAffectedByPhysics Whether the bone is affected by physics
     * @param limitation Angle limitation
     */
    public addIkChain(
        bone: MmdRuntimeBone,
        isAffectedByPhysics: boolean,
        limitation?: PmxObject.Bone.IKLink["limitation"]
    ): void {
        bone.ikChainInfo = new IkChainInfo();

        if (!isAffectedByPhysics) {
            this._canSkipWhenPhysicsEnabled = false;
        }

        const ikChain = new IkChain(bone, limitation);
        this._ikChains.push(ikChain);
    }

    /**
     * If all chains are affected by physics, ik solver can be skipped
     */
    public get canSkipWhenPhysicsEnabled(): boolean {
        return this._canSkipWhenPhysicsEnabled;
    }

    private static readonly _IkPosition = new Vector3();
    private static readonly _TargetPosition = new Vector3();

    /**
     * Solve IK
     * @param usePhysics Whether to use physics
     */
    public solve(usePhysics: boolean): void {
        if (this._ikChains.length === 0) return;

        const ikBone = this.ikBone;
        const targetBone = this.targetBone;
        const chains = this._ikChains;
        for (let chainIndex = 0; chainIndex < chains.length; ++chainIndex) {
            chains[chainIndex].bone.ikChainInfo!.ikRotation.set(0, 0, 0, 1);
        }

        const ikPosition = ikBone.getWorldTranslationToRef(IkSolver._IkPosition);

        targetBone.updateWorldMatrix(usePhysics, true);
        const targetPosition = targetBone.getWorldTranslationToRef(IkSolver._TargetPosition);

        if (Vector3.DistanceSquared(ikPosition, targetPosition) < 1.0e-8) return;

        // update ik chain, target bone world matrix
        for (let chainIndex = chains.length - 1; chainIndex >= 0; --chainIndex) {
            chains[chainIndex].bone.updateWorldMatrix(usePhysics, false);
        }
        targetBone.updateWorldMatrix(false, false);
        targetBone.getWorldTranslationToRef(targetPosition);

        if (Vector3.DistanceSquared(ikPosition, targetPosition) < 1.0e-8) return;

        const iteration = this.iteration;
        const halfIteration = iteration >> 1;
        for (let i = 0; i < iteration; ++i) {
            for (let chainIndex = 0; chainIndex < chains.length; ++chainIndex) {
                const chain = chains[chainIndex];
                if (chain.solveAxis !== SolveAxis.Fixed) {
                    this._solveChain(chain, chainIndex, ikPosition, targetPosition, i < halfIteration);
                }
            }
            if (Vector3.DistanceSquared(ikPosition, targetPosition) < 1.0e-8) break;
        }
    }

    private static readonly _ChainPosition = new Vector3();
    private static readonly _ChainTargetVector = new Vector3();
    private static readonly _ChainIkVector = new Vector3();
    private static readonly _ChainRotationAxis = new Vector3();
    private static readonly _ChainParentRotationMatrix = new Matrix();
    private static readonly _Axis = new Vector3();
    private static readonly _Rotation = new Quaternion();
    private static readonly _RotationMatrix = new Matrix();
    private static readonly _Right: DeepImmutable<Vector3> = Vector3.Right();
    private static readonly _Up: DeepImmutable<Vector3> = Vector3.Up();
    private static readonly _Forward: DeepImmutable<Vector3> = Vector3.Forward();
    private static readonly _Rotation2 = new Quaternion();
    private static readonly _Rotation3 = new Quaternion();

    private _solveChain(
        chain: IkChain,
        chainIndex: number,
        ikPosition: DeepImmutable<Vector3>,
        targetPosition: Vector3,
        useAxis: boolean
    ): void {
        const targetBone = this.targetBone;
        const chainBone = chain.bone;

        const chainPosition = chainBone.getWorldTranslationToRef(IkSolver._ChainPosition);
        const chainTargetVector = chainPosition.subtractToRef(targetPosition, IkSolver._ChainTargetVector).normalize();
        const chainIkVector = chainPosition.subtractToRef(ikPosition, IkSolver._ChainIkVector).normalize();

        const chainRotationAxis = Vector3.CrossToRef(chainTargetVector, chainIkVector, IkSolver._ChainRotationAxis);
        if (chainRotationAxis.lengthSquared() < 1.0e-8) return;

        const chainParentRotationMatrix = chainBone.parentBone !== null
            ? chainBone.parentBone.getWorldMatrixToRef(IkSolver._ChainParentRotationMatrix)
            : Matrix.IdentityToRef(IkSolver._ChainParentRotationMatrix);
        chainParentRotationMatrix.setTranslationFromFloats(0, 0, 0);
        if (chain.minimumAngle !== null && useAxis) {
            switch (chain.solveAxis) {
            case SolveAxis.None:
                chainParentRotationMatrix.transposeToRef(chainParentRotationMatrix); // inverse
                Vector3.TransformNormalToRef(chainRotationAxis, chainParentRotationMatrix, chainRotationAxis);
                chainRotationAxis.normalize();
                break;
            case SolveAxis.X: {
                const m = chainParentRotationMatrix.m;
                const dot = Vector3.Dot(chainRotationAxis, IkSolver._Axis.set(m[0], m[1], m[2]));
                chainRotationAxis.x = 0 <= dot ? 1 : -1;
                chainRotationAxis.y = 0;
                chainRotationAxis.z = 0;
                break;
            }
            case SolveAxis.Y: {
                const m = chainParentRotationMatrix.m;
                const dot = Vector3.Dot(chainRotationAxis, IkSolver._Axis.set(m[4], m[5], m[6]));
                chainRotationAxis.x = 0;
                chainRotationAxis.y = 0 <= dot ? 1 : -1;
                chainRotationAxis.z = 0;
                break;
            }
            case SolveAxis.Z: {
                const m = chainParentRotationMatrix.m;
                const dot = Vector3.Dot(chainRotationAxis, IkSolver._Axis.set(m[8], m[9], m[10]));
                chainRotationAxis.x = 0;
                chainRotationAxis.y = 0;
                chainRotationAxis.z = 0 <= dot ? 1 : -1;
                break;
            }
            }
        } else {
            chainParentRotationMatrix.transposeToRef(chainParentRotationMatrix); // inverse
            Vector3.TransformNormalToRef(chainRotationAxis, chainParentRotationMatrix, chainRotationAxis);
            chainRotationAxis.normalize();
        }

        let dot = Vector3.Dot(chainTargetVector, chainIkVector);
        dot = Math.max(-1.0, Math.min(1.0, dot));

        const angle = Math.min(this.limitAngle * (chainIndex + 1), Math.acos(dot));
        const ikRotation = Quaternion.RotationAxisToRef(chainRotationAxis, angle, IkSolver._Rotation);
        ikRotation.multiplyToRef(chainBone.ikChainInfo!.ikRotation, chainBone.ikChainInfo!.ikRotation);

        if (chain.minimumAngle !== null) {
            chainBone.ikChainInfo!.ikRotation.multiplyToRef(chainBone.ikChainInfo!.localRotation, ikRotation);
            const chainRotation = Matrix.FromQuaternionToRef(ikRotation, IkSolver._RotationMatrix).m;
            const threshold = 88 * Math.PI / 180;

            let rX: number;
            let rY: number;
            let rZ: number;
            switch (chain.rotationOrder) {
            case EulerRotationOrder.YXZ: {
                rX = Math.asin(-chainRotation[9] /* m32 */);
                if (Math.abs(rX) > threshold) {
                    rX = rX < 0 ? -threshold : threshold;
                }
                let cosX = Math.cos(rX);
                if (cosX !== 0) cosX = 1 / cosX; // inverse
                rY = Math.atan2(chainRotation[8] /* m31 */ * cosX, chainRotation[10] /* m33 */ * cosX);
                rZ = Math.atan2(chainRotation[1] /* m12 */ * cosX, chainRotation[5] /* m22 */ * cosX);
                {
                    const min = chain.minimumAngle;
                    const max = chain.maximumAngle!;
                    rX = this._limitAngle(rX, min.x, max.x, useAxis);
                    rY = this._limitAngle(rY, min.y, max.y, useAxis);
                    rZ = this._limitAngle(rZ, min.z, max.z, useAxis);
                }

                Quaternion.RotationAxisToRef(IkSolver._Up, rY, chainBone.ikChainInfo!.ikRotation);
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Right, rX, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Forward, rZ, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                break;
            }
            case EulerRotationOrder.ZYX: {
                rY = Math.asin(-chainRotation[2] /* m13 */);
                if (Math.abs(rY) > threshold) {
                    rY = rY < 0 ? -threshold : threshold;
                }
                let cosY = Math.cos(rY);
                if (cosY !== 0) cosY = 1 / cosY; // inverse
                rX = Math.atan2(chainRotation[6] /* m23 */ * cosY, chainRotation[10] /* m33 */ * cosY);
                rZ = Math.atan2(chainRotation[1] /* m12 */ * cosY, chainRotation[0] /* m11 */ * cosY);
                {
                    const min = chain.minimumAngle;
                    const max = chain.maximumAngle!;
                    rX = this._limitAngle(rX, min.x, max.x, useAxis);
                    rY = this._limitAngle(rY, min.y, max.y, useAxis);
                    rZ = this._limitAngle(rZ, min.z, max.z, useAxis);
                }

                Quaternion.RotationAxisToRef(IkSolver._Forward, rZ, chainBone.ikChainInfo!.ikRotation);
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Up, rY, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Right, rX, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                break;
            }
            case EulerRotationOrder.XZY: {
                rZ = Math.asin(-chainRotation[4] /* m21 */);
                if (Math.abs(rZ) > threshold) {
                    rZ = rZ < 0 ? -threshold : threshold;
                }
                let cosZ = Math.cos(rZ);
                if (cosZ !== 0) cosZ = 1 / cosZ; // inverse
                rX = Math.atan2(chainRotation[6] /* m23 */ * cosZ, chainRotation[5] /* m22 */ * cosZ);
                rY = Math.atan2(chainRotation[8] /* m31 */ * cosZ, chainRotation[0] /* m11 */ * cosZ);
                {
                    const min = chain.minimumAngle;
                    const max = chain.maximumAngle!;
                    rX = this._limitAngle(rX, min.x, max.x, useAxis);
                    rY = this._limitAngle(rY, min.y, max.y, useAxis);
                    rZ = this._limitAngle(rZ, min.z, max.z, useAxis);
                }

                Quaternion.RotationAxisToRef(IkSolver._Right, rX, chainBone.ikChainInfo!.ikRotation);
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Forward, rZ, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Up, rY, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                break;
            }
            }

            const invertedLocalRotation = Quaternion.InverseToRef(chainBone.ikChainInfo!.localRotation, IkSolver._Rotation3);
            chainBone.ikChainInfo!.ikRotation.multiplyToRef(invertedLocalRotation, chainBone.ikChainInfo!.ikRotation);
        }

        const chains = this._ikChains;
        for (let i = chainIndex; i >= 0; --i) {
            chains[i].bone.updateWorldMatrixForIkChain();
        }
        targetBone.updateWorldMatrix(false, false);
        targetBone.getWorldTranslationToRef(targetPosition);
    }

    private _limitAngle(
        angle: number,
        min: number,
        max: number,
        useAxis: boolean
    ): number {
        if (angle < min) {
            const diff = 2 * min - angle;
            return (diff <= max && useAxis) ? diff : min;
        } else if (angle > max) {
            const diff = 2 * max - angle;
            return (diff >= min && useAxis) ? diff : max;
        } else {
            return angle;
        }
    }
}
