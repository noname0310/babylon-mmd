import { Material } from "@babylonjs/core/Materials/material";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Nullable } from "@babylonjs/core/types";

import type { Vec3, Vec4 } from "@/Loader/Parser/mmdTypes";

import type { IMmdMaterialProxy, IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";

/**
 * Standard material proxy
 *
 * Used to apply MMD material morphs to standard materials
 */
export class StandardMaterialProxy implements IMmdMaterialProxy {
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

    protected readonly _material: StandardMaterial;
    private readonly _referencedMeshes: readonly Mesh[];

    private readonly _initialDiffuse: Vec4;
    private readonly _initialSpecular: Vec3;
    private readonly _initialShininess: number;
    private readonly _initialAmbient: Vec3;

    private readonly _initialTransparencyMode: Nullable<number>;

    /**
     * Create standard material proxy
     * @param material standard material
     */
    public constructor(material: StandardMaterial, referencedMeshes: readonly Mesh[]) {
        this._material = material;
        this._referencedMeshes = referencedMeshes;

        const materialDiffuseColor = material.diffuseColor;
        this.diffuse = [materialDiffuseColor.r, materialDiffuseColor.g, materialDiffuseColor.b, material.alpha];

        const materialSpecularColor = material.specularColor;
        this.specular = [materialSpecularColor.r, materialSpecularColor.g, materialSpecularColor.b];

        this.shininess = material.specularPower;

        const materialAmbientColor = material.ambientColor;
        this.ambient = [materialAmbientColor.r, materialAmbientColor.g, materialAmbientColor.b];

        this.edgeColor = [0, 0, 0, 0];

        this.edgeSize = 0;

        this.textureMultiplicativeColor = [1, 1, 1, 1];
        this.textureAdditiveColor = [0, 0, 0, 0];
        this.sphereTextureMultiplicativeColor = [1, 1, 1, 1];
        this.sphereTextureAdditiveColor = [0, 0, 0, 0];
        this.toonTextureMultiplicativeColor = [1, 1, 1, 1];
        this.toonTextureAdditiveColor = [0, 0, 0, 0];

        this._initialDiffuse = [...this.diffuse];
        this._initialSpecular = [...this.specular];
        this._initialShininess = this.shininess;
        this._initialAmbient = [...this.ambient];

        this._initialTransparencyMode = material.transparencyMode;
    }

    /**
     * Reset material properties to initial state
     */
    public reset(): void {
        for (let i = 0; i < 4; ++i) {
            this.diffuse[i] = this._initialDiffuse[i];
        }

        for (let i = 0; i < 3; ++i) {
            this.specular[i] = this._initialSpecular[i];
            this.ambient[i] = this._initialAmbient[i];
        }

        this.shininess = this._initialShininess;
    }

    /**
     * Apply changes to the material
     */
    public applyChanges(): void {
        const material = this._material;

        material.diffuseColor.set(this.diffuse[0], this.diffuse[1], this.diffuse[2]);
        material.alpha = this.diffuse[3];
        if (this.diffuse[3] === 1) {
            material.transparencyMode = this._initialTransparencyMode;
        } else {
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;
        }

        const referencedMeshes = this._referencedMeshes;
        if (this.diffuse[3] <= 0) {
            for (let i = 0; i < referencedMeshes.length; ++i) {
                referencedMeshes[i].isVisible = false;
            }
        } else {
            for (let i = 0; i < referencedMeshes.length; ++i) {
                referencedMeshes[i].isVisible = true;
            }
        }

        material.specularColor.set(this.specular[0], this.specular[1], this.specular[2]);
        material.specularPower = this.shininess;

        material.ambientColor.set(this.ambient[0], this.ambient[1], this.ambient[2]);
    }
}

StandardMaterialProxy satisfies IMmdMaterialProxyConstructor<StandardMaterial>;
