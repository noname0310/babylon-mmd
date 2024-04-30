import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

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
     * Texture multiplicative color
     */
    readonly textureMultiplicativeColor: Vec4;

    /**
     * Texture additive color
     */
    readonly textureAdditiveColor: Vec4;

    /**
     * Sphere texture multiplicative color
     */
    readonly sphereTextureMultiplicativeColor: Vec4;

    /**
     * Sphere texture additive color
     */
    readonly sphereTextureAdditiveColor: Vec4;

    /**
     * Toon texture multiplicative color
     */
    readonly toonTextureMultiplicativeColor: Vec4;

    /**
     * Toon texture additive color
     */
    readonly toonTextureAdditiveColor: Vec4;

}

/**
 * MMD material proxy constructor
 */
export interface IMmdMaterialProxyConstructor<T extends Material> {
    new(material: T, referencedMeshes: readonly Mesh[]): IMmdMaterialProxy;
}
