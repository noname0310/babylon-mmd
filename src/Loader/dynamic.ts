import type { ISceneLoaderPluginAsync, ISceneLoaderPluginFactory, SceneLoaderPluginOptions } from "@babylonjs/core/Loading/sceneLoader";
import { registerSceneLoaderPlugin } from "@babylonjs/core/Loading/sceneLoader";

import { BpmxLoaderMetadata } from "./Optimized/bpmxLoader.metadata";
import { PmdLoaderMetadata } from "./pmdLoader.metadata";
import { PmxLoaderMetadata } from "./pmxLoader.metadata";

/**
 * Registers the async plugin factories for all mmd model loaders (pmx, pmd, bpmx).
 * Loaders will be dynamically imported on demand, only when a SceneLoader load operation needs each respective loader.
 */
export function registerMmdModelLoaders(): void {
    // Register the PMX loader.
    registerSceneLoaderPlugin({
        ...PmxLoaderMetadata,
        createPlugin: async(options: SceneLoaderPluginOptions): Promise<ISceneLoaderPluginAsync> => {
            const { PmxLoader: pmxLoader } = await import("./pmxLoader");
            return new pmxLoader(options.mmdmodel);
        }
    } satisfies ISceneLoaderPluginFactory);

    // Register the PMD loader.
    registerSceneLoaderPlugin({
        ...PmdLoaderMetadata,
        createPlugin: async(options: SceneLoaderPluginOptions): Promise<ISceneLoaderPluginAsync> => {
            const { PmdLoader: pmdLoader } = await import("./pmdLoader");
            return new pmdLoader(options.mmdmodel);
        }
    } satisfies ISceneLoaderPluginFactory);

    // Register the BPMX loader.
    registerSceneLoaderPlugin({
        ...BpmxLoaderMetadata,
        createPlugin: async(options: SceneLoaderPluginOptions): Promise<ISceneLoaderPluginAsync> => {
            const { BpmxLoader: bpmxLoader } = await import("./Optimized/bpmxLoader");
            return new bpmxLoader(options.mmdmodel);
        }
    } satisfies ISceneLoaderPluginFactory);
}