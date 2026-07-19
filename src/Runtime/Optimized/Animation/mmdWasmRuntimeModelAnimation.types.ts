import type { ILogger } from "@/Runtime/ILogger";

import type { MmdWasmModel } from "../mmdWasmModel";
import type { MmdWasmRuntimeModelAnimation } from "./mmdWasmRuntimeModelAnimation.pure";

declare module "./mmdWasmAnimation" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface MmdWasmAnimation {
        /**
         * @internal
         */
        _runtimeModelAnimations: MmdWasmRuntimeModelAnimation[];

        /**
         * @internal
         * Create wasm runtime model animation
         * @param model Bind target
         * @param onDispose Callback when this instance is disposed
         * @param retargetingMap Animation bone name to model bone name map
         * @param logger Logger
         * @returns MmdRuntimeModelAnimation instance
         */
        createWasmRuntimeModelAnimation(
            model: MmdWasmModel,
            onDispose: () => void,
            retargetingMap?: { [key: string]: string },
            logger?: ILogger
        ): MmdWasmRuntimeModelAnimation;
    }
}
