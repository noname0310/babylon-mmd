import type { IMmdAnimation } from "@/Loader/Animation/IMmdAnimation";
import type { ILogger } from "@/Loader/Parser/ILogger";

import type { MmdCamera } from "../mmdCamera";
import type { MmdModel } from "../mmdModel";
import type { IMmdRuntimeCameraAnimation, IMmdRuntimeModelAnimation } from "./IMmdRuntimeAnimation";

/**
 * Interface for Bindable MMD Camera animation
 */
export interface IMmdBindableCameraAnimation<T extends IMmdRuntimeCameraAnimation = IMmdRuntimeCameraAnimation> extends IMmdAnimation {
    /**
     * Create runtime camera animation
     * @param camera bind target
     * @returns MmdRuntimeCameraAnimation instance
     */
    createRuntimeAnimation(camera: MmdCamera): T;
}

/**
 * Interface for Bindable MMD Model animation
 */
export interface IMmdBindableModelAnimation<T extends IMmdRuntimeModelAnimation = IMmdRuntimeModelAnimation> extends IMmdAnimation {
    /**
     * Create runtime animation
     * @param model Bind target
     * @param retargetingMap Model bone name to animation bone name map
     * @param logger Logger
     * @returns MmdRuntimeModelAnimation instance
     */
    createRuntimeAnimation(model: MmdModel, retargetingMap?: { [key: string]: string }, logger?: ILogger): T;
}
