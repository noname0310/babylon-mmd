import type { Material, Mesh, Scene } from "@babylonjs/core";
import { Logger } from "@babylonjs/core";

import type { IAudioPlayer } from "./audio/IAudioPlayer";
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
    private _audioPlayer: IAudioPlayer | null;

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
    private _paused: boolean;

    private readonly _needToInitializePhysicsModels: Set<MmdModel>;

    private _beforePhysicsBinded: (() => void) | null;
    private readonly _afterPhysicsBinded: () => void;

    public constructor(physics?: MmdPhysics) {
        this._physics = physics ?? null;

        this._models = [];
        this._camera = null;
        this._audioPlayer = null;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._isRegistered = false;

        this._currentFrameTime = 0;
        this._timeScale = 1;
        this._paused = true;

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

    public setAudioPlayer(audioPlayer: IAudioPlayer): void {
        if (this._audioPlayer !== null) {
            this._audioPlayer.pause();
            this._audioPlayer.onPlayObservable.removeCallback(this._onAudioPlay);
            this._audioPlayer.onPauseObservable.removeCallback(this._onAudioPause);
            this._audioPlayer.onSeekObservable.removeCallback(this._onAudioSeek);
        }

        this._audioPlayer = audioPlayer;
        audioPlayer.onPlayObservable.add(this._onAudioPlay);
        audioPlayer.onPauseObservable.add(this._onAudioPause);
        audioPlayer.onSeekObservable.add(this._onAudioSeek);
        audioPlayer._setPlaybackRateWithoutNotify(this._timeScale);
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
        if (!this._paused) {
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

    private readonly _onAudioPlay = (): void => {
        this._playAnimationInternal();
    };

    private readonly _onAudioPause = (): void => {
        this._paused = true;
    };

    private readonly _onAudioSeek = (): void => {
        this.seekAnimation(this._audioPlayer!.currentTime * 30);
    };

    private _playAnimationInternal(): void {
        if (!this._paused) return;
        this._paused = false;

        this._currentFrameTime = 0;

        const models = this._models;
        for (let i = 0; i < this._models.length; ++i) {
            const model = models[i];
            model.resetState();
            this._needToInitializePhysicsModels.add(model);
        }
    }

    public playAnimation(): void {
        if (this._audioPlayer !== null) {
            this._audioPlayer.play();
        } else {
            this._playAnimationInternal();
        }
    }

    public pauseAnimation(): void {
        if (this._audioPlayer !== null) {
            this._audioPlayer.pause();
        } else {
            this._paused = true;
        }
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
            const originalPaused = this._paused;
            this._paused = false;
            this.beforePhysics(0);
            this._paused = originalPaused;
        }
    }

    public get isAnimationPlaying(): boolean {
        return !this._paused;
    }

    public get models(): readonly MmdModel[] {
        return this._models;
    }

    public get camera(): MmdCamera | null {
        return this._camera;
    }

    public get audioPlayer(): IAudioPlayer | null {
        return this._audioPlayer;
    }

    public get timeScale(): number {
        return this._timeScale;
    }

    public set timeScale(value: number) {
        this._timeScale = value;

        if (this._audioPlayer !== null) {
            this._audioPlayer._setPlaybackRateWithoutNotify(value);
        }
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
