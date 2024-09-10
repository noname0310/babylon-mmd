import type { ISceneLoaderPluginMetadata } from "@babylonjs/core/Loading/sceneLoader";

export const PmxLoaderMetadata = {
    name: "pmx",

    extensions: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ".pmx": { isBinary: true }
    }
} as const satisfies ISceneLoaderPluginMetadata;
