import type { IAnimatable } from "@babylonjs/core/Animations/animatable.interface";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
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

export abstract class MmdPluginMaterial extends MaterialPluginBase {
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

    /**
     * Gets a boolean indicating that the plugin is compatible with a given shader language.
     * @param shaderLanguage The shader language to use.
     * @returns true if the plugin is compatible with the shader language
     */
    public override isCompatible(_shaderLanguage: ShaderLanguage): boolean {
        return true;
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

    public abstract override getCustomCode(shaderType: string, shaderLanguage?: ShaderLanguage): Nullable<{ [pointName: string]: string; }>;

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

    public override getUniforms(_shaderLanguage?: ShaderLanguage): {
        ubo: { name: string; size: number; type: string; }[];
        fragment?: string;
    } {
        return {
            "ubo": [
                { name: "textureMultiplicativeColor", size: 4, type: "vec4" },
                { name: "textureAdditiveColor", size: 4, type: "vec4" },
                { name: "sphereTextureMultiplicativeColor", size: 4, type: "vec4" },
                { name: "sphereTextureAdditiveColor", size: 4, type: "vec4" },
                { name: "toonTextureMultiplicativeColor", size: 4, type: "vec4" },
                { name: "toonTextureAdditiveColor", size: 4, type: "vec4" }
            ]
        };
    }

    public override getClassName(): string {
        return "MmdPluginMaterial";
    }
}

RegisterClass("BABYLON.MmdPluginMaterial", MmdPluginMaterial);
