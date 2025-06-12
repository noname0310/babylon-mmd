/**
 * @internal
 * Represents the states of rigid body temporal kinematics
 *
 *
 * ==============================State machine graph===================================
 *
 * [Disabled: always kinematic]
 *
 * [WaitForChange]              --(change to kinematic)-->     [Changed: kinematic]
 *
 * [WaitForTemporalChange]      --(change to kinematic)-->     [WaitForRestore]     --(restore to dynamic)-->     [Idle: dynamic]
 *
 * ====================================================================================
 *
 *
 * ==============================External transitions==================================
 * For make kinematic:
 * [Idle] -> [waitForChange]
 * [WaitForChange] -> X
 * [WaitForTemporalChange] -> [WaitForChange]
 * [Changed] -> X
 * [WaitForRestore] -> [WaitForChange]
 *
 * For make temporal kinematic:
 * [Idle] -> [WaitForTemporalChange]
 * [WaitForChange] -> [WaitForTemporalChange]
 * [WaitForTemporalChange] -> X
 * [Changed] -> [WaitForTemporalChange]
 * [WaitForRestore] -> [WaitForTemporalChange]
 *
 * For restore dynamic:
 * [Idle] -> X
 * [WaitForChange] -> [WaitForRestore]
 * [WaitForTemporalChange] -> [WaitForRestore]
 * [Changed] -> [WaitForRestore]
 * [WaitForRestore] -> X
 * ====================================================================================
 */
export enum TemporalKinematicState {
    /**
     * For follow bone types that do not use temporal kinematics
     */
    Disabled = 0,

    /**
     * Ground state of dynamics
     */
    Idle = 1,

    /**
     * Wait for a change physics mode to kinematic
     */
    WaitForChange = 2,

    /**
     * Wait for a change physics mode to kinematic for one frame
     */
    WaitForTemporalChange = 3,

    /**
     * State when the physics mode has changed to kinematic
     *
     * only transition from WaitForChange to Changed
     */
    Changed = 4,

    /**
     * Wait for a restore of the physics mode to dynamic
     */
    WaitForRestore = 5
}
