import type { SceneLoaderPluginOptions } from "@babylonjs/core/Loading/sceneLoader";
import { type ISceneLoaderPluginAsync, RegisterSceneLoaderPlugin } from "@babylonjs/core/Loading/sceneLoader";

import { BpmxLoader as OriginalBpmxLoader } from "../bpmxLoader";
import type { BpmxObject } from "../Parser/bpmxObject";
import { BpmxReader } from "./Parser/bpmxReader";

/**
 * Legacy BPMX loader 2.x
 *
 * BpmxLoader is a loader that loads models in BPMX format
 *
 * BPMX is a single binary file format that contains all the data of a model
 */
export class BpmxLoader extends OriginalBpmxLoader {
    public override createPlugin(options: SceneLoaderPluginOptions): ISceneLoaderPluginAsync {
        return new BpmxLoader(options.mmdmodel, this);
    }

    protected override async _parseFileAsync(arrayBuffer: ArrayBuffer): Promise<BpmxObject> {
        return await BpmxReader.ParseAsync(arrayBuffer, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });
    }
}

RegisterSceneLoaderPlugin(new BpmxLoader());
