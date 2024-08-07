import "@babylonjs/core/Shaders/ShadersInclude/clipPlaneFragmentDeclaration";
import "@babylonjs/core/Shaders/ShadersInclude/logDepthDeclaration";
import "@babylonjs/core/Shaders/ShadersInclude/clipPlaneFragment";
import "@babylonjs/core/Shaders/ShadersInclude/logDepthFragment";

import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

const name = "mmdOutlinePixelShader";
const shader = /* glsl */`
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
ShaderStore.ShadersStore[name] = shader;
/** @internal */
export const mmdOutlinePixelShader = { name, shader };
