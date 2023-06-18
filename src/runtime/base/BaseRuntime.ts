import type { Engine, Scene } from "@babylonjs/core";

import type { ISceneBuilder } from "./ISceneBuilder";
import type { ITickRunner } from "./ITickRunner";

export interface BaseRuntimeInitParams {
    canvas: HTMLCanvasElement;
    engine: Engine;
    sceneBuilder: ISceneBuilder;
    tickRunner: ITickRunner;
}

export interface IRuntimeContext {
    readonly engine: Engine;
    readonly scene: Scene;
}

export class BaseRuntime {
    private readonly _canvas: HTMLCanvasElement;
    private readonly _engine: Engine;
    private readonly _tickRunner: ITickRunner;
    private _scene: Scene;
    private _onTick: () => void;

    private constructor(params: BaseRuntimeInitParams) {
        this._canvas = params.canvas;
        this._engine = params.engine;
        this._tickRunner = params.tickRunner;

        this._scene = null!;
        this._onTick = null!;
    }

    public static async Create(params: BaseRuntimeInitParams): Promise<BaseRuntime> {
        const runtime = new BaseRuntime(params);
        runtime._scene = await runtime._initialize(params.sceneBuilder);
        runtime._onTick = runtime._makeOnTick();
        return runtime;
    }

    public run(): void {
        const engine = this._engine;

        window.addEventListener("resize", this._onResize);
        engine.runRenderLoop(this._onTick);
    }

    public dispose(): void {
        window.removeEventListener("resize", this._onResize);
        this._engine.dispose();
    }

    private readonly _onResize = (): void => {
        this._engine.resize();
    };

    private async _initialize(sceneBuilder: ISceneBuilder): Promise<Scene> {
        const scene = await sceneBuilder.build(this._canvas, this._engine);
        this._tickRunner.afterBuild({
            engine: this._engine,
            scene: scene
        });
        return scene;
    }

    private _makeOnTick(): () => void {
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
