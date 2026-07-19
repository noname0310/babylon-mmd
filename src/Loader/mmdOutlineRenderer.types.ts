import type { _InstancesBatch } from "@babylonjs/core/Meshes/mesh.pure";

import type { MmdOutlineRenderer } from "./mmdOutlineRenderer.pure";

declare module "@babylonjs/core/scene.pure" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface Scene {
        /** @internal */
        _mmdOutlineRenderer: MmdOutlineRenderer;

        /**
         * Gets the outline renderer associated with the scene
         * @returns a MmdOutlineRenderer
         */
        getMmdOutlineRenderer(): MmdOutlineRenderer;
    }
}
