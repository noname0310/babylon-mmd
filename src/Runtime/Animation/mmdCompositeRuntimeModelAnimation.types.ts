import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { MmdCompositeRuntimeModelAnimation } from "./mmdCompositeRuntimeModelAnimation.pure";

declare module "./mmdCompositeAnimation" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdCompositeAnimation extends IMmdBindableModelAnimation<MmdCompositeRuntimeModelAnimation> { }
}
