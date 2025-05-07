import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene } from "@babylonjs/core/scene";

export interface ISceneBuilder {
    buildAsync(canvas: HTMLCanvasElement, engine: AbstractEngine): Scene | Promise<Scene>;
}

export interface IBaseRuntimeInitParams {
    canvas: HTMLCanvasElement;
    engine: AbstractEngine;
    sceneBuilder: ISceneBuilder;
}

export class BaseRuntime {
    private readonly _canvas: HTMLCanvasElement;
    private readonly _engine: AbstractEngine;
    private _scene: Scene;
    private _onTick: () => void;

    private constructor(params: IBaseRuntimeInitParams) {
        this._canvas = params.canvas;
        this._engine = params.engine;

        this._scene = null!;
        this._onTick = null!;
    }

    public static async CreateAsync(params: IBaseRuntimeInitParams): Promise<BaseRuntime> {
        const runtime = new BaseRuntime(params);
        runtime._scene = await runtime._initializeAsync(params.sceneBuilder);
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

    private async _initializeAsync(sceneBuilder: ISceneBuilder): Promise<Scene> {
        return await sceneBuilder.buildAsync(this._canvas, this._engine);
    }

    private _makeOnTick(): () => void {
        const scene = this._scene;
        return () => scene.render();
    }
}
