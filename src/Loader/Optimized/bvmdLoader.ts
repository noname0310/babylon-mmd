import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { IFileRequest } from "@babylonjs/core/Misc/fileRequest";
import { LoadFileError } from "@babylonjs/core/Misc/fileTools";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { WebRequest } from "@babylonjs/core/Misc/webRequest";
import type { Scene } from "@babylonjs/core/scene";

import { MmdAnimation } from "../Animation/mmdAnimation";
import { MmdBoneAnimationTrack, MmdCameraAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack } from "../Animation/mmdAnimationTrack";
import { AlignedDataDeserializer } from "./alignedDataDeserializer";

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

    private readonly _v300Int = 3 << 16 | 0 << 8 | 0;

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
        const deserializer = new AlignedDataDeserializer(buffer);

        const signature = deserializer.getString(4);
        if (signature !== "BVMD") {
            throw new LoadFileError("BVMD signature is not valid.");
        }

        const version = [
            deserializer.getUint8(),
            deserializer.getUint8(),
            deserializer.getUint8()
        ] as const;
        const versionInt = version[0] << 16 | version[1] << 8 | version[2];
        if (versionInt < this._v300Int) {
            throw new LoadFileError(`BVMD version ${version[0]}.${version[1]}.${version[2]} is not supported.`);
        }

        const sizeOfHeader = deserializer.getUint32();
        let leftHeaderBytes = sizeOfHeader;

        let positionToBoneTrack = 0;
        if (4 <= leftHeaderBytes) {
            positionToBoneTrack = deserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToMovableBoneTrack = 0;
        if (4 <= leftHeaderBytes) {
            positionToMovableBoneTrack = deserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToMorphTrack = 0;
        if (4 <= leftHeaderBytes) {
            positionToMorphTrack = deserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToPropertyTrack = 0;
        if (4 <= leftHeaderBytes) {
            positionToPropertyTrack = deserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        let positionToCameraTrack = 0;
        if (4 <= leftHeaderBytes) {
            positionToCameraTrack = deserializer.getUint32();
            leftHeaderBytes -= 4;
        }

        if (leftHeaderBytes !== 0) {
            this.warn(`Left ${leftHeaderBytes} bytes in BVMD header, which is not used.`);
        }

        const boneTracks = positionToBoneTrack !== 0
            ? this._parseBoneTracks(deserializer, positionToBoneTrack)
            : [];
        const movableBoneTracks = positionToMovableBoneTrack !== 0
            ? this._parseMovableBoneTracks(deserializer, positionToMovableBoneTrack)
            : [];
        const morphTracks = positionToMorphTrack !== 0
            ? this._parseMorphTracks(deserializer, positionToMorphTrack)
            : [];
        const propertyTrack = positionToPropertyTrack !== 0
            ? this._parsePropertyTrack(deserializer, positionToPropertyTrack)
            : new MmdPropertyAnimationTrack(0, []);
        const cameraTrack = positionToCameraTrack !== 0
            ? this._parseCameraTrack(deserializer, positionToCameraTrack)
            : new MmdCameraAnimationTrack(0);

        return new MmdAnimation(name, boneTracks, movableBoneTracks, morphTracks, propertyTrack, cameraTrack);
    }

    private _parseBoneTracks(deserializer: AlignedDataDeserializer, positionToBoneTrack: number): MmdBoneAnimationTrack[] {
        deserializer.offset = positionToBoneTrack;
        const buffer = deserializer.arrayBuffer;
        const boneTrackCount = deserializer.getUint32();
        const boneTracks: MmdBoneAnimationTrack[] = new Array(boneTrackCount);
        for (let i = 0; i < boneTrackCount; ++i) {
            const trackName = deserializer.getString(deserializer.getUint32());
            const frameCount = deserializer.getUint32();
            const frameNumberByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4; // uint32
            const rotationByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4 * 4; // float32 * 4
            const rotationInterpolationByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4; // uint8 * 4
            const physicsToggleByteOffset = deserializer.offset;
            deserializer.offset += frameCount; // uint8
            deserializer.offset += AlignedDataDeserializer.Padding(deserializer.offset);

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

        return boneTracks;
    }

    private _parseMovableBoneTracks(deserializer: AlignedDataDeserializer, positionToMovableBoneTrack: number): MmdMovableBoneAnimationTrack[] {
        deserializer.offset = positionToMovableBoneTrack;
        const buffer = deserializer.arrayBuffer;
        const movableBoneTrackCount = deserializer.getUint32();
        const movableBoneTracks: MmdMovableBoneAnimationTrack[] = new Array(movableBoneTrackCount);
        for (let i = 0; i < movableBoneTrackCount; ++i) {
            const trackName = deserializer.getString(deserializer.getUint32());
            const frameCount = deserializer.getUint32();
            const frameNumberByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4; // uint32
            const positionByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4 * 3; // float32 * 3
            const positionInterpolationByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 12; // uint8 * 12
            const rotationByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4 * 4; // float32 * 4
            const rotationInterpolationByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4; // uint8 * 4
            const physicsToggleByteOffset = deserializer.offset;
            deserializer.offset += frameCount; // uint8
            deserializer.offset += AlignedDataDeserializer.Padding(deserializer.offset);

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

        return movableBoneTracks;
    }

    private _parseMorphTracks(deserializer: AlignedDataDeserializer, positionToMorphTrack: number): MmdMorphAnimationTrack[] {
        deserializer.offset = positionToMorphTrack;
        const buffer = deserializer.arrayBuffer;
        const morphTrackCount = deserializer.getUint32();
        const morphTracks: MmdMorphAnimationTrack[] = new Array(morphTrackCount);
        for (let i = 0; i < morphTrackCount; ++i) {
            const trackName = deserializer.getString(deserializer.getUint32());
            const frameCount = deserializer.getUint32();
            const frameNumberByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4; // uint32
            const weightByteOffset = deserializer.offset;
            deserializer.offset += frameCount * 4; // float32

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

        return morphTracks;
    }

    private _parsePropertyTrack(deserializer: AlignedDataDeserializer, positionToPropertyTrack: number): MmdPropertyAnimationTrack {
        deserializer.offset = positionToPropertyTrack;
        const buffer = deserializer.arrayBuffer;
        const propertyFrameCount = deserializer.getUint32();
        const propertyFrameNumberByteOffset = deserializer.offset;
        deserializer.offset += propertyFrameCount * 4; // uint32
        const propertyVisibleByteOffset = deserializer.offset;
        deserializer.offset += propertyFrameCount; // uint8
        deserializer.offset += AlignedDataDeserializer.Padding(deserializer.offset);

        const ikBoneNameCount = deserializer.getUint32();
        const propertyIkBoneNames: string[] = new Array(ikBoneNameCount);
        const propertyIkStateByteOffsets: number[] = new Array(ikBoneNameCount);
        for (let i = 0; i < ikBoneNameCount; ++i) {
            propertyIkBoneNames[i] = deserializer.getString(deserializer.getUint32());
            propertyIkStateByteOffsets[i] = deserializer.offset;
            deserializer.offset += propertyFrameCount; // uint8
            deserializer.offset += AlignedDataDeserializer.Padding(deserializer.offset);
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

        return propertyTrack;
    }

    private _parseCameraTrack(deserializer: AlignedDataDeserializer, positionToCameraTrack: number): MmdCameraAnimationTrack {
        deserializer.offset = positionToCameraTrack;
        const buffer = deserializer.arrayBuffer;
        const cameraFrameCount = deserializer.getUint32();
        const cameraFrameNumberByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 4; // uint32
        const cameraPositionByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 4 * 3; // float32 * 3
        const cameraPositionInterpolationByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 12; // uint8 * 12
        const cameraRotationByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 4 * 3; // float32 * 3
        const cameraRotationInterpolationByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 4; // uint8 * 4
        const cameraDistanceByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 4; // float32
        const cameraDistanceInterpolationByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 4; // uint8 * 4
        const cameraFovByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 4; // float32
        const cameraFovInterpolationByteOffset = deserializer.offset;
        deserializer.offset += cameraFrameCount * 4; // uint8 * 4

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

        return cameraTrack;
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
