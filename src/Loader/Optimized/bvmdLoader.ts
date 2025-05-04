import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { IFileRequest } from "@babylonjs/core/Misc/fileRequest";
import { LoadFileError } from "@babylonjs/core/Misc/fileTools";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { WebRequest } from "@babylonjs/core/Misc/webRequest";
import type { Scene } from "@babylonjs/core/scene";

import { MmdAnimation } from "../Animation/mmdAnimation";
import { MmdBoneAnimationTrack, MmdCameraAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack } from "../Animation/mmdAnimationTrack";
import { MmdDataDeserializer } from "../Parser/mmdDataDeserializer";

/**
 * BvmdLoader is a loader that loads MMD animation data in BVMD format
 *
 * BVMD format is a optimized binary format for MMD animation data
 */
export class BvmdLoader {
    private readonly _scene: Scene;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    /**
     * Create a new BvmdLoader
     * @param scene Scene for loading file
     */
    public constructor(scene: Scene) {
        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._scene = scene;
    }

    private readonly _v200Int = 2 << 16 | 0 << 8 | 0;
    private readonly _v210Int = 2 << 16 | 1 << 8 | 0;

    /**
     * Load MMD animation data from BVMD array buffer
     * @param name Animation name
     * @param buffer BVMD array buffer
     * @returns Animation data
     * @throws {LoadFileError} when validation fails
     */
    public loadFromBuffer(
        name: string,
        buffer: ArrayBufferLike
    ): MmdAnimation {
        const deserializer = new MmdDataDeserializer(buffer);
        deserializer.initializeTextDecoder("utf-8");

        const signature = deserializer.getDecoderString(4, false);
        if (signature !== "BVMD") {
            throw new LoadFileError("BVMD signature is not valid.");
        }

        const version = [
            deserializer.getInt8(),
            deserializer.getInt8(),
            deserializer.getInt8()
        ] as const;
        const versionInt = version[0] << 16 | version[1] << 8 | version[2];
        if (versionInt < this._v200Int || this._v210Int < versionInt) {
            throw new LoadFileError(`BVMD version ${version[0]}.${version[1]}.${version[2]} is not supported.`);
        }

        const boneTrackCount = deserializer.getUint32();
        const boneTracks: MmdBoneAnimationTrack[] = new Array(boneTrackCount);
        for (let i = 0; i < boneTrackCount; ++i) {
            const trackName = deserializer.getDecoderString(deserializer.getUint32(), true);
            const frameCount = deserializer.getUint32();
            const frameNumberByteOffset = deserializer.getPaddedArrayOffset(4, frameCount);
            const rotationByteOffset = deserializer.getPaddedArrayOffset(4, frameCount * 4);
            const rotationInterpolationByteOffset = deserializer.getPaddedArrayOffset(1, frameCount * 4);
            const physicsToggleByteOffset = this._v210Int <= versionInt
                ? deserializer.getPaddedArrayOffset(1, frameCount)
                : undefined;

            const boneTrack = boneTracks[i] = new MmdBoneAnimationTrack(
                trackName,
                frameCount,
                buffer,
                frameNumberByteOffset,
                rotationByteOffset,
                rotationInterpolationByteOffset,
                physicsToggleByteOffset
            );
            if (!deserializer.isDeviceLittleEndian) {
                deserializer.swap32Array(boneTrack.frameNumbers);
                deserializer.swap32Array(boneTrack.rotations);
            }
        }

        const movableBoneTrackCount = deserializer.getUint32();
        const movableBoneTracks: MmdMovableBoneAnimationTrack[] = new Array(movableBoneTrackCount);
        for (let i = 0; i < movableBoneTrackCount; ++i) {
            const trackName = deserializer.getDecoderString(deserializer.getUint32(), true);
            const frameCount = deserializer.getUint32();
            const frameNumberByteOffset = deserializer.getPaddedArrayOffset(4, frameCount);
            const positionByteOffset = deserializer.getPaddedArrayOffset(4, frameCount * 3);
            const positionInterpolationByteOffset = deserializer.getPaddedArrayOffset(1, frameCount * 12);
            const rotationByteOffset = deserializer.getPaddedArrayOffset(4, frameCount * 4);
            const rotationInterpolationByteOffset = deserializer.getPaddedArrayOffset(1, frameCount * 4);
            const physicsToggleByteOffset = this._v210Int <= versionInt
                ? deserializer.getPaddedArrayOffset(1, frameCount)
                : undefined;

            const movableBoneTrack = movableBoneTracks[i] = new MmdMovableBoneAnimationTrack(
                trackName,
                frameCount,
                buffer,
                frameNumberByteOffset,
                positionByteOffset,
                positionInterpolationByteOffset,
                rotationByteOffset,
                rotationInterpolationByteOffset,
                physicsToggleByteOffset
            );
            if (!deserializer.isDeviceLittleEndian) {
                deserializer.swap32Array(movableBoneTrack.frameNumbers);
                deserializer.swap32Array(movableBoneTrack.positions);
                deserializer.swap32Array(movableBoneTrack.rotations);
            }
        }

        const morphTrackCount = deserializer.getUint32();
        const morphTracks: MmdMorphAnimationTrack[] = new Array(morphTrackCount);
        for (let i = 0; i < morphTrackCount; ++i) {
            const trackName = deserializer.getDecoderString(deserializer.getUint32(), true);
            const frameCount = deserializer.getUint32();
            const frameNumberByteOffset = deserializer.getPaddedArrayOffset(4, frameCount);
            const weightByteOffset = deserializer.getPaddedArrayOffset(4, frameCount);

            const morphTrack = morphTracks[i] = new MmdMorphAnimationTrack(
                trackName,
                frameCount,
                buffer,
                frameNumberByteOffset,
                weightByteOffset
            );
            if (!deserializer.isDeviceLittleEndian) {
                deserializer.swap32Array(morphTrack.frameNumbers);
                deserializer.swap32Array(morphTrack.weights);
            }
        }

        const propertyFrameCount = deserializer.getUint32();
        const ikBoneNameCount = deserializer.getUint32();
        const propertyFrameNumberByteOffset = deserializer.getPaddedArrayOffset(4, propertyFrameCount);
        const propertyVisibleByteOffset = deserializer.getPaddedArrayOffset(1, propertyFrameCount);

        const propertyIkBoneNames: string[] = new Array(ikBoneNameCount);
        const propertyIkStateByteOffsets: number[] = new Array(ikBoneNameCount);
        for (let i = 0; i < ikBoneNameCount; ++i) {
            propertyIkBoneNames[i] = deserializer.getDecoderString(deserializer.getUint32(), true);
            propertyIkStateByteOffsets[i] = deserializer.getPaddedArrayOffset(1, propertyFrameCount);
        }

        const propertyTrack = new MmdPropertyAnimationTrack(
            propertyFrameCount,
            propertyIkBoneNames,
            buffer,
            propertyFrameNumberByteOffset,
            propertyVisibleByteOffset,
            propertyIkStateByteOffsets
        );
        if (!deserializer.isDeviceLittleEndian) {
            deserializer.swap32Array(propertyTrack.frameNumbers);
        }

        const cameraFrameCount = deserializer.getUint32();
        const cameraFrameNumberByteOffset = deserializer.getPaddedArrayOffset(4, cameraFrameCount);
        const cameraPositionByteOffset = deserializer.getPaddedArrayOffset(4, cameraFrameCount * 3);
        const cameraPositionInterpolationByteOffset = deserializer.getPaddedArrayOffset(1, cameraFrameCount * 12);
        const cameraRotationByteOffset = deserializer.getPaddedArrayOffset(4, cameraFrameCount * 3);
        const cameraRotationInterpolationByteOffset = deserializer.getPaddedArrayOffset(1, cameraFrameCount * 4);
        const cameraDistanceByteOffset = deserializer.getPaddedArrayOffset(4, cameraFrameCount);
        const cameraDistanceInterpolationByteOffset = deserializer.getPaddedArrayOffset(1, cameraFrameCount * 4);
        const cameraFovByteOffset = deserializer.getPaddedArrayOffset(4, cameraFrameCount);
        const cameraFovInterpolationByteOffset = deserializer.getPaddedArrayOffset(1, cameraFrameCount * 4);

        const cameraTrack = new MmdCameraAnimationTrack(
            cameraFrameCount,
            buffer,
            cameraFrameNumberByteOffset,
            cameraPositionByteOffset,
            cameraPositionInterpolationByteOffset,
            cameraRotationByteOffset,
            cameraRotationInterpolationByteOffset,
            cameraDistanceByteOffset,
            cameraDistanceInterpolationByteOffset,
            cameraFovByteOffset,
            cameraFovInterpolationByteOffset
        );
        if (!deserializer.isDeviceLittleEndian) {
            deserializer.swap32Array(cameraTrack.frameNumbers);
            deserializer.swap32Array(cameraTrack.positions);
            deserializer.swap32Array(cameraTrack.rotations);
            deserializer.swap32Array(cameraTrack.distances);
            deserializer.swap32Array(cameraTrack.fovs);
        }

        return new MmdAnimation(name, boneTracks, movableBoneTracks, morphTracks, propertyTrack, cameraTrack);
    }

    /**
     * Load MMD animation data from BVMD file or URL
     * @param name Animation name
     * @param fileOrUrl BVMD file or URL
     * @param onLoad Callback function that is called when load is complete
     * @param onProgress Callback function that is called while loading
     * @param onError Callback function that is called when loading is failed
     * @returns File request
     */
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
                try {
                    onLoad(this.loadFromBuffer(name, data as ArrayBuffer));
                } catch (e: any) {
                    onError?.(undefined, e);
                }
            },
            onProgress,
            true,
            true,
            onError
        );
    }

    /**
     * Load MMD animation data from BVMD file or URL asynchronously
     * @param name Animation name
     * @param fileOrUrl BVMD file or URL
     * @param onProgress Callback function that is called while loading
     * @returns Animation data
     */
    public loadAsync(
        name: string,
        fileOrUrl: File | string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<MmdAnimation> {
        return new Promise<MmdAnimation>((resolve, reject) => {
            this.load(name, fileOrUrl, resolve, onProgress, (request, exception) => reject({ request, exception }));
        });
    }

    /**
     * Enable or disable debug logging (default: false)
     */
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
