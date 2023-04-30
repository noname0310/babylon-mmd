import type * as BABYLON from "babylonjs";

import type { ISceneBuilder } from "./ISceneBuilder";
import type { ITickRunner } from "./ITickRunner";

export interface BaseRuntimeInitParams {
    canvas: HTMLCanvasElement;
    engine: BABYLON.Engine;
    sceneBuilder: ISceneBuilder;
    tickRunner: ITickRunner;
}

export interface IRuntimeContext {
    readonly engine: BABYLON.Engine;
    readonly scene: BABYLON.Scene;
}

export class BaseRuntime {
    private readonly _canvas: HTMLCanvasElement;
    private readonly _engine: BABYLON.Engine;
    private readonly _scene: BABYLON.Scene;
    private readonly _tickRunner: ITickRunner;
    private readonly _onTick: () => void;

    public constructor(params: BaseRuntimeInitParams) {
        this._canvas = params.canvas;
        this._engine = params.engine;
        this._scene =  this.initialize(params.sceneBuilder);
        this._tickRunner = params.tickRunner;

        this._onTick = this.makeOnTick();
    }

    public run(): void {
        const engine = this._engine;

        window.addEventListener("resize", this.onResize);
        engine.runRenderLoop(this._onTick);
    }

    public dispose(): void {
        window.removeEventListener("resize", this.onResize);
        this._engine.dispose();
    }

    private readonly onResize = (): void => {
        this._engine.resize();
    };

    private initialize(sceneBuilder: ISceneBuilder): BABYLON.Scene {
        const scene = sceneBuilder.build(this._canvas, this._engine);
        this._tickRunner.afterBuild({
            engine: this._engine,
            scene: scene
        });
        return scene;
    }

    private makeOnTick(): () => void {
        const scene = this._scene;
        const tickRunner = this._tickRunner;

        const context: IRuntimeContext = {
            engine: this._engine,
            scene: scene
        };

        return () => {
            tickRunner.beforeRender(context);
            scene.render();
            tickRunner.afterRender(context);
        };
    }
}
