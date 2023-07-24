import type { Material } from "@babylonjs/core/Materials/material";

import type { Vec3, Vec4 } from "@/Loader/Parser/mmdTypes";

/**
 * MMD material proxy interface
 *
 * This interface is used to apply MMD material morphs to Babylon.js materials
 */
export interface IMmdMaterialProxy {
    /**
     * Reset material properties to initial state
     */
    reset(): void;

    /**
     * Apply changes to the material
     */
    applyChanges(): void;

    /**
     * Diffuse color
     */
    readonly diffuse: Vec4;

    /**
     * Specular color
     */
    readonly specular: Vec3;

    /**
     * Shininess
     */
    shininess: number;

    /**
     * Ambient color
     */
    readonly ambient: Vec3;

    /**
     * Edge color
     */
    readonly edgeColor: Vec4;

    /**
     * Edge size
     */
    edgeSize: number;

    /**
     * Texture color
     */
    readonly textureColor: Vec4;

    /**
     * Sphere texture color
     */
    readonly sphereTextureColor: Vec4;

    /**
     * Toon texture color
     */
    readonly toonTextureColor: Vec4;
}

/**
 * MMD material proxy constructor
 */
export interface IMmdMaterialProxyConstructor<T extends Material> {
    new(material: T): IMmdMaterialProxy;
}
