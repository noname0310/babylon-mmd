const ITERATIONS: i32 = 15;
const EPSILON: f32 = 1e-5;

pub(crate) fn bezier_interpolation(x1: f32, x2: f32, y1: f32, y2: f32, x: f32) -> f32 {
    let mut c = 0.5;
    let mut t = c;
    let mut s = 1.0 - t;

    let mut sst3;
    let mut stt3;
    let mut ttt;

    let mut i = 0;
    loop {
        sst3 = 3.0 * s * s * t;
        stt3 = 3.0 * s * t * t;
        ttt = t * t * t;

        let ft = sst3 * x1 + stt3 * x2 + ttt - x;

        if ft.abs() < EPSILON {
            break;
        }

        c *= 0.5;

        t += if ft < 0.0 { c } else { -c };
        s = 1.0 - t;

        i += 1;
        if i == ITERATIONS {
            break;
        }
    }
    sst3 * y1 + stt3 * y2 + ttt
}
