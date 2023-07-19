export abstract class MmdAnimationTrack {
    public readonly trackType: string;

    public readonly name: string;
    public readonly frameNumbers: Uint32Array; // [..., frameNumber, ...]

    public constructor(
        trackType: string,
        trackName: string,
        frameCount: number
    ) {
        this.trackType = trackType;

        this.name = trackName;
        this.frameNumbers = new Uint32Array(frameCount);
    }

    public validate(): boolean {
        for (let i = 1; i < this.frameNumbers.length; ++i) {
            if (this.frameNumbers[i - 1] >= this.frameNumbers[i]) return false;
        }

        return true;
    }

    public get startFrame(): number {
        if (this.frameNumbers.length === 0) return 0;
        return this.frameNumbers[0];
    }

    public get endFrame(): number {
        if (this.frameNumbers.length === 0) return 0;
        return this.frameNumbers[this.frameNumbers.length - 1];
    }
}

export class MmdBoneAnimationTrack extends MmdAnimationTrack {
    public readonly rotations: Float32Array; // [..., x, y, z, w, ...]
    public readonly rotationInterpolations: Uint8Array; // [..., x1, x2, y1, y2, ...]

    public constructor(
        trackName: string,
        frameCount: number
    ) {
        super("bone", trackName, frameCount);

        this.rotations = new Float32Array(frameCount * 4);
        this.rotationInterpolations = new Uint8Array(frameCount * 4);
    }
}

export class MmdMovableBoneAnimationTrack extends MmdAnimationTrack {
    public readonly positions: Float32Array; // [..., x, y, z, ...]
    public readonly positionInterpolations: Uint8Array; // [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]

    public readonly rotations: Float32Array; // [..., x, y, z, w, ...]
    public readonly rotationInterpolations: Uint8Array; // [..., x1, x2, y1, y2, ...]

    public constructor(
        trackName: string,
        frameCount: number
    ) {
        super("moveableBone", trackName, frameCount);

        this.positions = new Float32Array(frameCount * 3);
        this.positionInterpolations = new Uint8Array(frameCount * 12);

        this.rotations = new Float32Array(frameCount * 4);
        this.rotationInterpolations = new Uint8Array(frameCount * 4);
    }
}

export class MmdMorphAnimationTrack extends MmdAnimationTrack {
    public readonly weights: Float32Array; // [..., weight, ...]

    public constructor(
        trackName: string,
        frameCount: number
    ) {
        super("morph", trackName, frameCount);

        this.weights = new Float32Array(frameCount);
    }
}

export class MmdCameraAnimationTrack extends MmdAnimationTrack {
    public readonly positions: Float32Array; // [..., x, y, z, ...]
    public readonly positionInterpolations: Uint8Array; // [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]

    public readonly rotations: Float32Array; // [..., x, y, z, ...]
    public readonly rotationInterpolations: Uint8Array; // [..., x1, x2, y1, y2, ...]

    public readonly distances: Float32Array; // [..., distance, ...]
    public readonly distanceInterpolations: Uint8Array; // [..., x1, x2, y1, y2, ...]

    public readonly fovs: Float32Array; // [..., fov, ...]
    public readonly fovInterpolations: Uint8Array; // [..., x1, x2, y1, y2, ...]

    public constructor(
        frameCount: number
    ) {
        super("camera", "cameraTrack", frameCount);

        this.positions = new Float32Array(frameCount * 3);
        this.positionInterpolations = new Uint8Array(frameCount * 12);

        this.rotations = new Float32Array(frameCount * 3);
        this.rotationInterpolations = new Uint8Array(frameCount * 4);

        this.distances = new Float32Array(frameCount);
        this.distanceInterpolations = new Uint8Array(frameCount * 4);

        this.fovs = new Float32Array(frameCount);
        this.fovInterpolations = new Uint8Array(frameCount * 4);
    }
}

export class MmdPropertyAnimationTrack extends MmdAnimationTrack {
    public readonly visibles: Uint8Array; // [..., visible, ...]
    public readonly ikBoneNames: string[]; // [..., ikBoneName, ...]
    public readonly ikStates: Uint8Array[]; // [..., ikState, ...]

    public constructor(
        frameCount: number,
        ikBoneCount: number
    ) {
        super("property", "propertyTrack", frameCount);

        this.visibles = new Uint8Array(frameCount);

        this.ikBoneNames = new Array(ikBoneCount);
        this.ikStates = new Array(ikBoneCount);
        for (let i = 0; i < ikBoneCount; ++i) {
            this.ikStates[i] = new Uint8Array(frameCount);
        }
    }
}
