export const mmdOutlineVertexShader = /* glsl */`
// Attribute
attribute vec3 position;
attribute vec3 normal;

#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>

#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]

#include<clipPlaneVertexDeclaration>

// Uniform
uniform float offset;

#include<instancesDeclaration>

uniform vec2 viewport;
uniform mat3 view;
uniform mat4 viewProjection;
#ifdef WORLDPOS_REQUIRED
uniform mat4 inverseViewProjection;
#endif

#ifdef ALPHATEST
varying vec2 vUV;
uniform mat4 diffuseMatrix;
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#endif
#include<logDepthDeclaration>


#define CUSTOM_VERTEX_DEFINITIONS

void main(void)
{
    vec3 positionUpdated = position;
    vec3 normalUpdated = normal;
#ifdef UV1
    vec2 uvUpdated = uv;
#endif
    #include<morphTargetsVertexGlobal>
    #include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]

#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>

    vec3 viewNormal = view * (mat3(finalWorld) * normalUpdated);
    vec4 projectedPosition = viewProjection * finalWorld * vec4(positionUpdated, 1.0);
    vec2 screenNormal = normalize(vec2(viewNormal));
    projectedPosition.xy += screenNormal / (viewport * 0.25 /* 0.5 */) * offset * projectedPosition.w;

	gl_Position = projectedPosition;
#ifdef WORLDPOS_REQUIRED
    vec4 worldPos = inverseViewProjection * projectedPosition;
#endif

#ifdef ALPHATEST
#ifdef UV1
	vUV = vec2(diffuseMatrix * vec4(uvUpdated, 1.0, 0.0));
#endif
#ifdef UV2
	vUV = vec2(diffuseMatrix * vec4(uv2, 1.0, 0.0));
#endif
#endif
#include<clipPlaneVertex>
#include<logDepthVertex>
}
`;
