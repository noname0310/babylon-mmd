import type { IMmdAnimation } from "./IMmdAnimation";
import type { MmdBoneAnimationTrack, MmdCameraAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack } from "./mmdAnimationTrack";

/**
 * Represents mmd animation data
 *
 * Internally, it uses typed arrays to store animation data for better performance
 *
 * Therefore, it is not compatible with existing Babylon.js animation systems.
 *
 * You can save one mesh animation and one camera animation in one `MmdAnimation` instance
 */
export class MmdAnimation implements IMmdAnimation {
    /**
     * Animation name for identification
     */
    public readonly name: string;

    /**
     * Bone animation tracks for one `mesh.skeleton`
     *
     * it contains rotation and rotation cubic interpolation data
     */
    public readonly boneTracks: readonly MmdBoneAnimationTrack[];

    /**
     * Moveable bone animation tracks for one `mesh.skeleton`
     *
     * it contains position, rotation and their cubic interpolation data
     */
    public readonly moveableBoneTracks: readonly MmdMovableBoneAnimationTrack[];

    /**
     * Morph animation tracks for one `mesh.morphTargetManager`
     *
     * it contains weight and weight linear interpolation data
     */
    public readonly morphTracks: readonly MmdMorphAnimationTrack[];

    /**
     * Property animation track for one `mmdModel`
     *
     * it contains visibility and ik toggle keyframe data
     */
    public readonly propertyTrack: MmdPropertyAnimationTrack;

    /**
     * Camera animation track for one `mmdCamera`
     *
     * it contains position, rotation, distance and fov cubic interpolation data
     */
    public readonly cameraTrack: MmdCameraAnimationTrack;

    /**
     * The start frame of this animation
     */
    public readonly startFrame: number;

    /**
     * The end frame of this animation
     */
    public readonly endFrame: number;

    /**
     * Create a new `MmdAnimation` instance
     * @param name animation name for identification
     * @param boneTracks bone animation tracks
     * @param moveableBoneTracks moveable bone animation tracks
     * @param morphTracks morph animation tracks
     * @param propertyTrack property animation track
     * @param cameraTrack camera animation track
     */
    public constructor(
        name: string,
        boneTracks: readonly MmdBoneAnimationTrack[],
        moveableBoneTracks: readonly MmdMovableBoneAnimationTrack[],
        morphTracks: readonly MmdMorphAnimationTrack[],
        propertyTrack: MmdPropertyAnimationTrack,
        cameraTrack: MmdCameraAnimationTrack
    ) {
        this.name = name;

        this.boneTracks = boneTracks;
        this.moveableBoneTracks = moveableBoneTracks;
        this.morphTracks = morphTracks;
        this.propertyTrack = propertyTrack;
        this.cameraTrack = cameraTrack;

        let minStartFrame = Number.MAX_SAFE_INTEGER;
        let maxEndFrame = Number.MIN_SAFE_INTEGER;
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            minStartFrame = Math.min(minStartFrame, boneTrack.startFrame);
            maxEndFrame = Math.max(maxEndFrame, boneTrack.endFrame);
        }
        for (let i = 0; i < moveableBoneTracks.length; ++i) {
            const moveableBoneTrack = moveableBoneTracks[i];
            minStartFrame = Math.min(minStartFrame, moveableBoneTrack.startFrame);
            maxEndFrame = Math.max(maxEndFrame, moveableBoneTrack.endFrame);
        }
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            minStartFrame = Math.min(minStartFrame, morphTrack.startFrame);
            maxEndFrame = Math.max(maxEndFrame, morphTrack.endFrame);
        }
        minStartFrame = Math.min(minStartFrame, propertyTrack.startFrame);
        maxEndFrame = Math.max(maxEndFrame, propertyTrack.endFrame);
        minStartFrame = Math.min(minStartFrame, cameraTrack.startFrame);
        maxEndFrame = Math.max(maxEndFrame, cameraTrack.endFrame);

        this.startFrame = minStartFrame;
        this.endFrame = maxEndFrame;
    }

    /**
     * Check if all animation tracks are valid(sorted)
     * @returns true if all animation tracks are valid
     */
    public validate(): boolean {
        const boneTracks = this.boneTracks;
        for (let i = 0; i < boneTracks.length; ++i) {
            if (!boneTracks[i].validate()) return false;
        }

        const moveableBoneTracks = this.moveableBoneTracks;
        for (let i = 0; i < moveableBoneTracks.length; ++i) {
            if (!moveableBoneTracks[i].validate()) return false;
        }

        const morphTracks = this.morphTracks;
        for (let i = 0; i < morphTracks.length; ++i) {
            if (!morphTracks[i].validate()) return false;
        }

        return this.propertyTrack.validate() && this.cameraTrack.validate();
    }
}
