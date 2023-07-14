import { Observable } from "@babylonjs/core";

const enum AudioPlayerState {
    Playing,
    Paused,
    Stopped,
    Disposed,
}

export class AudioPlayer {
    public onAudioDataChangedObservable: Observable<void>;
    public onDurationChangedObservable: Observable<void>;

    public onPlayObservable: Observable<void>;
    public onPauseObservable: Observable<void>;
    public onStopObservable: Observable<void>;
    public onSeekObservable: Observable<void>;

    private readonly _audio: HTMLAudioElement;
    private _duration: number;
    private _playbackRate: number;

    private _state: AudioPlayerState;

    public constructor() {
        this.onAudioDataChangedObservable = new Observable<void>();
        this.onDurationChangedObservable = new Observable<void>();

        this.onPlayObservable = new Observable<void>();
        this.onPauseObservable = new Observable<void>();
        this.onStopObservable = new Observable<void>();
        this.onSeekObservable = new Observable<void>();

        const audio = this._audio = new Audio();
        audio.loop = false;
        audio.autoplay = false;

        this._duration = Infinity;
        this._playbackRate = 1;

        this._state = AudioPlayerState.Stopped;

        audio.onloadedmetadata = this._onMetadataLoaded;
    }

    private readonly _onMetadataLoaded = (): void => {
        this._duration = this._audio.duration;
        this.onDurationChangedObservable.notifyObservers();
    };

    public get duration(): number {
        return this._duration;
    }

    public get currentTime(): number {
        return this._audio.currentTime;
    }

    public set currentTime(value: number) {
        this._audio.currentTime = value;
        this.onSeekObservable.notifyObservers();
    }

    public get volume(): number {
        return this._audio.volume;
    }

    public set volume(value: number) {
        this._audio.volume = value;
    }

    public get playbackRate(): number {
        return this._playbackRate;
    }

    public set playbackRate(value: number) {
        this._playbackRate = value;
        this._audio.playbackRate = value;
    }

    public get preservesPitch(): boolean {
        return this._audio.preservesPitch;
    }

    public set preservesPitch(value: boolean) {
        this._audio.preservesPitch = value;
    }

    public get isPlaying(): boolean {
        return !this._audio.paused;
    }

    public async play(source: string): Promise<void> {
        if (this._state === AudioPlayerState.Playing) {
            this.stop();
        }

        this._audio.src = source;

        try {
            await this._audio.play();
            this._audio.playbackRate = this._playbackRate;
            this._state = AudioPlayerState.Playing;
            this.onPlayObservable.notifyObservers();
        } catch (e) {
            if (e instanceof DOMException && e.name === "NotAllowedError") {
                this._audio.muted = true;
                await this._audio.play();
                this._audio.playbackRate = this._playbackRate;
                this._state = AudioPlayerState.Playing;
                this.onPlayObservable.notifyObservers();
            } else {
                throw e;
            }
        }
    }

    public pause(): void {
        if (this._state !== AudioPlayerState.Playing) return;

        this._audio.pause();
        this._state = AudioPlayerState.Paused;
        this.onPauseObservable.notifyObservers();
    }

    public stop(): void {
        if (this._state === AudioPlayerState.Stopped) return;

        this._audio.pause();
        this._audio.currentTime = 0;
        this._state = AudioPlayerState.Stopped;
        this.onStopObservable.notifyObservers();
    }

    public dispose(): void {
        this._audio.pause();
        this._audio.src = "";

        this.onAudioDataChangedObservable.clear();
        this.onDurationChangedObservable.clear();

        this.onPlayObservable.clear();
        this.onPauseObservable.clear();
        this.onStopObservable.clear();
        this.onSeekObservable.clear();

        this._audio.onloadedmetadata = null;
        this._audio.remove();

        this._state = AudioPlayerState.Disposed;
    }
}
