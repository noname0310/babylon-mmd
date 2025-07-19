/**
 * Animation handle for runtime animations in MMD runtime
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type MmdRuntimeAnimationHandle = number  & { __brand: "RuntimeAnimationHandle" };

let NextHandle = 1;

/**
 * Create a new runtime animation handle
 *
 * This function generates a unique handle for each animation.
 * The handle is a number that can be used to identify the animation in the runtime.
 *
 * @returns A unique runtime animation handle
 */
export function CreateMmdRuntimeAnimationHandle(): MmdRuntimeAnimationHandle {
    const handle = NextHandle;
    NextHandle += 1;
    return handle as MmdRuntimeAnimationHandle;
}
