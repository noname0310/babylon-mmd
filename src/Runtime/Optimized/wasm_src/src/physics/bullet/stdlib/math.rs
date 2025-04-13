#[no_mangle]
extern "C" fn bw_sqrtf(x: f32) -> f32 {
    x.sqrt()
}

#[no_mangle]
extern "C" fn bw_cosf(x: f32) -> f32 {
    x.cos()
}

#[no_mangle]
extern "C" fn bw_sinf(x: f32) -> f32 {
    x.sin()
}

#[no_mangle]
extern "C" fn bw_tanf(x: f32) -> f32 {
    x.tan()
}

#[no_mangle]
extern "C" fn bw_acosf(x: f32) -> f32 {
    x.acos()
}

#[no_mangle]
extern "C" fn bw_asinf(x: f32) -> f32 {
    x.asin()
}

#[no_mangle]
extern "C" fn bw_atanf(x: f32) -> f32 {
    x.atan()
}

#[no_mangle]
extern "C" fn bw_atan2f(y: f32, x: f32) -> f32 {
    y.atan2(x)
}

#[no_mangle]
extern "C" fn bw_expf(x: f32) -> f32 {
    x.exp()
}

#[no_mangle]
extern "C" fn bw_logf(x: f32) -> f32 {
    x.ln()
}

#[no_mangle]
extern "C" fn bw_powf(x: f32, y: f32) -> f32 {
    x.powf(y)
}

#[no_mangle]
extern "C" fn bw_fmodf(x: f32, y: f32) -> f32 {
    x % y
}

#[no_mangle]
extern "C" fn bw_cos(x: f64) -> f64 {
    x.cos()
}

#[no_mangle]
extern "C" fn bw_sin(x: f64) -> f64 {
    x.sin()
}

#[no_mangle]
extern "C" fn bw_tan(x: f64) -> f64 {
    x.tan()
}

#[no_mangle]
extern "C" fn bw_acos(x: f64) -> f64 {
    x.acos()
}

#[no_mangle]
extern "C" fn bw_asin(x: f64) -> f64 {
    x.asin()
}

#[no_mangle]
extern "C" fn bw_atan(x: f64) -> f64 {
    x.atan()
}

#[no_mangle]
extern "C" fn bw_atan2(y: f64, x: f64) -> f64 {
    y.atan2(x)
}

#[no_mangle]
extern "C" fn bw_exp(x: f64) -> f64 {
    x.exp()
}

#[no_mangle]
extern "C" fn bw_log(x: f64) -> f64 {
    x.ln()
}

#[no_mangle]
extern "C" fn bw_pow(x: f64, y: f64) -> f64 {
    x.powf(y)
}

#[no_mangle]
extern "C" fn bw_fmod(x: f64, y: f64) -> f64 {
    x % y
}

#[no_mangle]
extern "C" fn bw_isinf(x: f64) -> bool {
    x.is_infinite()
}

#[no_mangle]
extern "C" fn bw_isnan(x: f64) -> bool {
    x.is_nan()
}

#[no_mangle]
extern "C" fn bw_fabs(x: f64) -> f64 {
    x.abs()
}

#[no_mangle]
extern "C" fn bw_floor(x: f64) -> f64 {
    x.floor()
}

#[no_mangle]
extern "C" fn bw_ceil(x: f64) -> f64 {
    x.ceil()
}

#[no_mangle]
extern "C" fn bw_sqrt(x: f64) -> f64 {
    x.sqrt()
}
