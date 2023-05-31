import * as BABYLON from "@babylonjs/core";

import type { MmdPluginMaterialSphereTextureBlendMode } from "./MmdPluginMaterial";
import { MmdPluginMaterial } from "./MmdPluginMaterial";

export class MmdStandardMaterial extends BABYLON.StandardMaterial {
    private readonly _pluginMaterial: MmdPluginMaterial;

    private _renderOutline = false;
    private _renderOverlay = false;
    public outlineWidth = 0.01;
    public outlineColor: BABYLON.Color3 = new BABYLON.Color3(0, 0, 0);
    public overlayColor: BABYLON.Color3 = new BABYLON.Color3(0, 0, 0);
    public overlayAlpha = 1.0;

    public constructor(name: string, scene?: BABYLON.Scene) {
        super(name, scene);
        this.specularColor = new BABYLON.Color3(0, 0, 0);

        const pluginMaterial = this._pluginMaterial = new MmdPluginMaterial(this);
        pluginMaterial.isEnabled = true;
        pluginMaterial.ignoreDiffuseWhenToonTextureIsNull = true;
    }

    public get sphereTexture(): BABYLON.Texture | null {
        return this._pluginMaterial.sphereTexture;
    }

    public set sphereTexture(value: BABYLON.Texture | null) {
        this._pluginMaterial.sphereTexture = value;
    }

    public get sphereTextureBlendMode(): MmdPluginMaterialSphereTextureBlendMode {
        return this._pluginMaterial.sphereTextureBlendMode;
    }

    public set sphereTextureBlendMode(value: MmdPluginMaterialSphereTextureBlendMode) {
        this._pluginMaterial.sphereTextureBlendMode = value;
    }

    public get toonTexture(): BABYLON.Texture | null {
        return this._pluginMaterial.toonTexture;
    }

    public set toonTexture(value: BABYLON.Texture | null) {
        this._pluginMaterial.toonTexture = value;
    }

    public get ignoreDiffuseWhenToonTextureIsNull(): boolean {
        return this._pluginMaterial.ignoreDiffuseWhenToonTextureIsNull;
    }

    public set ignoreDiffuseWhenToonTextureIsNull(value: boolean) {
        this._pluginMaterial.ignoreDiffuseWhenToonTextureIsNull = value;
    }

    public get renderOutline(): boolean {
        return this._renderOutline;
    }

    public set renderOutline(value: boolean) {
        // Lazy Load the component
        if (value) {
            this.getScene().getMmdOutlineRenderer();
        }
        this._renderOutline = value;
    }

    public get renderOverlay(): boolean {
        return this._renderOverlay;
    }

    public set renderOverlay(value: boolean) {
        // Lazy Load the component
        if (value) {
            this.getScene().getMmdOutlineRenderer();
        }
        this._renderOverlay = value;
    }
}
