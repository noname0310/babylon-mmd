export const sdefVertex = /* wgsl */`
#ifndef SDEFVERTEX
#define SDEFVERTEX

#if !defined(BAKED_VERTEX_ANIMATION_TEXTURE) && defined(SDEF)

#if NUM_BONE_INFLUENCERS > 0
{
    let weight0: f32 = vertexInputs.matricesWeights[0];
    let weight1: f32 = vertexInputs.matricesWeights[1];

    #ifdef BONETEXTURE
        let transformMatrix0: mat4x4f = readMatrixFromRawSampler(boneSampler, vertexInputs.matricesIndices[0]);
        let transformMatrix1: mat4x4f = readMatrixFromRawSampler(boneSampler, vertexInputs.matricesIndices[1]);
    #else
        let transformMatrix0: mat4x4f = uniforms.mBones[int(vertexInputs.matricesIndices[0])];
        let transformMatrix1: mat4x4f = uniforms.mBones[int(vertexInputs.matricesIndices[1])];
    #endif

    let slerpedRotationMatrix: mat3x3f = quaternionToRotationMatrix(slerp(
        rotationMatrixToQuaternion(mat3x3f(transformMatrix0[0].xyz, transformMatrix0[1].xyz, transformMatrix0[2].xyz)),
        rotationMatrixToQuaternion(mat3x3f(transformMatrix1[0].xyz, transformMatrix1[1].xyz, transformMatrix1[2].xyz)),
        weight1
    ));

    // -center transform
    var sdefInflunce: mat4x4f = mat4x4f(
        vec4f(1.0, 0.0, 0.0, 0.0),
        vec4f(0.0, 1.0, 0.0, 0.0),
        vec4f(0.0, 0.0, 1.0, 0.0),
        vec4f(-vertexInputs.matricesSdefC, 1.0)
    );

    // rotation
    let rotationMatrix: mat4x4f = mat4x4f(
        vec4f(slerpedRotationMatrix[0], 0.0),
        vec4f(slerpedRotationMatrix[1], 0.0),
        vec4f(slerpedRotationMatrix[2], 0.0),
        vec4f(0.0, 0.0, 0.0, 1.0)
    );
    sdefInflunce = rotationMatrix * sdefInflunce;

    // add position offset
    let positionOffset: vec3f =
        (transformMatrix0 * vec4f(vertexInputs.matricesSdefRW0, 1)).xyz * weight0 +
        (transformMatrix1 * vec4f(vertexInputs.matricesSdefRW1, 1)).xyz * weight1;

    sdefInflunce[3] += vec4f(positionOffset, 0.0);
    
    let useLinearDeform: f32 = step(0.0, -abs(vertexInputs.matricesSdefRW0.x));

    influence = mat4x4f(
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
