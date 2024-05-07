import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Logger } from "@babylonjs/core/Misc/logger";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdRuntimeCameraAnimation, IMmdRuntimeModelAnimation } from "./Animation/IMmdRuntimeAnimation";
import type { IPlayer } from "./Audio/IAudioPlayer";
import type { IDisposeObservable } from "./IDisposeObserable";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { IMmdRuntime } from "./IMmdRuntime";
import type { IMmdLinkedBoneContainer } from "./IMmdRuntimeLinkedBone";
import type { MmdCamera } from "./mmdCamera";
import type { MmdSkinnedMesh } from "./mmdMesh";
import { MmdMesh } from "./mmdMesh";
import { MmdModel } from "./mmdModel";
import { MmdStandardMaterialProxy } from "./mmdStandardMaterialProxy";
import type { IMmdPhysics } from "./Physics/IMmdPhysics";

/**
 * Options for creating MMD model
 */
export interface CreateMmdModelOptions {
    /**
     * Material proxy constructor is required if you other than `MmdStandardMaterial` (default: `MmdStandardMaterialProxy`)
     */
    materialProxyConstructor?: Nullable<IMmdMaterialProxyConstructor<Material>>;

    /**
     * Whether to build physics (default: true)
     */
    buildPhysics?: boolean;
}

/**
 * MMD runtime orchestrates several MMD components (models, camera, audio)
 *
 * MMD runtime handles updates and synchronization of MMD components
 *
 * It can also create and remove runtime components
 */
export class MmdRuntime implements IMmdRuntime<MmdModel> {
    private readonly _physics: Nullable<IMmdPhysics>;

    private readonly _models: MmdModel[];
    private _camera: Nullable<MmdCamera>;
    private _audioPlayer: Nullable<IPlayer>;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    private _isRegistered: boolean;

    /**
     * This observable is notified when animation duration is changed
     */
    public readonly onAnimationDurationChangedObservable: Observable<void>;

    /**
     * This observable is notified when animation is played
     */
    public readonly onPlayAnimationObservable: Observable<void>;

    /**
     * This observable is notified when animation is paused
     */
    public readonly onPauseAnimationObservable: Observable<void>;

    /**
     * This observable is notified when animation is seeked
     */
    public readonly onSeekAnimationObservable: Observable<void>;

    /**
     * This observable is notified when animation is evaluated (usually every frame)
     */
    public readonly onAnimationTickObservable: Observable<void>;

    private _currentFrameTime: number;
    private _animationTimeScale: number;
    private _animationPaused: boolean;
    private _animationFrameTimeDuration: number;
    private _useManualAnimationDuration: boolean;

    private readonly _needToInitializePhysicsModels: Set<MmdModel>;

    private _beforePhysicsBinded: Nullable<() => void>;
    private readonly _afterPhysicsBinded: () => void;

    private readonly _bindedDispose: Nullable<(scene: Scene) => void>;
    private readonly _disposeObservableObject: Nullable<IDisposeObservable>;

    /**
     * Creates a new MMD runtime
     * @param scene Objects that limit the lifetime of this instance
     * @param physics Physics builder
     */
    public constructor(scene: Nullable<Scene> = null, physics: Nullable<IMmdPhysics> = null) {
        this._physics = physics;

        this._models = [];
        this._camera = null;
        this._audioPlayer = null;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._isRegistered = false;

        this.onAnimationDurationChangedObservable = new Observable<void>();
        this.onPlayAnimationObservable = new Observable<void>();
        this.onPauseAnimationObservable = new Observable<void>();
        this.onSeekAnimationObservable = new Observable<void>();
        this.onAnimationTickObservable = new Observable<void>();

        this._currentFrameTime = 0;
        this._animationTimeScale = 1;
        this._animationPaused = true;
        this._animationFrameTimeDuration = 0;
        this._useManualAnimationDuration = false;

        this._needToInitializePhysicsModels = new Set<MmdModel>();

        this._beforePhysicsBinded = null;
        this._afterPhysicsBinded = this.afterPhysics.bind(this);

        if (scene !== null) {
            this._bindedDispose = (): void => this.dispose(scene);
            this._disposeObservableObject = scene;
            if (this._disposeObservableObject !== null) {
                this._disposeObservableObject.onDisposeObservable.add(this._bindedDispose);
            }
        } else {
            this._bindedDispose = null;
            this._disposeObservableObject = null;
        }
    }

    /**
     * Dispose MMD runtime
     *
     * Destroy all MMD models and unregister this runtime from scene
     * @param scene Scene
     */
    public dispose(scene: Scene): void {
        for (let i = 0; i < this._models.length; ++i) this._models[i].dispose();
        this._models.length = 0;
        this.setCamera(null);
        this.setAudioPlayer(null);

        this.onAnimationDurationChangedObservable.clear();
        this.onPlayAnimationObservable.clear();
        this.onPauseAnimationObservable.clear();
        this.onSeekAnimationObservable.clear();
        this.onAnimationTickObservable.clear();

        this._needToInitializePhysicsModels.clear();

        this.unregister(scene);

        if (this._disposeObservableObject !== null && this._bindedDispose !== null) {
            this._disposeObservableObject.onDisposeObservable.removeCallback(this._bindedDispose);
        }
    }

    /**
     * Create MMD model from mesh that has MMD metadata
     *
     * The skeletons in the mesh where the MmdModel was created no longer follow the usual matrix update policy
     * @param mmdSkinnedMesh MmdSkinnedMesh
     * @param options Creation options
     * @returns MMD model
     * @throws {Error} if mesh is not `MmdSkinnedMesh`
     */
    public createMmdModel(
        mmdSkinnedMesh: Mesh,
        options: CreateMmdModelOptions = {}
    ): MmdModel {
        if (!MmdMesh.isMmdSkinnedMesh(mmdSkinnedMesh)) throw new Error("Mesh validation failed.");
        return this.createMmdModelFromSkeleton(mmdSkinnedMesh, mmdSkinnedMesh.metadata.skeleton, options);
    }

    /**
     * Create MMD model from humanoid mesh and virtual skeleton
     *
     * this method is useful for supporting humanoid models, usually used by `HumanoidMmd`
     * @param mmdSkinnedMesh MmdSkinnedMesh
     * @param skeleton Skeleton or Virtualized skeleton
     * @param options Creation options
     */
    public createMmdModelFromSkeleton(
        mmdSkinnedMesh: MmdSkinnedMesh,
        skeleton: IMmdLinkedBoneContainer,
        options: CreateMmdModelOptions = {}
    ): MmdModel {
        if (options.materialProxyConstructor === undefined) {
            options.materialProxyConstructor = MmdStandardMaterialProxy as unknown as IMmdMaterialProxyConstructor<Material>;
        }
        if (options.buildPhysics === undefined) {
            options.buildPhysics = true;
        }

        const model = new MmdModel(
            mmdSkinnedMesh,
            skeleton,
            options.materialProxyConstructor,
            options.buildPhysics ? this._physics : null,
            this
        );
        this._models.push(model);
        this._needToInitializePhysicsModels.add(model);

        model.onCurrentAnimationChangedObservable.add(this._onAnimationChanged);

        return model;
    }

    /**
     * Destroy MMD model
     *
     * Dispose all resources used at MMD runtime and restores the skeleton to the usual matrix update policy
     *
     * After calling the `destroyMmdModel` once, the mesh is no longer able to `createMmdModel` because the metadata is lost
     * @param mmdModel MMD model to destroy
     * @throws {Error} if model is not found
     */
    public destroyMmdModel(mmdModel: MmdModel): void {
        mmdModel.dispose();

        const models = this._models;
        const index = models.indexOf(mmdModel);
        if (index < 0) throw new Error("Model not found.");

        models.splice(index, 1);
    }

    /**
     * Set camera to animate
     * @param camera MMD camera
     */
    public setCamera(camera: Nullable<MmdCamera>): void {
        if (this._camera !== null) {
            this._camera.onCurrentAnimationChangedObservable.removeCallback(this._onAnimationChanged);
        }

        if (camera !== null) {
            camera.onCurrentAnimationChangedObservable.add(this._onAnimationChanged);
        }
        this._camera = camera;
        this._onAnimationChanged(camera?.currentAnimation ?? null);
    }

    private _setAudioPlayerLastValue: Nullable<IPlayer> = null;

    /**
     * Set audio player to sync with animation
     *
     * If you set up audio Player while playing an animation, it try to play the audio from the current animation time
     * And returns Promise because this operation is asynchronous. In most cases, you don't have to await this Promise
     * @param audioPlayer Audio player
     * @returns Promise
     */
    public async setAudioPlayer(audioPlayer: Nullable<IPlayer>): Promise<void> {
        if (this._audioPlayer === audioPlayer) return;

        this._setAudioPlayerLastValue = audioPlayer;

        if (this._audioPlayer !== null) {
            this._audioPlayer.onDurationChangedObservable.removeCallback(this._onAudioDurationChanged);
            this._audioPlayer.onPlaybackRateChangedObservable.removeCallback(this._onAudioPlaybackRateChanged);
            this._audioPlayer.onPlayObservable.removeCallback(this._onAudioPlay);
            this._audioPlayer.onPauseObservable.removeCallback(this._onAudioPause);
            this._audioPlayer.onSeekObservable.removeCallback(this._onAudioSeek);
            this._audioPlayer.pause();
        }

        this._audioPlayer = null;
        if (audioPlayer === null) return;

        if (!this._animationPaused) {
            const audioFrameTimeDuration = audioPlayer.duration * 30;
            if (this._currentFrameTime < audioFrameTimeDuration) {
                audioPlayer.currentTime = this._currentFrameTime / 30;
                await audioPlayer.play();
                if (this._setAudioPlayerLastValue !== audioPlayer) {
                    audioPlayer.pause();
                    return;
                }
            }
        }
        this._audioPlayer = audioPlayer;
        this._onAudioDurationChanged();

        audioPlayer.onDurationChangedObservable.add(this._onAudioDurationChanged);
        audioPlayer.onPlaybackRateChangedObservable.add(this._onAudioPlaybackRateChanged);
        audioPlayer.onPlayObservable.add(this._onAudioPlay);
        audioPlayer.onPauseObservable.add(this._onAudioPause);
        audioPlayer.onSeekObservable.add(this._onAudioSeek);
        audioPlayer._setPlaybackRateWithoutNotify(this._animationTimeScale);
    }

    /**
     * Register MMD runtime to scene
     *
     * register `beforePhysics` and `afterPhysics` to scene Observables
     *
     * If you need a more complex update method you can call `beforePhysics` and `afterPhysics` manually
     * @param scene Scene
     */
    public register(scene: Scene): void {
        if (this._isRegistered) return;
        this._isRegistered = true;

        this._beforePhysicsBinded = (): void => this.beforePhysics(scene.getEngine().getDeltaTime());

        scene.onBeforeAnimationsObservable.add(this._beforePhysicsBinded);
        scene.onBeforeRenderObservable.add(this._afterPhysicsBinded);
    }

    /**
     * Unregister MMD runtime from scene
     * @param scene Scene
     */
    public unregister(scene: Scene): void {
        if (!this._isRegistered) return;
        this._isRegistered = false;

        scene.onBeforeAnimationsObservable.removeCallback(this._beforePhysicsBinded!);
        scene.onBeforeRenderObservable.removeCallback(this._afterPhysicsBinded);

        this._beforePhysicsBinded = null;
    }

    /**
     * Before the physics stage, update animations and run MMD runtime solvers
     *
     * @param deltaTime Delta time in milliseconds
     */
    public beforePhysics(deltaTime: number): void {
        if (!this._animationPaused) {
            if (this._audioPlayer !== null && !this._audioPlayer.paused) { // sync animation time with audio time
                const audioPlayerCurrentTime = this._audioPlayer.currentTime;

                const timeDiff = audioPlayerCurrentTime - this._currentFrameTime / 30;
                const timeDiffAbs = Math.abs(timeDiff);
                if (timeDiffAbs < 0.05) { // synced
                    this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale;
                } else if (timeDiffAbs < 0.5) {
                    if (timeDiff < 0) { // animation is faster than audio
                        this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale * 0.9;
                    } else { // animation is slower than audio
                        this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale * 1.1;
                    }
                } else {
                    if (2 * 30 < Math.abs(audioPlayerCurrentTime - this._currentFrameTime)) {
                        const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
                        for (let i = 0; i < this._models.length; ++i) {
                            const model = this._models[i];
                            if (model.currentAnimation !== null) {
                                needToInitializePhysicsModels.add(model);
                            }
                        }
                    }

                    this._currentFrameTime = audioPlayerCurrentTime * 30;
                }
            } else { // only use delta time to calculate animation time
                this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale;
            }

            const elapsedFrameTime = this._currentFrameTime;

            if (this._animationFrameTimeDuration <= elapsedFrameTime) {
                this._animationPaused = true;
                this._currentFrameTime = this._animationFrameTimeDuration;

                if (this._audioPlayer !== null && !this._audioPlayer.paused) {
                    this._audioPlayer.pause();
                } else {
                    this.onPauseAnimationObservable.notifyObservers();
                }
            }

            const models = this._models;
            for (let i = 0; i < models.length; ++i) {
                models[i].beforePhysics(elapsedFrameTime);
            }

            if (this._camera !== null) {
                this._camera.animate(elapsedFrameTime);
            }

            this.onAnimationTickObservable.notifyObservers();
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

    /**
     * After the physics stage, update physics and run MMD runtime solvers
     */
    public afterPhysics(): void {
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            models[i].afterPhysics();
        }
    }

    private readonly _onAnimationChanged = (newAnimation: Nullable<IMmdRuntimeCameraAnimation | IMmdRuntimeModelAnimation>): void => {
        if (this._useManualAnimationDuration) return;

        const newAnimationDuration = newAnimation?.animation.endFrame ?? 0;

        if (this._animationFrameTimeDuration < newAnimationDuration) {
            this._animationFrameTimeDuration = newAnimationDuration;
        } else if (newAnimationDuration < this._animationFrameTimeDuration) {
            this._animationFrameTimeDuration = this._computeAnimationDuration();
        }

        this.onAnimationDurationChangedObservable.notifyObservers();
    };

    private _computeAnimationDuration(): number {
        let duration = 0;
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            const model = models[i];
            if (model.currentAnimation !== null) {
                duration = Math.max(duration, model.currentAnimation.animation.endFrame);
            }
        }

        if (this._camera !== null && this._camera.currentAnimation !== null) {
            duration = Math.max(duration, this._camera.currentAnimation.animation.endFrame);
        }

        if (this._audioPlayer !== null) {
            duration = Math.max(duration, this._audioPlayer.duration * 30);
        }

        return duration;
    }

    private readonly _onAudioDurationChanged = (): void => {
        if (!this._animationPaused) {
            const audioPlayer = this._audioPlayer!;
            const currentTime = this._currentFrameTime / 30;
            if (currentTime < audioPlayer.duration) {
                audioPlayer._setCurrentTimeWithoutNotify(currentTime);
                audioPlayer.play().then(() => {
                    if (this._setAudioPlayerLastValue !== audioPlayer) {
                        audioPlayer.pause();
                        return;
                    }
                });
            }
        }

        if (this._useManualAnimationDuration) return;

        const audioFrameTimeDuration = this._audioPlayer!.duration * 30;

        if (this._animationFrameTimeDuration < audioFrameTimeDuration) {
            this._animationFrameTimeDuration = audioFrameTimeDuration;
        } else {
            this._animationFrameTimeDuration = this._computeAnimationDuration();
        }

        this.onAnimationDurationChangedObservable.notifyObservers();
    };

    private readonly _onAudioPlaybackRateChanged = (): void => {
        this._animationTimeScale = this._audioPlayer!.playbackRate;
    };

    private readonly _onAudioPlay = (): void => {
        this._playAnimationInternal();
    };

    private readonly _onAudioPause = (): void => {
        if (this._audioPlayer!.currentTime === this._audioPlayer!.duration) return;
        this._animationPaused = true;
        this.onPauseAnimationObservable.notifyObservers();
    };

    private readonly _onAudioSeek = (): void => {
        this._seekAnimationInternal(this._audioPlayer!.currentTime * 30, this._animationPaused);
    };

    private _playAnimationInternal(): void {
        if (!this._animationPaused) return;
        this._animationPaused = false;

        if (this._currentFrameTime === 0) {
            const models = this._models;
            const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
            for (let i = 0; i < models.length; ++i) {
                needToInitializePhysicsModels.add(models[i]);
            }
        }

        this.onPlayAnimationObservable.notifyObservers();
    }

    /**
     * Play animation from the current animation time
     *
     * If audio player is set, it try to play the audio from the current animation time
     *
     * It returns Promise because playing audio is asynchronous
     * @returns Promise
     */
    public async playAnimation(): Promise<void> {
        if (this._audioPlayer !== null && this._currentFrameTime < this._audioPlayer.duration * 30) {
            try {
                const currentTime = this._currentFrameTime / 30;
                if (0.05 < Math.abs(this._audioPlayer.currentTime - currentTime)) {
                    this._audioPlayer._setCurrentTimeWithoutNotify(currentTime);
                }
                await this._audioPlayer.play();
            } catch (e) {
                if (e instanceof DOMException && e.name === "NotSupportedError") {
                    this.error("Failed to play audio.");
                    this._playAnimationInternal();
                } else {
                    throw e;
                }
            }
        } else {
            this._playAnimationInternal();
        }
    }

    /**
     * Pause animation
     */
    public pauseAnimation(): void {
        if (this._audioPlayer !== null && !this._audioPlayer.paused) {
            this._audioPlayer.pause();
            this._animationPaused = true;
        } else {
            this._animationPaused = true;
            this.onPauseAnimationObservable.notifyObservers();
        }
    }

    private _seekAnimationInternal(frameTime: number, forceEvaluate: boolean): void {
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
            const models = this._models;
            for (let i = 0; i < models.length; ++i) {
                const model = models[i];
                if (model.currentAnimation !== null) {
                    model.currentAnimation.animate(frameTime);
                }
            }

            if (this._camera !== null && this._camera.currentAnimation !== null) {
                this._camera.animate(frameTime);
            }

            this.onAnimationTickObservable.notifyObservers();
        }

        this.onSeekAnimationObservable.notifyObservers();
    }

    /**
     * Seek animation to the specified frame time
     *
     * If you set forceEvaluate true, the animation is evaluated even if the animation is not playing
     *
     * If audio player is set and not paused, it try to play the audio from the seek time so it returns Promise
     * @param frameTime Time in 30fps frame
     * @param forceEvaluate Whether to force evaluate animation
     * @returns Promise
     */
    public async seekAnimation(frameTime: number, forceEvaluate: boolean = false): Promise<void> {
        frameTime = Math.max(0, Math.min(frameTime, this._animationFrameTimeDuration));

        if (this._audioPlayer !== null) {
            if (!this._audioPlayer.paused) {
                this._audioPlayer.currentTime = frameTime / 30;
            } else if (
                !this._animationPaused && // animation playing but audio paused
                this._audioPlayer.currentTime * 30 < this._animationFrameTimeDuration && // is player exausted
                frameTime < this._audioPlayer.duration * 30 // is seek time in audio duration
            ) {
                try {
                    this._audioPlayer._setCurrentTimeWithoutNotify(frameTime / 30);
                    await this._audioPlayer.play();
                } catch (e) {
                    if (e instanceof DOMException && e.name === "NotSupportedError") {
                        this.error("Failed to play audio.");
                        this._seekAnimationInternal(frameTime, forceEvaluate);
                    } else {
                        throw e;
                    }
                }
            } else {
                this._seekAnimationInternal(frameTime, forceEvaluate);
                this._audioPlayer?._setCurrentTimeWithoutNotify(frameTime / 30);
            }
        } else {
            this._seekAnimationInternal(frameTime, forceEvaluate);
        }
    }

    /**
     * Whether animation is playing
     */
    public get isAnimationPlaying(): boolean {
        return !this._animationPaused;
    }

    /**
     * MMD models created by this runtime
     */
    public get models(): readonly MmdModel[] {
        return this._models;
    }

    /**
     * MMD camera
     */
    public get camera(): Nullable<MmdCamera> {
        return this._camera;
    }

    /**
     * Audio player
     */
    public get audioPlayer(): Nullable<IPlayer> {
        return this._audioPlayer;
    }

    /**
     * Current animation time scale (default: 1)
     */
    public get timeScale(): number {
        return this._animationTimeScale;
    }

    public set timeScale(value: number) {
        this._animationTimeScale = value;

        if (this._audioPlayer !== null) {
            this._audioPlayer._setPlaybackRateWithoutNotify(value);
        }
    }

    /**
     * Current animation time in 30fps frame
     */
    public get currentFrameTime(): number {
        return this._currentFrameTime;
    }

    /**
     * Current animation time in seconds
     */
    public get currentTime(): number {
        return this._currentFrameTime / 30;
    }

    /**
     * Current animation duration in 30fps frame
     */
    public get animationFrameTimeDuration(): number {
        return this._animationFrameTimeDuration;
    }

    /**
     * Current animation duration in seconds
     */
    public get animationDuration(): number {
        return this._animationFrameTimeDuration / 30;
    }

    /**
     * Set animation duration manually
     *
     * When the difference between the length of the song and the length of the animation is large, it can be helpful to adjust the animation duration manually
     * @param frameTimeDuration Time in 30fps frame
     */
    public setManualAnimationDuration(frameTimeDuration: Nullable<number>): void {
        if (frameTimeDuration === null && !this._useManualAnimationDuration) return;

        if (frameTimeDuration === null) {
            this._useManualAnimationDuration = false;
            this._animationFrameTimeDuration = this._computeAnimationDuration();
        } else {
            this._useManualAnimationDuration = true;
            this._animationFrameTimeDuration = frameTimeDuration;
        }

        this.onAnimationDurationChangedObservable.notifyObservers();
    }

    /**
     * Enable or disable debug logging (default: false)
     */
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
