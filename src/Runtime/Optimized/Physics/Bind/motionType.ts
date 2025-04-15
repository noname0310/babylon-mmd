/**
 * Bullet physics motion type
 */
export enum MotionType {
    /**
     * Dynamic motion type Rigid bodies are affected by forces and can be moved by the user
     */
    Dynamic = 0,

    /**
     * Static motion type Rigid bodies are not affected by forces and cannot be moved by the user
     */
    Static = 1,

    /**
     * Kinematic motion type Rigid bodies are not affected by forces but can be moved by the user
     */
    Kinematic = 2,
}
