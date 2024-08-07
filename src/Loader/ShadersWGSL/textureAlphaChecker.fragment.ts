import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

const name = "textureAlphaCheckerPixelShader";
const shader = /* wgsl */`
var textureSamplerSampler: sampler;
var textureSampler: texture_2d<f32>;
varying vUv: vec2f;

@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
    fragmentOutputs.color = vec4f(
        vec3f(1.0) - vec3f(textureSample(textureSampler, textureSamplerSampler, fragmentInputs.vUv).a),
        1.0
    );
}
`;
// Sideeffect
ShaderStore.ShadersStoreWGSL[name] = shader;
/** @internal */
export const textureAlphaCheckerPixelShader = { name, shader };
