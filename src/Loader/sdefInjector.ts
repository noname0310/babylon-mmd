import type { ThinEngine } from "@babylonjs/core/Engines/thinEngine";
import type { Effect, IEffectCreationOptions } from "@babylonjs/core/Materials/effect";
import type { IEffectFallbacks } from "@babylonjs/core/Materials/iEffectFallbacks";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { Nullable } from "@babylonjs/core/types";

import { SdefBufferKind } from "./sdefBufferKind";
import { sdefDeclaration } from "./Shader/sdefDeclaration";
import { sdefVertex } from "./Shader/sdefVertex";

/**
 * Sdef injector
 *
 * This class is used to inject SDEF code into the vertex shader
 */
export class SdefInjector {
    /**
     * Override engine create effect
     *
     * Inject the code so that all GLSL fragment shaders support Spherical Defromation(SDEF)
     *
     * If you want shadow map or postprocessing shaders to support SDEF call this method before creating the shadow map or postprocess render pipeline
     * @param engine Engine
     */
    public static OverrideEngineCreateEffect(engine: ThinEngine): void {
        const originalCreateEffect = engine.createEffect.bind(engine);
        engine.createEffect = function(
            baseName: any,
            attributesNamesOrOptions: string[] | IEffectCreationOptions,
            uniformsNamesOrEngine: string[] | ThinEngine,
            samplers?: string[],
            defines?: string,
            fallbacks?: IEffectFallbacks,
            onCompiled?: Nullable<(effect: Effect) => void>,
            onError?: Nullable<(effect: Effect, errors: string) => void>,
            indexParameters?: any,
            shaderLanguage = ShaderLanguage.GLSL
        ): Effect {
            let effectCreationOptions: IEffectCreationOptions;
            if ((<IEffectCreationOptions>attributesNamesOrOptions).attributes) {
                effectCreationOptions = attributesNamesOrOptions as IEffectCreationOptions;
            } else {
                effectCreationOptions = {
                    attributes: attributesNamesOrOptions as string[],
                    uniformsNames: uniformsNamesOrEngine as string[],
                    uniformBuffersNames: [],
                    samplers: samplers ?? [],
                    defines: defines ?? "",
                    fallbacks: fallbacks ?? null,
                    onCompiled: onCompiled ?? null,
                    onError: onError ?? null,
                    indexParameters: indexParameters ?? null,
                    shaderLanguage: shaderLanguage
                };
            }

            if (effectCreationOptions.shaderLanguage === ShaderLanguage.GLSL || effectCreationOptions.shaderLanguage === undefined) {
                if (effectCreationOptions.uniformsNames.includes("mBones") || effectCreationOptions.samplers.includes("boneSampler")) {
                    if (effectCreationOptions.defines.indexOf("#define SDEF") === -1) {

                        effectCreationOptions.attributes.push(SdefBufferKind.MatricesSdefCKind);
                        effectCreationOptions.attributes.push(SdefBufferKind.MatricesSdefR0Kind);
                        effectCreationOptions.attributes.push(SdefBufferKind.MatricesSdefR1Kind);
                        effectCreationOptions.defines += "\n#define SDEF";

                        const originalProcessCodeAfterIncludes = effectCreationOptions.processCodeAfterIncludes;
                        effectCreationOptions.processCodeAfterIncludes = originalProcessCodeAfterIncludes
                            ? function(shaderType: string, code: string): string {
                                code = originalProcessCodeAfterIncludes!(shaderType, code);
                                return SdefInjector.ProcessSdefCode(shaderType, code);
                            }
                            : SdefInjector.ProcessSdefCode;
                    }
                }
            }

            return originalCreateEffect(
                baseName,
                effectCreationOptions,
                this
            );
        };
    }

    /**
     * Returns the result of putting the SDEF code in the shader
     *
     * You can use this method if you want to manually inject shader
     *
     * This method is usually not used directly
     * @param shaderType Shader type
     * @param code Shader code
     * @returns Shader code that SDEF is injected
     */
    public static ProcessSdefCode(shaderType: string, code: string): string {
        if (shaderType !== "vertex") return code;

        const vertexDefInjectionPoint = "#define CUSTOM_VERTEX_DEFINITIONS";
        code = code.replace(vertexDefInjectionPoint, `${vertexDefInjectionPoint}\n${sdefDeclaration}`);

        const sdefVertexInjectionPoint = new RegExp("finalWorld=finalWorld\\*influence;", "g");
        code = code.replace(sdefVertexInjectionPoint, `${sdefVertex}\nfinalWorld=finalWorld*influence;`);

        return code;
    }
}
