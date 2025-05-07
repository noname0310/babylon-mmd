import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { Nullable } from "@babylonjs/core/types";

import { MmdPluginMaterial as MmdPluginMaterialBase } from "../mmdPluginMaterial";
import { EscapeRegExp } from "./escapeRegExp";
import { SdefDeclaration } from "./sdefDeclaration";
import { SdefVertex } from "./sdefVertex";

export class MmdPluginMaterial extends MmdPluginMaterialBase {
    /**
     * Gets a boolean indicating that the plugin is compatible with a given shader language.
     * @param shaderLanguage The shader language to use.
     * @returns true if the plugin is compatible with the shader language
     */
    public override isCompatible(shaderLanguage: ShaderLanguage): boolean {
        switch (shaderLanguage) {
        case ShaderLanguage.WGSL:
            return true;
        default:
            return false;
        }
    }

    public override getCustomCode(shaderType: string): Nullable<{ [pointName: string]: string; }> {
        if (shaderType === "vertex") {
            const codes: { [pointName: string]: string; } = {};

            codes["CUSTOM_VERTEX_DEFINITIONS"] = SdefDeclaration;

            codes[`!${EscapeRegExp("finalWorld=finalWorld*influence;")}`] = /* wgsl */`
                ${SdefVertex}
                
                finalWorld = (finalWorld * influence);
            `;

            return codes;
        }

        if (shaderType === "fragment") {
            const codes: { [pointName: string]: string; } = {};

            codes["CUSTOM_FRAGMENT_DEFINITIONS"] = /* wgsl */`
                #if defined(SPHERE_TEXTURE) && defined(NORMAL)
                    var sphereSamplerSampler: sampler;
                    var sphereSampler: texture_2d<f32>;
                #endif
                #ifdef TOON_TEXTURE
                    var toonSamplerSampler: sampler;
                    var toonSampler: texture_2d<f32>;
                #endif
            `;

            codes["CUSTOM_FRAGMENT_MAIN_BEGIN"] = /* wgsl */`
                #ifdef TOON_TEXTURE
                    var toonNdl: vec3f;
                #endif
            `;

            codes[`!${EscapeRegExp("var diffuseColor: vec3f=uniforms.vDiffuseColor.rgb;")}`] = /* wgsl */`
                #ifdef APPLY_AMBIENT_COLOR_TO_DIFFUSE
                    var diffuseColor: vec3f = clamp(uniforms.vDiffuseColor.rgb + uniforms.vAmbientColor, vec3f(0.0), vec3f(1.0));
                #else
                    var diffuseColor: vec3f = (uniforms.vDiffuseColor.rgb);
                #endif
            `;

            codes[`!${EscapeRegExp("var alpha: f32=uniforms.vDiffuseColor.a;")}`] = /* wgsl */`
                #ifdef CLAMP_ALPHA
                    var alpha: f32 = clamp(uniforms.vDiffuseColor.a, 0.0, 1.0);
                #else
                    var alpha: f32 = uniforms.vDiffuseColor.a;
                #endif
            `;

            codes[`!${EscapeRegExp("baseColor=textureSample(diffuseSampler,diffuseSamplerSampler,fragmentInputs.vDiffuseUV+uvOffset);")}`] = /* wgsl */`
                #if defined(DIFFUSE) && defined(TEXTURE_COLOR)
                    baseColor = textureSample(diffuseSampler, diffuseSamplerSampler, (fragmentInputs.vDiffuseUV + uvOffset));
                    baseColor = vec4f(
                        mix(
                            vec3f(1.0),
                            baseColor.rgb * uniforms.textureMultiplicativeColor.rgb,
                            uniforms.textureMultiplicativeColor.a
                        ),
                        baseColor.a
                    );
                    baseColor = vec4f(
                        clamp(
                            baseColor.rgb + (baseColor.rgb - vec3f(1.0)) * uniforms.textureAdditiveColor.a,
                            vec3f(0.0),
                            vec3f(1.0)
                        ) + uniforms.textureAdditiveColor.rgb,
                        baseColor.a
                    );
                #else
                    baseColor = textureSample(diffuseSampler, diffuseSamplerSampler, (fragmentInputs.vDiffuseUV + uvOffset));
                #endif
            `;

            codes[`!${EscapeRegExp("struct lightingInfo\n{")}`] = /* wgsl */`
                struct lightingInfo {
                #ifdef TOON_TEXTURE
                    #ifndef NDOTL
                        ndl: f32,
                    #endif
                    isToon: f32,
                #endif
            `;

            // ndl might be clamped to 1.0
            codes[`!${EscapeRegExp("result.diffuse=ndl*diffuseColor*attenuation;")}`] = /* wgsl */`
                #ifdef TOON_TEXTURE
                    result.diffuse = diffuseColor * attenuation;
                    result.ndl = ndl;
                    result.isToon = 1.0;
                #elif defined(IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED)
                    result.diffuse = diffuseColor * attenuation;
                #else
                    result.diffuse = (ndl * diffuseColor * attenuation);
                #endif
            `;

            codes[`!${EscapeRegExp("diffuseBase+=info.diffuse*shadow;")}`] = /* wgsl */`
                #ifdef TOON_TEXTURE
                    toonNdl = vec3f(clamp(info.ndl * shadow, 0.02, 0.98));
                    toonNdl.r = textureSample(toonSampler, toonSamplerSampler, vec2f(0.5, toonNdl.r)).r;
                    toonNdl.g = textureSample(toonSampler, toonSamplerSampler, vec2f(0.5, toonNdl.g)).g;
                    toonNdl.b = textureSample(toonSampler, toonSamplerSampler, vec2f(0.5, toonNdl.b)).b;

                    #ifdef TOON_TEXTURE_COLOR
                        toonNdl = mix(
                            vec3f(1.0),
                            toonNdl * uniforms.toonTextureMultiplicativeColor.rgb,
                            uniforms.toonTextureMultiplicativeColor.a
                        );
                        toonNdl = clamp(
                            toonNdl + (toonNdl - vec3f(1.0)) * uniforms.toonTextureAdditiveColor.a,
                            vec3f(0.0),
                            vec3f(1.0)
                        ) + uniforms.toonTextureAdditiveColor.rgb;
                    #endif

                    diffuseBase += mix(info.diffuse * shadow, toonNdl * info.diffuse, info.isToon);
                #elif defined(IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED)
                    diffuseBase += info.diffuse;
                #else
                    diffuseBase += (info.diffuse * shadow);
                #endif
            `;

            const finalDiffuse = /* wgsl */`
                #ifdef EMISSIVEASILLUMINATION
                    var finalDiffuse: vec3f = clamp(diffuseBase * diffuseColor + uniforms.vAmbientColor, vec3f(0.0), vec3f(1.0)) * baseColor.rgb;
                #else
                #ifdef LINKEMISSIVEWITHDIFFUSE
                    var finalDiffuse: vec3f = clamp((diffuseBase + emissiveColor) * diffuseColor + uniforms.vAmbientColor, vec3f(0.0), vec3f(1.0)) * baseColor.rgb;
                #else
                    var finalDiffuse: vec3f = clamp(diffuseBase * diffuseColor + emissiveColor + uniforms.vAmbientColor, vec3f(0.0), vec3f(1.0)) * baseColor.rgb;
                #endif
                #endif
            `;

            codes[`!${EscapeRegExp(finalDiffuse)}`] = /* wgsl */`
                #ifdef APPLY_AMBIENT_COLOR_TO_DIFFUSE
                    #ifdef EMISSIVEASILLUMINATION
                        var finalDiffuse: vec3f = clamp(diffuseBase * diffuseColor, vec3f(0.0), vec3f(1.0)) * baseColor.rgb;
                    #else
                        #ifdef LINKEMISSIVEWITHDIFFUSE
                            var finalDiffuse: vec3f = clamp((diffuseBase + emissiveColor) * diffuseColor, vec3f(0.0), vec3f(1.0)) * baseColor.rgb;
                        #else
                            var finalDiffuse: vec3f = clamp(diffuseBase * diffuseColor + emissiveColor, vec3f(0.0), vec3f(1.0)) * baseColor.rgb;
                        #endif
                    #endif
                #else
                    ${finalDiffuse.replace("diffuseBase", "(diffuseBase)")} // prevent regex match bug
                #endif
            `;

            codes["CUSTOM_FRAGMENT_BEFORE_FOG"] = /* wgsl */`
                #if defined(NORMAL) && defined(SPHERE_TEXTURE)
                    var viewSpaceNormal: vec3f = normalize(mat3x3f(scene.view[0].xyz, scene.view[1].xyz, scene.view[2].xyz) * fragmentInputs.vNormalW);

                    var sphereUV: vec2f = viewSpaceNormal.xy * 0.5 + 0.5;

                    var sphereReflectionColor: vec4f = textureSample(sphereSampler, sphereSamplerSampler, sphereUV);
                    #ifdef SPHERE_TEXTURE_COLOR
                        sphereReflectionColor = vec4f(
                            mix(
                                vec3f(1.0),
                                sphereReflectionColor.rgb * uniforms.sphereTextureMultiplicativeColor.rgb,
                                uniforms.sphereTextureMultiplicativeColor.a
                            ),
                            sphereReflectionColor.a
                        );
                        sphereReflectionColor = vec4f(
                            clamp(
                                sphereReflectionColor.rgb + (sphereReflectionColor.rgb - vec3f(1.0)) * uniforms.sphereTextureAdditiveColor.a,
                                vec3f(0.0),
                                vec3f(1.0)
                            ) + uniforms.sphereTextureAdditiveColor.rgb,
                            sphereReflectionColor.a
                        );
                    #endif
                    sphereReflectionColor = vec4f(sphereReflectionColor.rgb * diffuseBase, sphereReflectionColor.a);

                    #ifdef SPHERE_TEXTURE_BLEND_MODE_MULTIPLY
                        color *= sphereReflectionColor;
                    #elif defined(SPHERE_TEXTURE_BLEND_MODE_ADD)
                        color = vec4f(color.rgb + sphereReflectionColor.rgb, color.a);// * sphereReflectionColor.a);
                    #endif
                #endif
            `;

            return codes;
        }
        return null;
    }
}
