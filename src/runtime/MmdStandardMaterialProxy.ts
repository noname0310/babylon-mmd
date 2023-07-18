import type { Nullable } from "@babylonjs/core";
import { Material } from "@babylonjs/core";

import type { MmdStandardMaterial } from "@/loader/MmdStandardMaterial";
import { MmdStandardMaterialBuilder } from "@/loader/MmdStandardMaterialBuilder";
import type { Vec3, Vec4 } from "@/loader/parser/MmdTypes";

import type { IMmdMaterialProxy } from "./IMmdMaterialProxy";

export class MmdStandardMaterialProxy implements IMmdMaterialProxy {
    public readonly diffuse: Vec4;
    public readonly specular: Vec3;
    public shininess: number;
    public readonly ambient: Vec3;
    public readonly edgeColor: Vec4;
    public edgeSize: number;
    public readonly textureColor: Vec4;
    public readonly sphereTextureColor: Vec4;
    public readonly toonTextureColor: Vec4;

    private readonly _material: MmdStandardMaterial;

    private readonly _initialDiffuse: Vec4;
    private readonly _initialSpecular: Vec3;
    private readonly _initialShininess: number;
    private readonly _initialAmbient: Vec3;
    private readonly _initialEdgeColor: Vec4;
    private readonly _initialEdgeSize: number;
    private readonly _initialTextureColor: Vec4;
    private readonly _initialSphereTextureColor: Vec4;
    private readonly _initialToonTextureColor: Vec4;

    private readonly _initialTransparencyMode: Nullable<number>;
    private readonly _initialBackFaceCulling: boolean;

    public constructor(material: MmdStandardMaterial) {
        this._material = material;

        const materialDiffuseColor = material.diffuseColor;
        this.diffuse = [materialDiffuseColor.r, materialDiffuseColor.g, materialDiffuseColor.b, material.alpha];

        const materialSpecularColor = material.specularColor;
        this.specular = [materialSpecularColor.r, materialSpecularColor.g, materialSpecularColor.b];

        this.shininess = material.specularPower;

        const materialAmbientColor = material.ambientColor;
        this.ambient = [materialAmbientColor.r, materialAmbientColor.g, materialAmbientColor.b];

        const materialOutlineColor = material.outlineColor;
        this.edgeColor = [materialOutlineColor.r, materialOutlineColor.g, materialOutlineColor.b, material.outlineAlpha];

        this.edgeSize = material.outlineWidth / MmdStandardMaterialBuilder.EdgeSizeScaleFactor;

        this.textureColor = [1, 1, 1, 1];
        this.sphereTextureColor = [1, 1, 1, 1];
        this.toonTextureColor = [1, 1, 1, 1];

        this._initialDiffuse = [...this.diffuse];
        this._initialSpecular = [...this.specular];
        this._initialShininess = this.shininess;
        this._initialAmbient = [...this.ambient];
        this._initialEdgeColor = [...this.edgeColor];
        this._initialEdgeSize = this.edgeSize;
        this._initialTextureColor = [...this.textureColor];
        this._initialSphereTextureColor = [...this.sphereTextureColor];
        this._initialToonTextureColor = [...this.toonTextureColor];

        this._initialTransparencyMode = material.transparencyMode;
        this._initialBackFaceCulling = material.backFaceCulling;
    }

    public reset(): void {
        for (let i = 0; i < 4; ++i) {
            this.diffuse[i] = this._initialDiffuse[i];
            this.edgeColor[i] = this._initialEdgeColor[i];

            this.textureColor[i] = this._initialTextureColor[i];
            this.sphereTextureColor[i] = this._initialSphereTextureColor[i];
            this.toonTextureColor[i] = this._initialToonTextureColor[i];
        }

        for (let i = 0; i < 3; ++i) {
            this.specular[i] = this._initialSpecular[i];
            this.ambient[i] = this._initialAmbient[i];
        }

        this.shininess = this._initialShininess;
        this.edgeSize = this._initialEdgeSize;
    }

    public applyChanges(): void {
        const material = this._material;

        material.diffuseColor.set(this.diffuse[0], this.diffuse[1], this.diffuse[2]);
        material.alpha = this.diffuse[3];
        if (this.diffuse[3] === 1) {
            material.transparencyMode = this._initialTransparencyMode;
            material.backFaceCulling = this._initialBackFaceCulling;
        } else {
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;
            material.backFaceCulling = false;
        }

        material.specularColor.set(this.specular[0], this.specular[1], this.specular[2]);
        material.specularPower = this.shininess;

        material.ambientColor.set(this.ambient[0], this.ambient[1], this.ambient[2]);

        material.outlineColor.set(this.edgeColor[0], this.edgeColor[1], this.edgeColor[2]);
        material.outlineAlpha = this.edgeColor[3];

        material.outlineWidth = this.edgeSize * MmdStandardMaterialBuilder.EdgeSizeScaleFactor;

        material.textureColor.set(this.textureColor[0], this.textureColor[1], this.textureColor[2], this.textureColor[3]);

        material.sphereTextureColor.set(this.sphereTextureColor[0], this.sphereTextureColor[1], this.sphereTextureColor[2], this.sphereTextureColor[3]);

        material.toonTextureColor.set(this.toonTextureColor[0], this.toonTextureColor[1], this.toonTextureColor[2], this.toonTextureColor[3]);
    }
}
