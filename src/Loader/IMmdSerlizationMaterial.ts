import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Nullable } from "@babylonjs/core/types";
import { MmdPluginMaterialSphereTextureBlendMode } from "./mmdPluginMaterial";
import { Material } from "@babylonjs/core/Materials/material";

/**
 * MMD material properties for serialization
 */
export interface IMmdSerlizationMaterial extends Material {
    /**
     * Name of the material
     */
    readonly name: string;

    /**
     * Diffuse color of the material
     */
    readonly diffuseColor: Color3;
    
    /**
     * Diffuse alpha of the material
     */
    readonly alpha: number;
    
    /**
     * Specular color of the material
     */
    readonly specularColor: Color3;
    
    /**
     * Ambient color of the material
     */
    readonly ambientColor: Color3;

    /**
     * Specular power of the material
     * 
     * mapped to `shininess`
     */
    readonly specularPower: number;

    readonly backFaceCulling: boolean;

    /**
     * Diffuse texture of the material
     */
    readonly diffuseTexture: Nullable<BaseTexture>;
    
    readonly transparencyMode: Nullable<number>;
    
    /**
     * Sphere texture of the material
     */
    readonly sphereTexture: Nullable<BaseTexture>;

    /**
     * Sphere texture blend mode of the material
     */
    readonly sphereTextureBlendMode: MmdPluginMaterialSphereTextureBlendMode;
    
    /**
     * Toon texture of the material
     */
    readonly toonTexture: Nullable<BaseTexture>;
    
    /**
     * Whether the material should be rendered with outline
     */
    readonly renderOutline: boolean;

    /**
     * Outline width of the material
     */
    readonly outlineWidth: number;

    /**
     * Outline color of the material
     */
    readonly outlineColor: Color3;
    
    /**
     * Outline alpha of the material
     */
    readonly outlineAlpha: number;
}
