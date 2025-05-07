import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

const Name = "textureAlphaCheckerVertexShader";
const Shader = /* wgsl */`
attribute uv: vec2f;
varying vUv: vec2f;

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    vertexOutputs.vUv = vertexInputs.uv;
    vertexOutputs.position = vec4f(
        (vertexInputs.uv % 1.0) * 2.0 - 1.0,
        0.0,
        1.0
    );
}
`;
// Sideeffect
ShaderStore.ShadersStoreWGSL[Name] = Shader;
/** @internal */
export const TextureAlphaCheckerVertexShader = { name: Name, shader: Shader };
