import type { ISceneLoaderPluginMetadata } from "@babylonjs/core/Loading/sceneLoader";

export const BpmxLoaderMetadata = {
    name: "bpmx",

    extensions: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ".bpmx": { isBinary: true }
    }
} as const satisfies ISceneLoaderPluginMetadata;
