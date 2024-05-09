import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import { PhysicsJoint, type PhysicsJointData } from "@babylonjs/core/Physics/v1/physicsJoint";
import { AmmoJSPlugin } from "@babylonjs/core/Physics/v1/Plugins/ammoJSPlugin";

export const generic6DofSpringJoint = 20;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export class MmdAmmoJSPlugin extends AmmoJSPlugin {
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

        this.setMaxSteps(120);
        this.setFixedTimeStep(1 / 120);
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    private override _stepSimulation(timeStep: number = 1 / 60, maxSteps: number = 10, fixedTimeStep: number = 1 / 60): void {
        this.world.stepSimulation(timeStep, maxSteps, fixedTimeStep);
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
}
