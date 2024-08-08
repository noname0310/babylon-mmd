import { Material } from "@babylonjs/core/Materials/material";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import { serialize, serializeAsColor3 } from "@babylonjs/core/Misc/decorators";
import { SerializationHelper } from "@babylonjs/core/Misc/decorators.serialization";
import { RegisterClass } from "@babylonjs/core/Misc/typeStore";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdPluginMaterial } from "./mmdPluginMaterial";
import { MmdPluginMaterialSphereTextureBlendMode } from "./mmdPluginMaterial";

class MmdPluginMaterialMock implements IMmdPluginMaterial {
    public readonly isMock = true;

    public sphereTexture: Nullable<Texture> = null;
    public sphereTextureBlendMode: MmdPluginMaterialSphereTextureBlendMode = MmdPluginMaterialSphereTextureBlendMode.Add;

    public toonTexture: Nullable<Texture> = null;

    public ignoreDiffuseWhenToonTextureIsNull: boolean = false;

    public applyAmbientColorToDiffuse: boolean = true;

    public clampAlpha: boolean = true;

    public textureMultiplicativeColor: Color4 = new Color4(1, 1, 1, 1);
    public textureAdditiveColor: Color4 = new Color4(0, 0, 0, 0);

    public sphereTextureMultiplicativeColor: Color4 = new Color4(1, 1, 1, 1);
    public sphereTextureAdditiveColor: Color4 = new Color4(0, 0, 0, 0);

    public toonTextureMultiplicativeColor: Color4 = new Color4(1, 1, 1, 1);
    public toonTextureAdditiveColor: Color4 = new Color4(0, 0, 0, 0);

    public useTextureColor: boolean = false;
    public useSphereTextureColor: boolean = false;
    public useToonTextureColor: boolean = false;
}

/**
 * MMD standard material
 *
 * This material is an extension of the `StandardMaterial` and includes features for mmd's shading specifications
 *
 * The user can decide whether to activate each mmd shading specification
 *
 * If you disable all features, it behaves the same as `StandardMaterial`
 */
export class MmdStandardMaterial extends StandardMaterial {
    private _pluginMaterial: IMmdPluginMaterial;

    @serialize("renderOutline")
    private _renderOutline = false;

    /**
     * Outline width (default: 0.01)
     */
    @serialize()
    public outlineWidth = 0.01;

    /**
     * Outline color (default: (0, 0, 0))
     */
    @serializeAsColor3()
    public outlineColor: Color3 = new Color3(0, 0, 0);

    /**
     * Outline alpha (default: 1.0)
     */
    @serialize()
    public outlineAlpha = 1.0;

    private _disposed = false;

    /**
     * Create a new MMD standard material
     * @param name Define the name of the material in the scene
     * @param scene The scene the material belongs to
     * @param forceGLSL Use the GLSL code generation for the shader (even on WebGPU). Default is false
     */
    public constructor(name: string, scene?: Scene, forceGLSL = false) {
        super(name, scene, forceGLSL);
        this.specularColor = new Color3(0, 0, 0);

        const pluginMaterialMock = this._pluginMaterial = new MmdPluginMaterialMock();
        pluginMaterialMock.ignoreDiffuseWhenToonTextureIsNull = true;

        this._initPluginShaderSourceAsync(this._shaderLanguage);
    }

    private async _initPluginShaderSourceAsync(shaderLanguage: ShaderLanguage): Promise<void> {
        const mmdPluginMaterial = shaderLanguage === ShaderLanguage.GLSL
            ? (await import(
                /* webpackChunkName: "mmd-shader-glsl" */
                /* webpackMode: "lazy-once" */
                "./Shaders/mmdStandard")
            ).MmdPluginMaterial
            : (await import(
                /* webpackChunkName: "mmd-shader-wgsl" */
                /* webpackMode: "lazy-once" */
                "./ShadersWGSL/mmdStandard")
            ).MmdPluginMaterial;

        if (this._disposed) {
            return;
        }

        const pluginMaterialMock = this._pluginMaterial;
        const pluginMaterial = this._pluginMaterial = new mmdPluginMaterial(this);
        pluginMaterial.isEnabled = true;

        // todo: copy optimization
        pluginMaterial.sphereTexture = pluginMaterialMock.sphereTexture;
        pluginMaterial.sphereTextureBlendMode = pluginMaterialMock.sphereTextureBlendMode;
        pluginMaterial.toonTexture = pluginMaterialMock.toonTexture;
        pluginMaterial.ignoreDiffuseWhenToonTextureIsNull = pluginMaterialMock.ignoreDiffuseWhenToonTextureIsNull;
        pluginMaterial.applyAmbientColorToDiffuse = pluginMaterialMock.applyAmbientColorToDiffuse;
        pluginMaterial.clampAlpha = pluginMaterialMock.clampAlpha;
        pluginMaterial.textureMultiplicativeColor = pluginMaterialMock.textureMultiplicativeColor;
        pluginMaterial.textureAdditiveColor = pluginMaterialMock.textureAdditiveColor;
        pluginMaterial.sphereTextureMultiplicativeColor = pluginMaterialMock.sphereTextureMultiplicativeColor;
        pluginMaterial.sphereTextureAdditiveColor = pluginMaterialMock.sphereTextureAdditiveColor;
        pluginMaterial.toonTextureMultiplicativeColor = pluginMaterialMock.toonTextureMultiplicativeColor;
        pluginMaterial.toonTextureAdditiveColor = pluginMaterialMock.toonTextureAdditiveColor;
        pluginMaterial.useTextureColor = pluginMaterialMock.useTextureColor;
        pluginMaterial.useSphereTextureColor = pluginMaterialMock.useSphereTextureColor;
        pluginMaterial.useToonTextureColor = pluginMaterialMock.useToonTextureColor;
    }

    /**
     * Disposes the material
     * @param forceDisposeEffect specifies if effects should be forcefully disposed
     * @param forceDisposeTextures specifies if textures should be forcefully disposed
     */
    public override dispose(forceDisposeEffect?: boolean, forceDisposeTextures?: boolean): void {
        super.dispose(forceDisposeEffect, forceDisposeTextures);
        this._disposed = true;
    }

    /**
     * Get if the submesh is ready to be used and all its information available.
     * Child classes can use it to update shaders
     * @param mesh defines the mesh to check
     * @param subMesh defines which submesh to check
     * @param useInstances specifies that instances should be used
     * @returns a boolean indicating that the submesh is ready or not
     */
    public override isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        if ((this._pluginMaterial as MmdPluginMaterialMock).isMock) {
            return false;
        }
        return super.isReadyForSubMesh(mesh, subMesh, useInstances);
    }

    /**
     * Get or set sphere texture
     */
    public get sphereTexture(): Nullable<Texture> {
        return this._pluginMaterial.sphereTexture;
    }

    public set sphereTexture(value: Nullable<Texture>) {
        this._pluginMaterial.sphereTexture = value;
    }

    /**
     * Get or set sphere texture blend mode (default: MmdPluginMaterialSphereTextureBlendMode.Add)
     */
    public get sphereTextureBlendMode(): MmdPluginMaterialSphereTextureBlendMode {
        return this._pluginMaterial.sphereTextureBlendMode;
    }

    public set sphereTextureBlendMode(value: MmdPluginMaterialSphereTextureBlendMode) {
        this._pluginMaterial.sphereTextureBlendMode = value;
    }

    /**
     * Get or set toon texture
     */
    public get toonTexture(): Nullable<Texture> {
        return this._pluginMaterial.toonTexture;
    }

    public set toonTexture(value: Nullable<Texture>) {
        this._pluginMaterial.toonTexture = value;
    }

    /**
     * If toe on texture is not set, decide whether to treat it as if it had white toon texture applied (default: true)
     *
     * In general, in order to get a stylized rendering, it's better to do true
     *
     * and if you want a more realistic rendering, it's better to do false
     */
    public get ignoreDiffuseWhenToonTextureIsNull(): boolean {
        return this._pluginMaterial.ignoreDiffuseWhenToonTextureIsNull;
    }

    public set ignoreDiffuseWhenToonTextureIsNull(value: boolean) {
        this._pluginMaterial.ignoreDiffuseWhenToonTextureIsNull = value;
    }

    /**
     * Get or set whether to apply ambient color to diffuse color (default: true)
     *
     * In babylon.js, the ambient color is not affected by the light source, but in mmd, it is
     *
     * Therefore, if you want to get a more mmd-like rendering, it is better to do true
     */
    public get applyAmbientColorToDiffuse(): boolean {
        return this._pluginMaterial.applyAmbientColorToDiffuse;
    }

    public set applyAmbientColorToDiffuse(value: boolean) {
        this._pluginMaterial.applyAmbientColorToDiffuse = value;
    }

    /**
     * Get or set whether to apply clamp `Material.alpha` to 0.0 .. 1.0 (default: false)
     *
     * Babylon.js does not clamp the alpha value
     */
    public get clampAlpha(): boolean {
        return this._pluginMaterial.clampAlpha;
    }

    public set clampAlpha(value: boolean) {
        this._pluginMaterial.clampAlpha = value;
    }

    /**
     * Get or set whether to use the texture multiplicative color (default: (1, 1, 1, 1))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get textureMultiplicativeColor(): Color4 {
        this._pluginMaterial.useTextureColor = true;
        return this._pluginMaterial.textureMultiplicativeColor;
    }

    public set textureMultiplicativeColor(value: Color4) {
        this._pluginMaterial.useTextureColor = true;
        this._pluginMaterial.textureMultiplicativeColor = value;
    }

    /**
     * Get or set whether to use the texture additive color (default: (0, 0, 0, 0))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get textureAdditiveColor(): Color4 {
        this._pluginMaterial.useTextureColor = true;
        return this._pluginMaterial.textureAdditiveColor;
    }

    public set textureAdditiveColor(value: Color4) {
        this._pluginMaterial.useTextureColor = true;
        this._pluginMaterial.textureAdditiveColor = value;
    }

    /**
     * Get or set whether to use the sphere texture multiplicative color (default: (1, 1, 1, 1))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get sphereTextureMultiplicativeColor(): Color4 {
        this._pluginMaterial.useSphereTextureColor = true;
        return this._pluginMaterial.sphereTextureMultiplicativeColor;
    }

    public set sphereTextureMultiplicativeColor(value: Color4) {
        this._pluginMaterial.useSphereTextureColor = true;
        this._pluginMaterial.sphereTextureMultiplicativeColor = value;
    }

    /**
     * Get or set whether to use the sphere texture additive color (default: (0, 0, 0, 0))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get sphereTextureAdditiveColor(): Color4 {
        this._pluginMaterial.useSphereTextureColor = true;
        return this._pluginMaterial.sphereTextureAdditiveColor;
    }

    public set sphereTextureAdditiveColor(value: Color4) {
        this._pluginMaterial.useSphereTextureColor = true;
        this._pluginMaterial.sphereTextureAdditiveColor = value;
    }

    /**
     * Get or set whether to use the toon texture multiplicative color (default: (1, 1, 1, 1))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get toonTextureMultiplicativeColor(): Color4 {
        this._pluginMaterial.useToonTextureColor = true;
        return this._pluginMaterial.toonTextureMultiplicativeColor;
    }

    public set toonTextureMultiplicativeColor(value: Color4) {
        this._pluginMaterial.useToonTextureColor = true;
        this._pluginMaterial.toonTextureMultiplicativeColor = value;
    }

    /**
     * Get or set whether to use the toon texture additive color (default: (0, 0, 0, 0))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get toonTextureAdditiveColor(): Color4 {
        this._pluginMaterial.useToonTextureColor = true;
        return this._pluginMaterial.toonTextureAdditiveColor;
    }

    public set toonTextureAdditiveColor(value: Color4) {
        this._pluginMaterial.useToonTextureColor = true;
        this._pluginMaterial.toonTextureAdditiveColor = value;
    }

    /**
     * Whether to use the outline rendering (default: false)
     */
    public get renderOutline(): boolean {
        return this._renderOutline;
    }

    public set renderOutline(value: boolean) {
        // Lazy Load the component
        if (value) {
            this.getScene().getMmdOutlineRenderer?.();
        }
        this._renderOutline = value;
    }

    /**
     * Specifies if the material will require alpha blending
     * @returns a boolean specifying if alpha blending is needed
     */
    public override needAlphaBlending(): boolean {
        if (this._disableAlphaBlending) {
            return false;
        }

        return super.needAlphaBlending() ||
            (this._pluginMaterial.sphereTexture !== null &&
            this._pluginMaterial.sphereTextureBlendMode === MmdPluginMaterialSphereTextureBlendMode.Multiply);
    }

    /**
     * Makes a duplicate of the material, and gives it a new name
     * @param name defines the new name for the duplicated material
     * @param cloneTexturesOnlyOnce - if a texture is used in more than one channel (e.g diffuse and opacity), only clone it once and reuse it on the other channels. Default false.
     * @param rootUrl defines the root URL to use to load textures
     * @returns the cloned material
     */
    public override clone(name: string, cloneTexturesOnlyOnce: boolean = true, rootUrl = ""): MmdStandardMaterial {
        const result = SerializationHelper.Clone(() => new MmdStandardMaterial(name, this.getScene()), this, { cloneTexturesOnlyOnce });

        result.name = name;
        result.id = name;

        this.stencil.copyTo(result.stencil);

        this._clonePlugins(result, rootUrl);

        return result;
    }

    /**
     * Creates a mmd standard material from parsed material data
     * @param source defines the JSON representation of the material
     * @param scene defines the hosting scene
     * @param rootUrl defines the root URL to use to load textures and relative dependencies
     * @returns a new standard material
     */
    public static override Parse(source: any, scene: Scene, rootUrl: string): StandardMaterial {
        const material = SerializationHelper.Parse(() => new MmdStandardMaterial(source.name, scene), source, scene, rootUrl);

        if (source.stencil) {
            material.stencil.parse(source.stencil, scene, rootUrl);
        }

        Material._ParsePlugins(source, material, scene, rootUrl);

        return material;
    }
}

RegisterClass("BABYLON.MmdStandardMaterial", MmdStandardMaterial);
