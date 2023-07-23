import type { Observable } from "@babylonjs/core/Misc/observable";

/**
 * Abstract player interface
 */
export interface IPlayer {
    /**
     * On duration changed observable
     *
     * This observable is notified when the (audio) duration is changed
     */
    readonly onDurationChangedObservable: Observable<void>;

    /**
     * On playback rate changed observable
     *
     * This observable is notified when the playback rate is changed
     */
    readonly onPlaybackRateChangedObservable: Observable<void>;

    /**
     * On play observable
     *
     * This observable is notified when the player is played
     */
    readonly onPlayObservable: Observable<void>;

    /**
     * On pause observable
     *
     * This observable is notified when the player is paused
     */
    readonly onPauseObservable: Observable<void>;

    /**
     * On seek observable
     *
     * This observable is notified when the player is seeked
     */
    readonly onSeekObservable: Observable<void>;

    /**
     * (Audio) duration (in seconds)
     */
    readonly duration: number;

    /**
     * Current time (in seconds)
     */
    currentTime: number;
    /** @internal */
    _setCurrentTimeWithoutNotify(value: number): void;

    /**
     * Playback rate (1.0 is normal speed)
     */
    playbackRate: number;
    /** @internal */
    _setPlaybackRateWithoutNotify(value: number): void;

    /**
     * Whether the player is paused
     */
    readonly paused: boolean;

    /**
     * Whether the audio metadata(durations) is loaded
     */
    readonly metadataLoaded: boolean;

    /**
     * Play the player
     */
    play(): Promise<void>;

    /**
     * Pause the player
     */
    pause(): void;
}

/**
 * Abstract audio player interface
 */
export interface IAudioPlayer extends IPlayer {
    /**
     * On mute state changed observable
     *
     * This observable is notified when the mute state is changed
     */
    readonly onMuteStateChangedObservable: Observable<void>;

    /**
     * Volume (0.0 to 1.0)
     */
    volume: number;

    /**
     * Whether the player is muted
     */
    readonly muted: boolean;

    /**
     * Mute the player
     */
    mute(): void;

    /**
     * Unmute the player
     *
     * Unmute is possible failed if user interaction is not performed
     * @returns Whether the player is unmuted
     */
    unmute(): Promise<boolean>;

    /**
     * Whether the player preserves pitch
     */
    preservesPitch: boolean;
}
