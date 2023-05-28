import * as BABYLON from "@babylonjs/core";

import { MmdPluginMaterial } from "./MmdPluginMaterial";

export class MmdStandardMaterial extends BABYLON.StandardMaterial {
    private readonly _pluginMaterial: MmdPluginMaterial;

    public constructor(name: string, scene?: BABYLON.Scene) {
        super(name, scene);
        this.sideOrientation = BABYLON.Material.ClockWiseSideOrientation;
        this.specularColor = new BABYLON.Color3(0, 0, 0);

        const pluginMaterial = this._pluginMaterial = new MmdPluginMaterial(this);
        pluginMaterial.isEnabled = true;
    }

    public get sphereTexture(): BABYLON.Texture | null {
        return this._pluginMaterial.sphereTexture;
    }

    public set sphereTexture(value: BABYLON.Texture | null) {
        this._pluginMaterial.sphereTexture = value;
    }
}