import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Color4 } from "@babylonjs/core/Maths/math.color";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdPluginMaterialSphereTextureBlendMode } from "./mmdPluginMaterial";
import { MmdPluginMaterial } from "./mmdPluginMaterial";

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
    private readonly _pluginMaterial: MmdPluginMaterial;

    private _renderOutline = false;

    /**
     * Outline width (default: 0.01)
     */
    public outlineWidth = 0.01;

    /**
     * Outline color (default: (0, 0, 0))
     */
    public outlineColor: Color3 = new Color3(0, 0, 0);

    /**
     * Outline alpha (default: 1.0)
     */
    public outlineAlpha = 1.0;

    /**
     * Create a new MMD standard material
     * @param name Define the name of the material in the scene
     * @param scene The scene the material belongs to
     */
    public constructor(name: string, scene?: Scene) {
        super(name, scene);
        this.specularColor = new Color3(0, 0, 0);

        const pluginMaterial = this._pluginMaterial = new MmdPluginMaterial(this);
        pluginMaterial.isEnabled = true;
        pluginMaterial.ignoreDiffuseWhenToonTextureIsNull = true;
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
     * Get or set whether to use the texture color (default: (1, 1, 1, 1))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get textureColor(): Color4 {
        this._pluginMaterial.useTextureColor = true;
        return this._pluginMaterial.textureColor;
    }

    public set textureColor(value: Color4) {
        this._pluginMaterial.useTextureColor = true;
        this._pluginMaterial.textureColor = value;
    }

    /**
     * Get or set whether to use the sphere texture color (default: (1, 1, 1, 1))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get sphereTextureColor(): Color4 {
        this._pluginMaterial.useSphereTextureColor = true;
        return this._pluginMaterial.sphereTextureColor;
    }

    public set sphereTextureColor(value: Color4) {
        this._pluginMaterial.useSphereTextureColor = true;
        this._pluginMaterial.sphereTextureColor = value;
    }

    /**
     * Get or set whether to use the toon texture color (default: (1, 1, 1, 1))
     *
     * If this property is first accessed as set, the shader is recompiled to support texture color properties
     *
     * After that, the feature is no longer turned off to prevent shader recompilation
     *
     * These features are subject to change at a later date
     */
    public get toonTextureColor(): Color4 {
        this._pluginMaterial.useToonTextureColor = true;
        return this._pluginMaterial.toonTextureColor;
    }

    public set toonTextureColor(value: Color4) {
        this._pluginMaterial.useToonTextureColor = true;
        this._pluginMaterial.toonTextureColor = value;
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
}
