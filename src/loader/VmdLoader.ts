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
        vmdObject: VmdObject | VmdObject[],
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ProgressEvent) => void
    ): void {
        if (!Array.isArray(vmdObject)) {
            vmdObject = [vmdObject];
        }

        const boneTracks: MmdBoneAnimationTrack[] = [];
        {
            const boneTrackIndexMap = new Map<string, number>();
            const boneTrackFrameCounts: number[] = [];
            const boneNames: string[] = [];

            const margedBoneKeyFrames: VmdObject.BoneKeyFrame[] = [];
            for (let i = 0; i < vmdObject.length; ++i) {
                const vmdObjectItem = vmdObject[i];
                const boneKeyFrames = vmdObjectItem.boneKeyFrames;

                const boneKeyFrameCount = boneKeyFrames.length;
                for (let i = 0; i < boneKeyFrameCount; ++i) {
                    margedBoneKeyFrames.push(boneKeyFrames.get(i));
                }
            }

            const margedBoneKeyFrameCount = margedBoneKeyFrames.length;
            for (let i = 0; i < margedBoneKeyFrameCount; ++i) {
                const boneKeyFrame = margedBoneKeyFrames[i];

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

            margedBoneKeyFrames.sort((a, b) => a.frameNumber - b.frameNumber);

            for (let i = 0; i < boneTrackIndexMap.size; ++i) {
                boneTracks.push(new MmdBoneAnimationTrack(boneNames[i], boneTrackFrameCounts[i]));
            }
        }

        const morphTracks: MmdMorphAnimationTrack[] = [];
        {
            const morphTrackIndexMap = new Map<string, number>();
            const morphTrackFrameCounts: number[] = [];
            const morphNames: string[] = [];

            const margedMorphKeyFrames: VmdObject.MorphKeyFrame[] = [];
            for (let i = 0; i < vmdObject.length; ++i) {
                const vmdObjectItem = vmdObject[i];
                const morphKeyFrames = vmdObjectItem.morphKeyFrames;

                const morphKeyFrameCount = morphKeyFrames.length;
                for (let i = 0; i < morphKeyFrameCount; ++i) {
                    margedMorphKeyFrames.push(morphKeyFrames.get(i));
                }
            }

            const margedMorphKeyFrameCount = margedMorphKeyFrames.length;
            for (let i = 0; i < margedMorphKeyFrameCount; ++i) {
                const morphKeyFrame = margedMorphKeyFrames[i];

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

            margedMorphKeyFrames.sort((a, b) => a.frameNumber - b.frameNumber);

            for (let i = 0; i < morphTrackIndexMap.size; ++i) {
                morphTracks.push(new MmdMorphAnimationTrack(morphNames[i], morphTrackFrameCounts[i]));
            }
        }

        const margedPropertyKeyFrames: VmdObject.PropertyKeyFrame[] = [];
        for (let i = 0; i < vmdObject.length; ++i) {
            const vmdObjectItem = vmdObject[i];
            const propertyKeyFrames = vmdObjectItem.propertyKeyFrames;
            for (let i = 0; i < propertyKeyFrames.length; ++i) {
                margedPropertyKeyFrames.push(propertyKeyFrames[i]);
            }
        }
        margedPropertyKeyFrames.sort((a, b) => a.frameNumber - b.frameNumber);
        const ikStates = new Set<string>();
        for (let i = 0; i < vmdObject.length; ++i) {
            const vmdObjectItem = vmdObject[i];
            const propertyKeyFrames = vmdObjectItem.propertyKeyFrames;
            for (let i = 0; i < propertyKeyFrames.length; ++i) {
                const propertyKeyFrame = propertyKeyFrames[i];
                for (let j = 0; j < propertyKeyFrame.ikStates.length; ++j) {
                    ikStates.add(propertyKeyFrame.ikStates[j][0]);
                }
            }
        }
        const propertyTrack = new MmdPropertyAnimationTrack("propertyTrack", margedPropertyKeyFrames.length, ikStates.size);
        // {
        //     const propertyKeyFrames = vmdObject.propertyKeyFrames;

        //     const propertyKeyFrameCount = propertyKeyFrames.length;
        // }

        const margedCameraKeyFrames: VmdObject.CameraKeyFrame[] = [];
        for (let i = 0; i < vmdObject.length; ++i) {
            const vmdObjectItem = vmdObject[i];
            const cameraKeyFrames = vmdObjectItem.cameraKeyFrames;
            for (let i = 0; i < cameraKeyFrames.length; ++i) {
                margedCameraKeyFrames.push(cameraKeyFrames.get(i));
            }
        }
        margedCameraKeyFrames.sort((a, b) => a.frameNumber - b.frameNumber);
        const cameraTrack = new MmdCameraAnimationTrack("cameraTrack", margedCameraKeyFrames.length);

        onProgress;

        if (0 < cameraTrack.frameNumbers.length) {
            if (boneTracks.length !== 0 || morphTracks.length !== 0 || propertyTrack.frameNumbers.length !== 0) {
                this.warn("animation contains both camera and model animation. model animation will be ignored.");
            }
            onLoad(cameraTrack);
        } else {
            onLoad(new MmdModelAnimation(name, boneTracks, morphTracks, propertyTrack));
        }
    }

    public loadFromVmdObjectAsync(
        name: string,
        vmdObject: VmdObject | VmdObject[],
        onProgress?: (event: ProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve) => {
            this.loadFromVmdObject(name, vmdObject, resolve, onProgress);
        });
    }

    public loadFromVmdData(
        name: string,
        vmdData: VmdData | VmdData[],
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ProgressEvent) => void
    ): void {
        if (!Array.isArray(vmdData)) {
            vmdData = [vmdData];
        }

        const vmdObjects: VmdObject[] = [];
        for (let i = 0; i < vmdData.length; ++i) {
            vmdObjects.push(VmdObject.Parse(vmdData[i]));
        }
        this.loadFromVmdObject(name, vmdObjects, onLoad, onProgress);
    }

    public loadFromVmdDataAsync(
        name: string,
        vmdData: VmdData | VmdData[],
        onProgress?: (event: ProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve) => {
            this.loadFromVmdData(name, vmdData, resolve, onProgress);
        });
    }

    public loadFromBuffer(
        name: string,
        buffer: ArrayBufferLike | ArrayBufferLike[],
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: Error) => void
    ): void {
        if (!Array.isArray(buffer)) {
            buffer = [buffer];
        }

        const vmdData: VmdData[] = [];
        for (let i = 0; i < buffer.length; ++i) {
            const vmdDatum = VmdData.CheckedCreate(buffer[i]);
            if (vmdDatum === null) {
                onError?.(new Error("VMD data validation failed."));
                return;
            }
            vmdData.push(vmdDatum);
        }
        this.loadFromVmdData(name, vmdData, onLoad, onProgress);
    }

    public loadFromBufferAsync(
        name: string,
        buffer: ArrayBufferLike | ArrayBufferLike[],
        onProgress?: (event: ProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve, reject) => {
            this.loadFromBuffer(name, buffer, resolve, onProgress, reject);
        });
    }

    public load(
        name: string,
        fileOrUrl: File | string | File[] | string[],
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: ((request?: WebRequest | undefined, exception?: Error | undefined) => void) | undefined
    ): typeof fileOrUrl extends any[] ? IFileRequest[] : IFileRequest {
        if (!Array.isArray(fileOrUrl)) {
            fileOrUrl = [fileOrUrl as any];
        }

        const scene = this._scene;
        const arrayBuffers: ArrayBuffer[] = [];
        const requests: IFileRequest[] = [];
        for (let i = 0; i < fileOrUrl.length; ++i) {
            const item = fileOrUrl[i];
            requests.push(scene._loadFile(
                item,
                (data: string | ArrayBuffer, _responseURL?: string) => {
                    if (typeof data === "string") {
                        onError?.(undefined, new LoadFileError("VMD data must be binary."));
                    } else {
                        arrayBuffers.push(data);
                        if (arrayBuffers.length === fileOrUrl.length) {
                            this.loadFromBuffer(name, arrayBuffers, onLoad, onProgress, (event) => {
                                onError?.(undefined, event);
                            });
                        }
                    }
                },
                onProgress,
                true,
                true,
                onError
            ));
        }

        return fileOrUrl.length === 1 ? requests[0] : requests as any;
    }

    public loadAsync(
        name: string,
        fileOrUrl: File | string | File[] | string[],
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
