import type { Observable } from "@babylonjs/core";

export interface IAudioPlayer {
    readonly onLoadErrorObservable: Observable<void>;
    readonly onDurationChangedObservable: Observable<void>;
    readonly onPlaybackRateChangedObservable: Observable<void>;

    readonly onPlayObservable: Observable<void>;
    readonly onPauseObservable: Observable<void>;
    readonly onSeekObservable: Observable<void>;

    get duration(): number;

    get currentTime(): number;
    set currentTime(value: number);
    /** @internal */
    _setCurrentTimeWithoutNotify(value: number): void;

    get volume(): number;
    set volume(value: number);

    get muted(): boolean;
    mute(): void;
    unmute(): Promise<boolean>;

    get playbackRate(): number;
    set playbackRate(value: number);
    /** @internal */
    _setPlaybackRateWithoutNotify(value: number): void;

    get preservesPitch(): boolean;
    set preservesPitch(value: boolean);

    get paused(): boolean;

    get source(): string;
    set source(value: string);

    play(): Promise<void>;

    pause(): void;
}
