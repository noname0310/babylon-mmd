import type { IFileRequest, ISceneLoaderProgressEvent, Scene, WebRequest } from "@babylonjs/core";
import { LoadFileError, Logger, Tools } from "@babylonjs/core";

import { MmdAnimation } from "../animation/MmdAnimation";
import { MmdBoneAnimationTrack, MmdCameraAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack } from "../animation/MmdAnimationTrack";
import { MmdDataDeserializer } from "../parser/MmdDataDeserializer";

export class BvmdLoader {
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

    public loadFromBuffer(
        name: string,
        buffer: ArrayBufferLike,
        onLoad: (animation: MmdAnimation) => void,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        onError?: (event: Error) => void
    ): void {
        this.loadFromBufferAsync(name, buffer, onProgress).then(onLoad).catch(onError);
    }

    public async loadFromBufferAsync(
        name: string,
        buffer: ArrayBufferLike,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<MmdAnimation> {
        const deserializer = new MmdDataDeserializer(buffer);
        deserializer.initializeTextDecoder("utf-8");

        const progressEvent = {
            lengthComputable: true,
            loaded: 0,
            total: deserializer.bytesAvailable
        };
        let time = performance.now();

        const signature = deserializer.getDecoderString(4, false);
        if (signature !== "BVMD") {
            throw new LoadFileError("BVMD signature is not valid.");
        }

        const version = [deserializer.getInt8(), deserializer.getInt8(), deserializer.getInt8()];
        if (version[0] !== 1 || version[1] !== 0 || version[2] !== 0) {
            throw new LoadFileError("BVMD version is not supported.");
        }

        const boneTrackCount = deserializer.getUint32();
        const boneTracks: MmdBoneAnimationTrack[] = new Array(boneTrackCount);
        for (let i = 0; i < boneTrackCount; ++i) {
            const trackName = deserializer.getDecoderString(deserializer.getUint32(), true);
            const frameCount = deserializer.getUint32();
            const track = boneTracks[i] = new MmdBoneAnimationTrack(trackName, frameCount);
            deserializer.getUint32Array(track.frameNumbers, track.frameNumbers.length);
            deserializer.getFloat32Array(track.rotations, track.rotations.length);
            deserializer.getUint8Array(track.rotationInterpolations, track.rotationInterpolations.length);

            if (100 < performance.now() - time) {
                progressEvent.loaded = progressEvent.total - deserializer.bytesAvailable;
                onProgress?.(progressEvent);

                await Tools.DelayAsync(0);
                time = performance.now();
            }
        }

        const moveableBoneTrackCount = deserializer.getUint32();
        const moveableBoneTracks: MmdMovableBoneAnimationTrack[] = new Array(moveableBoneTrackCount);
        for (let i = 0; i < moveableBoneTrackCount; ++i) {
            const trackName = deserializer.getDecoderString(deserializer.getUint32(), true);
            const frameCount = deserializer.getUint32();
            const track = moveableBoneTracks[i] = new MmdMovableBoneAnimationTrack(trackName, frameCount);
            deserializer.getUint32Array(track.frameNumbers, track.frameNumbers.length);
            deserializer.getFloat32Array(track.positions, track.positions.length);
            deserializer.getUint8Array(track.positionInterpolations, track.positionInterpolations.length);
            deserializer.getFloat32Array(track.rotations, track.rotations.length);
            deserializer.getUint8Array(track.rotationInterpolations, track.rotationInterpolations.length);

            if (100 < performance.now() - time) {
                progressEvent.loaded = progressEvent.total - deserializer.bytesAvailable;
                onProgress?.(progressEvent);

                await Tools.DelayAsync(0);
                time = performance.now();
            }
        }

        const morphTrackCount = deserializer.getUint32();
        const morphTracks: MmdMorphAnimationTrack[] = new Array(morphTrackCount);
        for (let i = 0; i < morphTrackCount; ++i) {
            const trackName = deserializer.getDecoderString(deserializer.getUint32(), true);
            const frameCount = deserializer.getUint32();
            const track = morphTracks[i] = new MmdMorphAnimationTrack(trackName, frameCount);
            deserializer.getUint32Array(track.frameNumbers, track.frameNumbers.length);
            deserializer.getFloat32Array(track.weights, track.weights.length);

            if (100 < performance.now() - time) {
                progressEvent.loaded = progressEvent.total - deserializer.bytesAvailable;
                onProgress?.(progressEvent);

                await Tools.DelayAsync(0);
                time = performance.now();
            }
        }

        const propertyFrameCount = deserializer.getUint32();
        const ikBoneNameCount = deserializer.getUint32();
        const propertyTrack = new MmdPropertyAnimationTrack(propertyFrameCount, ikBoneNameCount);
        deserializer.getUint32Array(propertyTrack.frameNumbers, propertyTrack.frameNumbers.length);
        deserializer.getUint8Array(propertyTrack.visibles, propertyTrack.visibles.length);
        for (let i = 0; i < ikBoneNameCount; ++i) {
            propertyTrack.ikBoneNames[i] = deserializer.getDecoderString(deserializer.getUint32(), true);
            deserializer.getUint8Array(propertyTrack.ikStates[i], propertyTrack.ikStates[i].length);
        }

        if (100 < performance.now() - time) {
            progressEvent.loaded = progressEvent.total - deserializer.bytesAvailable;
            onProgress?.(progressEvent);

            await Tools.DelayAsync(0);
            time = performance.now();
        }

        const cameraFrameCount = deserializer.getUint32();
        const cameraTrack = new MmdCameraAnimationTrack(cameraFrameCount);
        deserializer.getUint32Array(cameraTrack.frameNumbers, cameraTrack.frameNumbers.length);
        deserializer.getFloat32Array(cameraTrack.positions, cameraTrack.positions.length);
        deserializer.getUint8Array(cameraTrack.positionInterpolations, cameraTrack.positionInterpolations.length);
        deserializer.getFloat32Array(cameraTrack.rotations, cameraTrack.rotations.length);
        deserializer.getUint8Array(cameraTrack.rotationInterpolations, cameraTrack.rotationInterpolations.length);
        deserializer.getFloat32Array(cameraTrack.distances, cameraTrack.distances.length);
        deserializer.getUint8Array(cameraTrack.distanceInterpolations, cameraTrack.distanceInterpolations.length);
        deserializer.getFloat32Array(cameraTrack.fovs, cameraTrack.fovs.length);
        deserializer.getUint8Array(cameraTrack.fovInterpolations, cameraTrack.fovInterpolations.length);

        if (100 < performance.now() - time) {
            progressEvent.loaded = progressEvent.total - deserializer.bytesAvailable;
            onProgress?.(progressEvent);

            await Tools.DelayAsync(0);
            time = performance.now();
        }

        return new MmdAnimation(name, boneTracks, moveableBoneTracks, morphTracks, propertyTrack, cameraTrack);
    }

    public load(
        name: string,
        fileOrUrl: File | string,
        onLoad: (animation: MmdAnimation) => void,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        onError?: ((request?: WebRequest | undefined, exception?: Error | undefined) => void) | undefined
    ): IFileRequest {
        return this._scene._loadFile(
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
    }

    public loadAsync(
        name: string,
        fileOrUrl: File | string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<MmdAnimation> {
        return new Promise<MmdAnimation>((resolve, reject) => {
            this.load(name, fileOrUrl, resolve, onProgress, (request, exception) => reject({ request, exception }));
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
