import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { MmdRuntimeModelAnimation } from "./mmdRuntimeModelAnimation.pure";

declare module "../../Loader/Animation/mmdAnimationBase" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdAnimationBase extends IMmdBindableModelAnimation<MmdRuntimeModelAnimation> { }
}
