import type { MmdMesh } from "./MmdMesh";
import { MmdMorphController } from "./MmdMorphController";

export class MmdModel {
    public readonly mesh: MmdMesh;
    public readonly morph: MmdMorphController;

    public constructor(
        mmdMesh: MmdMesh
    ) {
        this.mesh = mmdMesh;
        this.morph = new MmdMorphController(mmdMesh.morphTargetManager, mmdMesh.metadata.morphs);
    }
}
