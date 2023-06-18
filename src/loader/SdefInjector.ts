import type { Effect, IEffectCreationOptions, IEffectFallbacks, Nullable, ThinEngine } from "@babylonjs/core";
import { ShaderLanguage } from "@babylonjs/core";

import { SdefBufferKind } from "./SdefBufferKind";
import { sdefDeclaration } from "./shader/SdefDeclaration";
import { sdefVertex } from "./shader/SdefVertex";

export class SdefInjector {
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

    public static ProcessSdefCode(shaderType: string, code: string): string {
        if (shaderType !== "vertex") return code;

        const vertexDefInjectionPoint = "#define CUSTOM_VERTEX_DEFINITIONS";
        code = code.replace(vertexDefInjectionPoint, `${vertexDefInjectionPoint}\n${sdefDeclaration}`);

        const sdefVertexInjectionPoint = new RegExp("finalWorld=finalWorld\\*influence;", "g");
        code = code.replace(sdefVertexInjectionPoint, `${sdefVertex}\nfinalWorld=finalWorld*influence;`);

        return code;
    }
}
