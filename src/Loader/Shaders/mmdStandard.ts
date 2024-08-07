import type { Nullable } from "@babylonjs/core/types";

import { MmdPluginMaterial as MmdPluginMaterialBase } from "../mmdPluginMaterial";
import { escapeRegExp } from "../Util/escapeRegExp";
import { sdefDeclaration } from "./sdefDeclaration";
import { sdefVertex } from "./sdefVertex";

export class MmdPluginMaterial extends MmdPluginMaterialBase {
    public override getCustomCode(shaderType: string): Nullable<{ [pointName: string]: string; }> {
        if (shaderType === "vertex") {
            const codes: { [pointName: string]: string; } = {};

            codes["CUSTOM_VERTEX_DEFINITIONS"] = sdefDeclaration;

            codes[`!${escapeRegExp("finalWorld=finalWorld*influence;")}`] = /* glsl */`
                ${sdefVertex}
                
                finalWorld = (finalWorld * influence);
            `;

            return codes;
        }

        if (shaderType === "fragment") {
            const codes: { [pointName: string]: string; } = {};

            codes["CUSTOM_FRAGMENT_DEFINITIONS"] = /* glsl */`
                #if defined(SPHERE_TEXTURE) && defined(NORMAL)
                    uniform sampler2D sphereSampler;
                #endif
                #ifdef TOON_TEXTURE
                    uniform sampler2D toonSampler;
                #endif
            `;

            codes[`!${escapeRegExp("#if defined(REFLECTIONMAP_SPHERICAL) || defined(REFLECTIONMAP_PROJECTION) || defined(REFRACTION) || defined(PREPASS)\nuniform mat4 view;\n#endif")}`] = /* glsl */`
                #if defined(REFLECTIONMAP_SPHERICAL) || defined(REFLECTIONMAP_PROJECTION) || defined(REFRACTION) || defined(PREPASS)
                    uniform mat4 view;
                #elif defined(NORMAL) && defined(SPHERE_TEXTURE)
                    uniform mat4 view;
                #endif
            `;

            codes["CUSTOM_FRAGMENT_MAIN_BEGIN"] = /* glsl */`
                #ifdef TOON_TEXTURE
                    vec3 toonNdl;
                #endif
            `;

            codes[`!${escapeRegExp("vec3 diffuseColor=vDiffuseColor.rgb;")}`] = /* glsl */`
                #ifdef APPLY_AMBIENT_COLOR_TO_DIFFUSE
                    vec3 diffuseColor = clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);
                #else
                    vec3 diffuseColor = (vDiffuseColor.rgb);
                #endif
            `;

            codes[`!${escapeRegExp("float alpha=vDiffuseColor.a;")}`] = /* glsl */`
                #ifdef CLAMP_ALPHA
                    float alpha = clamp(vDiffuseColor.a, 0.0, 1.0);
                #else
                    float alpha = vDiffuseColor.a;
                #endif
            `;

            codes[`!${escapeRegExp("baseColor=texture2D(diffuseSampler,vDiffuseUV+uvOffset);")}`] = /* glsl */`
                #if defined(DIFFUSE) && defined(TEXTURE_COLOR)
                    baseColor = texture2D(diffuseSampler, (vDiffuseUV + uvOffset));
                    baseColor.rgb = mix(
                        vec3(1.0),
                        baseColor.rgb * textureMultiplicativeColor.rgb,
                        textureMultiplicativeColor.a
                    );
                    baseColor.rgb = clamp(
                        baseColor.rgb + (baseColor.rgb - vec3(1.0)) * textureAdditiveColor.a,
                        0.0,
                        1.0
                    ) + textureAdditiveColor.rgb;
                #else
                    baseColor = texture2D(diffuseSampler, (vDiffuseUV + uvOffset));
                #endif
            `;

            codes[`!${escapeRegExp("struct lightingInfo\n{")}`] = /* glsl */`
                struct lightingInfo {
                #ifdef TOON_TEXTURE
                    #if !defined(NDOTL)
                        float ndl;
                    #endif
                    float isToon;
                #endif
            `;

            // ndl might be clamped to 1.0
            codes[`!${escapeRegExp("result.diffuse=ndl*diffuseColor*attenuation;")}`] = /* glsl */`
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

            codes[`!${escapeRegExp("diffuseBase+=info.diffuse*shadow;")}`] = /* glsl */`
                #ifdef TOON_TEXTURE
                    toonNdl = vec3(clamp(info.ndl * shadow, 0.02, 0.98));
                    toonNdl.r = texture2D(toonSampler, vec2(0.5, toonNdl.r)).r;
                    toonNdl.g = texture2D(toonSampler, vec2(0.5, toonNdl.g)).g;
                    toonNdl.b = texture2D(toonSampler, vec2(0.5, toonNdl.b)).b;

                    #ifdef TOON_TEXTURE_COLOR
                        toonNdl = mix(
                            vec3(1.0),
                            toonNdl * toonTextureMultiplicativeColor.rgb,
                            toonTextureMultiplicativeColor.a
                        );
                        toonNdl = clamp(
                            toonNdl + (toonNdl - vec3(1.0)) * toonTextureAdditiveColor.a,
                            0.0,
                            1.0
                        ) + toonTextureAdditiveColor.rgb;
                    #endif

                    diffuseBase += mix(info.diffuse * shadow, toonNdl * info.diffuse, info.isToon);
                #elif defined(IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED)
                    diffuseBase += info.diffuse;
                #else
                    diffuseBase += (info.diffuse * shadow);
                #endif
            `;

            const finalDiffuse = /* glsl */`
                #ifdef EMISSIVEASILLUMINATION
                    vec3 finalDiffuse=clamp(diffuseBase*diffuseColor+vAmbientColor,0.0,1.0)*baseColor.rgb;
                #else
                #ifdef LINKEMISSIVEWITHDIFFUSE
                    vec3 finalDiffuse=clamp((diffuseBase+emissiveColor)*diffuseColor+vAmbientColor,0.0,1.0)*baseColor.rgb;
                #else
                    vec3 finalDiffuse=clamp(diffuseBase*diffuseColor+emissiveColor+vAmbientColor,0.0,1.0)*baseColor.rgb;
                #endif
                #endif
            `;

            codes[`!${escapeRegExp(finalDiffuse)}`] = /* glsl */`
                #ifdef APPLY_AMBIENT_COLOR_TO_DIFFUSE
                    #ifdef EMISSIVEASILLUMINATION
                        vec3 finalDiffuse = clamp(diffuseBase * diffuseColor, 0.0, 1.0) * baseColor.rgb;
                    #else
                        #ifdef LINKEMISSIVEWITHDIFFUSE
                            vec3 finalDiffuse = clamp((diffuseBase + emissiveColor) * diffuseColor, 0.0, 1.0) * baseColor.rgb;
                        #else
                            vec3 finalDiffuse = clamp(diffuseBase * diffuseColor + emissiveColor, 0.0, 1.0) * baseColor.rgb;
                        #endif
                    #endif
                #else
                    ${finalDiffuse.replace("diffuseBase", "(diffuseBase)")} // prevent regex match bug
                #endif
            `;

            codes["CUSTOM_FRAGMENT_BEFORE_FOG"] = /* glsl */`
                #if defined(NORMAL) && defined(SPHERE_TEXTURE)
                    vec3 viewSpaceNormal = normalize(mat3(view) * vNormalW);

                    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

                    vec4 sphereReflectionColor = texture2D(sphereSampler, sphereUV);
                    #ifdef SPHERE_TEXTURE_COLOR
                        sphereReflectionColor.rgb = mix(
                            vec3(1.0),
                            sphereReflectionColor.rgb * sphereTextureMultiplicativeColor.rgb,
                            sphereTextureMultiplicativeColor.a
                        );
                        sphereReflectionColor.rgb = clamp(
                            sphereReflectionColor.rgb + (sphereReflectionColor.rgb - vec3(1.0)) * sphereTextureAdditiveColor.a,
                            0.0,
                            1.0
                        ) + sphereTextureAdditiveColor.rgb;
                    #endif
                    sphereReflectionColor.rgb *= diffuseBase;

                    #ifdef SPHERE_TEXTURE_BLEND_MODE_MULTIPLY
                        color *= sphereReflectionColor;
                    #elif defined(SPHERE_TEXTURE_BLEND_MODE_ADD)
                        color = vec4(color.rgb + sphereReflectionColor.rgb, color.a);// * sphereReflectionColor.a);
                    #endif
                #endif
            `;

            return codes;
        }
        return null;
    }
}
