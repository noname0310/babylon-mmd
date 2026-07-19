import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { MmdRuntimeModelAnimationContainer } from "./mmdRuntimeModelAnimationContainer.pure";

declare module "../../Loader/Animation/mmdModelAnimationContainer" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdModelAnimationContainer extends IMmdBindableModelAnimation<MmdRuntimeModelAnimationContainer> { }
}
