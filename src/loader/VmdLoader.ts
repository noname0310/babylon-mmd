import type { IFileRequest, ISceneLoaderProgressEvent, Scene, WebRequest } from "@babylonjs/core";
import { LoadFileError, Logger, Tools } from "@babylonjs/core";

import { MmdModelAnimation } from "./animation/MmdAnimation";
import type { MmdBoneAnimationTrack} from "./animation/MmdAnimationTrack";
import { MmdCameraAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack } from "./animation/MmdAnimationTrack";
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
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): void {
        this.loadFromVmdObjectAsync(name, vmdObject, onProgress).then(onLoad);
    }

    public async loadFromVmdObjectAsync(
        name: string,
        vmdObject: VmdObject | VmdObject[],
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        if (!Array.isArray(vmdObject)) {
            vmdObject = [vmdObject];
        }

        let boneLoadCost = 0;
        let morphLoadCost = 0;
        let propertyLoadCost = 0;
        let cameraLoadCost = 0;
        for (let i = 0; i < vmdObject.length; ++i) {
            const vmdObjectItem = vmdObject[i];
            boneLoadCost += vmdObjectItem.boneKeyFrames.length;
            morphLoadCost += vmdObjectItem.morphKeyFrames.length;
            propertyLoadCost += vmdObjectItem.propertyKeyFrames.length;
            cameraLoadCost += vmdObjectItem.cameraKeyFrames.length;
        }

        const progressEvent = {
            lengthComputable: true,
            loaded: 0,
            total: boneLoadCost + morphLoadCost + propertyLoadCost + cameraLoadCost
        };

        let lastStageLoaded = 0;

        let time = performance.now();

        const boneTracks: MmdMovableBoneAnimationTrack[] = [];
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

            if (100 < performance.now() - time) {
                await Tools.DelayAsync(0);
                time = performance.now();
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
                boneTracks.push(new MmdMovableBoneAnimationTrack(boneNames[i], boneTrackFrameCounts[i]));
            }

            if (100 < performance.now() - time) {
                await Tools.DelayAsync(0);
                time = performance.now();
            }

            const trackLengths = new Uint32Array(boneTrackIndexMap.size);
            for (let i = 0; i < margedBoneKeyFrameCount; ++i) {
                const boneKeyFrame = margedBoneKeyFrames[i];
                const trackIndex = boneTrackIndexMap.get(boneKeyFrame.boneName)!;
                const boneTrack = boneTracks[trackIndex];
                const insertIndex = trackLengths[trackIndex];

                const boneKeyFrameInterpolation = boneKeyFrame.interpolation;


                boneTrack.frameNumbers[insertIndex] = boneKeyFrame.frameNumber;


                const boneTrackPositions = boneTrack.positions;
                const boneKeyFramePosition = boneKeyFrame.position;
                boneTrackPositions[insertIndex * 3 + 0] = boneKeyFramePosition[0];
                boneTrackPositions[insertIndex * 3 + 1] = boneKeyFramePosition[1];
                boneTrackPositions[insertIndex * 3 + 2] = boneKeyFramePosition[2];

                //interpolation import references: https://github.com/AiMiDi/C4D_MMD_Tool/blob/main/source/Utility.h#L302-L318
                const boneTrackPositionInterpolations = boneTrack.positionInterpolations;
                boneTrackPositionInterpolations[insertIndex * 12 + 0] = boneKeyFrameInterpolation[0 * 16 + 0];// x_x1
                boneTrackPositionInterpolations[insertIndex * 12 + 1] = boneKeyFrameInterpolation[0 * 16 + 8];// x_x2
                boneTrackPositionInterpolations[insertIndex * 12 + 2] = boneKeyFrameInterpolation[0 * 16 + 4];// x_y1
                boneTrackPositionInterpolations[insertIndex * 12 + 3] = boneKeyFrameInterpolation[0 * 16 + 12];// x_y2

                boneTrackPositionInterpolations[insertIndex * 12 + 4] = boneKeyFrameInterpolation[1 * 16 + 0];// y_x1
                boneTrackPositionInterpolations[insertIndex * 12 + 5] = boneKeyFrameInterpolation[1 * 16 + 8];// y_x2
                boneTrackPositionInterpolations[insertIndex * 12 + 6] = boneKeyFrameInterpolation[1 * 16 + 4];// y_y1
                boneTrackPositionInterpolations[insertIndex * 12 + 7] = boneKeyFrameInterpolation[1 * 16 + 12];// y_y2

                boneTrackPositionInterpolations[insertIndex * 12 + 8] = boneKeyFrameInterpolation[2 * 16 + 0];// z_x1
                boneTrackPositionInterpolations[insertIndex * 12 + 9] = boneKeyFrameInterpolation[2 * 16 + 8];// z_x2
                boneTrackPositionInterpolations[insertIndex * 12 + 10] = boneKeyFrameInterpolation[2 * 16 + 4];// z_y1
                boneTrackPositionInterpolations[insertIndex * 12 + 11] = boneKeyFrameInterpolation[2 * 16 + 12];// z_y2


                const boneTrackRotations = boneTrack.rotations;
                const boneKeyFrameRotation = boneKeyFrame.rotation;
                boneTrackRotations[insertIndex * 4 + 0] = boneKeyFrameRotation[0];
                boneTrackRotations[insertIndex * 4 + 1] = boneKeyFrameRotation[1];
                boneTrackRotations[insertIndex * 4 + 2] = boneKeyFrameRotation[2];
                boneTrackRotations[insertIndex * 4 + 3] = boneKeyFrameRotation[3];

                const boneTrackRotationInterpolations = boneTrack.rotationInterpolations;
                boneTrackRotationInterpolations[insertIndex * 4 + 0] = boneKeyFrameInterpolation[3 * 16 + 0];// x1
                boneTrackRotationInterpolations[insertIndex * 4 + 1] = boneKeyFrameInterpolation[3 * 16 + 8];// x2
                boneTrackRotationInterpolations[insertIndex * 4 + 2] = boneKeyFrameInterpolation[3 * 16 + 4];// y1
                boneTrackRotationInterpolations[insertIndex * 4 + 3] = boneKeyFrameInterpolation[3 * 16 + 12];// y2


                trackLengths[trackIndex] += 1;


                if (i % 1000 < performance.now() - time) {
                    progressEvent.loaded = lastStageLoaded + i;
                    onProgress?.({ ...progressEvent });

                    await Tools.DelayAsync(0);
                    time = performance.now();
                }
            }
        }
        const filteredBoneTracks: MmdBoneAnimationTrack[] = [];
        const filteredMoveableBoneTracks: MmdMovableBoneAnimationTrack[] = [];
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            if (boneTrack.frameNumbers.length === 1 &&
                boneTrack.positions[0] === 0 &&
                boneTrack.positions[1] === 0 &&
                boneTrack.positions[2] === 0 &&
                boneTrack.rotations[0] === 0 &&
                boneTrack.rotations[1] === 0 &&
                boneTrack.rotations[2] === 0 &&
                boneTrack.rotations[3] === 1
            ) {
                continue;
            }

            let isMoveableBone = false;
            for (let j = 0; j < boneTrack.positions.length; ++j) {
                if (boneTrack.positions[j] !== 0) {
                    isMoveableBone = true;
                    break;
                }
            }
            if (isMoveableBone) {
                filteredMoveableBoneTracks.push(boneTrack);
            } else {
                filteredBoneTracks.push(boneTrack);
            }
        }

        progressEvent.loaded = lastStageLoaded + boneLoadCost;
        onProgress?.({ ...progressEvent });
        lastStageLoaded += boneLoadCost;

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

            if (100 < performance.now() - time) {
                await Tools.DelayAsync(0);
                time = performance.now();
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

            if (100 < performance.now() - time) {
                await Tools.DelayAsync(0);
                time = performance.now();
            }

            const trackLengths = new Uint32Array(morphTrackIndexMap.size);
            for (let i = 0; i < margedMorphKeyFrameCount; ++i) {
                const morphKeyFrame = margedMorphKeyFrames[i];
                const trackIndex = morphTrackIndexMap.get(morphKeyFrame.morphName)!;
                const morphTrack = morphTracks[trackIndex];
                const insertIndex = trackLengths[trackIndex];

                morphTrack.frameNumbers[insertIndex] = morphKeyFrame.frameNumber;
                morphTrack.weights[insertIndex] = morphKeyFrame.weight;

                trackLengths[trackIndex] += 1;

                if (i % 1000 < performance.now() - time) {
                    progressEvent.loaded = lastStageLoaded + i;
                    onProgress?.({ ...progressEvent });

                    await Tools.DelayAsync(0);
                    time = performance.now();
                }
            }
        }
        const filteredMorphTracks: MmdMorphAnimationTrack[] = [];
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            let isZeroValues = true;
            for (let j = 0; j < morphTrack.weights.length; ++j) {
                if (morphTrack.weights[j] !== 0) {
                    isZeroValues = false;
                    break;
                }
            }
            if (isZeroValues) continue;
            filteredMorphTracks.push(morphTrack);
        }

        progressEvent.loaded = lastStageLoaded + morphLoadCost;
        onProgress?.({ ...progressEvent });
        lastStageLoaded += morphLoadCost;

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
        const propertyTrack = new MmdPropertyAnimationTrack(margedPropertyKeyFrames.length, ikStates.size);
        {
            const boneNameMap: string[] = new Array(ikStates.size);
            const boneIndexMap: Map<string, number> = new Map();
            let ikStateIndex = 0;
            for (const ikState of ikStates) {
                boneNameMap[ikStateIndex] = ikState;
                boneIndexMap.set(ikState, ikStateIndex);

                propertyTrack.ikBoneNames[ikStateIndex] = ikState;
                ikStateIndex += 1;
            }

            const keyExistsCheckArray = new Uint8Array(ikStates.size);

            for (let i = 0; i < margedPropertyKeyFrames.length; ++i) {
                const propertyKeyFrame = margedPropertyKeyFrames[i];

                propertyTrack.frameNumbers[i] = propertyKeyFrame.frameNumber;
                propertyTrack.visibles[i] = propertyKeyFrame.visible ? 1 : 0;

                const propertyTrackIkStates = propertyTrack.ikStates;
                const propertyKeyFrameIkStates = propertyKeyFrame.ikStates;

                keyExistsCheckArray.fill(0);
                for (let j = 0; j < propertyKeyFrameIkStates.length; ++j) {
                    const ikState = propertyKeyFrameIkStates[j];
                    const boneIndex = boneIndexMap.get(ikState[0])!;
                    propertyTrackIkStates[boneIndex][i] = ikState[1] ? 1 : 0;

                    keyExistsCheckArray[boneIndex] = 1;
                }

                for (let j = 0; j < keyExistsCheckArray.length; ++j) {
                    if (keyExistsCheckArray[j] === 0) {
                        const previousValue = propertyTrackIkStates[j][i - 1];
                        propertyTrackIkStates[j][i] = previousValue === undefined ? 0 : previousValue;
                    }
                }
            }
        }

        progressEvent.loaded = lastStageLoaded + propertyLoadCost;
        onProgress?.({ ...progressEvent });
        lastStageLoaded += propertyLoadCost;

        const margedCameraKeyFrames: VmdObject.CameraKeyFrame[] = [];
        for (let i = 0; i < vmdObject.length; ++i) {
            const vmdObjectItem = vmdObject[i];
            const cameraKeyFrames = vmdObjectItem.cameraKeyFrames;
            for (let i = 0; i < cameraKeyFrames.length; ++i) {
                margedCameraKeyFrames.push(cameraKeyFrames.get(i));
            }
        }
        margedCameraKeyFrames.sort((a, b) => a.frameNumber - b.frameNumber);
        const cameraTrack = new MmdCameraAnimationTrack(name, margedCameraKeyFrames.length);
        for (let i = 0; i < margedCameraKeyFrames.length; ++i) {
            const cameraKeyFrame = margedCameraKeyFrames[i];
            const cameraKeyFrameInterpolation = cameraKeyFrame.interpolation;


            cameraTrack.frameNumbers[i] = cameraKeyFrame.frameNumber;


            const cameraTrackPositions = cameraTrack.positions;
            const cameraKeyFramePosition = cameraKeyFrame.position;
            cameraTrackPositions[i * 3 + 0] = cameraKeyFramePosition[0];
            cameraTrackPositions[i * 3 + 1] = cameraKeyFramePosition[1];
            cameraTrackPositions[i * 3 + 2] = cameraKeyFramePosition[2];

            const cameraTrackPositionInterpolations = cameraTrack.positionInterpolations;
            cameraTrackPositionInterpolations[i * 12 + 0] = cameraKeyFrameInterpolation[0];// x_x1
            cameraTrackPositionInterpolations[i * 12 + 1] = cameraKeyFrameInterpolation[1];// x_x2
            cameraTrackPositionInterpolations[i * 12 + 2] = cameraKeyFrameInterpolation[2];// x_y1
            cameraTrackPositionInterpolations[i * 12 + 3] = cameraKeyFrameInterpolation[3];// x_y2

            cameraTrackPositionInterpolations[i * 12 + 4] = cameraKeyFrameInterpolation[4];// y_x1
            cameraTrackPositionInterpolations[i * 12 + 5] = cameraKeyFrameInterpolation[5];// y_x2
            cameraTrackPositionInterpolations[i * 12 + 6] = cameraKeyFrameInterpolation[6];// y_y1
            cameraTrackPositionInterpolations[i * 12 + 7] = cameraKeyFrameInterpolation[7];// y_y2

            cameraTrackPositionInterpolations[i * 12 + 8] = cameraKeyFrameInterpolation[8];// z_x1
            cameraTrackPositionInterpolations[i * 12 + 9] = cameraKeyFrameInterpolation[9];// z_x2
            cameraTrackPositionInterpolations[i * 12 + 10] = cameraKeyFrameInterpolation[10];// z_y1
            cameraTrackPositionInterpolations[i * 12 + 11] = cameraKeyFrameInterpolation[11];// z_y2


            const cameraTrackRotations = cameraTrack.rotations;
            const cameraKeyFrameRotation = cameraKeyFrame.rotation;
            cameraTrackRotations[i * 3 + 0] = cameraKeyFrameRotation[0];
            cameraTrackRotations[i * 3 + 1] = cameraKeyFrameRotation[1];
            cameraTrackRotations[i * 3 + 2] = cameraKeyFrameRotation[2];

            const cameraTrackRotationInterpolations = cameraTrack.rotationInterpolations;
            cameraTrackRotationInterpolations[i * 4 + 0] = cameraKeyFrameInterpolation[12];// x1
            cameraTrackRotationInterpolations[i * 4 + 1] = cameraKeyFrameInterpolation[13];// x2
            cameraTrackRotationInterpolations[i * 4 + 2] = cameraKeyFrameInterpolation[14];// y1
            cameraTrackRotationInterpolations[i * 4 + 3] = cameraKeyFrameInterpolation[15];// y2


            cameraTrack.distances[i] = cameraKeyFrame.distance;

            const cameraTrackDistancesInterpolations = cameraTrack.distancesInterpolations;
            cameraTrackDistancesInterpolations[i * 4 + 0] = cameraKeyFrameInterpolation[16];// x1
            cameraTrackDistancesInterpolations[i * 4 + 1] = cameraKeyFrameInterpolation[17];// x2
            cameraTrackDistancesInterpolations[i * 4 + 2] = cameraKeyFrameInterpolation[18];// y1
            cameraTrackDistancesInterpolations[i * 4 + 3] = cameraKeyFrameInterpolation[19];// y2


            cameraTrack.fovs[i] = cameraKeyFrame.fov;

            const cameraTrackFovInterpolations = cameraTrack.fovInterpolations;
            cameraTrackFovInterpolations[i * 4 + 0] = cameraKeyFrameInterpolation[20];// x1
            cameraTrackFovInterpolations[i * 4 + 1] = cameraKeyFrameInterpolation[21];// x2
            cameraTrackFovInterpolations[i * 4 + 2] = cameraKeyFrameInterpolation[22];// y1
            cameraTrackFovInterpolations[i * 4 + 3] = cameraKeyFrameInterpolation[23];// y2


            if (i % 1000 < performance.now() - time) {
                progressEvent.loaded = lastStageLoaded + i;
                onProgress?.({ ...progressEvent });

                await Tools.DelayAsync(0);
                time = performance.now();
            }
        }

        progressEvent.loaded = lastStageLoaded + cameraLoadCost;
        onProgress?.({ ...progressEvent });
        lastStageLoaded += cameraLoadCost;

        if (0 < cameraTrack.frameNumbers.length) {
            if (boneTracks.length !== 0 || filteredMorphTracks.length !== 0 || propertyTrack.frameNumbers.length !== 0) {
                this.warn("animation contains both camera and model animation. model animation will be ignored.");
            }
            return cameraTrack;
        } else {
            return new MmdModelAnimation(name, filteredBoneTracks, filteredMoveableBoneTracks, filteredMorphTracks, propertyTrack);
        }
    }

    public loadFromVmdData(
        name: string,
        vmdData: VmdData | VmdData[],
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
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
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve) => {
            this.loadFromVmdData(name, vmdData, resolve, onProgress);
        });
    }

    public loadFromBuffer(
        name: string,
        buffer: ArrayBufferLike | ArrayBufferLike[],
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
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
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<MmdModelAnimation | MmdCameraAnimationTrack> {
        return new Promise<MmdModelAnimation | MmdCameraAnimationTrack>((resolve, reject) => {
            this.loadFromBuffer(name, buffer, resolve, onProgress, reject);
        });
    }

    public load(
        name: string,
        fileOrUrl: File | string | File[] | string[],
        onLoad: (animation: MmdModelAnimation | MmdCameraAnimationTrack) => void,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
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
        onProgress?: (event: ISceneLoaderProgressEvent) => void
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
