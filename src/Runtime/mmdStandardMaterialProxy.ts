import type { Mesh } from "@babylonjs/core/Meshes/mesh";

import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import type { Vec4 } from "@/Loader/Parser/mmdTypes";

import type { IMmdMaterialProxy, IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import { StandardMaterialProxy } from "./standardMaterialProxy";

/**
 * MMD standard material proxy
 *
 * Used to apply MMD material morphs to MMD standard materials
 */
export class MmdStandardMaterialProxy extends StandardMaterialProxy implements IMmdMaterialProxy {
    declare protected readonly _material: MmdStandardMaterial;

    private readonly _initialEdgeColor: Vec4;
    private readonly _initialEdgeSize: number;
    private readonly _initialTextureMultiplicativeColor: Vec4;
    private readonly _initialTextureAdditiveColor: Vec4;
    private readonly _initialSphereTextureMultiplicativeColor: Vec4;
    private readonly _initialSphereTextureAdditiveColor: Vec4;
    private readonly _initialToonTextureMultiplicativeColor: Vec4;
    private readonly _initialToonTextureAdditiveColor: Vec4;

    /**
     * Create MMD standard material proxy
     * @param material MMD standard material
     */
    public constructor(material: MmdStandardMaterial, referencedMeshes: readonly Mesh[]) {
        super(material, referencedMeshes);
        const materialOutlineColor = material.outlineColor;
        this.edgeColor[0] = materialOutlineColor.r;
        this.edgeColor[1] = materialOutlineColor.g;
        this.edgeColor[2] = materialOutlineColor.b;
        this.edgeColor[3] = material.outlineAlpha;

        this.edgeSize = material.outlineWidth;

        this._initialEdgeColor = [...this.edgeColor];
        this._initialEdgeSize = this.edgeSize;
        this._initialTextureMultiplicativeColor = [...this.textureMultiplicativeColor];
        this._initialTextureAdditiveColor = [...this.textureAdditiveColor];
        this._initialSphereTextureMultiplicativeColor = [...this.sphereTextureMultiplicativeColor];
        this._initialSphereTextureAdditiveColor = [...this.sphereTextureAdditiveColor];
        this._initialToonTextureMultiplicativeColor = [...this.toonTextureMultiplicativeColor];
        this._initialToonTextureAdditiveColor = [...this.toonTextureAdditiveColor];
    }

    /**
     * Reset material properties to initial state
     */
    public override reset(): void {
        super.reset();

        for (let i = 0; i < 4; ++i) {
            this.edgeColor[i] = this._initialEdgeColor[i];

            this.textureMultiplicativeColor[i] = this._initialTextureMultiplicativeColor[i];
            this.textureAdditiveColor[i] = this._initialTextureAdditiveColor[i];
            this.sphereTextureMultiplicativeColor[i] = this._initialSphereTextureMultiplicativeColor[i];
            this.sphereTextureAdditiveColor[i] = this._initialSphereTextureAdditiveColor[i];
            this.toonTextureMultiplicativeColor[i] = this._initialToonTextureMultiplicativeColor[i];
            this.toonTextureAdditiveColor[i] = this._initialToonTextureAdditiveColor[i];
        }

        this.edgeSize = this._initialEdgeSize;
    }

    /**
     * Apply changes to the material
     */
    public override applyChanges(): void {
        super.applyChanges();
        const material = this._material;

        material.outlineColor.set(this.edgeColor[0], this.edgeColor[1], this.edgeColor[2]);
        material.outlineAlpha = this.edgeColor[3];

        material.outlineWidth = this.edgeSize;

        {
            const multiplicative = this.textureMultiplicativeColor;
            material.textureMultiplicativeColor.set(multiplicative[0], multiplicative[1], multiplicative[2], multiplicative[3]);
        }
        {
            const additive = this.textureAdditiveColor;
            material.textureAdditiveColor.set(additive[0], additive[1], additive[2], additive[3]);
        }

        {
            const multiplicative = this.sphereTextureMultiplicativeColor;
            material.sphereTextureMultiplicativeColor.set(multiplicative[0], multiplicative[1], multiplicative[2], multiplicative[3]);
        }
        {
            const additive = this.sphereTextureAdditiveColor;
            material.sphereTextureAdditiveColor.set(additive[0], additive[1], additive[2], additive[3]);
        }

        {
            const multiplicative = this.toonTextureMultiplicativeColor;
            material.toonTextureMultiplicativeColor.set(multiplicative[0], multiplicative[1], multiplicative[2], multiplicative[3]);
        }
        {
            const additive = this.toonTextureAdditiveColor;
            material.toonTextureAdditiveColor.set(additive[0], additive[1], additive[2], additive[3]);
        }
    }
}

MmdStandardMaterialProxy satisfies IMmdMaterialProxyConstructor<MmdStandardMaterial>;
