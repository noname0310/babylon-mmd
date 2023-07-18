import type { Observable } from "@babylonjs/core";

export interface IPlayer {
    readonly onDurationChangedObservable: Observable<void>;
    readonly onPlaybackRateChangedObservable: Observable<void>;
    readonly onMuteStateChangedObservable: Observable<void>;

    readonly onPlayObservable: Observable<void>;
    readonly onPauseObservable: Observable<void>;
    readonly onSeekObservable: Observable<void>;

    readonly duration: number;

    currentTime: number;
    /** @internal */
    _setCurrentTimeWithoutNotify(value: number): void;

    playbackRate: number;
    /** @internal */
    _setPlaybackRateWithoutNotify(value: number): void;

    readonly paused: boolean;
    readonly metadataLoaded: boolean;

    play(): Promise<void>;
    pause(): void;
}

export interface IAudioPlayer extends IPlayer {
    volume: number;
    readonly muted: boolean;
    
    mute(): void;
    unmute(): Promise<boolean>;

    preservesPitch: boolean;
}
