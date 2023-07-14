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

const enum AnimationState {
    Playing,
    Paused,
    Stopped
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

    private _currentFrameTime: number;
    private _timeScale: number;
    private _animationState: AnimationState;

    private readonly _needToInitializePhysicsModels: Set<MmdModel>;

    private _beforePhysicsBinded: (() => void) | null;
    private readonly _afterPhysicsBinded: () => void;

    public constructor(physics?: MmdPhysics) {
        this._physics = physics ?? null;

        this._models = [];
        this._camera = null;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._isRegistered = false;

        this._currentFrameTime = 0;
        this._timeScale = 1;
        this._animationState = AnimationState.Stopped;

        this._needToInitializePhysicsModels = new Set<MmdModel>();

        this._beforePhysicsBinded = null;
        this._afterPhysicsBinded = this.afterPhysics.bind(this);
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
        this._needToInitializePhysicsModels.add(model);

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

        this._beforePhysicsBinded = (): void => this.beforePhysics(scene.getEngine().getDeltaTime());

        scene.onBeforeAnimationsObservable.add(this._beforePhysicsBinded);
        scene.onBeforeRenderObservable.add(this._afterPhysicsBinded);
    }

    public unregister(scene: Scene): void {
        if (!this._isRegistered) return;
        this._isRegistered = false;

        scene.onBeforeAnimationsObservable.removeCallback(this._beforePhysicsBinded!);
        scene.onBeforeRenderObservable.removeCallback(this._afterPhysicsBinded);

        this._beforePhysicsBinded = null;
    }

    public beforePhysics(deltaTime: number): void {
        if (this._animationState === AnimationState.Playing) {
            this._currentFrameTime += deltaTime / 1000 * 30 * this._timeScale;
            const elapsedFrameTime = this._currentFrameTime;
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
        for (const model of needToInitializePhysicsModels) {
            model.initializePhysics();
        }
        needToInitializePhysicsModels.clear();
    }

    public afterPhysics(): void {
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            models[i].afterPhysics();
        }
    }

    public playAnimation(): void {
        if (this._animationState === AnimationState.Playing) return;

        this._currentFrameTime = 0;
        this._animationState = AnimationState.Playing;

        const models = this._models;
        for (let i = 0; i < this._models.length; ++i) {
            const model = models[i];
            model.resetState();
            this._needToInitializePhysicsModels.add(model);
        }
    }

    public stopAnimation(): void {
        this._animationState = AnimationState.Stopped;
    }

    public pauseAnimation(): void {
        if (this._animationState !== AnimationState.Playing) return;
        this._animationState = AnimationState.Paused;
    }

    public resumeAnimation(): void {
        if (this._animationState !== AnimationState.Paused) return;
        this._animationState = AnimationState.Playing;
    }

    public seekAnimation(frameTime: number, forceEvaluate: boolean = false): void {
        if (2 * 30 < Math.abs(frameTime - this._currentFrameTime)) {
            const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
            for (let i = 0; i < this._models.length; ++i) {
                const model = this._models[i];
                if (model.currentAnimation !== null) {
                    needToInitializePhysicsModels.add(model);
                }
            }
        }

        this._currentFrameTime = frameTime;

        if (forceEvaluate) {
            const originalAnimationState = this._animationState;
            this._animationState = AnimationState.Playing;
            this.beforePhysics(0);
            this._animationState = originalAnimationState;
        }
    }

    public get isAnimationPlaying(): boolean {
        return this._animationState === AnimationState.Playing;
    }

    public get models(): readonly MmdModel[] {
        return this._models;
    }

    public get camera(): MmdCamera | null {
        return this._camera;
    }

    public get timeScale(): number {
        return this._timeScale;
    }

    public set timeScale(value: number) {
        this._timeScale = value;
    }

    public get currentFrameTime(): number {
        return this._currentFrameTime;
    }

    public get currentTime(): number {
        return this._currentFrameTime / 30;
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
