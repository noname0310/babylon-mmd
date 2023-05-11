import type * as BABYLON from "@babylonjs/core";

import { BaseRuntime } from "./BaseRuntime";
import type { ISceneBuilder } from "./ISceneBuilder";
import type { ITickRunner } from "./ITickRunner";

export class RuntimeBuilder {
    private readonly _canvas: HTMLCanvasElement;
    private readonly _engine: BABYLON.Engine;
    private _sceneBuilder: ISceneBuilder | null;
    private _tickRunner: ITickRunner | null;

    public constructor(canvas: HTMLCanvasElement, engine: BABYLON.Engine) {
        this._canvas = canvas;
        this._engine = engine;
        this._sceneBuilder = null;
        this._tickRunner = null;
    }

    public withSceneBuilder(sceneBuilder: ISceneBuilder): this {
        this._sceneBuilder = sceneBuilder;
        return this;
    }

    public withTickRunner(tickRunner: ITickRunner): this {
        this._tickRunner = tickRunner;
        return this;
    }

    public make(): BaseRuntime {
        if (this._sceneBuilder === null) {
            throw new Error("Scene builder is not set");
        }

        if (this._tickRunner === null) {
            this._tickRunner = new class implements ITickRunner {
                public afterBuild(): void { /* do nothing */ }
                public beforeRender(): void { /* do nothing */ }
                public afterRender(): void { /* do nothing */ }
            };
        }

        return new BaseRuntime({
            canvas: this._canvas,
            engine: this._engine,
            sceneBuilder: this._sceneBuilder,
            tickRunner: this._tickRunner
        });
    }
}
