import type { IMmdBindableCameraAnimation } from "./IMmdBindableAnimation";
import type { MmdRuntimeCameraAnimation } from "./mmdRuntimeCameraAnimation.pure";

declare module "../../Loader/Animation/mmdAnimationBase" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdAnimationBase extends IMmdBindableCameraAnimation<MmdRuntimeCameraAnimation> { }
}
