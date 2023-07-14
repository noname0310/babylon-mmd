import { Observable } from "@babylonjs/core";

import type { IAudioPlayer } from "./IAudioPlayer";

export class AudioPlayer implements IAudioPlayer {
    public onDurationChangedObservable: Observable<void>;
    public onPlaybackRateChangedObservable: Observable<void>;

    public onPlayObservable: Observable<void>;
    public onPauseObservable: Observable<void>;
    public onSeekObservable: Observable<void>;

    private readonly _audio: HTMLAudioElement;
    private _duration: number;
    private _playbackRate: number;

    private _isVirtualPlay: boolean;
    private _virtualStartTime: number;
    private _virtualPaused: boolean;
    private _virtualPauseCurrentTime: number;
    private _metadataLoaded: boolean;

    public constructor() {
        this.onDurationChangedObservable = new Observable<void>();
        this.onPlaybackRateChangedObservable = new Observable<void>();

        this.onPlayObservable = new Observable<void>();
        this.onPauseObservable = new Observable<void>();
        this.onSeekObservable = new Observable<void>();

        const audio = this._audio = new Audio();
        audio.loop = false;
        audio.autoplay = false;

        this._duration = Infinity;
        this._playbackRate = 1;

        this._isVirtualPlay = false;
        this._virtualStartTime = 0;
        this._virtualPaused = true;
        this._virtualPauseCurrentTime = 0;
        this._metadataLoaded = false;

        audio.onloadedmetadata = this._onMetadataLoaded;
        audio.onplay = this._onPlay;
        audio.onpause = this._onPause;
        audio.onseeked = this._onSeek;
    }

    private readonly _onMetadataLoaded = (): void => {
        this._duration = this._audio.duration;

        this._isVirtualPlay = false;
        this._virtualPaused = true;
        this._virtualPauseCurrentTime = 0;
        this._metadataLoaded = true;

        this.onDurationChangedObservable.notifyObservers();
    };

    private readonly _onPlay = (): void => {
        if (!this._isVirtualPlay) {
            this._audio.playbackRate = this._playbackRate;
        }
        this.onPlayObservable.notifyObservers();
    };

    private readonly _onPause = (): void => {
        this.onPauseObservable.notifyObservers();
    };

    private readonly _onSeek = (): void => {
        this.onSeekObservable.notifyObservers();
    };

    public get duration(): number {
        return this._duration;
    }

    public get currentTime(): number {
        if (this._isVirtualPlay) {
            if (this._virtualPaused) {
                return this._virtualPauseCurrentTime;
            } else {
                const computedTime = (performance.now() / 1000 - this._virtualStartTime) * this._playbackRate;
                if (computedTime > this._duration) {
                    this._virtualPaused = true;
                    this._virtualPauseCurrentTime = this._duration;
                    this._onPause();
                    return this._virtualPauseCurrentTime;
                } else {
                    return computedTime;
                }
            }
        } else {
            return this._audio.currentTime;
        }
    }

    public set currentTime(value: number) {
        if (this._isVirtualPlay) {
            this._virtualStartTime = performance.now() / 1000 - value / this._playbackRate;
            this._onSeek();
        } else {
            this._audio.currentTime = value;
        }
    }

    public get volume(): number {
        return this._audio.volume;
    }

    public set volume(value: number) {
        this._audio.volume = value;
    }

    public get muted(): boolean {
        return this._isVirtualPlay;
    }

    public mute(): void {
        if (this._isVirtualPlay) return;

        this._isVirtualPlay = true;
        this._virtualStartTime = performance.now() / 1000 - this._audio.currentTime / this._playbackRate;
        this._virtualPaused = this._audio.paused;
        this._virtualPauseCurrentTime = this._audio.currentTime;
        this._audio.pause();
    }

    public async unmute(): Promise<boolean> {
        if (!this._isVirtualPlay) return false;

        let notAllowedError = false;

        this._audio.onseeked = null;
        if (this._virtualPaused) {
            this._audio.currentTime = this._virtualPauseCurrentTime;
            this._audio.onseeked = this._onSeek;
        } else {
            this._audio.currentTime = (performance.now() / 1000 - this._virtualStartTime) * this._playbackRate;
            this._audio.onseeked = this._onSeek;

            try {
                await this._audio.play();
                this._audio.playbackRate = this._playbackRate;
            } catch (e) {
                if (!(e instanceof DOMException && e.name === "NotAllowedError")) throw e;
                notAllowedError = true;
            }
        }

        if (!notAllowedError) {
            this._isVirtualPlay = false;
            this._virtualPaused = true;
            this._virtualPauseCurrentTime = 0;
            return true;
        }

        return false;
    }

    public get playbackRate(): number {
        return this._playbackRate;
    }

    public set playbackRate(value: number) {
        this._setPlaybackRateWithoutNotify(value);
        this.onPlaybackRateChangedObservable.notifyObservers();
    }

    /** @internal */
    public _setPlaybackRateWithoutNotify(value: number): void {
        if (value < 0) throw new RangeError("playbackRate must be greater than or equal to 0");

        this._playbackRate = value;
        this._audio.playbackRate = value;
    }

    public get preservesPitch(): boolean {
        return this._audio.preservesPitch;
    }

    public set preservesPitch(value: boolean) {
        this._audio.preservesPitch = value;
    }

    public get paused(): boolean {
        if (this._isVirtualPlay) {
            return this._virtualPaused;
        } else {
            return this._audio.paused;
        }
    }

    public get source(): string {
        return this._audio.src;
    }

    public set source(value: string) {
        if (value === this._audio.src) return;

        this._audio.src = value;
        this._metadataLoaded = false;
    }

    private _playRequestBlocking = false;

    public async play(): Promise<void> {
        if (this._isVirtualPlay && !this._virtualPaused) return;

        if (this._playRequestBlocking) return;
        this._playRequestBlocking = true;

        try {
            await this._audio.play();
        } catch (e) {
            if (e instanceof DOMException && e.name === "NotAllowedError") {
                if (this._metadataLoaded) {
                    if (this._virtualPaused) {
                        this._virtualStartTime = performance.now() / 1000 - this._virtualPauseCurrentTime / this._playbackRate;
                        this._virtualPaused = false;
                    }
                    this._isVirtualPlay = true;
                    this._onPlay();
                } else {
                    await new Promise<void>((resolve) => {
                        this.onDurationChangedObservable.addOnce(() => {
                            if (this._virtualPaused) {
                                this._virtualStartTime = performance.now() / 1000 - this._virtualPauseCurrentTime / this._playbackRate;
                                this._virtualPaused = false;
                            }
                            this._isVirtualPlay = true;
                            this._onPlay();
                            resolve();
                        });
                    });
                }
            } else {
                throw e;
            }
        } finally {
            this._playRequestBlocking = false;
        }
    }

    public pause(): void {
        if (this._isVirtualPlay) {
            if (this._virtualPaused) return;
            this._virtualPaused = true;

            this._virtualPauseCurrentTime = (performance.now() / 1000 - this._virtualStartTime) * this._playbackRate;
            this._onPause();
        } else {
            this._audio.pause();
        }
    }
}
