import type { IMmdAnimationTrack } from "@/Loader/Animation/IMmdAnimationTrack";

/**
 * Mmd runtime animation base class
 */
export abstract class MmdRuntimeAnimation<T> {
    /**
     * Animation data
     */
    public abstract readonly animation: T;

    private readonly _lastResults = new Map<IMmdAnimationTrack, [number, number]>(); // [frameTime, frameIndex]

    /**
     * Find frame index B to interpolate between frame A and frame B
     *
     * Frame time must be clamped to [startFrame, endFrame]
     *
     * @param frameTime Frame time in 30fps
     * @param track Animation track
     * @returns
     */
    protected _upperBoundFrameIndex(frameTime: number, track: IMmdAnimationTrack): number {
        const frameNumbers = track.frameNumbers;

        let lastResult = this._lastResults.get(track);
        if (lastResult === undefined) {
            lastResult = [Number.NEGATIVE_INFINITY, 0];
            this._lastResults.set(track, lastResult);
        }

        const diff = frameTime - lastResult[0];

        if (Math.abs(diff) < 6) { // if frame time is close to last frame time, use iterative search
            let frameIndex = lastResult[1];
            while (0 < frameIndex && frameTime < frameNumbers[frameIndex - 1]) frameIndex -= 1;
            while (frameIndex < frameNumbers.length && frameNumbers[frameIndex] <= frameTime) frameIndex += 1;

            lastResult[0] = frameTime;
            lastResult[1] = frameIndex;

            return frameIndex;
        } else { // if frame time is far from last frame time, use binary search
            let low = 0;
            let high = frameNumbers.length;

            while (low < high) {
                const mid = low + ((high - low) >> 1);
                if (frameTime < frameNumbers[mid]) high = mid;
                else low = mid + 1;
            }

            lastResult[0] = frameTime;
            lastResult[1] = low;

            return low;
        }
    }
}
