import type { IMmdBindableCameraAnimation } from "./IMmdBindableAnimation";
import type { MmdRuntimeCameraAnimationContainer } from "./mmdRuntimeCameraAnimationContainer.pure";

declare module "../../Loader/Animation/mmdCameraAnimationContainer" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdCameraAnimationContainer extends IMmdBindableCameraAnimation<MmdRuntimeCameraAnimationContainer> { }
}
