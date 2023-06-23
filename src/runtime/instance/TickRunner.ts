import { Mesh } from "@babylonjs/core";
import { Inspector } from "@babylonjs/inspector";

import type { IRuntimeContext } from "../base/BaseRuntime";
import type { ITickRunner } from "../base/ITickRunner";
import { MmdRuntime } from "../MmdRuntime";

export class TickRunner implements ITickRunner {
    private readonly _mmdRuntime = new MmdRuntime();

    public afterBuild(context: IRuntimeContext): void {
        const mmdRuntime = this._mmdRuntime;
        mmdRuntime.loggingEnabled = true;
        Object.defineProperty(globalThis, "mmdModels", {
            configurable: true,
            enumerable: true,
            get: () => mmdRuntime.models
        });

        const meshes = context.scene.meshes;
        for (let i = 0; i < meshes.length; ++i) {
            const mesh = meshes[i];
            if (!(mesh instanceof Mesh)) continue;
            if (!mesh.metadata || !mesh.metadata.isMmdModel) continue;

            mmdRuntime.createMmdModel(mesh);
        }

        mmdRuntime.register(context.scene);

        Inspector.Show(context.scene, { });
        // Inspector.Hide();
        context.engine.setHardwareScalingLevel(1);
    }
    public beforeRender(/* context: IRuntimeContext */): void { /* do nothing */ }
    public afterRender(/* context: IRuntimeContext */): void { /* do nothing */ }
}
