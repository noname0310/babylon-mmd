import { MmdBoneAnimationTrack, MmdMorphAnimationTrack } from "./MmdAnimationTrack";

export class MmdModelAnimation {
    public readonly startFrame: number;
    public readonly endFrame: number;

    public readonly boneTracks: readonly MmdBoneAnimationTrack[];
    public readonly morphTracks: readonly MmdMorphAnimationTrack[];
    public readonly propertyTrack: MmdMorphAnimationTrack;

    public constructor(
        boneTracks: readonly MmdBoneAnimationTrack[],
        morphTracks: readonly MmdMorphAnimationTrack[],
        propertyTrack: MmdMorphAnimationTrack
    ) {
        this.boneTracks = boneTracks;
        this.morphTracks = morphTracks;
        this.propertyTrack = propertyTrack;

        let minStartFrame = Infinity;
        let maxEndFrame = -Infinity;
        for (let i = 0; i < boneTracks.length; ++i) {
            const boneTrack = boneTracks[i];
            minStartFrame = Math.min(minStartFrame, boneTrack.startFrame);
            maxEndFrame = Math.max(maxEndFrame, boneTrack.endFrame);
        }
        for (let i = 0; i < morphTracks.length; ++i) {
            const morphTrack = morphTracks[i];
            minStartFrame = Math.min(minStartFrame, morphTrack.startFrame);
            maxEndFrame = Math.max(maxEndFrame, morphTrack.endFrame);
        }
        minStartFrame = Math.min(minStartFrame, propertyTrack.startFrame);
        maxEndFrame = Math.max(maxEndFrame, propertyTrack.endFrame);

        this.startFrame = minStartFrame;
        this.endFrame = maxEndFrame;
    }

    public validate(): boolean {
        const boneTracks = this.boneTracks;
        for (let i = 0; i < boneTracks.length; ++i) {
            if (!boneTracks[i].validate()) return false;
        }

        const morphTracks = this.morphTracks;
        for (let i = 0; i < morphTracks.length; ++i) {
            if (!morphTracks[i].validate()) return false;
        }

        return this.propertyTrack.validate();
    }
}
