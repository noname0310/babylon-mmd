import type { Engine } from "@babylonjs/core";

import { BaseRuntime } from "./BaseRuntime";
import type { ISceneBuilder } from "./ISceneBuilder";

export class RuntimeBuilder {
    private readonly _canvas: HTMLCanvasElement;
    private readonly _engine: Engine;
    private _sceneBuilder: ISceneBuilder | null;

    public constructor(canvas: HTMLCanvasElement, engine: Engine) {
        this._canvas = canvas;
        this._engine = engine;
        this._sceneBuilder = null;
    }

    public withSceneBuilder(sceneBuilder: ISceneBuilder): this {
        this._sceneBuilder = sceneBuilder;
        return this;
    }

    public async make(): Promise<BaseRuntime> {
        if (this._sceneBuilder === null) {
            throw new Error("Scene builder is not set");
        }

        return BaseRuntime.Create({
            canvas: this._canvas,
            engine: this._engine,
            sceneBuilder: this._sceneBuilder
        });
    }
}
