import type { Mesh } from "@babylonjs/core";

import { MmdMesh } from "./MmdMesh";
import { MmdModel } from "./MmdModel";

export class MmdRuntime {
    private readonly _models: MmdModel[];

    public constructor() {
        this._models = [];
    }

    public createMmdModel(mmdMesh: Mesh): MmdModel {
        if (!MmdMesh.isMmdMesh(mmdMesh)) throw new Error("Mesh validation failed.");

        const model = new MmdModel(mmdMesh);
        this._models.push(model);
        return model;
    }
}
