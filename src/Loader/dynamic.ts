import type { ISceneLoaderPluginAsync, ISceneLoaderPluginFactory, SceneLoaderPluginOptions } from "@babylonjs/core/Loading/sceneLoader";
import { RegisterSceneLoaderPlugin } from "@babylonjs/core/Loading/sceneLoader";

import { BpmxLoaderMetadata } from "./Optimized/bpmxLoader.metadata";
import { PmdLoaderMetadata } from "./pmdLoader.metadata";
import { PmxLoaderMetadata } from "./pmxLoader.metadata";

/**
 * Registers the async plugin factories for all mmd model loaders (pmx, pmd, bpmx).
 * Loaders will be dynamically imported on demand, only when a SceneLoader load operation needs each respective loader.
 */
export function RegisterMmdModelLoaders(): void {
    // Register the PMX loader.
    RegisterSceneLoaderPlugin({
        ...PmxLoaderMetadata,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        createPlugin: async(options: SceneLoaderPluginOptions): Promise<ISceneLoaderPluginAsync> => {
            const { PmxLoader: pmxLoader } = await import("./pmxLoader");
            return new pmxLoader(options.mmdmodel);
        }
    } satisfies ISceneLoaderPluginFactory);

    // Register the PMD loader.
    RegisterSceneLoaderPlugin({
        ...PmdLoaderMetadata,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        createPlugin: async(options: SceneLoaderPluginOptions): Promise<ISceneLoaderPluginAsync> => {
            const { PmdLoader: pmdLoader } = await import("./pmdLoader");
            return new pmdLoader(options.mmdmodel);
        }
    } satisfies ISceneLoaderPluginFactory);

    // Register the BPMX loader.
    RegisterSceneLoaderPlugin({
        ...BpmxLoaderMetadata,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        createPlugin: async(options: SceneLoaderPluginOptions): Promise<ISceneLoaderPluginAsync> => {
            const { BpmxLoader: bpmxLoader } = await import("./Optimized/bpmxLoader");
            return new bpmxLoader(options.mmdmodel);
        }
    } satisfies ISceneLoaderPluginFactory);
}
