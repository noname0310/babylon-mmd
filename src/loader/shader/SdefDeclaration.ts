export const sdefDeclaration = /* glsl */`
#ifndef SDEFDECLARATION
#define SDEFDECLARATION

#if NUM_BONE_INFLUENCERS > 0 && defined(SDEF)
attribute vec3 matricesSdefC;
attribute vec3 matricesSdefR0;
attribute vec3 matricesSdefR1;

vec4 rotationMatrixToQuaternion(mat3 matrix) {
    float trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
    float s;

    float sqrtParam;
    if (trace > 0.0) {
        sqrtParam = trace + 1.0;
    } else if (matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2]) {
        sqrtParam = 1.0 + matrix[0][0] - matrix[1][1] - matrix[2][2];
    } else if (matrix[1][1] > matrix[2][2]) {
        sqrtParam = 1.0 + matrix[1][1] - matrix[0][0] - matrix[2][2];
    } else {
        sqrtParam = 1.0 + matrix[2][2] - matrix[0][0] - matrix[1][1];
    }
    float sqrtValue = sqrt(sqrtParam);

    if (trace > 0.0) {
        s = 0.5 / sqrtValue;

        return vec4(
            (matrix[1][2] - matrix[2][1]) * s,
            (matrix[2][0] - matrix[0][2]) * s,
            (matrix[0][1] - matrix[1][0]) * s,
            0.25 / s
        );
    } else if (matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2]) {
        s = 2.0 * sqrtValue;

        return vec4(
            0.25 * s,
            (matrix[0][1] + matrix[1][0]) / s,
            (matrix[2][0] + matrix[0][2]) / s,
            (matrix[1][2] - matrix[2][1]) / s
        );
    } else if (matrix[1][1] > matrix[2][2]) {
        s = 2.0 * sqrtValue;
        
        return vec4(
            (matrix[0][1] + matrix[1][0]) / s,
            0.25 * s,
            (matrix[1][2] + matrix[2][1]) / s,
            (matrix[2][0] - matrix[0][2]) / s
        );
    } else {
        s = 2.0 * sqrtValue;

        return vec4(
            (matrix[2][0] + matrix[0][2]) / s,
            (matrix[1][2] + matrix[2][1]) / s,
            0.25 * s,
            (matrix[0][1] - matrix[1][0]) / s
        );
    }
}

mat3 quaternionToRotationMatrix(vec4 q) {
    float xx = q.x * q.x;
    float yy = q.y * q.y;
    float zz = q.z * q.z;
    float xy = q.x * q.y;
    float zw = q.z * q.w;
    float zx = q.z * q.x;
    float yw = q.y * q.w;
    float yz = q.y * q.z;
    float xw = q.x * q.w;

    return mat3(
        1.0 - 2.0 * (yy + zz), 2.0 * (xy + zw), 2.0 * (zx - yw),
        2.0 * (xy - zw), 1.0 - 2.0 * (zz + xx), 2.0 * (yz + xw),
        2.0 * (zx + yw), 2.0 * (yz - xw), 1.0 - 2.0 * (yy + xx)
    );
}

vec4 slerp(vec4 q0, vec4 q1, float t) {
    float cosTheta = dot(q0, q1);

    // if (cosTheta < 0.0) {
    //     q1 = -q1;
    //     cosTheta = -cosTheta;
    // }
    q1 = mix(-q1, q1, step(0.0, cosTheta));
    cosTheta = abs(cosTheta);
    
    if (cosTheta > 0.999999) {
        return normalize(mix(q0, q1, t));
    }

    float theta = acos(cosTheta);
    float sinTheta = sin(theta);

    float w0 = sin((1.0 - t) * theta) / sinTheta;
    float w1 = sin(t * theta) / sinTheta;

    return q0 * w0 + q1 * w1;
}
#endif

#endif
`;
