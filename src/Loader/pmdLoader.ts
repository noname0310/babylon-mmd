import type { SceneLoaderPluginOptions } from "@babylonjs/core/Loading/sceneLoader";
import { type ISceneLoaderPluginAsync, RegisterSceneLoaderPlugin } from "@babylonjs/core/Loading/sceneLoader";

import type { ILogger } from "./Parser/ILogger";
import { PmdReader } from "./Parser/pmdReader";
import type { PmxObject } from "./Parser/pmxObject";
import { PmdLoaderMetadata } from "./pmdLoader.metadata";
import type { IPmLoaderOptions } from "./pmLoader";
import { PmLoader } from "./pmLoader";

/**
 * PmdLoader is a loader that loads the model in the PMD format
 *
 * PMD is a binary file format that contains all the data except the texture of the model
 */
export class PmdLoader extends PmLoader implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Create a new PmdLoader
     *
     * @param options babylon.js scene loader options
     * @param loaderOptions Overriding options, typically pass global PmdLoader instance as loaderOptions
     */
    public constructor(options?: Partial<IPmLoaderOptions>, loaderOptions?: IPmLoaderOptions) {
        super(
            PmdLoaderMetadata.name,
            PmdLoaderMetadata.extensions,
            options,
            loaderOptions
        );
    }

    public createPlugin(options: SceneLoaderPluginOptions): ISceneLoaderPluginAsync {
        return new PmdLoader(options.mmdmodel, this);
    }

    protected override async _parseFileAsync(arrayBuffer: ArrayBuffer): Promise<PmxObject> {
        return await PmdReader.ParseAsync(arrayBuffer, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });
    }
}

RegisterSceneLoaderPlugin(new PmdLoader());
