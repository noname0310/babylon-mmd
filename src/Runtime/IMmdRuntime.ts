import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Observable } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IPlayer } from "./Audio/IAudioPlayer";
import type { ILogger } from "./ILogger";
import type { MmdCamera } from "./mmdCamera";
import type { MmdModel } from "./mmdModel";
import type { CreateMmdModelOptions } from "./mmdRuntime";

export interface IMmdRuntime extends ILogger {
    /**
     * This observable is notified when animation duration is changed
     */
    readonly onAnimationDurationChangedObservable: Observable<void>;

    /**
     * This observable is notified when animation is played
     */
    readonly onPlayAnimationObservable: Observable<void>;

    /**
     * This observable is notified when animation is paused
     */
    readonly onPauseAnimationObservable: Observable<void>;

    /**
     * This observable is notified when animation is seeked
     */
    readonly onSeekAnimationObservable: Observable<void>;

    /**
     * This observable is notified when animation is evaluated (usually every frame)
     */
    readonly onAnimationTickObservable: Observable<void>;

    /**
     * Create MMD model from mesh that has MMD metadata
     *
     * The skeletons in the mesh where the MmdModel was created no longer follow the usual matrix update policy
     * @param mmdMesh MMD mesh
     * @param options Creation options
     * @returns MMD model
     * @throws {Error} if mesh is not `MmdMesh`
     */
    createMmdModel(
        mmdMesh: Mesh,
        options: CreateMmdModelOptions
    ): MmdModel;

    /**
     * @internal
     */
    addMmdModelInternal(model: MmdModel): void;

    /**
     * Destroy MMD model
     *
     * Dispose all resources used at MMD runtime and restores the skeleton to the usual matrix update policy
     *
     * After calling the `destroyMmdModel` once, the mesh is no longer able to `createMmdModel` because the metadata is lost
     * @param mmdModel MMD model to destroy
     * @throws {Error} if model is not found
     */
    destroyMmdModel(mmdModel: MmdModel): void;

    /**
     * Set camera to animate
     * @param camera MMD camera
     */
    setCamera(camera: Nullable<MmdCamera>): void;

    /**
     * Set audio player to sync with animation
     *
     * If you set up audio Player while playing an animation, it try to play the audio from the current animation time
     * And returns Promise because this operation is asynchronous. In most cases, you don't have to await this Promise
     * @param audioPlayer Audio player
     */
    setAudioPlayer(audioPlayer: Nullable<IPlayer>): Promise<void>;

    /**
     * Register MMD runtime to scene
     *
     * register `beforePhysics` and `afterPhysics` to scene Observables
     *
     * If you need a more complex update method you can call `beforePhysics` and `afterPhysics` manually
     * @param scene Scene
     */
    register(scene: Scene): void;

    /**
     * Unregister MMD runtime from scene
     * @param scene Scene
     */
    unregister(scene: Scene): void;

    /**
     * Before the physics stage, update animations and run MMD runtime solvers
     *
     * @param deltaTime Delta time in milliseconds
     */
    beforePhysics(deltaTime: number): void;

    /**
     * After the physics stage, update physics and run MMD runtime solvers
     */
    afterPhysics(): void;

    /**
     * Play animation from the current animation time
     *
     * If audio player is set, it try to play the audio from the current animation time
     *
     * It returns Promise because playing audio is asynchronous
     */
    playAnimation(): Promise<void>;

    /**
     * Pause animation
     */
    pauseAnimation(): void;

    /**
     * Seek animation to the specified frame time
     *
     * If you set forceEvaluate true, the animation is evaluated even if the animation is not playing.
     * @param frameTime Time in 30fps frame
     * @param forceEvaluate Whether to force evaluate animation
     */
    seekAnimation(frameTime: number, forceEvaluate: boolean): Promise<void>;

    /**
     * Whether animation is playing
     */
    get isAnimationPlaying(): boolean;

    /**
     * MMD models created by this runtime
     */
    get models(): readonly MmdModel[];

    /**
     * MMD camera
     */
    get camera(): Nullable<MmdCamera>;

    /**
     * Audio player
     */
    get audioPlayer(): Nullable<IPlayer>;

    /**
     * Current animation time scale (default: 1)
     */
    get timeScale(): number;
    set timeScale(value: number);

    /**
     * Current animation time in 30fps frame
     */
    get currentFrameTime(): number;

    /**
     * Current animation time in seconds
     */
    get currentTime(): number;

    /**
     * Current animation duration in 30fps frame
     */
    get animationFrameTimeDuration(): number;

    /**
     * Current animation duration in seconds
     */
    get animationDuration(): number;

    /**
     * Set animation duration manually
     *
     * When the difference between the length of the song and the length of the animation is large, it can be helpful to adjust the animation duration manually
     * @param frameTimeDuration Time in 30fps frame
     */
    setManualAnimationDuration(frameTimeDuration: Nullable<number>): void;

    /**
     * Enable or disable debug logging (default: false)
     */
    get loggingEnabled(): boolean;
    set loggingEnabled(value: boolean);
}