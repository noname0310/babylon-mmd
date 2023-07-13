import { Observable } from "@babylonjs/core";

export class AudioPlayer {
    public onAudioDataChangedObservable: Observable<void>;
    public onDurationChangedObservable: Observable<void>;

    public onPlayObservable: Observable<void>;
    public onPauseObservable: Observable<void>;
    public onStopObservable: Observable<void>;
    public onSeekObservable: Observable<void>;

    private readonly _audio: HTMLAudioElement;
    private _duration: number;

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
        return this._audio.playbackRate;
    }

    public set playbackRate(value: number) {
        this._audio.playbackRate = value;
    }

    public get isPlaying(): boolean {
        return !this._audio.paused;
    }

    public async play(source: string): Promise<void> {
        this._audio.src = source;

        try {
            await this._audio.play();
            this.onPlayObservable.notifyObservers();
        } catch (e) {
            if (e instanceof DOMException && e.name === "NotAllowedError") {
                this._audio.muted = true;
                this._audio.play();
                this.onPlayObservable.notifyObservers();
            } else {
                throw e;
            }
        }
    }
}
