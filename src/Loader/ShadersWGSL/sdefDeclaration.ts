export const sdefDeclaration = /* wgsl */`
#ifndef SDEFDECLARATION
#define SDEFDECLARATION

#if NUM_BONE_INFLUENCERS > 0 && defined(SDEF)
attribute matricesSdefC: vec3f;
attribute matricesSdefRW0: vec3f;
attribute matricesSdefRW1: vec3f;

fn rotationMatrixToQuaternion(matrix: mat3x3f) -> vec4f {
    let trace: f32 = matrix[0][0] + matrix[1][1] + matrix[2][2];
    var s: f32;

    var sqrtParam: f32;
    if (trace > 0.0) {
        sqrtParam = trace + 1.0;
    } else if (matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2]) {
        sqrtParam = 1.0 + matrix[0][0] - matrix[1][1] - matrix[2][2];
    } else if (matrix[1][1] > matrix[2][2]) {
        sqrtParam = 1.0 + matrix[1][1] - matrix[0][0] - matrix[2][2];
    } else {
        sqrtParam = 1.0 + matrix[2][2] - matrix[0][0] - matrix[1][1];
    }
    let sqrtValue: f32 = sqrt(sqrtParam);

    if (trace > 0.0) {
        s = 0.5 / sqrtValue;

        return vec4f(
            (matrix[1][2] - matrix[2][1]) * s,
            (matrix[2][0] - matrix[0][2]) * s,
            (matrix[0][1] - matrix[1][0]) * s,
            0.25 / s
        );
    } else if (matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2]) {
        s = 2.0 * sqrtValue;

        return vec4f(
            0.25 * s,
            (matrix[0][1] + matrix[1][0]) / s,
            (matrix[2][0] + matrix[0][2]) / s,
            (matrix[1][2] - matrix[2][1]) / s
        );
    } else if (matrix[1][1] > matrix[2][2]) {
        s = 2.0 * sqrtValue;
        
        return vec4f(
            (matrix[0][1] + matrix[1][0]) / s,
            0.25 * s,
            (matrix[1][2] + matrix[2][1]) / s,
            (matrix[2][0] - matrix[0][2]) / s
        );
    } else {
        s = 2.0 * sqrtValue;

        return vec4f(
            (matrix[2][0] + matrix[0][2]) / s,
            (matrix[1][2] + matrix[2][1]) / s,
            0.25 * s,
            (matrix[0][1] - matrix[1][0]) / s
        );
    }
}

fn quaternionToRotationMatrix(q: vec4f) -> mat3x3f {
    let xx: f32 = q.x * q.x;
    let yy: f32 = q.y * q.y;
    let zz: f32 = q.z * q.z;
    let xy: f32 = q.x * q.y;
    let zw: f32 = q.z * q.w;
    let zx: f32 = q.z * q.x;
    let yw: f32 = q.y * q.w;
    let yz: f32 = q.y * q.z;
    let xw: f32 = q.x * q.w;

    return mat3x3f(
        1.0 - 2.0 * (yy + zz), 2.0 * (xy + zw), 2.0 * (zx - yw),
        2.0 * (xy - zw), 1.0 - 2.0 * (zz + xx), 2.0 * (yz + xw),
        2.0 * (zx + yw), 2.0 * (yz - xw), 1.0 - 2.0 * (yy + xx)
    );
}

fn slerp(q0: vec4f, _q1: vec4f, t: f32) -> vec4f {
    var q1: vec4f = _q1;

    var cosTheta: f32 = dot(q0, q1);

    // if (cosTheta < 0.0) {
    //     q1 = -q1;
    //     cosTheta = -cosTheta;
    // }
    q1 = mix(-q1, q1, step(0.0, cosTheta));
    cosTheta = abs(cosTheta);
    
    if (cosTheta > 0.999999) {
        return normalize(mix(q0, q1, t));
    }

    var theta: f32 = acos(cosTheta);
    var sinTheta: f32 = sin(theta);

    var w0: f32 = sin((1.0 - t) * theta) / sinTheta;
    var w1: f32 = sin(t * theta) / sinTheta;

    return q0 * w0 + q1 * w1;
}
#endif

#endif
`;
