import type { ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { IFileRequest } from "@babylonjs/core/Misc/fileRequest";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { WebRequest } from "@babylonjs/core/Misc/webRequest";
import type { Scene } from "@babylonjs/core/scene";

import { MmdAnimation } from "./Animation/mmdAnimation";
import { MmdBoneAnimationTrack, MmdCameraAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack } from "./Animation/mmdAnimationTrack";
import type { VpdObject } from "./Parser/vpdObject";
import { VpdReader } from "./Parser/vpdReader";

/**
 * VpdLoader is a loader that loads MMD pose data in VPD format
 *
 * VPD format is a binary format for MMD animation data
 */
export class VpdLoader {
    private readonly _scene: Scene;
    private readonly _textDecoder: TextDecoder;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    /**
     * Create a new VpdLoader
     * @param scene Scene for loading file
     */
    public constructor(scene: Scene) {
        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;

        this._scene = scene;
        this._textDecoder = new TextDecoder("shift_jis");
    }

    /**
     * Load MMD animation data from VPD object
     * @param name Animation name
     * @param vpdObject VPD object
     */
    public loadFromVpdObject(
        name: string,
        vpdObject: VpdObject
    ): MmdAnimation {
        const bones = vpdObject.bones;
        const boneNames = Object.keys(bones);
        let moveableBoneCount = 0;
        for (let i = 0; i < boneNames.length; i++) {
            if (bones[boneNames[i]].position !== undefined) {
                moveableBoneCount += 1;
            }
        }
        const boneTracks: MmdBoneAnimationTrack[] = new Array(boneNames.length - moveableBoneCount);
        const moveableBoneTracks: MmdMovableBoneAnimationTrack[] = new Array(moveableBoneCount);
        let boneTrackIndex = 0;
        let moveableBoneTrackIndex = 0;
        for (let i = 0; i < boneNames.length; i++) {
            const boneName = boneNames[i];
            const bone = bones[boneName];
            if (bone.position === undefined) {
                const boneTrack = boneTracks[boneTrackIndex] = new MmdBoneAnimationTrack(boneName, 1);
                boneTrack.rotations[0] = bone.rotation[0];
                boneTrack.rotations[1] = bone.rotation[1];
                boneTrack.rotations[2] = bone.rotation[2];
                boneTrack.rotations[3] = bone.rotation[3];
                boneTrackIndex += 1;
            } else {
                const moveableBoneTrack = moveableBoneTracks[moveableBoneTrackIndex] = new MmdMovableBoneAnimationTrack(boneName, 1);

                moveableBoneTrack.positions[0] = bone.position[0];
                moveableBoneTrack.positions[1] = bone.position[1];
                moveableBoneTrack.positions[2] = bone.position[2];

                moveableBoneTrack.rotations[0] = bone.rotation[0];
                moveableBoneTrack.rotations[1] = bone.rotation[1];
                moveableBoneTrack.rotations[2] = bone.rotation[2];
                moveableBoneTrack.rotations[3] = bone.rotation[3];
                moveableBoneTrackIndex += 1;
            }
        }

        const morphs = vpdObject.morphs;
        const morphNames = Object.keys(morphs);
        const morphTracks: MmdMorphAnimationTrack[] = new Array(morphNames.length);
        for (let i = 0; i < morphNames.length; i++) {
            const morphName = morphNames[i];
            const morphTrack = morphTracks[i] = new MmdMorphAnimationTrack(morphName, 1);
            morphTrack.weights[0] = morphs[morphName];
        }

        return new MmdAnimation(name, boneTracks, moveableBoneTracks, morphTracks, new MmdPropertyAnimationTrack(0, []), new MmdCameraAnimationTrack(0));
    }

    /**
     * Load MMD animation data from VPD array buffer
     * @param name Animation name
     * @param buffer VPD array buffer
     * @returns Animation data
     * @throws {LoadFileError} when validation fails
     */
    public loadFromBuffer(
        name: string,
        buffer: ArrayBuffer
    ): MmdAnimation {
        const text = this._textDecoder.decode(buffer);
        const vpdObject = VpdReader.Parse(text, this);
        return this.loadFromVpdObject(name, vpdObject);
    }

    /**
     * Load MMD animation data from VPD file or URL
     * @param name Animation name
     * @param fileOrUrl VPD file or URL
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
            (data: string | ArrayBuffer) => onLoad(this.loadFromBuffer(name, data as ArrayBuffer)),
            onProgress,
            true,
            true,
            onError
        );
    }

    /**
     * Load MMD animation data from VPD file or URL asynchronously
     * @param name Animation name
     * @param fileOrUrl VPD file or URL
     * @param onProgress Callback function that is called while loading
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
