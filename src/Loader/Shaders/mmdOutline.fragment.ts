import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import { clipPlaneFragment } from "@babylonjs/core/Shaders/ShadersInclude/clipPlaneFragment";
import { clipPlaneFragmentDeclaration } from "@babylonjs/core/Shaders/ShadersInclude/clipPlaneFragmentDeclaration";
import { logDepthDeclaration } from "@babylonjs/core/Shaders/ShadersInclude/logDepthDeclaration";
import { logDepthFragment } from "@babylonjs/core/Shaders/ShadersInclude/logDepthFragment";

const Name = "mmdOutlinePixelShader";
const Shader = /* glsl */`
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
uniform vec4 color;

#ifdef ALPHATEST
varying vec2 vUV;
uniform sampler2D diffuseSampler;
#endif
#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>


#define CUSTOM_FRAGMENT_DEFINITIONS

void main(void) {

#define CUSTOM_FRAGMENT_MAIN_BEGIN

#include<clipPlaneFragment>

#ifdef ALPHATEST
    if (texture2D(diffuseSampler, vUV).a < 0.4)
        discard;
#endif
#include<logDepthFragment>
    gl_FragColor = color;

#define CUSTOM_FRAGMENT_MAIN_END
}
`;
// Sideeffect
if (!ShaderStore.ShadersStore[Name]) {
    ShaderStore.ShadersStore[Name] = Shader;
}
const Includes = [clipPlaneFragmentDeclaration, logDepthDeclaration, clipPlaneFragment, logDepthFragment];
for (const inc of Includes) {
    if (!ShaderStore.IncludesShadersStore[inc.name]) {
        ShaderStore.IncludesShadersStore[inc.name] = inc.shader;
    }
}
/** @internal */
export const MmdOutlinePixelShader = { name: Name, shader: Shader };
