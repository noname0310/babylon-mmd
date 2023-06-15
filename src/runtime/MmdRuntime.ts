import type { Mesh } from "@babylonjs/core";

import type { RuntimeMmdMesh } from "./MmdMesh";
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

        const runtimeMesh = mmdMesh as unknown as RuntimeMmdMesh;
        runtimeMesh.metadata = {
            isRuntimeMmdModel: true,
            header: mmdMesh.metadata.header
        };

        return model;
    }

    public update(): void {
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            const model = models[i];
            model.morph.update();
        }
    }
}
