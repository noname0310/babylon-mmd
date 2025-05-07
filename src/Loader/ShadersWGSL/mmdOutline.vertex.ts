import "@babylonjs/core/ShadersWGSL/ShadersInclude/bonesDeclaration";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/bakedVertexAnimationDeclaration";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/morphTargetsVertexGlobalDeclaration";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/morphTargetsVertexDeclaration";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/clipPlaneVertexDeclaration";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/instancesDeclaration";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/logDepthDeclaration";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/morphTargetsVertexGlobal";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/morphTargetsVertex";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/instancesVertex";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/bonesVertex";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/bakedVertexAnimation";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/clipPlaneVertex";
import "@babylonjs/core/ShadersWGSL/ShadersInclude/logDepthVertex";

import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";

const Name = "mmdOutlineVertexShader";
const Shader = /* wgsl */`
// Attribute
attribute position: vec3f;
attribute normal: vec3f;

#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>

#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]

#include<clipPlaneVertexDeclaration>

// Uniform
uniform offset: f32;

#include<instancesDeclaration>

uniform viewport: vec2f;
uniform view: mat3x3f;
uniform viewProjection: mat4x4f;
#ifdef WORLDPOS_REQUIRED
uniform inverseViewProjection: mat4x4f;
#endif

#ifdef ALPHATEST
varying vUV: vec2f;
uniform diffuseMatrix: mat4x4f; 
#ifdef UV1
attribute uv: vec2f;
#endif
#ifdef UV2
attribute uv2: vec2f;
#endif
#endif
#include<logDepthDeclaration>


#define CUSTOM_VERTEX_DEFINITIONS

@vertex
fn main(input: VertexInputs) -> FragmentInputs {
    var positionUpdated: vec3f = vertexInputs.position;
    var normalUpdated: vec3f = vertexInputs.normal;
#ifdef UV1
    var uvUpdated: vec2f = vertexInputs.uv;
#endif
#ifdef UV2
    var uv2Updated: vec2f = vertexInputs.uv2;
#endif
    #include<morphTargetsVertexGlobal>
    #include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]

#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>

    var viewNormal: vec3f = uniforms.view * (mat3x3(finalWorld[0].xyz, finalWorld[1].xyz, finalWorld[2].xyz) * normalUpdated);
    var projectedPosition: vec4f = uniforms.viewProjection * finalWorld * vec4f(positionUpdated, 1.0);
    var screenNormal: vec2f = normalize(viewNormal.xy);
    projectedPosition = vec4f(
        projectedPosition.xy + (screenNormal / (uniforms.viewport * 0.25 /* 0.5 */) * uniforms.offset * projectedPosition.w),
        projectedPosition.z,
        projectedPosition.w
    );

    vertexOutputs.position = projectedPosition;
#ifdef WORLDPOS_REQUIRED
    var worldPos: vec4f = uniforms.inverseViewProjection * projectedPosition;
#endif

#ifdef ALPHATEST
#ifdef UV1
    vertexOutputs.vUV = (uniforms.diffuseMatrix * vec4f(uvUpdated, 1.0, 0.0)).xy;
#endif
#ifdef UV2
    vertexOutputs.vUV = (uniforms.diffuseMatrix * vec4f(uv2Updated, 1.0, 0.0)).xy;
#endif
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
}
`;
// Sideeffect
ShaderStore.ShadersStoreWGSL[Name] = Shader;
/** @internal */
export const MmdOutlineVertexShader = { name: Name, shader: Shader };
