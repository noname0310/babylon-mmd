import type { ISceneLoaderPluginMetadata } from "@babylonjs/core/Loading/sceneLoader";

export const PmdLoaderMetadata = {
    name: "pmd",

    extensions: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ".pmd": { isBinary: true }
    }
} as const satisfies ISceneLoaderPluginMetadata;
