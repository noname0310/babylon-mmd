import type { MmdBoneAnimationTrack, MmdMorphAnimationTrack, MmdPropertyAnimationTrack } from "./MmdAnimationTrack";

export class MmdModelAnimation {
    public readonly name: string;

    public readonly boneTracks: readonly MmdBoneAnimationTrack[];
    public readonly morphTracks: readonly MmdMorphAnimationTrack[];
    public readonly propertyTrack: MmdPropertyAnimationTrack;

    public readonly startFrame: number;
    public readonly endFrame: number;

    public constructor(
        name: string,
        boneTracks: readonly MmdBoneAnimationTrack[],
        morphTracks: readonly MmdMorphAnimationTrack[],
        propertyTrack: MmdPropertyAnimationTrack
    ) {
        this.name = name;

        this.boneTracks = boneTracks;
        this.morphTracks = morphTracks;
        this.propertyTrack = propertyTrack;

        let minStartFrame = Number.MAX_SAFE_INTEGER;
        let maxEndFrame = Number.MIN_SAFE_INTEGER;
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
