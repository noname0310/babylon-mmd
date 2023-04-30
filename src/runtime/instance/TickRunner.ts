import * as BABYLON from "babylonjs";

import type { IRuntimeContext } from "../base/BaseRuntime";
import type { ITickRunner } from "../base/ITickRunner";

export class TickRunner implements ITickRunner {
    public afterBuild(context: IRuntimeContext): void {
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
