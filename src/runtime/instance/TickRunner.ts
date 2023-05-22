import * as BABYLON from "@babylonjs/core";
import { Inspector } from "@babylonjs/inspector";

import type { IRuntimeContext } from "../base/BaseRuntime";
import type { ITickRunner } from "../base/ITickRunner";

export class TickRunner implements ITickRunner {
    public afterBuild(context: IRuntimeContext): void {
        Inspector.Show(context.scene, { });
        Inspector.Hide();
        context;
        BABYLON;
    }
    public beforeRender(context: IRuntimeContext): void {
        context;
    }
    public afterRender(context: IRuntimeContext): void {
        context;
    }
}
