/**
 * Bullet Physics runtime evaluation type
 */
export enum PhysicsRuntimeEvaluationType {
    /**
     * Immediate physics evaluation for the current frame
     */
    Immediate = 0,

    /**
     * Buffered physics evaluation for the next frame
     *
     * Asynchronous Multi-thread optimization applies when possible
     */
    Buffered = 1,
}
