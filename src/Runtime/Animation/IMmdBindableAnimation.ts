import type { IMmdAnimation } from "@/Loader/Animation/IMmdAnimation";
import type { ILogger } from "@/Loader/Parser/ILogger";

import type { IMmdCamera } from "../IMmdCamera";
import type { IMmdModel } from "../IMmdModel";
import type { IMmdRuntimeCameraAnimation, IMmdRuntimeModelAnimation } from "./IMmdRuntimeAnimation";

/**
 * Interface for Bindable MMD Camera animation
 */
export interface IMmdBindableCameraAnimation<T extends IMmdRuntimeCameraAnimation = IMmdRuntimeCameraAnimation> extends IMmdAnimation {
    /**
     * Create runtime camera animation
     * @param camera bind target
     * @returns Runtime camera animation instance
     */
    createRuntimeCameraAnimation(camera: IMmdCamera): T;
}

/**
 * Interface for Bindable MMD Model animation
 */
export interface IMmdBindableModelAnimation<T extends IMmdRuntimeModelAnimation = IMmdRuntimeModelAnimation> extends IMmdAnimation {
    /**
     * @internal
     * Create runtime model animation
     * @param model Bind target
     * @param retargetingMap Animation bone name to model bone name map
     * @param logger Logger
     * @returns Runtime model animation instance
     */
    createRuntimeModelAnimation(model: IMmdModel, retargetingMap?: { [key: string]: string }, logger?: ILogger): T;
}
