import { IRuntimeContext } from "./BaseRuntime";

export interface ITickRunner {
    afterBuild(context: IRuntimeContext): void;
    beforeRender(context: IRuntimeContext): void;
    afterRender(context: IRuntimeContext): void;
}
