/**
 * Interface for objects that store the state of RigidBodies
 */
export interface IRigidBodyStateContainer {
    /**
     * Uint8Array that stores the state of RigidBody
     *
     * - If bone position is driven by physics, the value is 1
     * - If bone position is driven by only animation, the value is 0
     *
     * You can get the state of the rigid body by `rigidBodyStates[MmdModel.runtimeBones[i].rigidBodyIndex]`
     */
    readonly rigidBodyStates: Uint8Array;
}
