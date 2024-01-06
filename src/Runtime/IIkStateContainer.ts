/**
 * Interface for objects that store the state of IK solvers
 */
export interface IIkStateContainer {
    /**
     * Uint8Array that stores the state of IK solvers
     *
     * If `ikSolverState[MmdModel.runtimeBones[i].ikSolverIndex]` is 0, IK solver of `MmdModel.runtimeBones[i]` is disabled and vice versa
     */
    readonly ikSolverStates: Uint8Array;
}
