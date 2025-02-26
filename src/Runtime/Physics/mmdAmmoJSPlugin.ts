import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { PhysicsImpostorJoint } from "@babylonjs/core/Physics/v1/IPhysicsEnginePlugin";
import { PhysicsJoint, type PhysicsJointData } from "@babylonjs/core/Physics/v1/physicsJoint";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/v1/Plugins/ammoJSPlugin";

export const generic6DofSpringJoint = 20;

/**
 * AmmoJS Physics plugin modified for MMD
 *
 * 120 steps per second is recommended for better reproduction of MMD physics. but performance reasons default is 60 steps per second.
 *
 * for better reproduction of MMD physics, you can set the following parameters:
 * ```javascript
 * plugin.setMaxSteps(120);
 * plugin.setFixedTimeStep(1 / 120);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export class MmdAmmoJSPlugin extends AmmoJSPlugin {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    private readonly _mmdtmpAmmoVector: import("ammojs-typed").default.btVector3;
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    private readonly _mmdtmpAmmoQuat: import("ammojs-typed").default.btQuaternion;
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    private readonly _mmdtmpAmmoTransformA: import("ammojs-typed").default.btTransform;
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    private readonly _mmdtmpAmmoTransformB: import("ammojs-typed").default.btTransform;

    private static readonly _BjsQuaternion = new Quaternion();

    /**
     * Initializes the ammoJS plugin
     * @param _useDeltaForWorldStep if the time between frames should be used when calculating physics steps (Default: true)
     * @param ammoInjection can be used to inject your own ammo reference
     * @param overlappingPairCache can be used to specify your own overlapping pair cache
     */
    public constructor(
        useDeltaForWorldStep: boolean = true,
        ammoInjection: any,
        overlappingPairCache: any = null
    ) {
        super(useDeltaForWorldStep, ammoInjection, overlappingPairCache);

        this.name = "MmdAmmoJSPlugin";

        // for better reproduction of MMD physics
        this.setFixedTimeStep(1 / 100);

        this._mmdtmpAmmoVector = new this.bjsAMMO.btVector3();
        this._mmdtmpAmmoQuat = new this.bjsAMMO.btQuaternion();
        this._mmdtmpAmmoTransformA = new this.bjsAMMO.btTransform();
        this._mmdtmpAmmoTransformB = new this.bjsAMMO.btTransform();
    }

    public override dispose(): void {
        super.dispose();
        this.bjsAMMO.destroy(this._mmdtmpAmmoVector);
        this.bjsAMMO.destroy(this._mmdtmpAmmoQuat);
        this.bjsAMMO.destroy(this._mmdtmpAmmoTransformA);
        this.bjsAMMO.destroy(this._mmdtmpAmmoTransformB);
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    private override _stepSimulation(timeStep: number = 1 / 60, maxSteps: number = 10, fixedTimeStep: number = 1 / 60): void {
        this.world.stepSimulation(timeStep, maxSteps, fixedTimeStep);
    }

    private _normalizeAngle(angle: number): number {
        const pi = Math.PI;
        const twoPi = 2 * pi;
        angle = angle % twoPi;

        if (angle < -pi) {
            angle += twoPi;
        } else if (angle > pi) {
            angle -= twoPi;
        }
        return angle;
    }

    /**
     * Generates a joint
     * @param impostorJoint the imposter joint to create the joint with
     */
    public override generateJoint(impostorJoint: PhysicsImpostorJoint): void {
        const mainBody = impostorJoint.mainImpostor.physicsBody;
        const connectedBody = impostorJoint.connectedImpostor.physicsBody;
        if (!mainBody || !connectedBody) {
            return;
        }

        // if the joint is already created, don't create it again for preventing memory leaks
        if (impostorJoint.joint.physicsJoint) {
            return;
        }

        if (impostorJoint.joint.type === generic6DofSpringJoint) {
            const jointData = impostorJoint.joint.jointData as Generic6DofSpringJointData;
            if (!jointData.mainFrame) {
                jointData.mainFrame = Matrix.Identity();
            }
            if (!jointData.connectedFrame) {
                jointData.connectedFrame = Matrix.Identity();
            }
            if (!jointData.useLinearReferenceFrameA) {
                jointData.useLinearReferenceFrameA = true;
            }
            if (!jointData.linearLowerLimit) {
                jointData.linearLowerLimit = new Vector3(0, 0, 0);
            }
            if (!jointData.linearUpperLimit) {
                jointData.linearUpperLimit = new Vector3(0, 0, 0);
            }
            if (!jointData.angularLowerLimit) {
                jointData.angularLowerLimit = new Vector3(0, 0, 0);
            }
            if (!jointData.angularUpperLimit) {
                jointData.angularUpperLimit = new Vector3(0, 0, 0);
            }
            if (!jointData.linearStiffness) {
                jointData.linearStiffness = new Vector3(0, 0, 0);
            }
            if (!jointData.angularStiffness) {
                jointData.angularStiffness = new Vector3(0, 0, 0);
            }

            const origin = this._mmdtmpAmmoVector;
            const rotation = this._mmdtmpAmmoQuat;

            {
                const mainMatrix = jointData.mainFrame;
                origin.setValue(mainMatrix.m[12], mainMatrix.m[13], mainMatrix.m[14]);
                const mainRotation = Quaternion.FromRotationMatrixToRef(mainMatrix, MmdAmmoJSPlugin._BjsQuaternion);
                rotation.setValue(mainRotation.x, mainRotation.y, mainRotation.z, mainRotation.w);
            }
            const mainFrame = this._mmdtmpAmmoTransformA;
            mainFrame.setOrigin(origin);
            mainFrame.setRotation(rotation);

            {
                const connectedMatrix = jointData.connectedFrame;
                origin.setValue(connectedMatrix.m[12], connectedMatrix.m[13], connectedMatrix.m[14]);
                const connectedRotation = Quaternion.FromRotationMatrixToRef(connectedMatrix, MmdAmmoJSPlugin._BjsQuaternion);
                rotation.setValue(connectedRotation.x, connectedRotation.y, connectedRotation.z, connectedRotation.w);
            }
            const connectedFrame = this._mmdtmpAmmoTransformB;
            connectedFrame.setOrigin(origin);
            connectedFrame.setRotation(rotation);

            // eslint-disable-next-line @typescript-eslint/consistent-type-imports
            const joint: import("ammojs-typed").default.btGeneric6DofSpringConstraint =
                new this.bjsAMMO.btGeneric6DofSpringConstraint(mainBody, connectedBody, mainFrame, connectedFrame, jointData.useLinearReferenceFrameA);

            const jointPtr = this.bjsAMMO.getPointer(joint);
            const heap8 = this.bjsAMMO.HEAP8 as Uint8Array;

            // jointPtr + 1300 = m_useLinearReferenceFrameA

            // check bullet binary layout
            if (heap8[jointPtr + 1300] === (jointData.useLinearReferenceFrameA ? 1 : 0) && heap8[jointPtr + 1301] === 1) {
                // ptr + 1301 = m_useOffsetForConstraintFrame
                heap8[jointPtr + 1301] = 0; // m_useOffsetForConstraintFrame = false
            }

            if (jointData.linearStiffness.x !== 0) {
                joint.setStiffness(0, jointData.linearStiffness.x);
                joint.enableSpring(0, true);
            } else {
                joint.enableSpring(0, false);
            }
            if (jointData.linearStiffness.y !== 0) {
                joint.setStiffness(1, jointData.linearStiffness.y);
                joint.enableSpring(1, true);
            } else {
                joint.enableSpring(1, false);
            }
            if (jointData.linearStiffness.z !== 0) {
                joint.setStiffness(2, jointData.linearStiffness.z);
                joint.enableSpring(2, true);
            } else {
                joint.enableSpring(2, false);
            }
            joint.setStiffness(3, jointData.angularStiffness.x);
            joint.enableSpring(3, true);
            joint.setStiffness(4, jointData.angularStiffness.y);
            joint.enableSpring(4, true);
            joint.setStiffness(5, jointData.angularStiffness.z);
            joint.enableSpring(5, true);

            const limitVector = this._mmdtmpAmmoVector;

            limitVector.setValue(jointData.linearLowerLimit.x, jointData.linearLowerLimit.y, jointData.linearLowerLimit.z);
            joint.setLinearLowerLimit(limitVector);

            limitVector.setValue(jointData.linearUpperLimit.x, jointData.linearUpperLimit.y, jointData.linearUpperLimit.z);
            joint.setLinearUpperLimit(limitVector);

            limitVector.setValue(
                this._normalizeAngle(jointData.angularLowerLimit.x),
                this._normalizeAngle(jointData.angularLowerLimit.y),
                this._normalizeAngle(jointData.angularLowerLimit.z)
            );
            joint.setAngularLowerLimit(limitVector);

            limitVector.setValue(
                this._normalizeAngle(jointData.angularUpperLimit.x),
                this._normalizeAngle(jointData.angularUpperLimit.y),
                this._normalizeAngle(jointData.angularUpperLimit.z)
            );
            joint.setAngularUpperLimit(limitVector);

            this.world.addConstraint(joint, !impostorJoint.joint.jointData.collision);
            impostorJoint.joint.physicsJoint = joint;
        } else {
            super.generateJoint(impostorJoint);
        }
    }
}

/**
 * Represents a Generic6DofSpringJoint
 */
export class Generic6DofSpringJoint extends PhysicsJoint {
    /**
     * Initializes the Generic6DofSpringJoint
     * @param jointData The physical joint data for the joint
     */
    public constructor(jointData: Generic6DofSpringJointData) {
        super(generic6DofSpringJoint, jointData);
    }
}

/**
 * Interface for a generic 6 DOF spring joint
 */
export interface Generic6DofSpringJointData extends PhysicsJointData {
    /**
     * The main local axis of the joint in the first body's local space.
     */
    mainFrame: Matrix;

    /**
     * The connected local axis of the joint in the second body's local space.
     */
    connectedFrame: Matrix;

    /**
     * if true, the linear reference frame is mainFrame, otherwise it is connectedFrame.
     */
    useLinearReferenceFrameA: boolean;

    /**
     * The linear lower limit of the joint.
     */
    linearLowerLimit?: Vector3;

    /**
     * The linear upper limit of the joint.
     */
    linearUpperLimit?: Vector3;

    /**
     * The angular lower limit of the joint.
     */
    angularLowerLimit?: Vector3;

    /**
     * The angular upper limit of the joint.
     */
    angularUpperLimit?: Vector3;

    /**
     * The linear stiffness of the joint.
     */
    linearStiffness?: Vector3;

    /**
     * The angular stiffness of the joint.
     */
    angularStiffness?: Vector3;
}
