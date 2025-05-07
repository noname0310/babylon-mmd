import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Logger } from "@babylonjs/core/Misc/logger";
import { Observable } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdRuntimeCameraAnimation, IMmdRuntimeModelAnimation } from "../Animation/IMmdRuntimeAnimation";
import type { IPlayer } from "../Audio/IAudioPlayer";
import type { IDisposeObservable } from "../IDisposeObserable";
import type { IMmdMaterialProxyConstructor } from "../IMmdMaterialProxy";
import type { IMmdRuntime } from "../IMmdRuntime";
import type { IMmdLinkedBoneContainer } from "../IMmdRuntimeLinkedBone";
import type { MmdCamera } from "../mmdCamera";
import type { MmdSkinnedMesh } from "../mmdMesh";
import { MmdMesh } from "../mmdMesh";
import type { IMmdModelCreationOptions } from "../mmdRuntime";
import { MmdStandardMaterialProxy } from "../mmdStandardMaterialProxy";
import type { IMmdPhysics } from "../Physics/IMmdPhysics";
import type { MmdWasmRuntimeModelAnimation } from "./Animation/mmdWasmRuntimeModelAnimation";
import { WasmSpinlock } from "./Misc/wasmSpinlock";
import { MmdMetadataEncoder } from "./mmdMetadataEncoder";
import type { IMmdWasmInstance } from "./mmdWasmInstance";
import { MmdWasmModel } from "./mmdWasmModel";
import type { IMmdWasmPhysicsRuntime } from "./Physics/IMmdWasmPhysicsRuntime";
import type { IPhysicsClock } from "./Physics/IPhysicsClock";
import type { MmdWasmPhysics } from "./Physics/mmdWasmPhysics";
import type { MmdWasmPhysicsRuntime } from "./Physics/mmdWasmPhysicsRuntime";
import { NullPhysicsClock } from "./Physics/nullPhysicsClock";

/**
 * MMD WASM runtime animation evaluation type
 */
export enum MmdWasmRuntimeAnimationEvaluationType {
    /**
     * Immediate animation evaluation for the current frame
     */
    Immediate,

    /**
     * Buffered animation evaluation for the next frame
     *
     * Asynchronous Multi-thread optimization applies when possible
     *
     * If you are using havok or ammo.js physics, only beforePhysics process is asynchronous
     */
    Buffered
}

/**
 * @internal
 */
export interface IPhysicsInitializeSet {
    add(model: MmdWasmModel): void;
}

/**
 * MMD WASM runtime orchestrates several MMD components (models, camera, audio)
 *
 * MMD WASM runtime handles updates and synchronization of MMD components
 *
 * It can also create and remove runtime components
 */
export class MmdWasmRuntime implements IMmdRuntime<MmdWasmModel> {
    /**
     * @internal
     */
    public readonly wasmInstance: IMmdWasmInstance;

    /**
     * @internal
     */
    public readonly wasmInternal: ReturnType<IMmdWasmInstance["createMmdRuntime"]>;

    /**
     * Spinlock for MMD WASM runtime to synchronize animation evaluation
     * @internal
     */
    public readonly lock: WasmSpinlock;

    private _usingWasmBackBuffer: boolean;
    private _lastRequestAnimationFrameTime: Nullable<number>;
    private _needToSyncEvaluate: boolean;

    private readonly _externalPhysics: Nullable<IMmdPhysics>;
    private readonly _physicsRuntime: Nullable<MmdWasmPhysicsRuntime>;
    private readonly _physicsClock: IPhysicsClock;
    private readonly _mmdMetadataEncoder: MmdMetadataEncoder;

    private readonly _models: MmdWasmModel[];
    private _camera: Nullable<MmdCamera>;
    private _audioPlayer: Nullable<IPlayer>;

    /**
     * Whether to automatically initialize rigid bodies transform and velocity (default: true)
     *
     * auto physics initialization is triggered when
     * - animation seek is far from current frame time (more than 2 seconds)
     * - browser tab is stop rendering and resumed
     * - animation is played from the frame 0
     */
    public autoPhysicsInitialization: boolean;

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

    private _evaluationType: MmdWasmRuntimeAnimationEvaluationType;
    private _currentFrameTime: number;
    private _animationTimeScale: number;
    private _animationPaused: boolean;
    private _animationFrameTimeDuration: number;
    private _useManualAnimationDuration: boolean;

    private readonly _needToInitializePhysicsModels: Set<MmdWasmModel>;
    private readonly _needToInitializePhysicsModelsBuffer: Set<MmdWasmModel>;

    private _beforePhysicsBinded: Nullable<() => void>;
    private readonly _afterPhysicsBinded: () => void;

    private readonly _bindedDispose: Nullable<(scene: Scene) => void>;
    private readonly _disposeObservableObject: Nullable<IDisposeObservable>;

    /**
     * Creates a new MMD web assembly runtime
     *
     * For use external physics engine like ammo.js or havok, you need to set `physics` to instance of `IMmdPhysics`
     *
     * If you want to use the wasm binary built-in physics engine, you can set `physics` to `MmdWasmPhysics` and you should use physics version of the wasm instance (e.g. `MmdWasmInstanceTypeMPR`)
     * @param wasmInstance MMD WASM instance
     * @param scene Objects that limit the lifetime of this instance
     * @param physics IMmdPhysics instance or MmdWasmPhysics instance
     */
    public constructor(wasmInstance: IMmdWasmInstance, scene: Nullable<Scene> = null, physics: Nullable<IMmdPhysics | MmdWasmPhysics> = null) {
        this.wasmInstance = wasmInstance;
        this.wasmInternal = wasmInstance.createMmdRuntime();

        this.lock = new WasmSpinlock(wasmInstance.createTypedArray(Uint8Array, this.wasmInternal.getLockStatePtr(), 1));
        this._usingWasmBackBuffer = false;
        this._lastRequestAnimationFrameTime = null;
        this._needToSyncEvaluate = true;

        if ((physics as MmdWasmPhysics)?.createRuntime !== undefined) {
            this._externalPhysics = null;
            this._physicsRuntime = (physics as MmdWasmPhysics).createRuntime(this);
            this._physicsClock = (physics as MmdWasmPhysics).createPhysicsClock();
            this._mmdMetadataEncoder = (physics as MmdWasmPhysics).createMetadataEncoder(this._physicsRuntime, this);
        } else {
            this._externalPhysics = physics as IMmdPhysics;
            this._physicsRuntime = null;
            this._physicsClock = new NullPhysicsClock();
            this._mmdMetadataEncoder = new MmdMetadataEncoder(this);
        }

        this._models = [];
        this._camera = null;
        this._audioPlayer = null;

        this.autoPhysicsInitialization = true;

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

        this._evaluationType = MmdWasmRuntimeAnimationEvaluationType.Immediate;
        this._currentFrameTime = 0;
        this._animationTimeScale = 1;
        this._animationPaused = true;
        this._animationFrameTimeDuration = 0;
        this._useManualAnimationDuration = false;

        this._needToInitializePhysicsModels = new Set<MmdWasmModel>();
        this._needToInitializePhysicsModelsBuffer = new Set<MmdWasmModel>();

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
     * Dispose MMD WASM runtime
     *
     * Destroy all MMD models and unregister this runtime from scene
     * @param scene Scene
     */
    public dispose(scene: Scene): void {
        this.lock.wait(); // ensure that the runtime is not evaluating animations

        this._physicsRuntime?.dispose();

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
        this._needToInitializePhysicsModelsBuffer.clear();

        this.unregister(scene);
        this.wasmInternal.free();

        if (this._disposeObservableObject !== null && this._bindedDispose !== null) {
            this._disposeObservableObject.onDisposeObservable.removeCallback(this._bindedDispose);
        }
    }

    private static readonly _TextDecoder = new TextDecoder();

    private _flushWasmDiagnosticFromResultPtr(resultPtr: number, logFunction: (message: string) => void): void {
        const textDecoder = MmdWasmRuntime._TextDecoder;

        const [stringArrayPtr, stringArrayLength] = this.wasmInstance.createTypedArray(Uint32Array, resultPtr, 4).array;
        if (stringArrayLength <= 0) return;

        const stringArray = this.wasmInstance.createTypedArray(Uint32Array, stringArrayPtr, stringArrayLength * 2).array;
        for (let i = 0; i < stringArrayLength; ++i) {
            const stringPtr = stringArray[i * 2];
            const stringLength = stringArray[i * 2 + 1];

            const textBuffer = new Uint8Array(stringLength);
            textBuffer.set(this.wasmInstance.createTypedArray(Uint8Array, stringPtr, stringLength).array);

            const text = textDecoder.decode(textBuffer);
            logFunction(text);
        }
    }

    // flush wasm diagnostic log is always thread safe
    private _flushWasmDiagnosticLog(): void {
        // we need acquire and release the result to flush the log even if logging is disabled

        const errorResultPtr = this.wasmInternal.acquireDiagnosticErrorResult();
        if (this._loggingEnabled) {
            this._flushWasmDiagnosticFromResultPtr(errorResultPtr, this.error);
        }
        this.wasmInternal.releaseDiagnosticResult();

        const warningResultPtr = this.wasmInternal.acquireDiagnosticWarningResult();
        if (this._loggingEnabled) {
            this._flushWasmDiagnosticFromResultPtr(warningResultPtr, this.warn);
        }
        this.wasmInternal.releaseDiagnosticResult();

        const infoResultPtr = this.wasmInternal.acquireDiagnosticInfoResult();
        if (this._loggingEnabled) {
            this._flushWasmDiagnosticFromResultPtr(infoResultPtr, this.log);
        }
        this.wasmInternal.releaseDiagnosticResult();
    }

    private static readonly _NullPhysicsInitializeSet: IPhysicsInitializeSet = { add(_model: MmdWasmModel): void { } };

    private _getPhysicsInitializeSet(): IPhysicsInitializeSet {
        if (this._externalPhysics === null) {
            return this._physicsRuntime?.initializer ?? MmdWasmRuntime._NullPhysicsInitializeSet;
        } else {
            return this._needToInitializePhysicsModels;
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
    public createMmdModel<TMaterial extends Material>(
        mmdSkinnedMesh: Mesh,
        options: IMmdModelCreationOptions<TMaterial> = {}
    ): MmdWasmModel {
        if (!MmdMesh.isMmdSkinnedMesh(mmdSkinnedMesh)) throw new Error("Mesh validation failed.");
        return this.createMmdModelFromSkeleton(mmdSkinnedMesh, mmdSkinnedMesh.metadata.skeleton, options);
    }

    /**
     * Create MMD model from humanoid mesh and virtual skeleton
     *
     * this method is useful for supporting humanoid models, usually used by `HumanoidMmd`
     * @param mmdMesh MmdSkinnedMesh
     * @param skeleton Skeleton or Virtualized skeleton
     * @param options Creation options
     */
    public createMmdModelFromSkeleton<TMaterial extends Material>(
        mmdMesh: MmdSkinnedMesh,
        skeleton: IMmdLinkedBoneContainer,
        options: IMmdModelCreationOptions<TMaterial> = {}
    ): MmdWasmModel {
        if (options.materialProxyConstructor === undefined) {
            options.materialProxyConstructor = MmdStandardMaterialProxy as unknown as IMmdMaterialProxyConstructor<Material>;
        }
        if (options.buildPhysics === undefined) {
            options.buildPhysics = true;
        }

        this.lock.wait(); // ensure that the runtime is not evaluating animations

        const wasmRuntime = this.wasmInternal;

        // sync buffer temporarily
        const usingWasmBackBuffer = this._usingWasmBackBuffer;
        if (usingWasmBackBuffer) {
            wasmRuntime.swapWorldMatrixBuffer();
            this._usingWasmBackBuffer = false;
        }

        const metadataEncoder = this._mmdMetadataEncoder;
        metadataEncoder.setEncodePhysicsOptions(options.buildPhysics);

        const metadataSize = metadataEncoder.computeSize(mmdMesh);

        const metadataBufferPtr = this.wasmInstance.allocateBuffer(metadataSize);

        const metadataBuffer = this.wasmInstance.createTypedArray(Uint8Array, metadataBufferPtr, metadataSize);
        const wasmMorphIndexMap = metadataEncoder.encode(mmdMesh, skeleton.bones, metadataBuffer.array);

        const mmdModelPtr = wasmRuntime.createMmdModel(metadataBufferPtr, metadataSize);

        const model = new MmdWasmModel(
            this,
            mmdModelPtr,
            mmdMesh,
            skeleton,
            options.materialProxyConstructor as IMmdMaterialProxyConstructor<Material>,
            wasmMorphIndexMap,
            options.buildPhysics
                ? this._externalPhysics !== null
                    ? {
                        physicsImpl: this._externalPhysics,
                        physicsOptions: typeof options.buildPhysics === "boolean"
                            ? null
                            : options.buildPhysics
                    }
                    : null
                : null
        );
        this._models.push(model);

        this._getPhysicsInitializeSet().add(model);

        this.wasmInstance.deallocateBuffer(metadataBufferPtr, metadataSize);

        // desync again
        if (usingWasmBackBuffer) {
            wasmRuntime.swapWorldMatrixBuffer();
            this._usingWasmBackBuffer = true;
        }

        this._flushWasmDiagnosticLog();

        // because the model is created, the animation must be evaluated synchronously at least once
        this._needToSyncEvaluate = true;

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
    public destroyMmdModel(mmdModel: MmdWasmModel): void {
        mmdModel.dispose();

        const models = this._models;
        const index = models.indexOf(mmdModel);
        if (index < 0) throw new Error("Model not found.");

        models.splice(index, 1);
        this.lock.wait(); // ensure that the runtime is not evaluating animations
        this.wasmInternal.destroyMmdModel(mmdModel.ptr);
    }

    /**
     * Queue MMD model to initialize physics
     *
     * Actual physics initialization is done by the before physics stage
     * @param mmdModel MMD model
     */
    public initializeMmdModelPhysics(mmdModel: MmdWasmModel): void {
        this._getPhysicsInitializeSet().add(mmdModel);
    }

    /**
     * Queue all MMD models to initialize physics
     *
     * Actual physics initialization is done by the before physics stage
     *
     * If you set onlyAnimated true, it only initializes physics for animated models
     */
    public initializeAllMmdModelsPhysics(onlyAnimated: boolean): void {
        const models = this._models;
        if (onlyAnimated) {
            for (let i = 0; i < models.length; ++i) {
                const model = models[i];
                if (model.currentAnimation !== null) {
                    this._getPhysicsInitializeSet().add(model);
                }
            }
        } else {
            for (let i = 0; i < models.length; ++i) {
                this._getPhysicsInitializeSet().add(models[i]);
            }
        }
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
        if (audioPlayer === null) {
            this._onAudioDurationChanged();
            return;
        }

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
        let elapsedFrameTime: Nullable<number> = null;

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
                    if (this.autoPhysicsInitialization) {
                        if (2 * 30 < Math.abs(audioPlayerCurrentTime - this._currentFrameTime)) {
                            const physicsInitializeSet = this._getPhysicsInitializeSet();
                            for (let i = 0; i < this._models.length; ++i) {
                                const model = this._models[i];
                                if (model.currentAnimation !== null) {
                                    physicsInitializeSet.add(model);
                                }
                            }
                        }
                    }

                    this._currentFrameTime = audioPlayerCurrentTime * 30;
                }
            } else { // only use delta time to calculate animation time
                this._currentFrameTime += deltaTime / 1000 * 30 * this._animationTimeScale;
            }

            elapsedFrameTime = this._currentFrameTime;

            if (this._animationFrameTimeDuration <= elapsedFrameTime) {
                this._animationPaused = true;
                this._currentFrameTime = this._animationFrameTimeDuration;

                if (this._audioPlayer !== null && !this._audioPlayer.paused) {
                    this._audioPlayer.pause();
                } else {
                    this.onPauseAnimationObservable.notifyObservers();
                }
            }
        }

        const physicsDeltaTime = this._physicsClock.getDeltaTime();

        // update mmd models world matrix in scene hierarchy
        this._physicsRuntime?.setMmdModelsWorldMatrix(this._models);

        if (this._evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered) {
            const models = this._models;
            // evaluate vertex / uv animations on javascript side
            // they can't be buffered
            {
                const lastRequestAnimationFrameTime = this._lastRequestAnimationFrameTime ?? elapsedFrameTime;

                for (let i = 0; i < models.length; ++i) {
                    const model = models[i];
                    if ((model.currentAnimation as MmdWasmRuntimeModelAnimation)?.wasmAnimate !== undefined) {
                        models[i].beforePhysicsAndWasm(lastRequestAnimationFrameTime);
                    }
                }

                if (lastRequestAnimationFrameTime !== null) {
                    if (this._camera !== null) {
                        this._camera.animate(lastRequestAnimationFrameTime);
                    }
                }
            }

            if (this.wasmInstance.MmdRuntime.bufferedUpdate === undefined) { // single thread environment fallback
                this.wasmInternal.beforePhysics(this._lastRequestAnimationFrameTime ?? undefined, physicsDeltaTime);
                if (this._externalPhysics === null) this.wasmInternal.afterPhysics();
            }

            this.lock.wait(); // ensure that the runtime is not evaluating animations

            this._physicsRuntime?.impl?.beforeStep(); // for physics object buffer swap and commit changes

            // desync buffer
            if (this._usingWasmBackBuffer === false) {
                this._usingWasmBackBuffer = true;
                this.wasmInternal.swapWorldMatrixBuffer();
            }

            // if there is no previous evaluated frame time, evaluate animation synchronously
            if (this._lastRequestAnimationFrameTime === null) {
                if (elapsedFrameTime !== null) {
                    // evaluate animations on javascript side
                    for (let i = 0; i < models.length; ++i) {
                        const model = models[i];
                        if ((model.currentAnimation as MmdWasmRuntimeModelAnimation)?.wasmAnimate === undefined) {
                            models[i].beforePhysicsAndWasm(elapsedFrameTime);
                        }
                    }

                    // compute world matrix on wasm side synchronously
                    this.wasmInternal.beforePhysics(elapsedFrameTime ?? undefined, physicsDeltaTime);
                    if (this._externalPhysics === null) this.wasmInternal.afterPhysics();
                } else {
                    // if there is uninitialized new model, evaluate animation synchronously
                    if (this._needToSyncEvaluate) {
                        this._needToSyncEvaluate = false;

                        // move initialization sets to back buffer
                        const needToInitializePhysicsModelsBuffer = this._needToInitializePhysicsModelsBuffer;
                        for (const model of this._needToInitializePhysicsModels) {
                            needToInitializePhysicsModelsBuffer.add(model);
                        }

                        // compute world matrix on wasm side synchronously
                        this.wasmInternal.beforePhysics(undefined, physicsDeltaTime);
                        if (this._externalPhysics === null) this.wasmInternal.afterPhysics();
                    }
                }
            } else {
                // if there is uninitialized new model, evaluate animation synchronously
                if (this._needToSyncEvaluate) {
                    this._needToSyncEvaluate = false;

                    // move initialization sets to back buffer
                    const needToInitializePhysicsModelsBuffer = this._needToInitializePhysicsModelsBuffer;
                    for (const model of this._needToInitializePhysicsModels) {
                        needToInitializePhysicsModelsBuffer.add(model);
                    }

                    // evaluate animations on javascript side
                    for (let i = 0; i < models.length; ++i) {
                        const model = models[i];
                        if ((model.currentAnimation as MmdWasmRuntimeModelAnimation)?.wasmAnimate === undefined) {
                            models[i].beforePhysicsAndWasm(this._lastRequestAnimationFrameTime);
                        }
                    }

                    // compute world matrix on wasm side synchronously
                    this.wasmInternal.beforePhysics(this._lastRequestAnimationFrameTime, physicsDeltaTime);
                    if (this._externalPhysics === null) this.wasmInternal.afterPhysics();
                }
            }

            for (let i = 0; i < models.length; ++i) models[i].swapWorldTransformMatricesBuffer();
            this.wasmInternal.swapWorldMatrixBuffer();

            for (let i = 0; i < models.length; ++i) {
                const model = models[i];
                model.beforePhysics(); // sync body to bone
            }

            // update bone animation state on javascript side
            for (let i = 0; i < models.length; ++i) {
                const model = models[i];
                if ((model.currentAnimation as MmdWasmRuntimeModelAnimation)?.wasmAnimate === undefined) {
                    models[i].beforePhysicsAndWasm(elapsedFrameTime);
                }
            }

            // compute world matrix on wasm side asynchronously
            if (this._externalPhysics === null) {
                this.wasmInstance.MmdRuntime.bufferedUpdate?.(this.wasmInternal, elapsedFrameTime ?? undefined, physicsDeltaTime);
            }
            this._lastRequestAnimationFrameTime = elapsedFrameTime;

            if (this._externalPhysics !== null) { // physics initialization for external physics
                // physics initialization must be buffered 1 frame
                const needToInitializePhysicsModelsBuffer = this._needToInitializePhysicsModelsBuffer;
                for (const model of needToInitializePhysicsModelsBuffer) {
                    model.initializePhysics();
                }
                needToInitializePhysicsModelsBuffer.clear();

                const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
                for (const model of needToInitializePhysicsModels) {
                    needToInitializePhysicsModelsBuffer.add(model);
                }
                needToInitializePhysicsModels.clear();
            } // physics initialization for wasm integrated physics is done in wasm side
        } else {
            this._physicsRuntime?.impl?.beforeStep(); // for physics object buffer swap and commit changes

            // sync buffer
            if (this._usingWasmBackBuffer === true) {
                if (this._externalPhysics !== null) { // for external physics
                    // move buffered initialization sets to current initialization sets
                    const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
                    for (const model of this._needToInitializePhysicsModelsBuffer) {
                        needToInitializePhysicsModels.add(model);
                    }
                } // for wasm integrated physics, move initialization sets to back buffer is performed in wasm side

                this.lock.wait(); // ensure that the runtime is not evaluating animations
                this._usingWasmBackBuffer = false;
                this._lastRequestAnimationFrameTime = null;
                this.wasmInternal.swapWorldMatrixBuffer();
            }

            const models = this._models;
            for (let i = 0; i < models.length; ++i) models[i].beforePhysicsAndWasm(elapsedFrameTime);
            this.wasmInternal.beforePhysics(elapsedFrameTime ?? undefined, physicsDeltaTime);
            for (let i = 0; i < models.length; ++i) models[i].beforePhysics();

            this._needToSyncEvaluate = false;

            if (this._externalPhysics !== null) { // physics initialization for external physics
                const needToInitializePhysicsModels = this._needToInitializePhysicsModels;
                for (const model of needToInitializePhysicsModels) {
                    model.initializePhysics();
                }
                needToInitializePhysicsModels.clear();
            }

            if (elapsedFrameTime !== null) {
                if (this._camera !== null) {
                    this._camera.animate(elapsedFrameTime);
                }
            }
        }

        this._physicsRuntime?.impl?.afterStep(); // for trigger onSyncObservable and onTickObservable of physics runtime

        if (elapsedFrameTime !== null) {
            this.onAnimationTickObservable.notifyObservers();
        }
    }

    /**
     * After the physics stage, update physics and run MMD runtime solvers
     */
    public afterPhysics(): void {
        const models = this._models;
        if (this._usingWasmBackBuffer) {
            for (let i = 0; i < models.length; ++i) {
                const model = models[i];
                model.afterPhysicsAndWasm();
                model.afterPhysics(); // actually, afterPhysics can be called before "wasm side afterPhysics"
            }
            if (this._externalPhysics !== null) {
                { // afterPhysics is not thread safe, buffered evaluation must be done after afterPhysics
                    this.wasmInternal.swapWorldMatrixBuffer();
                    this.wasmInternal.afterPhysics();
                    this.wasmInternal.swapWorldMatrixBuffer();
                }
                const physicsDeltaTime = this._physicsClock.getDeltaTime();
                this.wasmInstance.MmdRuntime.bufferedBeforePhysics?.(this.wasmInternal, this._lastRequestAnimationFrameTime ?? undefined, physicsDeltaTime);
            }
        } else {
            for (let i = 0; i < models.length; ++i) models[i].afterPhysicsAndWasm();
            this.wasmInternal.afterPhysics();
            for (let i = 0; i < models.length; ++i) models[i].afterPhysics();
        }
    }

    private readonly _onAnimationChanged = (newAnimation: Nullable<IMmdRuntimeCameraAnimation | IMmdRuntimeModelAnimation | MmdWasmRuntimeModelAnimation>): void => {
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
        if (!this._animationPaused && this._audioPlayer !== null) {
            const audioPlayer = this._audioPlayer;
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

        const audioFrameTimeDuration = this._audioPlayer !== null
            ? this._audioPlayer.duration * 30
            : 0;

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

        if (this.autoPhysicsInitialization) {
            if (this._currentFrameTime === 0) {
                const models = this._models;

                const physicsInitializeSet = this._getPhysicsInitializeSet();
                for (let i = 0; i < models.length; ++i) {
                    physicsInitializeSet.add(models[i]);
                }
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
        if (this.autoPhysicsInitialization) {
            if (2 * 30 < Math.abs(frameTime - this._currentFrameTime)) {
                const physicsInitializeSet = this._getPhysicsInitializeSet();
                for (let i = 0; i < this._models.length; ++i) {
                    const model = this._models[i];
                    if (model.currentAnimation !== null) {
                        physicsInitializeSet.add(model);
                    }
                }
            }
        }

        this._currentFrameTime = frameTime;

        if (forceEvaluate) {
            const models = this._models;

            if (this._evaluationType === MmdWasmRuntimeAnimationEvaluationType.Buffered) {
                this._lastRequestAnimationFrameTime = frameTime;
                this._needToSyncEvaluate = true;
            } else {
                this.lock.wait(); // ensure that the runtime is not evaluating animations
                for (let i = 0; i < models.length; ++i) {
                    const currentAnimation = models[i].currentAnimation;
                    if (currentAnimation !== null) {
                        if ((currentAnimation as MmdWasmRuntimeModelAnimation).wasmAnimate !== undefined) {
                            (currentAnimation as MmdWasmRuntimeModelAnimation).wasmAnimate(frameTime);
                            (currentAnimation as MmdWasmRuntimeModelAnimation).animate(frameTime);
                        } else {
                            (currentAnimation as IMmdRuntimeModelAnimation).animate(frameTime);
                        }
                    }
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
    public get models(): readonly MmdWasmModel[] {
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
     * Animation evaluation type
     */
    public get evaluationType(): MmdWasmRuntimeAnimationEvaluationType {
        return this._evaluationType;
    }

    public set evaluationType(value: MmdWasmRuntimeAnimationEvaluationType) {
        if (this._evaluationType === value) return;

        if (value === MmdWasmRuntimeAnimationEvaluationType.Buffered) {
            this._evaluationType = value;
        } else {
            this._evaluationType = value;
        }

        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            models[i].onEvaluationTypeChanged(value);
        }

        this._physicsRuntime?.impl?.onEvaluationTypeChanged(value);
    }

    /**
     * get physics runtime
     *
     * If you don't set physics as `MmdWasmPhysics`, it returns null
     */
    public get physics(): Nullable<IMmdWasmPhysicsRuntime> {
        return this._physicsRuntime;
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
