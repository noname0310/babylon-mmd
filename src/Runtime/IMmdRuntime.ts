import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Observable } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IPlayer } from "./Audio/IAudioPlayer";
import type { ILogger } from "./ILogger";
import type { IMmdModel } from "./IMmdModel";
import type { IMmdLinkedBoneContainer } from "./IMmdRuntimeLinkedBone";
import type { MmdCamera } from "./mmdCamera";
import type { MmdSkinnedMesh } from "./mmdMesh";
import type { IMmdModelCreationOptions } from "./mmdRuntime";

/**
 * MMD runtime orchestrates several MMD components (models, camera, audio)
 *
 * MMD runtime handles updates and synchronization of MMD components
 *
 * It can also create and remove runtime components
 */
export interface IMmdRuntime<TMmdModel extends IMmdModel = IMmdModel> extends ILogger {
    /**
     * Whether to automatically initialize rigid bodies transform and velocity (default: true)
     *
     * auto physics initialization is triggered when
     * - animation seek is far from current frame time (more than 2 seconds)
     * - browser tab is stop rendering and resumed
     * - animation is played from the frame 0
     */
    autoPhysicsInitialization: boolean;

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
     * Dispose MMD runtime
     *
     * Destroy all MMD models and unregister this runtime from scene
     */
    dispose(scene: Scene): void;

    /**
     * Create MMD model from mesh that has MMD metadata
     *
     * The skeletons in the mesh where the MmdModel was created no longer follow the usual matrix update policy
     * @param mmdMesh MmdSkinnedMesh
     * @param options Creation options
     * @returns MMD model
     * @throws {Error} if mesh is not `MmdSkinnedMesh`
     */
    createMmdModel<TMaterial extends Material>(
        mmdSkinedMesh: Mesh,
        options?: IMmdModelCreationOptions<TMaterial>
    ): TMmdModel;

    /**
     * Create MMD model from humanoid mesh and virtual skeleton
     *
     * this method is useful for supporting humanoid models, usually used by `HumanoidMmd`
     * @param mmdSkinedMesh MmdSkinnedMesh
     * @param skeleton Skeleton or Virtualized skeleton
     * @param options Creation options
     */
    createMmdModelFromSkeleton<TMaterial extends Material>(
        mmdSkinedMesh: MmdSkinnedMesh,
        skeleton: IMmdLinkedBoneContainer,
        options?: IMmdModelCreationOptions<TMaterial>
    ): TMmdModel;

    /**
     * Destroy MMD model
     *
     * Dispose all resources used at MMD runtime and restores the skeleton to the usual matrix update policy
     *
     * After calling the `destroyMmdModel` once, the mesh is no longer able to `createMmdModel` because the metadata is lost
     * @param mmdModel MMD model to destroy
     * @throws {Error} if model is not found
     */
    destroyMmdModel(mmdModel: TMmdModel): void;

    /**
     * Queue MMD model to initialize physics
     *
     * Actual physics initialization is done by the before physics stage
     * @param mmdModel MMD model
     */
    initializeMmdModelPhysics(mmdModel: TMmdModel): void;

    /**
     * Queue all MMD models to initialize physics
     *
     * Actual physics initialization is done by the before physics stage
     *
     * If you set onlyAnimated true, it only initializes physics for animated models
     */
    initializeAllMmdModelsPhysics(onlyAnimated: boolean): void;

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
     * @returns Promise
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
     * @returns Promise
     */
    playAnimation(): Promise<void>;

    /**
     * Pause animation
     */
    pauseAnimation(): void;

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
    seekAnimation(frameTime: number, forceEvaluate: boolean): Promise<void>;

    /**
     * Whether animation is playing
     */
    get isAnimationPlaying(): boolean;

    /**
     * MMD models created by this runtime
     */
    get models(): readonly TMmdModel[];

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
