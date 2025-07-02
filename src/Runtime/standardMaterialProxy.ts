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

    private readonly _material: StandardMaterial;
    private readonly _referencedMeshes: readonly Mesh[];

    private readonly _initialDiffuse: Vec4;
    private readonly _initialSpecular: Vec3;
    private readonly _initialShininess: number;
    private readonly _initialAmbient: Vec3;
    // private readonly _initialEdgeColor: Vec4;
    // private readonly _initialEdgeSize: number;
    private readonly _initialTextureMultiplicativeColor: Vec4;
    private readonly _initialTextureAdditiveColor: Vec4;
    private readonly _initialSphereTextureMultiplicativeColor: Vec4;
    private readonly _initialSphereTextureAdditiveColor: Vec4;
    private readonly _initialToonTextureMultiplicativeColor: Vec4;
    private readonly _initialToonTextureAdditiveColor: Vec4;

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

        // const materialOutlineColor = material.outlineColor;
        // this.edgeColor = [materialOutlineColor.r, materialOutlineColor.g, materialOutlineColor.b, material.outlineAlpha];
        this.edgeColor = [0, 0, 0, 0];

        // this.edgeSize = material.outlineWidth;
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
        // this._initialEdgeColor = [...this.edgeColor];
        // this._initialEdgeSize = this.edgeSize;
        this._initialTextureMultiplicativeColor = [...this.textureMultiplicativeColor];
        this._initialTextureAdditiveColor = [...this.textureAdditiveColor];
        this._initialSphereTextureMultiplicativeColor = [...this.sphereTextureMultiplicativeColor];
        this._initialSphereTextureAdditiveColor = [...this.sphereTextureAdditiveColor];
        this._initialToonTextureMultiplicativeColor = [...this.toonTextureMultiplicativeColor];
        this._initialToonTextureAdditiveColor = [...this.toonTextureAdditiveColor];

        this._initialTransparencyMode = material.transparencyMode;
    }

    /**
     * Reset material properties to initial state
     */
    public reset(): void {
        for (let i = 0; i < 4; ++i) {
            this.diffuse[i] = this._initialDiffuse[i];
            // this.edgeColor[i] = this._initialEdgeColor[i];

            this.textureMultiplicativeColor[i] = this._initialTextureMultiplicativeColor[i];
            this.textureAdditiveColor[i] = this._initialTextureAdditiveColor[i];
            this.sphereTextureMultiplicativeColor[i] = this._initialSphereTextureMultiplicativeColor[i];
            this.sphereTextureAdditiveColor[i] = this._initialSphereTextureAdditiveColor[i];
            this.toonTextureMultiplicativeColor[i] = this._initialToonTextureMultiplicativeColor[i];
            this.toonTextureAdditiveColor[i] = this._initialToonTextureAdditiveColor[i];
        }

        for (let i = 0; i < 3; ++i) {
            this.specular[i] = this._initialSpecular[i];
            this.ambient[i] = this._initialAmbient[i];
        }

        this.shininess = this._initialShininess;
        // this.edgeSize = this._initialEdgeSize;
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

        // material.outlineColor.set(this.edgeColor[0], this.edgeColor[1], this.edgeColor[2]);
        // material.outlineAlpha = this.edgeColor[3];

        // material.outlineWidth = this.edgeSize;

        // {
        //     const multiplicative = this.textureMultiplicativeColor;
        //     material.textureMultiplicativeColor.set(multiplicative[0], multiplicative[1], multiplicative[2], multiplicative[3]);
        // }
        // {
        //     const additive = this.textureAdditiveColor;
        //     material.textureAdditiveColor.set(additive[0], additive[1], additive[2], additive[3]);
        // }

        // {
        //     const multiplicative = this.sphereTextureMultiplicativeColor;
        //     material.sphereTextureMultiplicativeColor.set(multiplicative[0], multiplicative[1], multiplicative[2], multiplicative[3]);
        // }
        // {
        //     const additive = this.sphereTextureAdditiveColor;
        //     material.sphereTextureAdditiveColor.set(additive[0], additive[1], additive[2], additive[3]);
        // }

        // {
        //     const multiplicative = this.toonTextureMultiplicativeColor;
        //     material.toonTextureMultiplicativeColor.set(multiplicative[0], multiplicative[1], multiplicative[2], multiplicative[3]);
        // }
        // {
        //     const additive = this.toonTextureAdditiveColor;
        //     material.toonTextureAdditiveColor.set(additive[0], additive[1], additive[2], additive[3]);
        // }
    }
}

StandardMaterialProxy satisfies IMmdMaterialProxyConstructor<StandardMaterial>;
