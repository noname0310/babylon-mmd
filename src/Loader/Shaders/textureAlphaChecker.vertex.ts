import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

const name = "textureAlphaCheckerVertexShader";
const shader = /* glsl */`
precision highp float;
attribute vec2 uv;
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(mod(uv, 1.0) * 2.0 - 1.0, 0.0, 1.0);
}
`;
// Sideeffect
ShaderStore.ShadersStore[name] = shader;
/** @internal */
export const textureAlphaCheckerVertexShader = { name, shader };
