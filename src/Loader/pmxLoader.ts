import type { SceneLoaderPluginOptions } from "@babylonjs/core/Loading/sceneLoader";
import { type ISceneLoaderPluginAsync, registerSceneLoaderPlugin } from "@babylonjs/core/Loading/sceneLoader";

import type { ILogger } from "./Parser/ILogger";
import type { PmxObject } from "./Parser/pmxObject";
import { PmxReader } from "./Parser/pmxReader";
import type { PmLoaderOptions } from "./pmLoader";
import { PmLoader } from "./pmLoader";

/**
 * PmxLoader is a loader that loads the model in the PMX format
 *
 * PMX is a binary file format that contains all the data except the texture of the model
 */
export class PmxLoader extends PmLoader implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Create a new PmdLoader
     */
    public constructor(options?: Partial<PmLoaderOptions>, loaderOptions?: PmLoaderOptions) {
        super(
            "pmx",
            {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                ".pmx": { isBinary: true }
            },
            options,
            loaderOptions
        );
    }

    public createPlugin(options: SceneLoaderPluginOptions): ISceneLoaderPluginAsync {
        return new PmxLoader(options.mmdmodel, this);
    }

    protected override async _parseFileAsync(arrayBuffer: ArrayBuffer): Promise<PmxObject> {
        return await PmxReader.ParseAsync(arrayBuffer, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });
    }
}

registerSceneLoaderPlugin(new PmxLoader());
