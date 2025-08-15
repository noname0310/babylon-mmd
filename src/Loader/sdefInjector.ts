import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Effect, IEffectCreationOptions } from "@babylonjs/core/Materials/effect";
import type { IEffectFallbacks } from "@babylonjs/core/Materials/iEffectFallbacks";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { Nullable } from "@babylonjs/core/types";

import { MmdBufferKind } from "./mmdBufferKind";
import { SdefDeclaration } from "./Shaders/sdefDeclaration";
import { SdefVertex } from "./Shaders/sdefVertex";
import { SdefDeclaration as sdefDeclarationWgsl } from "./ShadersWGSL/sdefDeclaration";
import { SdefVertex as sdefVertexWgsl } from "./ShadersWGSL/sdefVertex";

/**
 * Sdef injector
 *
 * This class is used to inject SDEF code into the vertex shader
 */
export class SdefInjector {
    // NOTE: be careful with the Babylon.js createEffect method changes
    /**
     * Override engine create effect
     *
     * Inject the code so that all GLSL fragment shaders support Spherical Defromation(SDEF)
     *
     * If you want shadow map or postprocessing shaders to support SDEF call this method before creating the shadow map or postprocess render pipeline
     * @param engine Engine
     */
    public static OverrideEngineCreateEffect(engine: AbstractEngine): void {
        const originalCreateEffect = engine.createEffect.bind(engine);
        engine.createEffect = function(
            baseName: any,
            attributesNamesOrOptions: string[] | IEffectCreationOptions,
            uniformsNamesOrEngine: string[] | AbstractEngine,
            samplers?: string[],
            defines?: string,
            fallbacks?: IEffectFallbacks,
            onCompiled?: Nullable<(effect: Effect) => void>,
            onError?: Nullable<(effect: Effect, errors: string) => void>,
            indexParameters?: any,
            shaderLanguage = ShaderLanguage.GLSL,
            extraInitializationsAsync?: () => Promise<void>
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
                    shaderLanguage: shaderLanguage,
                    extraInitializationsAsync: extraInitializationsAsync
                };
            }

            if (effectCreationOptions.uniformsNames.includes("mBones") || effectCreationOptions.samplers.includes("boneSampler")) {
                if (effectCreationOptions.defines.indexOf("#define SDEF") === -1) {

                    effectCreationOptions.attributes.push(MmdBufferKind.MatricesSdefCKind);
                    effectCreationOptions.attributes.push(MmdBufferKind.MatricesSdefRW0Kind);
                    effectCreationOptions.attributes.push(MmdBufferKind.MatricesSdefRW1Kind);
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

        if (code.includes("finalWorld=finalWorld*influence;")) {
            const isWgsl = code.includes("fn main");

            const vertexDefInjectionPoint = "#define CUSTOM_VERTEX_DEFINITIONS";
            if (code.includes(vertexDefInjectionPoint)) {
                code = code.replace(vertexDefInjectionPoint, `${vertexDefInjectionPoint}\n${isWgsl ? sdefDeclarationWgsl : SdefDeclaration}`);
            } else {
                const fallbackVertexDefInjectionPoint = "void main() {";
                code = code.replace(fallbackVertexDefInjectionPoint, `${isWgsl ? sdefDeclarationWgsl : SdefDeclaration}\nvoid main() {`);
            }

            const sdefVertexInjectionPoint = new RegExp("finalWorld=finalWorld\\*influence;", "g");
            code = code.replace(sdefVertexInjectionPoint, `${isWgsl ? sdefVertexWgsl : SdefVertex}\nfinalWorld=finalWorld*influence;`);
        }

        return code;
    }
}
