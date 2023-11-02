import type { IMmdAnimation } from "@/Loader/Animation/IMmdAnimation";

import type { ILogger } from "../ILogger";

/**
 * MMD Runtime Camera Animation
 */
export interface IMmdRuntimeCameraAnimation {
    readonly animation: IMmdAnimation;

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    animate(frameTime: number): void;

    /**
     * Dispose
     */
    dispose?(): void;
}

/**
 * MMD Runtime Model Animation
 */
export interface IMmdRuntimeModelAnimation {
    readonly animation: IMmdAnimation;

    /**
     * Update animation
     * @param frameTime frame time in 30fps
     */
    animate(frameTime: number): void;

    /**
     * Induce material recompile
     *
     * This method must run once before the animation runs
     *
     * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
     * @param logger logger
     */
    induceMaterialRecompile(logger?: ILogger): void;

    /**
     * Dispose
     */
    dispose?(): void;
}
