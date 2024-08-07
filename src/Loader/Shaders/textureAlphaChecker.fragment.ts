import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

const name = "textureAlphaCheckerPixelShader";
const shader = /* glsl */`
precision highp float;
uniform sampler2D textureSampler;
varying vec2 vUv;

void main() {
    gl_FragColor = vec4(vec3(1.0) - vec3(texture2D(textureSampler, vUv).a), 1.0);
}
`;
// Sideeffect
ShaderStore.ShadersStore[name] = shader;
/** @internal */
export const textureAlphaCheckerPixelShader = { name, shader };
