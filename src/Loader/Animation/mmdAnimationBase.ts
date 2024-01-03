import type { IMmdAnimation } from "./IMmdAnimation";
import type { IMmdBoneAnimationTrack, IMmdMorphAnimationTrack, IMmdMovableBoneAnimationTrack, IMmdPropertyAnimationTrack } from "./IMmdAnimationTrack";
import type { MmdCameraAnimationTrack } from "./mmdAnimationTrack";

/**
 * Mmd Animation
 */
export abstract class MmdAnimationBase implements IMmdAnimation {
    /**
     * Animation name for identification
     */
    public abstract readonly name: string;

    /**
     * Bone animation tracks for one `mesh.skeleton`
     *
     * it contains rotation and rotation cubic interpolation data
     */
    public abstract readonly boneTracks: readonly IMmdBoneAnimationTrack[];

    /**
     * Movable bone animation tracks for one `mesh.skeleton`
     *
     * it contains position, rotation and their cubic interpolation data
     */
    public abstract readonly movableBoneTracks: readonly IMmdMovableBoneAnimationTrack[];

    /**
     * Morph animation tracks for one `mesh.morphTargetManager`
     *
     * it contains weight and weight linear interpolation data
     */
    public abstract readonly morphTracks: readonly IMmdMorphAnimationTrack[];

    /**
     * Property animation track for one `mmdModel`
     *
     * it contains visibility and ik toggle keyframe data
     */
    public abstract readonly propertyTrack: IMmdPropertyAnimationTrack;

    /**
     * Camera animation track for one `mmdCamera`
     *
     * it contains position, rotation, distance and fov cubic interpolation data
     */
    public abstract readonly cameraTrack: MmdCameraAnimationTrack;

    /**
     * The start frame of this animation
     */
    public abstract readonly startFrame: number;

    /**
     * The end frame of this animation
     */
    public abstract readonly endFrame: number;
}
