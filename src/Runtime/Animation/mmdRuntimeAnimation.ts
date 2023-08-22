import type { MmdAnimationTrack } from "@/Loader/Animation/mmdAnimationTrack";

/**
 * Mmd runtime animation base class
 */
export abstract class MmdRuntimeAnimation<T> {
    /**
     * Animation data
     */
    public abstract readonly animation: T;

    private readonly _lastResults = new Map<MmdAnimationTrack, [number, number]>(); // [frameTime, frameIndex]

    /**
     * Find frame index B to interpolate between frame A and frame B
     *
     * frame time must be clamped to [startFrame, endFrame]
     *
     * @param frameTime frame time in 30fps
     * @param track animation track
     * @returns
     */
    protected _upperBoundFrameIndex(frameTime: number, track: MmdAnimationTrack): number {
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

/**
 * Mmd Interpolator for MMD animation interpolation
 */
export class MmdInterpolator {
    /**
     * Cubic Bezier interpolation
     * @param x1 X1
     * @param x2 X2
     * @param y1 Y1
     * @param y2 Y2
     * @param x Weight
     * @returns Interpolated value
     */
    public static Interpolate(x1: number, x2: number, y1: number, y2: number, x: number): number {
        /*
        Cubic Bezier curves
        https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B.C3.A9zier_curves

        B(t) = ( 1 - t ) ^ 3 * P0
            + 3 * ( 1 - t ) ^ 2 * t * P1
            + 3 * ( 1 - t ) * t^2 * P2
            + t ^ 3 * P3
            ( 0 <= t <= 1 )

        MMD uses Cubic Bezier curves for bone and camera animation interpolation.
        http://d.hatena.ne.jp/edvakf/20111016/1318716097

        x = ( 1 - t ) ^ 3 * x0
            + 3 * ( 1 - t ) ^ 2 * t * x1
            + 3 * ( 1 - t ) * t^2 * x2
            + t ^ 3 * x3
        y = ( 1 - t ) ^ 3 * y0
            + 3 * ( 1 - t ) ^ 2 * t * y1
            + 3 * ( 1 - t ) * t^2 * y2
            + t ^ 3 * y3
            ( x0 = 0, y0 = 0 )
            ( x3 = 1, y3 = 1 )
            ( 0 <= t, x1, x2, y1, y2 <= 1 )

        Here solves this equation with Bisection method,
        https://en.wikipedia.org/wiki/Bisection_method
        gets t, and then calculate y.

        f(t) = 3 * ( 1 - t ) ^ 2 * t * x1
            + 3 * ( 1 - t ) * t^2 * x2
            + t ^ 3 - x = 0

        (Another option: Newton's method https://en.wikipedia.org/wiki/Newton%27s_method)
        */
        let c = 0.5;
        let t = c;
        let s = 1.0 - t;
        const loop = 15;
        const eps = 1e-5;
        const math = Math;

        let sst3: number, stt3: number, ttt: number;

        for (let i = 0; i < loop; ++i) {
            sst3 = 3.0 * s * s * t;
            stt3 = 3.0 * s * t * t;
            ttt = t * t * t;

            const ft = (sst3 * x1) + (stt3 * x2) + (ttt) - x;

            if (math.abs(ft) < eps) break;

            c /= 2.0;

            t += (ft < 0) ? c : -c;
            s = 1.0 - t;
        }
        return (sst3! * y1) + (stt3! * y2) + ttt!;
    }
}
