import { Observable } from "@babylonjs/core";

export interface IAudioPlayer {
    onDurationChangedObservable: Observable<void>;
    onPlaybackRateChangedObservable: Observable<void>;

    onPlayObservable: Observable<void>;
    onPauseObservable: Observable<void>;
    onSeekObservable: Observable<void>;

    get duration(): number;
    
    get currentTime(): number;
    set currentTime(value: number);

    get volume(): number;
    set volume(value: number);

    get muted(): boolean;
    mute(): void;
    unmute(): Promise<boolean>;

    get playbackRate(): number;
    set playbackRate(value: number);
    _setPlaybackRateWithoutNotify(value: number): void;

    get preservesPitch(): boolean;
    set preservesPitch(value: boolean);

    get paused(): boolean;

    get source(): string;
    set source(value: string);

    play(): Promise<void>;

    pause(): void;
}
