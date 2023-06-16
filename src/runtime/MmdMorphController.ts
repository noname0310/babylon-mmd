import type { MorphTargetManager } from "@babylonjs/core";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";

export class MmdMorphController {
    public constructor(
        morphTargetManager: MorphTargetManager,
        morphs: readonly MmdModelMetadata.Morph[]
    ) {
        morphTargetManager;
        morphs;
    }

    public update(): void {
        //
    }
}
