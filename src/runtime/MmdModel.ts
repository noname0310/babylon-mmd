import { Material } from "@babylonjs/core";
import type { ILogger } from "./ILogger";
import { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdMesh } from "./MmdMesh";
import { MmdMorphController } from "./MmdMorphController";

export class MmdModel {
    public readonly mesh: MmdMesh;
    public readonly morph: MmdMorphController;

    public constructor(
        mmdMesh: MmdMesh,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material>,
        logger: ILogger
    ) {
        this.mesh = mmdMesh;
        this.morph = new MmdMorphController(
            mmdMesh.morphTargetManager,
            mmdMesh.skeleton,
            mmdMesh.material,
            materialProxyConstructor,
            mmdMesh.metadata.morphs,
            logger
        );
    }
}
