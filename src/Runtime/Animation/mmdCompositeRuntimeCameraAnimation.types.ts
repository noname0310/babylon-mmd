import type { IMmdBindableCameraAnimation } from "./IMmdBindableAnimation";
import type { MmdCompositeRuntimeCameraAnimation } from "./mmdCompositeRuntimeCameraAnimation.pure";

declare module "./mmdCompositeAnimation" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdCompositeAnimation extends IMmdBindableCameraAnimation<MmdCompositeRuntimeCameraAnimation> { }
}
