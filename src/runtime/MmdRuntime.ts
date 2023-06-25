import type { Material, Mesh, Scene } from "@babylonjs/core";
import { Logger } from "@babylonjs/core";

import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import { MmdMesh } from "./MmdMesh";
import { MmdModel } from "./MmdModel";
import { MmdStandardMaterialProxy } from "./MmdStandardMaterialProxy";

export class MmdRuntime implements ILogger {
    private readonly _models: MmdModel[];

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    private _isRegistered: boolean;

    private _animationStartTime: number;
    private _isAnimationPlaying: boolean;

    private readonly _beforePhysicsBinded = this.beforePhysics.bind(this);
    private readonly _afterPhysicsBinded = this.afterPhysics.bind(this);

    public constructor() {
        this._models = [];

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._isRegistered = false;

        this._animationStartTime = 0;
        this._isAnimationPlaying = false;
    }

    public createMmdModel(
        mmdMesh: Mesh,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material> = MmdStandardMaterialProxy as unknown as IMmdMaterialProxyConstructor<Material>
    ): MmdModel {
        if (!MmdMesh.isMmdMesh(mmdMesh)) throw new Error("Mesh validation failed.");

        const model = new MmdModel(mmdMesh, materialProxyConstructor, this);
        this._models.push(model);

        return model;
    }

    public destroyMmdModel(mmdModel: MmdModel): void {
        mmdModel.enableSkeletonWorldMatrixUpdate();

        const models = this._models;
        const index = models.indexOf(mmdModel);
        if (index < 0) throw new Error("Model not found.");

        models.splice(index, 1);
    }

    public register(scene: Scene): void {
        if (this._isRegistered) return;
        this._isRegistered = true;

        scene.onBeforeAnimationsObservable.add(this._beforePhysicsBinded);
        scene.onBeforeRenderObservable.add(this._afterPhysicsBinded);
    }

    public unregister(scene: Scene): void {
        if (!this._isRegistered) return;
        this._isRegistered = false;

        scene.onBeforeAnimationsObservable.removeCallback(this._beforePhysicsBinded);
        scene.onBeforeRenderObservable.removeCallback(this._afterPhysicsBinded);
    }

    public beforePhysics(): void {
        if (this._isAnimationPlaying) {
            const elapsed = performance.now() - this._animationStartTime;
            const elapsedFrameTime = elapsed * 0.001 * 30;
            const models = this._models;
            for (let i = 0; i < models.length; ++i) {
                models[i].beforePhysics(elapsedFrameTime);
            }
        } else {
            const models = this._models;
            for (let i = 0; i < models.length; ++i) {
                models[i].beforePhysics(null);
            }
        }
    }

    public afterPhysics(): void {
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            models[i].afterPhysics();
        }
    }

    public playAnimation(): void {
        if (this._isAnimationPlaying) return;

        this._animationStartTime = performance.now();
        this._isAnimationPlaying = true;
    }

    public stopAnimation(): void {
        if (!this._isAnimationPlaying) return;

        this._isAnimationPlaying = false;
    }

    public get isAnimationPlaying(): boolean {
        return this._isAnimationPlaying;
    }

    public get models(): readonly MmdModel[] {
        return this._models;
    }

    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this._logEnabled;
            this.warn = this._warnEnabled;
            this.error = this._errorEnabled;
        } else {
            this.log = this._logDisabled;
            this.warn = this._warnDisabled;
            this.error = this._errorDisabled;
        }
    }

    private _logEnabled(message: string): void {
        Logger.Log(message);
    }

    private _logDisabled(): void {
        // do nothing
    }

    private _warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private _warnDisabled(): void {
        // do nothing
    }

    private _errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private _errorDisabled(): void {
        // do nothing
    }
}
