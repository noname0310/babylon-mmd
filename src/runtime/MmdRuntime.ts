import type { Material, Mesh, Scene } from "@babylonjs/core";
import { Logger } from "@babylonjs/core";

import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdCamera } from "./MmdCamera";
import { MmdMesh } from "./MmdMesh";
import { MmdModel } from "./MmdModel";
import type { MmdPhysics } from "./MmdPhysics";
import { MmdStandardMaterialProxy } from "./MmdStandardMaterialProxy";

export interface CreateMmdModelOptions {
    materialProxyConstructor?: IMmdMaterialProxyConstructor<Material>;
    buildPhysics?: boolean;
}

export class MmdRuntime implements ILogger {
    private readonly _physics: MmdPhysics | null;

    private readonly _models: MmdModel[];
    private _camera: MmdCamera | null;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    private _isRegistered: boolean;

    private _animationStartTime: number;
    private _animationStopTime: number;

    private _isAnimationPlaying: boolean;

    private readonly _needToInitializePhysicsModels: MmdModel[] = [];

    private readonly _beforePhysicsBinded = this.beforePhysics.bind(this);
    private readonly _afterPhysicsBinded = this.afterPhysics.bind(this);

    public constructor(physics?: MmdPhysics) {
        this._physics = physics ?? null;

        this._models = [];
        this._camera = null;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._isRegistered = false;

        this._animationStartTime = 0;
        this._animationStopTime = -1;
        this._isAnimationPlaying = false;

        this._needToInitializePhysicsModels = [];
    }

    public createMmdModel(
        mmdMesh: Mesh,
        options: CreateMmdModelOptions = {}
    ): MmdModel {
        if (!MmdMesh.isMmdMesh(mmdMesh)) throw new Error("Mesh validation failed.");

        if (options.materialProxyConstructor === undefined) {
            options.materialProxyConstructor = MmdStandardMaterialProxy as unknown as IMmdMaterialProxyConstructor<Material>;
        }
        if (options.buildPhysics === undefined) {
            options.buildPhysics = true;
        }

        const model = new MmdModel(
            mmdMesh,
            options.materialProxyConstructor,
            options.buildPhysics ? this._physics : null,
            this
        );
        this._models.push(model);
        this._needToInitializePhysicsModels.push(model);

        return model;
    }

    public destroyMmdModel(mmdModel: MmdModel): void {
        mmdModel.dispose();

        const models = this._models;
        const index = models.indexOf(mmdModel);
        if (index < 0) throw new Error("Model not found.");

        models.splice(index, 1);
    }

    public setCamera(camera: MmdCamera): void {
        this._camera = camera;
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

            if (this._camera !== null) {
                this._camera.animate(elapsedFrameTime);
            }
        } else {
            const models = this._models;
            for (let i = 0; i < models.length; ++i) {
                models[i].beforePhysics(null);
            }
        }

        const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
        for (let i = 0; i < needToInitializePhysicsModels.length; ++i) {
            needToInitializePhysicsModels[i].initializePhysics();
        }
        needToInitializePhysicsModels.length = 0;
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
        this._animationStopTime = -1;
        this._isAnimationPlaying = true;

        const models = this._models;
        for (let i = 0; i < this._models.length; ++i) {
            models[i].resetState();
        }
    }

    public stopAnimation(): void {
        if (!this._isAnimationPlaying) return;

        this._isAnimationPlaying = false;
    }

    public pauseAnimation(): void {
        if (!this._isAnimationPlaying) return;

        this._animationStopTime = performance.now();
        this._isAnimationPlaying = false;
    }

    public resumeAnimation(): void {
        if (this._isAnimationPlaying) return;
        if (this._animationStopTime === -1) return;

        this._animationStartTime += performance.now() - this._animationStopTime;
        this._animationStopTime = -1;
        this._isAnimationPlaying = true;
    }

    public seekAnimation(frameTime: number): void {
        if (!this._isAnimationPlaying) return;

        const elapsed = performance.now() - this._animationStartTime;
        const elapsedFrameTime = elapsed * 0.001 * 30;

        if (2 * 30 < Math.abs(frameTime - elapsedFrameTime)) {
            const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
            for (let i = 0; i < this._models.length; ++i) {
                const model = this._models[i];
                if (model.currentAnimation !== null) {
                    needToInitializePhysicsModels.push(model);
                }
            }
        }

        this._animationStartTime = performance.now() - frameTime * 1000 / 30;
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
