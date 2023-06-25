import type {
    AbstractMesh,
    BaseTexture,
    Engine,
    IAnimatable,
    Mesh,
    Nullable,
    Scene,
    StandardMaterial,
    StandardMaterialDefines,
    SubMesh,
    Texture,
    UniformBuffer
} from "@babylonjs/core";
import {
    Color4,
    Constants,
    MaterialDefines,
    MaterialPluginBase
} from "@babylonjs/core";

import { SdefBufferKind } from "./SdefBufferKind";
import { sdefDeclaration } from "./shader/SdefDeclaration";
import { sdefVertex } from "./shader/SdefVertex";

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
    public TEXTURE_COLOR = false;
    public SPHERE_TEXTURE_COLOR = false;
    public TOON_TEXTURE_COLOR = false;
    public SDEF = false;
    /* eslint-enable @typescript-eslint/naming-convention */
}

export enum MmdPluginMaterialSphereTextureBlendMode {
    Multiply = 1,
    Add = 2
}

export class MmdPluginMaterial extends MaterialPluginBase {
    private _sphereTexture: Texture | null = null;
    private _sphereTextureBlendMode = MmdPluginMaterialSphereTextureBlendMode.Add;

    private _toonTexture: Texture | null = null;
    private _ignoreDiffuseWhenToonTextureIsNull = false;

    public textureColor = new Color4(1, 1, 1, 1);
    public sphereTextureColor = new Color4(1, 1, 1, 1);
    public toonTextureColor = new Color4(1, 1, 1, 1);

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

    public get sphereTexture(): Texture | null {
        return this._sphereTexture;
    }

    public set sphereTexture(value: Texture | null) {
        if (this._sphereTexture === value) return;
        this._sphereTexture = value;
        this.markAllSubMeshesAsTexturesDirty();
    }

    public get sphereTextureBlendMode(): MmdPluginMaterialSphereTextureBlendMode {
        return this._sphereTextureBlendMode;
    }

    public set sphereTextureBlendMode(value: MmdPluginMaterialSphereTextureBlendMode) {
        if (this._sphereTextureBlendMode === value) return;
        this._sphereTextureBlendMode = value;
        this.markAllDefinesAsDirty();
    }

    public get toonTexture(): Texture | null {
        return this._toonTexture;
    }

    public set toonTexture(value: Texture | null) {
        if (this._toonTexture === value) return;
        this._toonTexture = value;
        this.markAllSubMeshesAsTexturesDirty();
    }

    public get ignoreDiffuseWhenToonTextureIsNull(): boolean {
        return this._ignoreDiffuseWhenToonTextureIsNull;
    }

    public set ignoreDiffuseWhenToonTextureIsNull(value: boolean) {
        if (this._ignoreDiffuseWhenToonTextureIsNull === value) return;
        this._ignoreDiffuseWhenToonTextureIsNull = value;
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

    public markAllSubMeshesAsTexturesDirty(): void {
        this._enable(this._isEnabled);
        this._internalMarkAllSubMeshesAsTexturesDirty();
    }

    public constructor(material: StandardMaterial, addtoPluginList = true) {
        super(material, "MmdMaterial", 100, new MmdPluginMererialDefines(), addtoPluginList);

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

    public override bindForSubMesh(uniformBuffer: UniformBuffer, scene: Scene, _engine: Engine, subMesh: SubMesh): void {
        if (!this._isEnabled) return;

        const defines = subMesh!.materialDefines as StandardMaterialDefines & MmdPluginMererialDefines;
        const isFrozen = this._material.isFrozen;

        if (!uniformBuffer.useUbo || !isFrozen || !uniformBuffer.isSync) {
            if (defines.DIFFUSE && defines.TEXTURE_COLOR) {
                uniformBuffer.updateDirectColor4("textureColor", this.textureColor);
            }

            if (defines.NORMAL && defines.SPHERE_TEXTURE && defines.SPHERE_TEXTURE_COLOR) {
                uniformBuffer.updateDirectColor4("sphereTextureColor", this.sphereTextureColor);
            }

            if (defines.TOON_TEXTURE && defines.TOON_TEXTURE_COLOR) {
                uniformBuffer.updateDirectColor4("toonTextureColor", this.toonTextureColor);
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
                
                finalWorld = finalWorld * influence;
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

            codes["CUSTOM_FRAGMENT_MAIN_BEGIN"] = /* glsl */`
                #ifdef TOON_TEXTURE
                    vec3 clampedInfoDiffuse;
                    float infoToonDiffuseR;
                    float infoToonDiffuseG;
                    float infoToonDiffuseB;

                    vec3 infoToonDiffuse;
                #endif
            `;

            codes[`!${this._escapeRegExp("#if defined(REFLECTIONMAP_SPHERICAL) || defined(REFLECTIONMAP_PROJECTION) || defined(REFRACTION) || defined(PREPASS)\nuniform mat4 view;\n#endif")}`] = /* glsl */`
                #if defined(REFLECTIONMAP_SPHERICAL) || defined(REFLECTIONMAP_PROJECTION) || defined(REFRACTION) || defined(PREPASS)
                    uniform mat4 view;
                #elif defined(NORMAL) && defined(SPHERE_TEXTURE)
                    uniform mat4 view;
                #endif
            `;

            codes[`!${this._escapeRegExp("baseColor=texture2D(diffuseSampler,vDiffuseUV+uvOffset);")}`] = /* glsl */`
                #if defined(DIFFUSE) && defined(TEXTURE_COLOR)
                    baseColor = texture2D(diffuseSampler, vDiffuseUV + uvOffset) * textureColor;
                #else
                    baseColor = texture2D(diffuseSampler, vDiffuseUV + uvOffset);
                #endif
            `;

            codes[`!${this._escapeRegExp("diffuseBase+=info.diffuse*shadow;")}`] = /* glsl */`
                #ifdef TOON_TEXTURE
                    clampedInfoDiffuse = clamp(info.diffuse, 0.0, 1.0);

                    #ifdef TOON_TEXTURE_COLOR
                        infoToonDiffuseR = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.r)).r * toonTextureColor.r * toonTextureColor.a;
                        infoToonDiffuseG = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.g)).g * toonTextureColor.g * toonTextureColor.a;
                        infoToonDiffuseB = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.b)).b * toonTextureColor.b * toonTextureColor.a;
                    #else
                        infoToonDiffuseR = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.r)).r;
                        infoToonDiffuseG = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.g)).g;
                        infoToonDiffuseB = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.b)).b;
                    #endif
                    
                    infoToonDiffuse = vec3(infoToonDiffuseR, infoToonDiffuseG, infoToonDiffuseB);

                    diffuseBase += infoToonDiffuse * shadow;
                #elif defined(IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED)
                    diffuseBase += vec3(1.0, 1.0, 1.0) * shadow;
                #else
                    diffuseBase += info.diffuse * shadow;
                #endif
            `;

            codes["CUSTOM_FRAGMENT_BEFORE_FOG"] = /* glsl */`
                #if defined(NORMAL) && defined(SPHERE_TEXTURE)
                    vec3 viewSpaceNormal = normalize(mat3(view) * vNormalW);

                    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

                    vec4 sphereReflectionColor = texture2D(sphereSampler, sphereUV);

                    #ifdef SPHERE_TEXTURE_COLOR
                        sphereReflectionColor *= sphereTextureColor;
                    #endif

                    #ifdef SPHERE_TEXTURE_BLEND_MODE_MULTIPLY
                        color *= sphereReflectionColor;
                    #elif defined(SPHERE_TEXTURE_BLEND_MODE_ADD)
                        color += vec4(sphereReflectionColor.rgb, sphereReflectionColor.a * alpha);
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
            defines.TOON_TEXTURE = this._toonTexture !== null && texturesEnabled;
            defines.IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED = this._ignoreDiffuseWhenToonTextureIsNull;
            defines.TEXTURE_COLOR = this._useTextureColor;
            defines.SPHERE_TEXTURE_COLOR = this._useSphereTextureColor;
            defines.TOON_TEXTURE_COLOR = this._useToonTextureColor;
            defines.SDEF = mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton ? true : false && mesh.isVerticesDataPresent(SdefBufferKind.MatricesSdefCKind);
        } else {
            defines.SPHERE_TEXTURE = false;
            defines.SPHERE_TEXTURE_BLEND_MODE_MULTIPLY = false;
            defines.SPHERE_TEXTURE_BLEND_MODE_ADD = false;
            defines.TOON_TEXTURE = false;
            defines.IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED = false;
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
            if (mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton && mesh.isVerticesDataPresent(SdefBufferKind.MatricesSdefCKind)) {
                attributes.push(SdefBufferKind.MatricesSdefCKind);
                attributes.push(SdefBufferKind.MatricesSdefR0Kind);
                attributes.push(SdefBufferKind.MatricesSdefR1Kind);
            }
        }
    }

    public override getUniforms(): {
        ubo: { name: string; size: number; type: string; }[];
        fragment: string;
        } {
        return {
            "ubo": [
                { name: "textureColor", size: 4, type: "vec4" },
                { name: "sphereTextureColor", size: 4, type: "vec4" },
                { name: "toonTextureColor", size: 4, type: "vec4" }
            ],
            "fragment": /* glsl */`
                #if defined(DIFFUSE) && defined(TEXTURE_COLOR)
                    uniform vec4 textureColor;
                #endif
                #if defined(SPHERE_TEXTURE) && defined(SPHERE_TEXTURE_COLOR)
                    uniform vec4 sphereTextureColor;
                #endif
                #if defined(TOON_TEXTURE) && defined(TOON_TEXTURE_COLOR)
                    uniform vec4 toonTextureColor;
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
