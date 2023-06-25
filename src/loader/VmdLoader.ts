import type { IFileRequest, Scene, WebRequest } from "@babylonjs/core";
import { LoadFileError, Logger } from "@babylonjs/core";

import { MmdModelAnimation } from "./animation/MmdAnimation";
import { MmdBoneAnimationTrack, MmdCameraAnimationTrack, MmdMorphAnimationTrack, MmdPropertyAnimationTrack } from "./animation/MmdAnimationTrack";
import { VmdData, VmdObject } from "./parser/VmdObject";

export class VmdLoader {
    private readonly _scene: Scene;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    public constructor(scene: Scene) {
        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._scene = scene;
    }

    public loadFromVmdObject(
        name: string,
        vmdObject: VmdObject,
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ProgressEvent) => void
    ): void {
        const boneTracks: MmdBoneAnimationTrack[] = [];
        {
            const boneTrackIndexMap = new Map<string, number>();
            const boneTrackFrameCounts: number[] = [];
            const boneNames: string[] = [];

            const boneKeyFrames = vmdObject.boneKeyFrames;

            const boneKeyFrameCount = boneKeyFrames.length;
            for (let i = 0; i < boneKeyFrameCount; ++i) {
                const boneKeyFrame = boneKeyFrames.get(i);

                const boneName = boneKeyFrame.boneName;
                let boneTrackIndex = boneTrackIndexMap.get(boneName);
                if (boneTrackIndex === undefined) {
                    boneTrackIndex = boneTrackIndexMap.size;
                    boneTrackIndexMap.set(boneName, boneTrackIndex);

                    boneTrackFrameCounts.push(0);
                    boneNames.push(boneName);
                }

                boneTrackFrameCounts[boneTrackIndex] += 1;
            }

            for (let i = 0; i < boneTrackIndexMap.size; ++i) {
                boneTracks.push(new MmdBoneAnimationTrack(boneNames[i], boneTrackFrameCounts[i]));
            }
        }

        const morphTracks: MmdMorphAnimationTrack[] = [];
        {
            const morphTrackIndexMap = new Map<string, number>();
            const morphTrackFrameCounts: number[] = [];
            const morphNames: string[] = [];

            const morphKeyFrames = vmdObject.morphKeyFrames;

            const morphKeyFrameCount = morphKeyFrames.length;
            for (let i = 0; i < morphKeyFrameCount; ++i) {
                const morphKeyFrame = morphKeyFrames.get(i);

                const morphName = morphKeyFrame.morphName;
                let morphTrackIndex = morphTrackIndexMap.get(morphName);
                if (morphTrackIndex === undefined) {
                    morphTrackIndex = morphTrackIndexMap.size;
                    morphTrackIndexMap.set(morphName, morphTrackIndex);

                    morphTrackFrameCounts.push(0);
                    morphNames.push(morphName);
                }

                morphTrackFrameCounts[morphTrackIndex] += 1;
            }

            for (let i = 0; i < morphTrackIndexMap.size; ++i) {
                morphTracks.push(new MmdMorphAnimationTrack(morphNames[i], morphTrackFrameCounts[i]));
            }
        }

        const propertyKeyFrames = vmdObject.propertyKeyFrames;
        let maxIkStateCount = 0;
        for (let i = 0; i < propertyKeyFrames.length; ++i) {
            const propertyKeyFrame = propertyKeyFrames[i];
            maxIkStateCount = Math.max(maxIkStateCount, propertyKeyFrame.ikStates.length);
        }
        const propertyTrack = new MmdPropertyAnimationTrack("propertyTrack", vmdObject.propertyKeyFrames.length, maxIkStateCount);
        // {
        //     const propertyKeyFrames = vmdObject.propertyKeyFrames;

        //     const propertyKeyFrameCount = propertyKeyFrames.length;

        // }

        const cameraTrack = new MmdCameraAnimationTrack("cameraTrack", vmdObject.cameraKeyFrames.length);

        onProgress;

        if (0 < cameraTrack.frameNumbers.length) {
            onLoad(cameraTrack);
        } else {
            onLoad(new MmdModelAnimation(name, boneTracks, morphTracks, propertyTrack));
        }
    }

    public loadFromVmdObjectAsync(
        name: string,
        vmdObject: VmdObject,
        onProgress?: (event: ProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve) => {
            this.loadFromVmdObject(name, vmdObject, resolve, onProgress);
        });
    }

    public loadFromVmdData(
        name: string,
        vmdData: VmdData,
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ProgressEvent) => void
    ): void {
        this.loadFromVmdObject(name, VmdObject.Parse(vmdData), onLoad, onProgress);
    }

    public loadFromVmdDataAsync(
        name: string,
        vmdData: VmdData,
        onProgress?: (event: ProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve) => {
            this.loadFromVmdData(name, vmdData, resolve, onProgress);
        });
    }

    public loadFromBuffer(
        name: string,
        buffer: ArrayBufferLike,
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: Error) => void
    ): void {
        const vmdData = VmdData.CheckedCreate(buffer);
        if (vmdData === null) {
            onError?.(new Error("VMD data is invalid."));
            return;
        }
        this.loadFromVmdData(name, vmdData, onLoad, onProgress);
    }

    public loadFromBufferAsync(
        name: string,
        buffer: ArrayBufferLike,
        onProgress?: (event: ProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve, reject) => {
            this.loadFromBuffer(name, buffer, resolve, onProgress, reject);
        });
    }

    public load(
        name: string,
        fileOrUrl: File | string,
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: ((request?: WebRequest | undefined, exception?: Error | undefined) => void) | undefined
    ): IFileRequest {
        const request = this._scene._loadFile(
            fileOrUrl,
            (data: string | ArrayBuffer, _responseURL?: string) => {
                if (typeof data === "string") {
                    onError?.(undefined, new LoadFileError("VMD data must be binary."));
                } else {
                    this.loadFromBuffer(name, data, onLoad, onProgress, (event) => {
                        onError?.(undefined, event);
                    });
                }
            },
            onProgress,
            true,
            true,
            onError
        );
        return request;
    }

    public loadAsync(
        name: string,
        fileOrUrl: File | string,
        onProgress?: (event: ProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve, reject) => {
            this.load(name, fileOrUrl, resolve, onProgress, reject);
        });
    }

    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this._logEnabled;
            this.warn = this._warnEnabled;
            this.error = this._errorEnabled;
        } else {
            this.log = this._logDisabled;
            this.warn = this._warnDisabled;
            this.error = this._errorDisabled;
        }
    }

    private _logEnabled(message: string): void {
        Logger.Log(message);
    }

    private _logDisabled(): void {
        // do nothing
    }

    private _warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private _warnDisabled(): void {
        // do nothing
    }

    private _errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private _errorDisabled(): void {
        // do nothing
    }
}
