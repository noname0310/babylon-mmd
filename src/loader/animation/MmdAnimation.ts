import type { MmdBoneAnimationTrack, MmdCameraAnimationTrack, MmdMorphAnimationTrack, MmdMovableBoneAnimationTrack, MmdPropertyAnimationTrack } from "./MmdAnimationTrack";

export class MmdAnimation {
    public readonly name: string;

    public readonly boneTracks: readonly MmdBoneAnimationTrack[];
    public readonly moveableBoneTracks: readonly MmdMovableBoneAnimationTrack[];
    public readonly morphTracks: readonly MmdMorphAnimationTrack[];
    public readonly propertyTrack: MmdPropertyAnimationTrack;
    public readonly cameraTrack: MmdCameraAnimationTrack;

    public readonly startFrame: number;
    public readonly endFrame: number;

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
