import { Observable } from "@babylonjs/core/Misc/observable";
import type { Nullable } from "@babylonjs/core/types";

import type { IDisposeObservable } from "../IDisposeObserable";
import type { IAudioPlayer } from "./IAudioPlayer";

/**
 * Audio element pool interface
 *
 * Pass to the constructor of `StreamAudioPlayer` to pool the audio element
 */
export interface IAudioElementPool {
    /**
     * Rent the audio element
     * @returns The audio element
     */
    rent(): HTMLAudioElement;

    /**
     * Return the audio element
     *
     * Returned audio element should not be used anymore
     * @param audioElement The audio element
     */
    return(audioElement: HTMLAudioElement): void;
}

/**
 * This class is used to pooling the audio element
 */
export class AudioElementPool implements IAudioElementPool {
    private readonly _audioElements: HTMLAudioElement[] = [];

    /**
     * Rent the audio element
     * @returns The audio element
     */
    public rent(): HTMLAudioElement {
        if (this._audioElements.length === 0) {
            return new Audio();
        } else {
            const audio =  this._audioElements.pop()!;
            audio.loop = false;
            audio.autoplay = false;
            audio.playbackRate = 1;
            audio.volume = 1;
            audio.muted = false;
            audio.preservesPitch = true;
            audio.ondurationchange = null;
            audio.onerror = null;
            audio.onplaying = null;
            audio.onpause = null;
            audio.onseeked = null;
            return audio;
        }
    }

    /**
     * Return the audio element
     *
     * Returned audio element should not be used anymore
     * @param audioElement The audio element
     */
    public return(audioElement: HTMLAudioElement): void {
        audioElement.pause();
        audioElement.src = "";
        audioElement.load();
        this._audioElements.push(audioElement);
    }
}

/**
 * Stream audio player options
 */
export interface StreamAudioPlayerOptions {
    /**
     * Whether to pooling the audio element
     *
     * If `true`, the `StreamAudioPlayer.DefaultAudioElementPool` is used as the audio element pool
     * If `false`, the audio element is created on demand
     * If `IAudioElementPool`, the specified audio element pool is used
     *
     * Default is `false`
     */
    pool?: boolean | IAudioElementPool;
}

/**
 * Stream audio player
 *
 * This class is used to play the audio from the stream
 *
 * It is suitable for playing long sounds because it plays even if all of the audio is not loaded
 *
 * Wrapper of `HTMLAudioElement` which handles audio playback permission issues gracefully
 */
export class StreamAudioPlayer implements IAudioPlayer {
    /**
     * Default global audio element pool instance
     */
    public static readonly DefaultAudioElementPool: IAudioElementPool = new AudioElementPool();

    /**
     * On load error observable
     *
     * This observable is notified when the audio load is failed
     */
    public readonly onLoadErrorObservable: Observable<void>;

    /**
     * On duration changed observable
     *
     * This observable is notified when the audio duration is changed
     */
    public readonly onDurationChangedObservable: Observable<void>;

    /**
     * On mute state changed observable
     *
     * This observable is notified when the mute state is changed
     */
    public readonly onPlaybackRateChangedObservable: Observable<void>;

    /**
     * On mute state changed observable
     *
     * This observable is notified when the mute state is changed
     */
    public readonly onMuteStateChangedObservable: Observable<void>;

    /**
     * On play observable
     *
     * This observable is notified when the player is played
     */
    public readonly onPlayObservable: Observable<void>;

    /**
     * On pause observable
     *
     * This observable is notified when the player is paused
     */
    public readonly onPauseObservable: Observable<void>;

    /**
     * On seek observable
     *
     * This observable is notified when the player is seeked
     */
    public readonly onSeekObservable: Observable<void>;

    private readonly _pool: Nullable<IAudioElementPool>;
    private _audio: Nullable<HTMLAudioElement>;
    private _duration: number;
    private _playbackRate: number;

    private _isVirtualPlay: boolean;
    private _virtualStartTime: number;
    private _virtualPaused: boolean;
    private _virtualPauseCurrentTime: number;
    private _metadataLoaded: boolean;

    private readonly _bindedDispose: () => void;
    private readonly _disposeObservableObject: Nullable<IDisposeObservable>;

    /**
     * Create a stream audio player
     *
     * In general disposeObservable should be `Scene` of Babylon.js
     *
     * @param disposeObservable Objects that limit the lifetime of this instance
     * @param options Options
     */
    public constructor(disposeObservable: Nullable<IDisposeObservable>, options: StreamAudioPlayerOptions = {}) {
        const poolOption = options.pool ?? false;

        this.onLoadErrorObservable = new Observable<void>();
        this.onDurationChangedObservable = new Observable<void>();
        this.onPlaybackRateChangedObservable = new Observable<void>();
        this.onMuteStateChangedObservable = new Observable<void>();

        this.onPlayObservable = new Observable<void>();
        this.onPauseObservable = new Observable<void>();
        this.onSeekObservable = new Observable<void>();

        const pool = this._pool = typeof poolOption === "boolean"
            ? poolOption
                ? StreamAudioPlayer.DefaultAudioElementPool
                : null
            : poolOption;
        const audio = this._audio = pool !== null
            ? pool.rent()
            : new Audio();

        audio.loop = false;
        audio.autoplay = false;

        this._duration = 0;
        this._playbackRate = 1;

        this._isVirtualPlay = false;
        this._virtualStartTime = 0;
        this._virtualPaused = true;
        this._virtualPauseCurrentTime = 0;
        this._metadataLoaded = false;

        audio.ondurationchange = this._onDurationChanged;
        audio.onerror = this._onLoadError;
        audio.onplaying = this._onPlay;
        audio.onpause = this._onPause;
        audio.onseeked = this._onSeek;

        this._bindedDispose = this.dispose.bind(this);
        this._disposeObservableObject = disposeObservable;
        if (this._disposeObservableObject !== null) {
            this._disposeObservableObject.onDisposeObservable.add(this._bindedDispose);
        }
    }

    private readonly _onDurationChanged = (): void => {
        this._duration = this._audio!.duration;

        if (this._isVirtualPlay) {
            this._isVirtualPlay = false;
            this.onMuteStateChangedObservable.notifyObservers();
        }
        this._virtualPaused = true;
        this._virtualPauseCurrentTime = 0;
        this._metadataLoaded = true;

        this.onDurationChangedObservable.notifyObservers();
    };

    private readonly _onLoadError = (): void => {
        this._duration = 0;

        if (this._isVirtualPlay) {
            this._isVirtualPlay = false;
            this.onMuteStateChangedObservable.notifyObservers();
        }
        this._virtualPaused = true;
        this._virtualPauseCurrentTime = 0;
        this._metadataLoaded = false;

        this.onLoadErrorObservable.notifyObservers();
        this.onDurationChangedObservable.notifyObservers();
    };

    private readonly _onPlay = (): void => {
        if (!this._isVirtualPlay) {
            this._audio!.playbackRate = this._playbackRate;
        }
        this.onPlayObservable.notifyObservers();
    };

    private readonly _onPause = (): void => {
        if (!this._isVirtualPlay) {
            this.onPauseObservable.notifyObservers();
        } else {
            if (this._virtualPaused) {
                this.onPauseObservable.notifyObservers();
            }
        }
    };

    private _ignoreSeekedEventOnce = false;

    private readonly _onSeek = (): void => {
        if (this._ignoreSeekedEventOnce) {
            this._ignoreSeekedEventOnce = false;
            return;
        }
        this.onSeekObservable.notifyObservers();
    };

    /**
     * Audio duration (in seconds)
     */
    public get duration(): number {
        return this._duration;
    }

    /**
     * Current time (in seconds)
     *
     * This property may be slow to update
     */
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
            return this._audio?.currentTime ?? 0;
        }
    }

    public set currentTime(value: number) {
        if (this._isVirtualPlay) {
            if (this._virtualPaused) {
                this._virtualPauseCurrentTime = value;
            } else {
                this._virtualStartTime = performance.now() / 1000 - value / this._playbackRate;
            }
            this._onSeek();
        } else {
            if (this._audio !== null) {
                this._audio.currentTime = value;
            }
        }
    }

    /** @internal */
    public _setCurrentTimeWithoutNotify(value: number): void {
        if (this._isVirtualPlay) {
            if (this._virtualPaused) {
                this._virtualPauseCurrentTime = value;
            } else {
                this._virtualStartTime = performance.now() / 1000 - value / this._playbackRate;
            }
        } else {
            this._ignoreSeekedEventOnce = true;
            if (this._audio !== null) {
                this._audio.currentTime = value;
            }
        }
    }

    /**
     * Volume (0.0 to 1.0)
     */
    public get volume(): number {
        return this._audio?.volume ?? 0;
    }

    public set volume(value: number) {
        if (this._audio !== null) {
            this._audio.volume = value;
        }
    }

    /**
     * Whether the audio is muted
     */
    public get muted(): boolean {
        return this._isVirtualPlay;
    }

    /**
     * Mute the audio
     */
    public mute(): void {
        if (this._audio === null) return;
        if (this._isVirtualPlay) return;

        this._isVirtualPlay = true;
        this._virtualStartTime = performance.now() / 1000 - this._audio.currentTime / this._playbackRate;
        this._virtualPaused = this._audio.paused;
        this._virtualPauseCurrentTime = this._audio.currentTime;
        this._audio.pause();

        this.onMuteStateChangedObservable.notifyObservers();
    }

    /**
     * Unmute the audio
     *
     * Unmute is possible failed if user interaction is not performed
     * @returns Whether the audio is unmuted
     */
    public async unmute(): Promise<boolean> {
        if (this._audio === null) return false;
        if (!this._isVirtualPlay) return true;

        let notAllowedError = false;

        this._ignoreSeekedEventOnce = true;
        if (this._virtualPaused) {
            this._audio.currentTime = this._virtualPauseCurrentTime;
        } else {
            this._audio.currentTime = (performance.now() / 1000 - this._virtualStartTime) * this._playbackRate;

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

            this.onMuteStateChangedObservable.notifyObservers();
            return true;
        }

        return false;
    }

    /**
     * Playback rate (0.07 to 16.0)
     */
    public get playbackRate(): number {
        return this._playbackRate;
    }

    public set playbackRate(value: number) {
        this._setPlaybackRateWithoutNotify(value);
        this.onPlaybackRateChangedObservable.notifyObservers();
    }

    /** @internal */
    public _setPlaybackRateWithoutNotify(value: number): void {
        if (this._isVirtualPlay && !this._virtualPaused) {
            const nowInSec = performance.now() / 1000;
            const currentTime = (nowInSec - this._virtualStartTime) * this._playbackRate;
            this._virtualStartTime = nowInSec - currentTime / value;
        }

        this._playbackRate = value;
        if (this._audio !== null) {
            this._audio.playbackRate = value;
        }
    }

    /**
     * Determines whether or not the browser should adjust the pitch of the audio to compensate for changes to the playback rate made by setting
     */
    public get preservesPitch(): boolean {
        return this._audio?.preservesPitch ?? true;
    }

    public set preservesPitch(value: boolean) {
        if (this._audio !== null) {
            this._audio.preservesPitch = value;
        }
    }

    /**
     * Whether the player is paused
     */
    public get paused(): boolean {
        if (this._isVirtualPlay) {
            return this._virtualPaused;
        } else {
            return this._audio?.paused ?? true;
        }
    }

    /**
     * Audio source URL
     */
    public get source(): string {
        return this._audio?.src ?? "";
    }

    public set source(value: string) {
        if (this._audio === null) {
            return;
        }
        if (value === this._audio.src) return;

        this._audio.src = value;
        this._metadataLoaded = false;

        if (this._isVirtualPlay) {
            this._isVirtualPlay = false;
            this.onMuteStateChangedObservable.notifyObservers();
        }
        this._virtualPaused = true;
        this._virtualPauseCurrentTime = 0;

        this._audio.load();
    }

    /**
     * Whether the audio metadata(durations) is loaded
     */
    public get metadataLoaded(): boolean {
        return this._metadataLoaded;
    }

    private async _virtualPlay(): Promise<void> {
        if (this._metadataLoaded) {
            if (this._virtualPaused) {
                this._virtualStartTime = performance.now() / 1000 - this._virtualPauseCurrentTime / this._playbackRate;
                this._virtualPaused = false;
            }
            if (!this._isVirtualPlay) {
                this._isVirtualPlay = true;
                this.onMuteStateChangedObservable.notifyObservers();
            }
            this._onPlay();
        } else {
            await new Promise<void>((resolve, reject) => {
                const onDurationChanged = (): void => {
                    if (this._virtualPaused) {
                        this._virtualStartTime = performance.now() / 1000 - this._virtualPauseCurrentTime / this._playbackRate;
                        this._virtualPaused = false;
                    }
                    if (!this._isVirtualPlay) {
                        this._isVirtualPlay = true;
                        this.onMuteStateChangedObservable.notifyObservers();
                    }
                    this._onPlay();
                    this.onLoadErrorObservable.removeCallback(onLoadError);
                    resolve();
                };

                const onLoadError = (): void => {
                    this.onDurationChangedObservable.removeCallback(onDurationChanged);

                    reject(new DOMException(
                        "The media resource indicated by the src attribute or assigned media provider object was not suitable.",
                        "NotSupportedError"
                    ));
                };

                this.onDurationChangedObservable.addOnce(onDurationChanged);
                this.onLoadErrorObservable.addOnce(onLoadError);
            });
        }
    }

    private _playRequestBlocking = false;

    /**
     * Play the audio from the current position
     *
     * If context don't have permission to play the audio, play audio in a mute state
     */
    public async play(): Promise<void> {
        if (this._isVirtualPlay && !this._virtualPaused) return;

        if (this._isVirtualPlay) {
            await this._virtualPlay();
            return;
        }

        if (this._playRequestBlocking) return;
        this._playRequestBlocking = true;

        try {
            await this._audio?.play();
        } catch (e) {
            if (e instanceof DOMException && e.name === "NotAllowedError") {
                await this._virtualPlay();
            } else {
                throw e;
            }
        } finally {
            this._playRequestBlocking = false;
        }
    }

    /**
     * Pause the audio
     */
    public pause(): void {
        if (this._isVirtualPlay) {
            if (this._virtualPaused) return;
            this._virtualPaused = true;

            this._virtualPauseCurrentTime = (performance.now() / 1000 - this._virtualStartTime) * this._playbackRate;
            this._onPause();
        } else {
            this._audio?.pause();
        }
    }

    /**
     * Dispose the player
     */
    public dispose(): void {
        if (this._audio === null) {
            return;
        }

        const audio = this._audio;
        audio.pause();
        audio.ondurationchange = null;
        audio.onerror = null;
        audio.onplaying = null;
        audio.onpause = null;
        audio.onseeked = null;
        audio.src = "";
        audio.load();
        if (this._pool !== null) {
            this._pool.return(audio);
        } else {
            this._audio.remove();
        }

        this.onLoadErrorObservable.clear();
        this.onDurationChangedObservable.clear();
        this.onPlaybackRateChangedObservable.clear();
        this.onMuteStateChangedObservable.clear();

        this.onPlayObservable.clear();
        this.onPauseObservable.clear();
        this.onSeekObservable.clear();

        if (this._disposeObservableObject !== null) {
            this._disposeObservableObject.onDisposeObservable.removeCallback(this._bindedDispose);
        }

        this._audio = null;
        (this as unknown as { _pool: Nullable<IAudioElementPool> })._pool = null;
    }
}
