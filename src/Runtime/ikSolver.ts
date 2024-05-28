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
    private static readonly _RotationVector = new Vector3();
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
            const rotationVector = IkSolver._RotationVector;

            chainBone.ikChainInfo!.ikRotation.multiplyToRef(chainBone.ikChainInfo!.localRotation, ikRotation);
            const chainRotation = Matrix.FromQuaternionToRef(ikRotation, IkSolver._RotationMatrix).m;
            const threshold = 88 * Math.PI / 180;
            switch (chain.rotationOrder) {
            case EulerRotationOrder.YXZ: {
                rotationVector.x = Math.asin(-chainRotation[9] /* m32 */);
                if (Math.abs(rotationVector.x) > threshold) {
                    rotationVector.x = rotationVector.x < 0 ? -threshold : threshold;
                }
                let cosX = Math.cos(rotationVector.x);
                if (cosX !== 0) cosX = 1 / cosX; // inverse
                rotationVector.y = Math.atan2(chainRotation[8] /* m31 */ * cosX, chainRotation[10] /* m33 */ * cosX);
                rotationVector.z = Math.atan2(chainRotation[1] /* m12 */ * cosX, chainRotation[5] /* m22 */ * cosX);
                this._limitAngle(rotationVector, chain.minimumAngle, chain.maximumAngle!, useAxis);

                Quaternion.RotationAxisToRef(IkSolver._Up, rotationVector.y, chainBone.ikChainInfo!.ikRotation);
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Right, rotationVector.x, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Forward, rotationVector.z, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                break;
            }
            case EulerRotationOrder.ZYX: {
                rotationVector.y = Math.asin(-chainRotation[2] /* m13 */);
                if (Math.abs(rotationVector.y) > threshold) {
                    rotationVector.y = rotationVector.y < 0 ? -threshold : threshold;
                }
                let cosY = Math.cos(rotationVector.y);
                if (cosY !== 0) cosY = 1 / cosY; // inverse
                rotationVector.x = Math.atan2(chainRotation[6] /* m23 */ * cosY, chainRotation[10] /* m33 */ * cosY);
                rotationVector.z = Math.atan2(chainRotation[1] /* m12 */ * cosY, chainRotation[0] /* m11 */ * cosY);
                this._limitAngle(rotationVector, chain.minimumAngle, chain.maximumAngle!, useAxis);

                Quaternion.RotationAxisToRef(IkSolver._Forward, rotationVector.z, chainBone.ikChainInfo!.ikRotation);
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Up, rotationVector.y, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Right, rotationVector.x, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                break;
            }
            case EulerRotationOrder.XZY: {
                rotationVector.z = Math.asin(-chainRotation[4] /* m21 */);
                if (Math.abs(rotationVector.z) > threshold) {
                    rotationVector.z = rotationVector.z < 0 ? -threshold : threshold;
                }
                let cosZ = Math.cos(rotationVector.z);
                if (cosZ !== 0) cosZ = 1 / cosZ; // inverse
                rotationVector.y = Math.atan2(chainRotation[6] /* m23 */ * cosZ, chainRotation[5] /* m22 */ * cosZ);
                rotationVector.x = Math.atan2(chainRotation[8] /* m31 */ * cosZ, chainRotation[0] /* m11 */ * cosZ);
                this._limitAngle(rotationVector, chain.minimumAngle, chain.maximumAngle!, useAxis);

                Quaternion.RotationAxisToRef(IkSolver._Right, rotationVector.x, chainBone.ikChainInfo!.ikRotation);
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Forward, rotationVector.z, IkSolver._Rotation2),
                    chainBone.ikChainInfo!.ikRotation
                );
                chainBone.ikChainInfo!.ikRotation.multiplyToRef(
                    Quaternion.RotationAxisToRef(IkSolver._Up, rotationVector.y, IkSolver._Rotation2),
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
        angle: Vector3,
        min: DeepImmutable<Vector3>,
        max: DeepImmutable<Vector3>,
        useAxis: boolean
    ): void {
        if (angle.x < min.x) {
            const diff = 2 * min.x - angle.x;
            angle.x = (diff <= max.x && useAxis) ? diff : min.x;
        } else if (angle.x > max.x) {
            const diff = 2 * max.x - angle.x;
            angle.x = (diff >= min.x && useAxis) ? diff : max.x;
        }

        if (angle.y < min.y) {
            const diff = 2 * min.y - angle.y;
            angle.y = (diff <= max.y && useAxis) ? diff : min.y;
        } else if (angle.y > max.y) {
            const diff = 2 * max.y - angle.y;
            angle.y = (diff >= min.y && useAxis) ? diff : max.y;
        }

        if (angle.z < min.z) {
            const diff = 2 * min.z - angle.z;
            angle.z = (diff <= max.z && useAxis) ? diff : min.z;
        } else if (angle.z > max.z) {
            const diff = 2 * max.z - angle.z;
            angle.z = (diff >= min.z && useAxis) ? diff : max.z;
        }
    }
}
