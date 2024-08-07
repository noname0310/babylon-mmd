import type { IAnimatable } from "@babylonjs/core/Animations/animatable.interface";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { StandardMaterial, StandardMaterialDefines } from "@babylonjs/core/Materials/standardMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import { serialize, serializeAsTexture } from "@babylonjs/core/Misc/decorators";
import { RegisterClass } from "@babylonjs/core/Misc/typeStore";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import { MmdBufferKind } from "./mmdBufferKind";
import { sdefDeclaration } from "./Shaders/sdefDeclaration";
import { sdefVertex } from "./Shaders/sdefVertex";

/**
 * @internal
 */
export interface IMmdPluginMaterial {
    sphereTexture: Nullable<Texture>;
    sphereTextureBlendMode: MmdPluginMaterialSphereTextureBlendMode;

    toonTexture: Nullable<Texture>;

    ignoreDiffuseWhenToonTextureIsNull: boolean;

    applyAmbientColorToDiffuse: boolean;

    clampAlpha: boolean;

    textureMultiplicativeColor: Color4;
    textureAdditiveColor: Color4;

    sphereTextureMultiplicativeColor: Color4;
    sphereTextureAdditiveColor: Color4;

    toonTextureMultiplicativeColor: Color4;
    toonTextureAdditiveColor: Color4;

    useTextureColor: boolean;
    useSphereTextureColor: boolean;
    useToonTextureColor: boolean;
}

/**
 * for convert MMD material to Babylon material
 *
 * use StandardMaterial as base class
 *
 * propertiy mapping:
 *
 * - diffuse[0..2]: diffuseColor
 * - specular: specularColor
 * - ambient: ambientColor
 * - diffuse[3](opaque): alpha
 * - shininess(reflect): specularPower
 * - isDoubleSided: backFaceCulling
 * - enabledToonEdge: (custom implementation)
 * - edgeColor: (custom implementation)
 * - edgeSize: (custom implementation)
 * - texture: diffuseTexture
 * - sphereTexture: (custom implementation)
 * - toonTexture: (custom implementation)
 *
 * using options:
 *
 * useAlphaFromDiffuseTexture
 *
 * additinal implementation:
 *
 * spherical deformation
 */

// https://cyos.babylonjs.com/

// spherical environment mapping reference:
// https://learn.microsoft.com/en-us/windows/win32/direct3d9/spherical-environment-mapping

export class MmdPluginMererialDefines extends MaterialDefines {
    /* eslint-disable @typescript-eslint/naming-convention */
    public SPHERE_TEXTURE = false;
    public SPHERE_TEXTURE_BLEND_MODE_MULTIPLY = false;
    public SPHERE_TEXTURE_BLEND_MODE_ADD = false;
    public TOON_TEXTURE = false;
    public IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED = false;
    public APPLY_AMBIENT_COLOR_TO_DIFFUSE = false;
    public CLAMP_ALPHA = false;
    public TEXTURE_COLOR = false;
    public SPHERE_TEXTURE_COLOR = false;
    public TOON_TEXTURE_COLOR = false;
    public SDEF = false;
    /* eslint-enable @typescript-eslint/naming-convention */
}

export enum MmdPluginMaterialSphereTextureBlendMode {
    Multiply = 1,
    Add = 2,
    SubTexture = 3
}

export class MmdPluginMaterial extends MaterialPluginBase {
    @serializeAsTexture("sphereTexture")
    private _sphereTexture: Nullable<Texture> = null;
    @serialize("sphereTextureBlendMode")
    private _sphereTextureBlendMode = MmdPluginMaterialSphereTextureBlendMode.Add;

    @serializeAsTexture("toonTexture")
    private _toonTexture: Nullable<Texture> = null;
    @serialize("ignoreDiffuseWhenToonTextureIsNull")
    private _ignoreDiffuseWhenToonTextureIsNull = false;

    public textureMultiplicativeColor = new Color4(1, 1, 1, 1);
    public textureAdditiveColor = new Color4(0, 0, 0, 0);
    public sphereTextureMultiplicativeColor = new Color4(1, 1, 1, 1);
    public sphereTextureAdditiveColor = new Color4(0, 0, 0, 0);
    public toonTextureMultiplicativeColor = new Color4(1, 1, 1, 1);
    public toonTextureAdditiveColor = new Color4(0, 0, 0, 0);

    @serialize("applyAmbientColorToDiffuse")
    private _applyAmbientColorToDiffuse = true;
    @serialize("clampAlpha")
    private _clampAlpha = true;

    private _useTextureColor = false;
    private _useSphereTextureColor = false;
    private _useToonTextureColor = false;

    private _isEnabled = false;

    public get isEnabled(): boolean {
        return this._isEnabled;
    }

    public set isEnabled(value: boolean) {
        if (this._isEnabled === value) return;
        this._isEnabled = value;
        this.markAllDefinesAsDirty();
        this._enable(value);
    }

    public get sphereTexture(): Nullable<Texture> {
        return this._sphereTexture;
    }

    public set sphereTexture(value: Nullable<Texture>) {
        if (this._sphereTexture === value) return;
        this._sphereTexture = value;
        this._markAllSubMeshesAsTexturesDirty();
    }

    public get sphereTextureBlendMode(): MmdPluginMaterialSphereTextureBlendMode {
        return this._sphereTextureBlendMode;
    }

    public set sphereTextureBlendMode(value: MmdPluginMaterialSphereTextureBlendMode) {
        if (this._sphereTextureBlendMode === value) return;
        this._sphereTextureBlendMode = value;
        this.markAllDefinesAsDirty();
    }

    public get toonTexture(): Nullable<Texture> {
        return this._toonTexture;
    }

    public set toonTexture(value: Nullable<Texture>) {
        if (this._toonTexture === value) return;
        this._toonTexture = value;
        this._markAllSubMeshesAsTexturesDirty();
    }

    public get ignoreDiffuseWhenToonTextureIsNull(): boolean {
        return this._ignoreDiffuseWhenToonTextureIsNull;
    }

    public set ignoreDiffuseWhenToonTextureIsNull(value: boolean) {
        if (this._ignoreDiffuseWhenToonTextureIsNull === value) return;
        this._ignoreDiffuseWhenToonTextureIsNull = value;
        this.markAllDefinesAsDirty();
    }

    public get applyAmbientColorToDiffuse(): boolean {
        return this._applyAmbientColorToDiffuse;
    }

    public set applyAmbientColorToDiffuse(value: boolean) {
        if (this._applyAmbientColorToDiffuse === value) return;
        this._applyAmbientColorToDiffuse = value;
        this.markAllDefinesAsDirty();
    }

    public get clampAlpha(): boolean {
        return this._clampAlpha;
    }

    public set clampAlpha(value: boolean) {
        if (this._clampAlpha === value) return;
        this._clampAlpha = value;
        this.markAllDefinesAsDirty();
    }

    public get useTextureColor(): boolean {
        return this._useTextureColor;
    }

    public set useTextureColor(value: boolean) {
        if (this._useTextureColor === value) return;
        this._useTextureColor = value;
        this.markAllDefinesAsDirty();
    }

    public get useSphereTextureColor(): boolean {
        return this._useSphereTextureColor;
    }

    public set useSphereTextureColor(value: boolean) {
        if (this._useSphereTextureColor === value) return;
        this._useSphereTextureColor = value;
        this.markAllDefinesAsDirty();
    }

    public get useToonTextureColor(): boolean {
        return this._useToonTextureColor;
    }

    public set useToonTextureColor(value: boolean) {
        if (this._useToonTextureColor === value) return;
        this._useToonTextureColor = value;
        this.markAllDefinesAsDirty();
    }

    private readonly _internalMarkAllSubMeshesAsTexturesDirty: () => void;

    public _markAllSubMeshesAsTexturesDirty(): void {
        this._enable(this._isEnabled);
        this._internalMarkAllSubMeshesAsTexturesDirty();
    }

    public constructor(
        material: StandardMaterial,
        addtoPluginList = true,
        enable = false,
        resolveIncludes = false
    ) {
        super(material, "MmdMaterial", 100, new MmdPluginMererialDefines(), addtoPluginList, enable, resolveIncludes);

        this._internalMarkAllSubMeshesAsTexturesDirty = material._dirtyCallbacks[Constants.MATERIAL_TextureDirtyFlag];
    }

    public override isReadyForSubMesh(defines: MaterialDefines, scene: Scene): boolean {
        if (!this._isEnabled) return true;

        if (defines._areTexturesDirty && scene.texturesEnabled) {
            if (this._sphereTexture && !this._sphereTexture.isReadyOrNotBlocking()) {
                return false;
            }
        }

        return true;
    }

    public override bindForSubMesh(uniformBuffer: UniformBuffer, scene: Scene, _engine: AbstractEngine, subMesh: SubMesh): void {
        if (!this._isEnabled) return;

        const defines = subMesh!.materialDefines as StandardMaterialDefines & MmdPluginMererialDefines;
        const isFrozen = this._material.isFrozen;

        if (!uniformBuffer.useUbo || !isFrozen || !uniformBuffer.isSync) {
            if (defines.DIFFUSE && defines.TEXTURE_COLOR) {
                uniformBuffer.updateDirectColor4("textureMultiplicativeColor", this.textureMultiplicativeColor);
                uniformBuffer.updateDirectColor4("textureAdditiveColor", this.textureAdditiveColor);
            }

            if (defines.NORMAL && defines.SPHERE_TEXTURE && defines.SPHERE_TEXTURE_COLOR) {
                uniformBuffer.updateDirectColor4("sphereTextureMultiplicativeColor", this.sphereTextureMultiplicativeColor);
                uniformBuffer.updateDirectColor4("sphereTextureAdditiveColor", this.sphereTextureAdditiveColor);
            }

            if (defines.TOON_TEXTURE && defines.TOON_TEXTURE_COLOR) {
                uniformBuffer.updateDirectColor4("toonTextureMultiplicativeColor", this.toonTextureMultiplicativeColor);
                uniformBuffer.updateDirectColor4("toonTextureAdditiveColor", this.toonTextureAdditiveColor);
            }

            if (defines.SPHERE_TEXTURE && subMesh.effect !== null) {
                this._material.bindView(subMesh.effect);
            }
        }

        if (scene.texturesEnabled) {
            if (defines.NORMAL && this._sphereTexture) uniformBuffer.setTexture("sphereSampler", this._sphereTexture);

            if (this._toonTexture) uniformBuffer.setTexture("toonSampler", this._toonTexture);
        }
    }

    public override dispose(forceDisposeTextures?: boolean | undefined): void {
        if (forceDisposeTextures) {
            this._sphereTexture?.dispose();
            this._toonTexture?.dispose();
        }
    }

    public override getCustomCode(shaderType: string): Nullable<{ [pointName: string]: string; }> {
        if (shaderType === "vertex") {
            const codes: { [pointName: string]: string; } = {};

            codes["CUSTOM_VERTEX_DEFINITIONS"] = sdefDeclaration;

            codes[`!${this._escapeRegExp("finalWorld=finalWorld*influence;")}`] = /* glsl */`
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

            codes[`!${this._escapeRegExp("#if defined(REFLECTIONMAP_SPHERICAL) || defined(REFLECTIONMAP_PROJECTION) || defined(REFRACTION) || defined(PREPASS)\nuniform mat4 view;\n#endif")}`] = /* glsl */`
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

            codes[`!${this._escapeRegExp("vec3 diffuseColor=vDiffuseColor.rgb;")}`] = /* glsl */`
                #ifdef APPLY_AMBIENT_COLOR_TO_DIFFUSE
                    vec3 diffuseColor = clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);
                #else
                    vec3 diffuseColor = (vDiffuseColor.rgb);
                #endif
            `;

            codes[`!${this._escapeRegExp("float alpha=vDiffuseColor.a;")}`] = /* glsl */`
                #ifdef CLAMP_ALPHA
                    float alpha = clamp(vDiffuseColor.a, 0.0, 1.0);
                #else
                    float alpha = vDiffuseColor.a;
                #endif
            `;

            codes[`!${this._escapeRegExp("baseColor=texture2D(diffuseSampler,vDiffuseUV+uvOffset);")}`] = /* glsl */`
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

            codes[`!${this._escapeRegExp("struct lightingInfo\n{")}`] = /* glsl */`
                struct lightingInfo {
                #ifdef TOON_TEXTURE
                    #if !defined(NDOTL)
                        float ndl;
                    #endif
                    float isToon;
                #endif
            `;

            // ndl might be clamped to 1.0
            codes[`!${this._escapeRegExp("result.diffuse=ndl*diffuseColor*attenuation;")}`] = /* glsl */`
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

            codes[`!${this._escapeRegExp("diffuseBase+=info.diffuse*shadow;")}`] = /* glsl */`
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

            codes[`!${this._escapeRegExp(finalDiffuse)}`] = /* glsl */`
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

    public override prepareDefines(defines: MmdPluginMererialDefines, scene: Scene, mesh: Mesh): void {
        if (this._isEnabled) {
            const texturesEnabled = scene.texturesEnabled;
            defines.SPHERE_TEXTURE = this._sphereTexture !== null && texturesEnabled;
            defines.SPHERE_TEXTURE_BLEND_MODE_MULTIPLY = this._sphereTextureBlendMode === MmdPluginMaterialSphereTextureBlendMode.Multiply;
            defines.SPHERE_TEXTURE_BLEND_MODE_ADD = this._sphereTextureBlendMode === MmdPluginMaterialSphereTextureBlendMode.Add;
            // todo: support sub texture mode
            defines.TOON_TEXTURE = this._toonTexture !== null && texturesEnabled;
            defines.IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED = this._ignoreDiffuseWhenToonTextureIsNull;
            defines.APPLY_AMBIENT_COLOR_TO_DIFFUSE = this._applyAmbientColorToDiffuse;
            defines.CLAMP_ALPHA = this._clampAlpha;
            defines.TEXTURE_COLOR = this._useTextureColor;
            defines.SPHERE_TEXTURE_COLOR = this._useSphereTextureColor;
            defines.TOON_TEXTURE_COLOR = this._useToonTextureColor;
            defines.SDEF = mesh.useBones && mesh.computeBonesUsingShaders && (mesh.skeleton ? true : false) && mesh.isVerticesDataPresent(MmdBufferKind.MatricesSdefCKind);
        } else {
            defines.SPHERE_TEXTURE = false;
            defines.SPHERE_TEXTURE_BLEND_MODE_MULTIPLY = false;
            defines.SPHERE_TEXTURE_BLEND_MODE_ADD = false;
            defines.TOON_TEXTURE = false;
            defines.IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED = false;
            defines.APPLY_AMBIENT_COLOR_TO_DIFFUSE = false;
            defines.CLAMP_ALPHA = false;
            defines.TEXTURE_COLOR = false;
            defines.SPHERE_TEXTURE_COLOR = false;
            defines.TOON_TEXTURE_COLOR = false;
            defines.SDEF = false;
        }
    }

    public override hasTexture(texture: BaseTexture): boolean {
        return this._sphereTexture === texture || this._toonTexture === texture;
    }

    public override getActiveTextures(activeTextures: BaseTexture[]): void {
        if (this._sphereTexture) activeTextures.push(this._sphereTexture);

        if (this._toonTexture) activeTextures.push(this._toonTexture);
    }

    public override getAnimatables(animatables: IAnimatable[]): void {
        if (this._sphereTexture && this._sphereTexture.animations && 0 < this._sphereTexture.animations.length) {
            animatables.push(this._sphereTexture);
        }

        if (this._toonTexture && this._toonTexture.animations && 0 < this._toonTexture.animations.length) {
            animatables.push(this._toonTexture);
        }
    }

    public override getSamplers(samplers: string[]): void {
        samplers.push("sphereSampler", "toonSampler");
    }

    public override getAttributes(attributes: string[], _scene: Scene, mesh: AbstractMesh): void {
        if (this._isEnabled) {
            if (mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton && mesh.isVerticesDataPresent(MmdBufferKind.MatricesSdefCKind)) {
                attributes.push(MmdBufferKind.MatricesSdefCKind);
                attributes.push(MmdBufferKind.MatricesSdefRW0Kind);
                attributes.push(MmdBufferKind.MatricesSdefRW1Kind);
            }
        }
    }

    public override getUniforms(): {
        ubo: { name: string; size: number; type: string; }[];
        fragment: string;
        } {
        return {
            "ubo": [
                { name: "textureMultiplicativeColor", size: 4, type: "vec4" },
                { name: "textureAdditiveColor", size: 4, type: "vec4" },
                { name: "sphereTextureMultiplicativeColor", size: 4, type: "vec4" },
                { name: "sphereTextureAdditiveColor", size: 4, type: "vec4" },
                { name: "toonTextureMultiplicativeColor", size: 4, type: "vec4" },
                { name: "toonTextureAdditiveColor", size: 4, type: "vec4" }
            ],
            "fragment": /* glsl */`
                #if defined(DIFFUSE) && defined(TEXTURE_COLOR)
                    uniform vec4 textureMultiplicativeColor;
                    uniform vec4 textureAdditiveColor;
                #endif
                #if defined(SPHERE_TEXTURE) && defined(SPHERE_TEXTURE_COLOR)
                    uniform vec4 sphereTextureMultiplicativeColor;
                    uniform vec4 sphereTextureAdditiveColor;
                #endif
                #if defined(TOON_TEXTURE) && defined(TOON_TEXTURE_COLOR)
                    uniform vec4 toonTextureMultiplicativeColor;
                    uniform vec4 toonTextureAdditiveColor;
                #endif
            `
        };
    }

    public override getClassName(): string {
        return "MmdPluginMaterial";
    }

    private _escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}

RegisterClass("BABYLON.MmdPluginMaterial", MmdPluginMaterial);
