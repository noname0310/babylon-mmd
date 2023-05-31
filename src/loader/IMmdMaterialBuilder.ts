import * as BABYLON from "@babylonjs/core";

import { PmxObject } from "./parser/PmxObject";

export interface IMmdMaterialBuilder {
    buildMaterials(
        pmxObject: PmxObject,
        rootUrl: string,
        scene: BABYLON.Scene,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        multiMaterial: BABYLON.MultiMaterial
    ): Promise<void> | void;
}
