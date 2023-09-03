import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IAudioPlayer } from "../Audio/IAudioPlayer";
import type { MmdRuntime } from "../mmdRuntime";

/**
 * Display time format
 *
 * This enum is used for `MmdPlayerControl.displayTimeFormat`
 */
export enum DisplayTimeFormat {
    Seconds,
    Frames
}

/**
 * Mmd player control
 *
 * Create youtube-like player control for MMD
 *
 * It's just a GUI for debugging purposes, so it doesn't offer a lot of customization, and We don't plan to
 */
export class MmdPlayerControl {
    public autoHidePlayerControl: boolean;
    public hidePlayerControlTimeout: number;
    public displayTimeFormat: DisplayTimeFormat;

    private readonly _mmdRuntime: MmdRuntime;
    private readonly _audioPlayer: Nullable<IAudioPlayer>;

    private _newCanvasContainer: Nullable<HTMLElement>;
    private _playerContainer: HTMLElement;
    private _hidePlayerControlTimeoutId: number | undefined;
    private _playButton: HTMLButtonElement;
    private _timeSlider: HTMLInputElement;
    private _soundButton: Nullable<HTMLButtonElement>;
    private _volumeSlider: Nullable<HTMLInputElement>;
    private _currentFrameNumberSpan: HTMLSpanElement;
    private _endFrameNumberSpan: HTMLSpanElement;
    private _speedSlider: HTMLInputElement;
    private _fullscreenButton: HTMLButtonElement;

    private readonly _bindedDispose: () => void;
    private readonly _scene: Scene;

    /**
     * Create a MMD player control
     * @param scene Scene
     * @param mmdRuntime MMD runtime
     * @param audioPlayer Audio player
     * @throws {Error} if failed to get root element
     */
    public constructor(scene: Scene, mmdRuntime: MmdRuntime, audioPlayer?: IAudioPlayer) {
        const rootElement = scene.getEngine().getInputElement();
        if (rootElement === null) {
            throw new Error("Failed to get root element.");
        }

        this.autoHidePlayerControl = true;
        this.hidePlayerControlTimeout = 3000;
        this.displayTimeFormat = DisplayTimeFormat.Seconds;

        this._mmdRuntime = mmdRuntime;
        this._audioPlayer = audioPlayer ?? null;

        const parentControl = this._newCanvasContainer = this._createCanvasContainer(rootElement.parentElement!);
        this._playerContainer = null!;
        this._hidePlayerControlTimeoutId = undefined;
        this._playButton = null!;
        this._timeSlider = null!;
        this._soundButton = null;
        this._volumeSlider = null;
        this._currentFrameNumberSpan = null!;
        this._endFrameNumberSpan = null!;
        this._speedSlider = null!;
        this._fullscreenButton = null!;

        this._createPlayerControl(parentControl, mmdRuntime, audioPlayer);
        mmdRuntime.onPlayAnimationObservable.add(this._onAnimationPlay);
        mmdRuntime.onPauseAnimationObservable.add(this._onAnimationPause);
        mmdRuntime.onAnimationDurationChangedObservable.add(this._onAnimationDurationChanged);
        mmdRuntime.onAnimationTickObservable.add(this._onAnimationTick);
        audioPlayer?.onMuteStateChangedObservable.add(this._onMuteStateChanged);

        this._bindedDispose = this.dispose.bind(this);
        this._scene = scene;
        scene.onDisposeObservable.add(this._bindedDispose);
    }

    private _createCanvasContainer(parentControl: HTMLElement): HTMLElement {
        const newCanvasContainer = parentControl.ownerDocument.createElement("div");
        newCanvasContainer.style.display = parentControl.style.display;

        while (parentControl.childElementCount > 0) {
            const child = parentControl.childNodes[0];
            parentControl.removeChild(child);
            newCanvasContainer.appendChild(child);
        }

        parentControl.appendChild(newCanvasContainer);

        newCanvasContainer.style.width = "100%";
        newCanvasContainer.style.height = "100%";
        newCanvasContainer.style.overflow = "hidden";

        return newCanvasContainer;
    }

    private _restoreCanvasContainer(parentControl: HTMLElement): void {
        const newCanvasContainer = this._newCanvasContainer!;

        while (newCanvasContainer.childElementCount > 0) {
            const child = newCanvasContainer.childNodes[0];
            newCanvasContainer.removeChild(child);
            parentControl.appendChild(child);
        }

        parentControl.removeChild(newCanvasContainer);
    }

    private _createPlayerControl(parentControl: HTMLElement, mmdRuntime: MmdRuntime, audioPlayer?: IAudioPlayer): void {
        const ownerDocument = parentControl.ownerDocument;

        const playerContainer = this._playerContainer = ownerDocument.createElement("div");
        playerContainer.style.position = "relative";
        playerContainer.style.bottom = "120px";
        playerContainer.style.left = "0";
        playerContainer.style.width = "100%";
        playerContainer.style.height = "120px";
        playerContainer.style.transform = "translateY(50%)";
        playerContainer.style.transition = "transform 0.5s";
        parentControl.appendChild(playerContainer);
        playerContainer.onmouseenter = this._onPlayerControlMouseEnter;
        playerContainer.onmouseleave = this._onPlayerControlMouseLeave;
        {
            const playerInnerContainer = ownerDocument.createElement("div");
            playerInnerContainer.style.position = "absolute";
            playerInnerContainer.style.bottom = "0";
            playerInnerContainer.style.left = "0";
            playerInnerContainer.style.width = "100%";
            playerInnerContainer.style.height = "50%";
            playerInnerContainer.style.boxSizing = "border-box";
            playerInnerContainer.style.background = "linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.6))";
            playerInnerContainer.style.display = "flex";
            playerInnerContainer.style.flexDirection = "column";
            playerContainer.appendChild(playerInnerContainer);
            {
                const playerUpperContainer = ownerDocument.createElement("div");
                playerUpperContainer.style.width = "100%";
                playerUpperContainer.style.boxSizing = "border-box";
                playerUpperContainer.style.display = "flex";
                playerUpperContainer.style.flexDirection = "row";
                playerUpperContainer.style.alignItems = "center";
                playerInnerContainer.appendChild(playerUpperContainer);
                {
                    const timeSlider = this._timeSlider = ownerDocument.createElement("input");
                    timeSlider.style.width = "100%";
                    timeSlider.style.height = "4px";
                    timeSlider.style.border = "none";
                    timeSlider.style.opacity = "0.5";
                    timeSlider.type = "range";
                    timeSlider.min = "0";
                    timeSlider.max = mmdRuntime.animationFrameTimeDuration.toString();
                    timeSlider.oninput = (e): void => {
                        e.preventDefault();
                        mmdRuntime.seekAnimation(Number(timeSlider.value), true);
                    };
                    {
                        let isPlaySeeking = false;
                        timeSlider.onmousedown = (): void => {
                            if (mmdRuntime.isAnimationPlaying) {
                                mmdRuntime.pauseAnimation();
                                isPlaySeeking = true;
                            }
                        };
                        timeSlider.onmouseup = (): void => {
                            if (isPlaySeeking) {
                                mmdRuntime.playAnimation();
                                isPlaySeeking = false;
                            }
                        };
                    }
                    playerUpperContainer.appendChild(timeSlider);
                }

                const playerLowerContainer = ownerDocument.createElement("div");
                playerLowerContainer.style.width = "100%";
                playerLowerContainer.style.flexGrow = "1";
                playerLowerContainer.style.padding = "0 5px";
                playerLowerContainer.style.boxSizing = "border-box";
                playerLowerContainer.style.display = "flex";
                playerLowerContainer.style.flexDirection = "row";
                playerLowerContainer.style.alignItems = "space-between";
                playerInnerContainer.appendChild(playerLowerContainer);
                {
                    const playerLowerLeftContainer = ownerDocument.createElement("div");
                    playerLowerLeftContainer.style.flex = "1";
                    playerLowerLeftContainer.style.display = "flex";
                    playerLowerLeftContainer.style.flexDirection = "row";
                    playerLowerLeftContainer.style.alignItems = "center";
                    playerLowerContainer.appendChild(playerLowerLeftContainer);
                    {
                        const playButton = this._playButton = ownerDocument.createElement("button");
                        playButton.style.width = "40px";
                        playButton.style.border = "none";
                        playButton.style.backgroundColor = "rgba(0, 0, 0, 0)";
                        playButton.style.color = "white";
                        playButton.style.fontSize = "18px";
                        playButton.innerText = mmdRuntime.isAnimationPlaying ? "❚❚" : "▶";
                        playButton.onclick = (): void => {
                            if (mmdRuntime.isAnimationPlaying) mmdRuntime.pauseAnimation();
                            else mmdRuntime.playAnimation();
                        };
                        playerLowerLeftContainer.appendChild(playButton);

                        if (audioPlayer !== undefined) {
                            const soundButton = this._soundButton = ownerDocument.createElement("button");
                            soundButton.style.width = "35px";
                            soundButton.style.border = "none";
                            soundButton.style.backgroundColor = "rgba(0, 0, 0, 0)";
                            soundButton.style.color = "white";
                            soundButton.style.fontSize = "20px";
                            soundButton.innerText = audioPlayer.muted ? "🔇" : "🔊";
                            soundButton.onclick = (): void => {
                                if (audioPlayer.muted) {
                                    audioPlayer.unmute();
                                } else {
                                    audioPlayer.mute();
                                }
                            };
                            playerLowerLeftContainer.appendChild(soundButton);

                            const volumeSlider = this._volumeSlider = ownerDocument.createElement("input");
                            volumeSlider.style.width = "80px";
                            volumeSlider.style.height = "4px";
                            volumeSlider.style.border = "none";
                            volumeSlider.style.opacity = "0.5";
                            volumeSlider.type = "range";
                            volumeSlider.min = "0";
                            volumeSlider.max = "1";
                            volumeSlider.step = "0.01";
                            volumeSlider.value = audioPlayer.volume.toString();
                            volumeSlider.oninput = (): void => {
                                audioPlayer.volume = Number(volumeSlider.value);
                            };
                            playerLowerLeftContainer.appendChild(volumeSlider);
                        }

                        const curentFrameNumber = this._currentFrameNumberSpan = ownerDocument.createElement("span");
                        curentFrameNumber.style.width = "40px";
                        curentFrameNumber.style.textAlign = "right";
                        curentFrameNumber.style.color = "white";
                        curentFrameNumber.innerText = this.displayTimeFormat === DisplayTimeFormat.Seconds
                            ? this._getFormattedTime(mmdRuntime.currentTime)
                            : Math.floor(mmdRuntime.currentFrameTime).toString();
                        playerLowerLeftContainer.appendChild(curentFrameNumber);

                        const endFrameNumber = this._endFrameNumberSpan = ownerDocument.createElement("span");
                        endFrameNumber.style.width = "50px";
                        endFrameNumber.style.textAlign = "left";
                        endFrameNumber.style.color = "white";
                        endFrameNumber.innerHTML = "&nbsp;/&nbsp;" +
                            (this.displayTimeFormat === DisplayTimeFormat.Seconds
                                ? this._getFormattedTime(mmdRuntime.animationDuration)
                                : mmdRuntime.animationFrameTimeDuration.toString());
                        playerLowerLeftContainer.appendChild(endFrameNumber);
                    }

                    const playerLowerRightContainer = ownerDocument.createElement("div");
                    playerLowerRightContainer.style.flex = "1";
                    playerLowerRightContainer.style.display = "flex";
                    playerLowerRightContainer.style.flexDirection = "row";
                    playerLowerRightContainer.style.alignItems = "center";
                    playerLowerRightContainer.style.justifyContent = "flex-end";
                    playerLowerContainer.appendChild(playerLowerRightContainer);
                    {
                        const speedLabel = ownerDocument.createElement("label");
                        speedLabel.style.width = "40px";
                        speedLabel.style.textAlign = "center";
                        speedLabel.style.color = "white";
                        speedLabel.innerText = "1.00x";
                        playerLowerRightContainer.appendChild(speedLabel);

                        const speedSlider = this._speedSlider = ownerDocument.createElement("input");
                        speedSlider.style.width = "80px";
                        speedSlider.style.height = "4px";
                        speedSlider.style.border = "none";
                        speedSlider.style.opacity = "0.5";
                        speedSlider.type = "range";
                        speedSlider.min = "0.07";
                        speedSlider.max = "1";
                        speedSlider.step = "0.01";
                        speedSlider.value = mmdRuntime.timeScale.toString();
                        speedSlider.oninput = (): void => {
                            mmdRuntime.timeScale = Number(speedSlider.value);
                            speedLabel.innerText = mmdRuntime.timeScale.toFixed(2) + "x";
                        };
                        playerLowerRightContainer.appendChild(speedSlider);

                        const fullscreenButton = this._fullscreenButton = ownerDocument.createElement("button");
                        fullscreenButton.style.width = "40px";
                        fullscreenButton.style.border = "none";
                        fullscreenButton.style.color = "white";
                        fullscreenButton.style.backgroundColor = "rgba(0, 0, 0, 0)";
                        fullscreenButton.style.fontSize = "20px";
                        fullscreenButton.innerText = "🗖";
                        fullscreenButton.onclick = (): void => {
                            if (ownerDocument.fullscreenElement) ownerDocument.exitFullscreen();
                            else parentControl.requestFullscreen();
                        };
                        playerLowerRightContainer.appendChild(fullscreenButton);
                    }
                }
            }
        }
    }

    private readonly _onPlayerControlMouseEnter = (): void => {
        if (!this.autoHidePlayerControl) return;

        window.clearTimeout(this._hidePlayerControlTimeoutId);
        this._hidePlayerControlTimeoutId = undefined;
        this.showPlayerControl();
    };

    private readonly _onPlayerControlMouseLeave = (): void => {
        if (!this.autoHidePlayerControl) return;

        this._hidePlayerControlTimeoutId = window.setTimeout(
            this.hidePlayerControl.bind(this),
            this.hidePlayerControlTimeout
        );
    };

    private readonly _onAnimationPlay = (): void => {
        this._playButton.innerText = "❚❚";
    };

    private readonly _onAnimationPause = (): void => {
        this._playButton.innerText = "▶";
    };

    private readonly _onAnimationDurationChanged = (): void => {
        const mmdRuntime = this._mmdRuntime;
        this._timeSlider.max = mmdRuntime.animationFrameTimeDuration.toString();
        this._endFrameNumberSpan.innerHTML = "&nbsp;/&nbsp;" +
            (this.displayTimeFormat === DisplayTimeFormat.Seconds
                ? this._getFormattedTime(mmdRuntime.animationDuration)
                : mmdRuntime.animationFrameTimeDuration.toString());
    };

    private readonly _onAnimationTick = (): void => {
        const mmdRuntime = this._mmdRuntime;
        this._timeSlider.value = mmdRuntime.currentFrameTime.toString();
        this._currentFrameNumberSpan.innerText = this.displayTimeFormat === DisplayTimeFormat.Seconds
            ? this._getFormattedTime(mmdRuntime.currentTime)
            : Math.floor(mmdRuntime.currentFrameTime).toString();
    };

    private readonly _onMuteStateChanged = (): void => {
        if (this._soundButton === null) return;

        this._soundButton.innerText = this._audioPlayer!.muted ? "🔇" : "🔊";
    };

    private _formattedTimeCacheKey: number = NaN;
    private _formatterTimeCacheValue: string = "";

    private _getFormattedTime(time: number): string { // 00:00 or 0:00
        const floorTime = Math.floor(time);
        if (floorTime === this._formattedTimeCacheKey) return this._formatterTimeCacheValue;

        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const formattedTime = minutes.toString() + ":" + (seconds < 10 ? "0" : "") + seconds.toString();

        this._formattedTimeCacheKey = floorTime;
        this._formatterTimeCacheValue = formattedTime;

        return formattedTime;
    }

    /**
     * Hide player control
     */
    public hidePlayerControl(): void {
        this._playerContainer.style.transform = "translateY(50%)";
        this._hidePlayerControlTimeoutId = undefined;
    }

    /**
     * Show player control
     */
    public showPlayerControl(): void {
        this._playerContainer.style.transform = "translateY(0)";
    }

    /**
     * Dispose this object
     */
    public dispose(): void {
        if (this._newCanvasContainer === null) return;
        this._restoreCanvasContainer(this._newCanvasContainer.parentElement!);
        this._newCanvasContainer = null;

        this._playButton.onclick = null;

        this._timeSlider.oninput = null;
        this._timeSlider.onmousedown = null;
        this._timeSlider.onmouseup = null;

        if (this._audioPlayer !== null) {
            this._soundButton!.onclick = null;
            this._volumeSlider!.oninput = null;
        }

        this._speedSlider.oninput = null;
        this._fullscreenButton.onclick = null;

        this._playerContainer.onmouseenter = null;
        this._playerContainer.onmouseleave = null;
        this._playerContainer.remove();

        this._mmdRuntime.onPlayAnimationObservable.removeCallback(this._onAnimationPlay);
        this._mmdRuntime.onPauseAnimationObservable.removeCallback(this._onAnimationPause);
        this._mmdRuntime.onAnimationDurationChangedObservable.removeCallback(this._onAnimationDurationChanged);
        this._mmdRuntime.onAnimationTickObservable.removeCallback(this._onAnimationTick);
        this._audioPlayer?.onMuteStateChangedObservable.removeCallback(this._onMuteStateChanged);

        this._scene.onDisposeObservable.removeCallback(this._bindedDispose);
    }
}
