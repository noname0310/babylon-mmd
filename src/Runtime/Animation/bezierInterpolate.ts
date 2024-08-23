/**
 * Cubic Bezier Interpolation for MMD animation curves
 * @param x1 X1
 * @param x2 X2
 * @param y1 Y1
 * @param y2 Y2
 * @param x Weight
 * @returns Interpolated value
 */
export function bezierInterpolate(x1: number, x2: number, y1: number, y2: number, x: number): number {
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

        c *= 0.5;

        t += (ft < 0) ? c : -c;
        s = 1.0 - t;
    }
    return (sst3! * y1) + (stt3! * y2) + ttt!;
}
