export const sdefVertex = /* glsl */`
#ifndef SDEFVERTEX
#define SDEFVERTEX

#if !defined(BAKED_VERTEX_ANIMATION_TEXTURE) && defined(SDEF)

#if NUM_BONE_INFLUENCERS > 0
{
    float weight0 = matricesWeights[0];
    float weight1 = matricesWeights[1];

    #ifdef BONETEXTURE
        mat4 transformMatrix0 = readMatrixFromRawSampler(boneSampler, matricesIndices[0]);
        mat4 transformMatrix1 = readMatrixFromRawSampler(boneSampler, matricesIndices[1]);
    #else
        mat4 transformMatrix0 = mBones[int(matricesIndices[0])];
        mat4 transformMatrix1 = mBones[int(matricesIndices[1])];
    #endif

    mat3 slerpedRotationMatrix = quaternionToRotationMatrix(slerp(
        rotationMatrixToQuaternion(mat3(transformMatrix0)), 
        rotationMatrixToQuaternion(mat3(transformMatrix1)),
        weight1
    ));

    // -center transform
    mat4 sdefInflunce = mat4(
        vec4(1.0, 0.0, 0.0, 0.0),
        vec4(0.0, 1.0, 0.0, 0.0),
        vec4(0.0, 0.0, 1.0, 0.0),
        vec4(-matricesSdefC, 1.0)
    );

    // rotation
    mat4 rotationMatrix = mat4(
        vec4(slerpedRotationMatrix[0], 0.0),
        vec4(slerpedRotationMatrix[1], 0.0),
        vec4(slerpedRotationMatrix[2], 0.0),
        vec4(0.0, 0.0, 0.0, 1.0)
    );
    sdefInflunce = rotationMatrix * sdefInflunce;

    // add position offset
    vec3 positionOffset =
        vec3(transformMatrix0 * vec4(matricesSdefR0, 1)) * weight0 +
        vec3(transformMatrix1 * vec4(matricesSdefR1, 1)) * weight1;

    sdefInflunce[3] += vec4(positionOffset, 0.0);
    
    float useLinearDeform = step(0.0, -abs(matricesSdefR0.x));

    influence = mat4(
        mix(sdefInflunce[0], influence[0], useLinearDeform),
        mix(sdefInflunce[1], influence[1], useLinearDeform),
        mix(sdefInflunce[2], influence[2], useLinearDeform),
        mix(sdefInflunce[3], influence[3], useLinearDeform)
    );
}
#endif

#endif

#endif
`;
