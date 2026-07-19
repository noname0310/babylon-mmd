import type { IBpmxLoaderOptions } from "./Optimized/bpmxLoader.pure";
import type { IPmLoaderOptions } from "./pmLoader";

declare module "@babylonjs/core/Loading/sceneLoader" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface SceneLoaderPluginOptions {
        /**
         * Defines options for the pmx/pmd/bpmx loader.
         */
        mmdmodel?: Partial<IPmLoaderOptions & IBpmxLoaderOptions>;
    }
}
