/**
 * MMD animation track base class
 */
export abstract class MmdAnimationTrack {
    /**
     * Track type
     */
    public readonly trackType: string;

    /**
     * Track name for bind to model's bone/morph
     */
    public readonly name: string;

    /**
     * Frame numbers of this track
     *
     * The frame numbers must be sorted in ascending order
     *
     * Repr: [..., frameNumber, ...]
     */
    public readonly frameNumbers: Uint32Array;

    /**
     * Create a new `MmdAnimationTrack` instance
     * @param trackType Track type
     * @param trackName Track name for bind to model
     * @param frameCount Frame count of this track
     */
    public constructor(
        trackType: string,
        trackName: string,
        frameCount: number
    ) {
        this.trackType = trackType;

        this.name = trackName;
        this.frameNumbers = new Uint32Array(frameCount);
    }

    /**
     * Check if all frame numbers are valid(sorted)
     * @returns true if all frame numbers are valid
     */
    public validate(): boolean {
        for (let i = 1; i < this.frameNumbers.length; ++i) {
            if (this.frameNumbers[i - 1] >= this.frameNumbers[i]) return false;
        }

        return true;
    }

    /**
     * The start frame of this animation
     */
    public get startFrame(): number {
        if (this.frameNumbers.length === 0) return 0;
        return this.frameNumbers[0];
    }

    /**
     * The end frame of this animation
     *
     * if mmdAnimationTrack.validate() is false, the return value is not valid
     */
    public get endFrame(): number {
        if (this.frameNumbers.length === 0) return 0;
        return this.frameNumbers[this.frameNumbers.length - 1];
    }
}

/**
 * MMD bone animation track
 *
 * contains bone rotation and rotation cubic interpolation data
 */
export class MmdBoneAnimationTrack extends MmdAnimationTrack {
    /**
     * Bone rotation data in quaternion
     *
     * The rotation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x, y, z, w, ...]
     */
    public readonly rotations: Float32Array;

    /**
     * Rotation cubic interpolation data
     *
     * The rotation interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x1, x2, y1, y2, ...]
     */
    public readonly rotationInterpolations: Uint8Array;

    /**
     * Create a new `MmdBoneAnimationTrack` instance
     * @param trackName track name for bind to model's bone
     * @param frameCount frame count of this track
     */
    public constructor(
        trackName: string,
        frameCount: number
    ) {
        super("bone", trackName, frameCount);

        this.rotations = new Float32Array(frameCount * 4);
        this.rotationInterpolations = new Uint8Array(frameCount * 4);
    }
}

/**
 * MMD movable bone animation track
 *
 * contains bone position, rotation and position/rotation cubic interpolation data
 */
export class MmdMovableBoneAnimationTrack extends MmdAnimationTrack {
    /**
     * Bone position data in vector3
     *
     * The position data must be sorted by frame number in ascending order
     *
     * Repr: [..., x, y, z, ...]
     */
    public readonly positions: Float32Array;
    /**
     * Position cubic interpolation data
     *
     * The position interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]
     */
    public readonly positionInterpolations: Uint8Array;

    /**
     * Bone rotation data in quaternion
     *
     * The rotation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x, y, z, w, ...]
     */
    public readonly rotations: Float32Array;

    /**
     * Rotation cubic interpolation data
     *
     * The rotation interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x1, x2, y1, y2, ...]
     */
    public readonly rotationInterpolations: Uint8Array;

    /**
     * Create a new `MmdMovableBoneAnimationTrack` instance
     * @param trackName Track name for bind to model's bone
     * @param frameCount Frame count of this track
     */
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

/**
 * MMD morph animation track
 *
 * contains morph weight data
 *
 * weight data will be linear interpolated so there is no interpolation data
 */
export class MmdMorphAnimationTrack extends MmdAnimationTrack {
    /**
     * Morph weight data
     *
     * The weight data must be sorted by frame number in ascending order
     *
     * Repr: [..., weight, ...]
     */
    public readonly weights: Float32Array;

    /**
     * Create a new `MmdMorphAnimationTrack` instance
     * @param trackName Track name for bind to model's morph
     * @param frameCount Frame count of this track
     */
    public constructor(
        trackName: string,
        frameCount: number
    ) {
        super("morph", trackName, frameCount);

        this.weights = new Float32Array(frameCount);
    }
}

/**
 * MMD camera animation track
 *
 * contains camera position, rotation, distance, fov and their cubic interpolation data
 */
export class MmdCameraAnimationTrack extends MmdAnimationTrack {
    /**
     * Camera position data in vector3
     *
     * The position data must be sorted by frame number in ascending order
     *
     * Repr: [..., x, y, z, ...]
     */
    public readonly positions: Float32Array;

    /**
     * Position cubic interpolation data
     *
     * The position interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x_x1, x_x2, x_y1, x_y2, y_x1, y_x2, y_y1, y_y2, z_x1, z_x2, z_y1, z_y2, ...]
     */
    public readonly positionInterpolations: Uint8Array;

    /**
     * Camera rotation data in yaw/pitch/roll
     *
     * The rotation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x, y, z, ...]
     */
    public readonly rotations: Float32Array;

    /**
     * Rotation cubic interpolation data
     *
     * The rotation interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x1, x2, y1, y2, ...]
     */
    public readonly rotationInterpolations: Uint8Array;

    /**
     * Camera distance data
     *
     * The distance data must be sorted by frame number in ascending order
     *
     * Repr: [..., distance, ...]
     */
    public readonly distances: Float32Array;

    /**
     * Distance cubic interpolation data
     *
     * The distance interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x1, x2, y1, y2, ...]
     */
    public readonly distanceInterpolations: Uint8Array;

    /**
     * Camera fov data in degrees
     *
     * The fov data must be sorted by frame number in ascending order
     *
     * Repr: [..., fov, ...]
     */
    public readonly fovs: Float32Array;

    /**
     * Fov cubic interpolation data
     *
     * The fov interpolation data must be sorted by frame number in ascending order
     *
     * Repr: [..., x1, x2, y1, y2, ...]
     */
    public readonly fovInterpolations: Uint8Array;

    /**
     * Create a new `MmdCameraAnimationTrack` instance
     * @param frameCount Frame count of this track
     */
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

/**
 * MMD property animation track
 *
 * contains visibility and ik state data
 *
 * visibility and ik state will be step interpolated
 */
export class MmdPropertyAnimationTrack extends MmdAnimationTrack {
    /**
     * Visibility data
     *
     * The visibility data must be sorted by frame number in ascending order
     *
     * Repr: [..., visible, ...]
     */
    public readonly visibles: Uint8Array;

    /**
     * IK bone names
     *
     * Repr: [..., ikBoneName, ...]
     */
    public readonly ikBoneNames: string[];
    /**
     * IK state data
     *
     * The IK state data must be sorted by frame number in ascending order
     *
     * Repr: [..., ikState, ...]
     */
    public readonly ikStates: Uint8Array[];

    /**
     * Create a new `MmdPropertyAnimationTrack` instance
     * @param frameCount Frame count of this track
     * @param ikBoneCount IK bone count of this track
     */
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
