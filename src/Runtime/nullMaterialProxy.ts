import type { Material } from "@babylonjs/core/Materials/material";

import type { Vec3, Vec4 } from "@/Loader/Parser/mmdTypes";

import type { IMmdMaterialProxy, IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";

/**
 * null material proxy
 *
 * Used to ignore MMD material morphs
 */
export class NullMaterialProxy implements IMmdMaterialProxy {
    /**
     * Diffuse color
     */
    public readonly diffuse: Vec4;

    /**
     * Specular color
     */
    public readonly specular: Vec3;

    /**
     * Shininess
     */
    public shininess: number;

    /**
     * Ambient color
     */
    public readonly ambient: Vec3;

    /**
     * Edge color
     */
    public readonly edgeColor: Vec4;

    /**
     * Edge size
     */
    public edgeSize: number;

    /**
     * Texture multiplicative color
     */
    public readonly textureMultiplicativeColor: Vec4;

    /**
     * Texture additive color
     */
    public readonly textureAdditiveColor: Vec4;

    /**
     * Sphere texture multiplicative color
     */
    public readonly sphereTextureMultiplicativeColor: Vec4;

    /**
     * Sphere texture additive color
     */
    public readonly sphereTextureAdditiveColor: Vec4;

    /**
     * Toon texture multiplicative color
     */
    public readonly toonTextureMultiplicativeColor: Vec4;

    /**
     * Toon texture additive color
     */
    public readonly toonTextureAdditiveColor: Vec4;

    /**
     * Create null material proxy
     * @param material any material
     */
    public constructor() {
        // pmxe defaults
        this.diffuse = [1, 1, 1, 1];
        this.specular = [0, 0, 0];
        this.shininess = 5;
        this.ambient = [1, 1, 1];
        this.edgeColor = [0, 0, 0, 1];
        this.edgeSize = 1;

        this.textureMultiplicativeColor = [1, 1, 1, 1];
        this.textureAdditiveColor = [0, 0, 0, 0];
        this.sphereTextureMultiplicativeColor = [1, 1, 1, 1];
        this.sphereTextureAdditiveColor = [0, 0, 0, 0];
        this.toonTextureMultiplicativeColor = [1, 1, 1, 1];
        this.toonTextureAdditiveColor = [0, 0, 0, 0];
    }

    /**
     * Reset material properties to initial state
     */
    public reset(): void {
        // do noting
    }

    /**
     * Apply changes to the material
     */
    public applyChanges(): void {
        // do noting
    }
}

NullMaterialProxy satisfies IMmdMaterialProxyConstructor<Material>;
