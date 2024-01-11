import type { Material } from "@babylonjs/core/Materials/material";
import type { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { DeepImmutable, Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import type { Vec3, Vec4 } from "@/Loader/Parser/mmdTypes";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxy, IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdRuntimeBone } from "./mmdRuntimeBone";

/**
 * Represents a material morph element in MMD runtime
 *
 * This information is used to induce material recompilation
 */
export interface RuntimeMaterialMorphElement {
    index: number; // material index
    type: PmxObject.Morph.MaterialMorph.Type;
    diffuse: Nullable<Vec4>;
    specular: Nullable<Vec3>;
    shininess: Nullable<number>;
    ambient: Nullable<Vec3>;
    edgeColor: Nullable<Vec4>;
    edgeSize: Nullable<number>;
    textureColor: Nullable<Vec4>;
    sphereTextureColor: Nullable<Vec4>;
    toonTextureColor: Nullable<Vec4>;
}

/**
 * @internal
 * Represents a morph in MMD runtime
 */
export interface RuntimeMorph {
    readonly name: string;
    readonly type: PmxObject.Morph.Type;
    readonly materialElements: Nullable<readonly RuntimeMaterialMorphElement[]>;
    readonly elements: Nullable<
        Int32Array // group morph / bone morph indices
        | MorphTarget[] // MorphTargetManager morph targets
    >;

    readonly elements2: Nullable<Float32Array>; // group morph ratios / bone morph positions [..., x, y, z, ...]
    readonly elements3: Nullable<Float32Array>; // bone morph rotations [..., x, y, z, w, ...]
}

/**
 * Morph information exposed to the user
 *
 * Only material morphs data are exposed
 */
export interface ReadonlyRuntimeMorph {
    readonly name: string;
    readonly type: PmxObject.Morph.Type;
    readonly materialElements: Nullable<readonly DeepImmutable<RuntimeMaterialMorphElement>[]>;
}

/**
 * The MmdMorphControllerBase uses `MorphTargetManager` to handle position uv morphs, while the material, bone, and group morphs are handled by CPU bound
 *
 * As a result, it reproduces the behavior of the MMD morph system
 */
export abstract class MmdMorphControllerBase {
    private readonly _logger: ILogger;

    protected readonly _runtimeBones: readonly MmdRuntimeBone[];
    private readonly _materials: readonly (IMmdMaterialProxy | undefined)[];

    protected readonly _morphs: readonly RuntimeMorph[];
    protected readonly _morphIndexMap: Map<string, number[]>;
    protected readonly _morphWeights: Float32Array;
    protected readonly _activeMorphs: Set<string>;
    private readonly _morphTargetManagers: readonly MorphTargetManager[];

    /**
     * Creates a new MmdMorphController
     * @param runtimeBones MMD runtime bones which are original order
     * @param materials MMD materials which are order of mmd metadata
     * @param materialProxyConstructor The constructor of `IMmdMaterialProxy`
     * @param morphsMetadata Morphs metadata
     * @param morphTargetManagers MorphTargetManagers
     * @param logger Logger
     */
    public constructor(
        runtimeBones: Nullable<readonly MmdRuntimeBone[]>,
        materials: Material[],
        materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<Material>>,
        morphsMetadata: readonly MmdModelMetadata.Morph[],
        morphTargetManagers: MorphTargetManager[],
        logger: ILogger
    ) {
        this._logger = logger;

        this._runtimeBones = runtimeBones ?? [];

        if (materialProxyConstructor !== null) {
            const materialProxies = this._materials = new Array<IMmdMaterialProxy | undefined>(materials.length);
            for (let i = 0; i < materials.length; ++i) {
                materialProxies[i] = new materialProxyConstructor(materials[i]);
            }
        } else {
            this._materials = [];
        }

        const morphs = this._morphs = this._createRuntimeMorphData(
            morphsMetadata,
            runtimeBones !== null,
            materialProxyConstructor !== null
        );

        const morphIndexMap = this._morphIndexMap = new Map<string, number[]>();
        for (let i = 0; i < morphs.length; ++i) {
            const morph = morphs[i];
            let morphIndices = morphIndexMap.get(morph.name);
            if (morphIndices === undefined) {
                morphIndices = [];
                morphIndexMap.set(morph.name, morphIndices);
            }
            morphIndices.push(i);
        }

        this._morphWeights = new Float32Array(morphs.length);
        this._activeMorphs = new Set<string>();

        this._morphTargetManagers = morphTargetManagers;
    }

    /**
     * Sets the weight of the morph
     *
     * If there are multiple morphs with the same name, all of them will be set to the same weight, this is the behavior of MMD
     * @param morphName Name of the morph
     * @param weight Weight of the morph
     */
    public abstract setMorphWeight(morphName: string, weight: number): void;

    /**
     * Gets the weight of the morph
     *
     * If there are multiple morphs with the same name, the weight of the first one will be returned
     * @param morphName Name of the morph
     * @returns Weight of the morph
     */
    public getMorphWeight(morphName: string): number {
        const morphIndexMap = this._morphIndexMap;
        const morphIndices = morphIndexMap.get(morphName);
        if (morphIndices === undefined) return 0;

        return this._morphWeights[morphIndices[0]];
    }

    /**
     * Gets the indices of the morph with the given name
     *
     * The index array is returned because multiple morphs can have the same name
     * @param morphName Name of the morph
     * @returns
     */
    public getMorphIndices(morphName: string): readonly number[] | undefined {
        const morphIndexMap = this._morphIndexMap;
        const morphIndices = morphIndexMap.get(morphName);
        if (morphIndices === undefined) return undefined;

        return morphIndices;
    }

    /**
     * Sets the weight of the morph from the index
     *
     * This method is faster than `setMorphWeight` because it does not need to search the morphs with the given name
     * @param morphIndex Index of the morph
     * @param weight Weight of the morph
     */
    public abstract setMorphWeightFromIndex(morphIndex: number, weight: number): void;

    /**
     * Gets the weight of the morph from the index
     * @param morphIndex Index of the morph
     * @returns Weight of the morph
     */
    public getMorphWeightFromIndex(morphIndex: number): number {
        return this._morphWeights[morphIndex];
    }

    /**
     * Gets the weights of all morphs
     * @returns Weights of all morphs
     */
    public getMorphWeights(): Readonly<ArrayLike<number>> {
        return this._morphWeights;
    }

    /**
     * Set the weights of all morphs to 0
     */
    public resetMorphWeights(): void {
        this._morphWeights.fill(0);
    }

    private readonly _updatedMaterials = new Set<IMmdMaterialProxy>();

    /**
     * Apply the morphs to mesh
     */
    public update(): void {
        const morphs = this._morphs;
        const morphIndexMap = this._morphIndexMap;
        const morphWeights = this._morphWeights;
        const activeMorphs = this._activeMorphs;

        const morphTargetManagers = this._morphTargetManagers;
        for (let i = 0; i < morphTargetManagers.length; ++i) morphTargetManagers[i].areUpdatesFrozen = true;

        for (const morphName of activeMorphs) {
            const morphIndices = morphIndexMap.get(morphName)!;
            for (let i = 0; i < morphIndices.length; ++i) {
                this._resetMorph(morphs[morphIndices[i]]);
            }
        }

        for (const morphName of activeMorphs) {
            const morphIndices = morphIndexMap.get(morphName)!;
            for (let i = 0; i < morphIndices.length; ++i) {
                const morphIndex = morphIndices[i];
                const morphWeight = morphWeights[morphIndex];

                this._applyMorph(morphs[morphIndex], morphWeight);

                if (morphWeight === 0) {
                    activeMorphs.delete(morphName);
                }
            }
        }

        for (let i = 0; i < morphTargetManagers.length; ++i) morphTargetManagers[i].areUpdatesFrozen = false;

        const updatedMaterials = this._updatedMaterials;
        for (const updatedMaterial of updatedMaterials) {
            updatedMaterial.applyChanges();
        }
        updatedMaterials.clear();
    }

    /**
     * Gets the morph data
     */
    public get morphs(): readonly ReadonlyRuntimeMorph[] {
        return this._morphs;
    }

    private _createRuntimeMorphData(
        morphsMetadata: readonly MmdModelMetadata.Morph[],
        createBoneMorphs: boolean,
        createMaterialMorphs: boolean
    ): RuntimeMorph[] {
        const morphs: RuntimeMorph[] = [];

        for (let i = 0; i < morphsMetadata.length; ++i) {
            const morphMetadata = morphsMetadata[i];

            let runtimeMorphMaterialElements: Nullable<readonly RuntimeMaterialMorphElement[]> = null;
            let runtimeMorphElements: RuntimeMorph["elements"] = null;
            let runtimeMorphElements2: Nullable<Float32Array> = null;
            let runtimeMorphElements3: Nullable<Float32Array> = null;

            switch (morphMetadata.type) {
            case PmxObject.Morph.Type.GroupMorph:
                {
                    runtimeMorphElements = morphMetadata.indices;
                    runtimeMorphElements2 = morphMetadata.ratios;
                }
                break;

            case PmxObject.Morph.Type.BoneMorph:
                if (!createBoneMorphs) {
                    runtimeMorphElements = new Int32Array(0);
                    runtimeMorphElements2 = new Float32Array(0);
                    runtimeMorphElements3 = new Float32Array(0);
                } else {
                    runtimeMorphElements = morphMetadata.indices;
                    runtimeMorphElements2 = morphMetadata.positions;
                    runtimeMorphElements3 = morphMetadata.rotations;
                }
                break;

            case PmxObject.Morph.Type.MaterialMorph:
                if (!createMaterialMorphs) {
                    runtimeMorphMaterialElements = [];
                } else {
                    const elements = morphMetadata.elements;
                    const morphElements = new Array<RuntimeMaterialMorphElement>(elements.length);

                    for (let j = 0; j < elements.length; ++j) {
                        const element = elements[j];

                        if (element.type === PmxObject.Morph.MaterialMorph.Type.Multiply) {
                            morphElements[j] = {
                                index: element.index,
                                type: element.type,
                                diffuse: element.diffuse[0] !== 1 || element.diffuse[1] !== 1 || element.diffuse[2] !== 1 || element.diffuse[3] !== 1 ? element.diffuse : null,
                                specular: element.specular[0] !== 1 || element.specular[1] !== 1 || element.specular[2] !== 1 ? element.specular : null,
                                shininess: element.shininess !== 1 ? element.shininess : null,
                                ambient: element.ambient[0] !== 1 || element.ambient[1] !== 1 || element.ambient[2] !== 1 ? element.ambient : null,
                                edgeColor: element.edgeColor[0] !== 1 || element.edgeColor[1] !== 1 || element.edgeColor[2] !== 1 || element.edgeColor[3] !== 1 ? element.edgeColor : null,
                                edgeSize: element.edgeSize !== 1 ? element.edgeSize : null,
                                textureColor: element.textureColor[0] !== 1 || element.textureColor[1] !== 1 || element.textureColor[2] !== 1 || element.textureColor[3] !== 1 ? element.textureColor : null,
                                sphereTextureColor: element.sphereTextureColor[0] !== 1 || element.sphereTextureColor[1] !== 1 || element.sphereTextureColor[2] !== 1 || element.sphereTextureColor[3] !== 1 ? element.sphereTextureColor : null,
                                toonTextureColor: element.toonTextureColor[0] !== 1 || element.toonTextureColor[1] !== 1 || element.toonTextureColor[2] !== 1 || element.toonTextureColor[3] !== 1 ? element.toonTextureColor : null
                            };
                        } else /* if (element.type === PmxObject.Morph.MaterialMorph.Type.Add) */ {
                            morphElements[j] = {
                                index: element.index,
                                type: element.type,
                                diffuse: element.diffuse[0] !== 0 || element.diffuse[1] !== 0 || element.diffuse[2] !== 0 || element.diffuse[3] !== 0 ? element.diffuse : null,
                                specular: element.specular[0] !== 0 || element.specular[1] !== 0 || element.specular[2] !== 0 ? element.specular : null,
                                shininess: element.shininess !== 0 ? element.shininess : null,
                                ambient: element.ambient[0] !== 0 || element.ambient[1] !== 0 || element.ambient[2] !== 0 ? element.ambient : null,
                                edgeColor: element.edgeColor[0] !== 0 || element.edgeColor[1] !== 0 || element.edgeColor[2] !== 0 || element.edgeColor[3] !== 0 ? element.edgeColor : null,
                                edgeSize: element.edgeSize !== 0 ? element.edgeSize : null,
                                textureColor: element.textureColor[0] !== 0 || element.textureColor[1] !== 0 || element.textureColor[2] !== 0 || element.textureColor[3] !== 0 ? element.textureColor : null,
                                sphereTextureColor: element.sphereTextureColor[0] !== 0 || element.sphereTextureColor[1] !== 0 || element.sphereTextureColor[2] !== 0 || element.sphereTextureColor[3] !== 0 ? element.sphereTextureColor : null,
                                toonTextureColor: element.toonTextureColor[0] !== 0 || element.toonTextureColor[1] !== 0 || element.toonTextureColor[2] !== 0 || element.toonTextureColor[3] !== 0 ? element.toonTextureColor : null
                            };
                        }
                    }

                    runtimeMorphMaterialElements = morphElements;
                }
                break;

            case PmxObject.Morph.Type.UvMorph:
            case PmxObject.Morph.Type.AdditionalUvMorph1:
            case PmxObject.Morph.Type.AdditionalUvMorph2:
            case PmxObject.Morph.Type.AdditionalUvMorph3:
            case PmxObject.Morph.Type.AdditionalUvMorph4:
            case PmxObject.Morph.Type.VertexMorph:
                runtimeMorphElements = morphMetadata.morphTargets;
                break;
            }

            const morph: RuntimeMorph = {
                name: morphMetadata.name,
                type: morphMetadata.type,
                materialElements: runtimeMorphMaterialElements,
                elements: runtimeMorphElements,
                elements2: runtimeMorphElements2,
                elements3: runtimeMorphElements3
            };
            morphs.push(morph);
        }

        {
            const groupMorphStack: number[] = [];
            const fixLoopingGroupMorphs = (morphIndex: number): void => {
                const morph = morphs[morphIndex];
                if (morph.type !== PmxObject.Morph.Type.GroupMorph) return;

                const indices = morph.elements as Int32Array;
                for (let i = 0; i < indices.length; ++i) {
                    const index = indices[i];

                    if (groupMorphStack.includes(index)) {
                        this._logger.warn(`Looping group morph detected resolves to -1: ${morph.name} -> ${morphs[index].name}`);
                        indices[i] = -1;
                    } else {
                        if (0 <= index && index < morphs.length) {
                            groupMorphStack.push(morphIndex);
                            fixLoopingGroupMorphs(index);
                            groupMorphStack.pop();
                        }
                    }
                }
            };

            for (let i = 0; i < morphs.length; ++i) {
                groupMorphStack.push(i);
                fixLoopingGroupMorphs(i);
                groupMorphStack.length = 0;
            }
        }

        return morphs;
    }

    private _groupMorphFlatForeach(
        groupMorph: RuntimeMorph,
        callback: (index: number, ratio: number) => void,
        accumulatedRatio = 1
    ): void {
        const morphs = this._morphs;

        const indices = groupMorph.elements as Int32Array;
        const ratios = groupMorph.elements2 as Float32Array;
        for (let i = 0; i < indices.length; ++i) {
            const index = indices[i];
            const ratio = ratios[i];

            const childMorph = morphs[index];
            if (childMorph.type === PmxObject.Morph.Type.GroupMorph) {
                this._groupMorphFlatForeach(childMorph, callback, ratio * accumulatedRatio);
            } else {
                callback(index, ratio * accumulatedRatio);
            }
        }
    }

    private _resetMorph(morph: RuntimeMorph): void {
        switch (morph.type) {
        case PmxObject.Morph.Type.GroupMorph:
            {
                const morphs = this._morphs;
                this._groupMorphFlatForeach(morph, (index, _ratio) => {
                    const childMorph = morphs[index];
                    if (childMorph !== undefined) this._resetMorph(childMorph);
                });
            }
            break;

        case PmxObject.Morph.Type.BoneMorph:
            this._resetBoneMorph(morph);
            break;

        case PmxObject.Morph.Type.MaterialMorph:
            {
                const elements = morph.materialElements as readonly RuntimeMaterialMorphElement[];
                for (let i = 0; i < elements.length; ++i) {
                    const element = elements[i];
                    const materials = this._materials;
                    if (element.index === -1) { // -1 means "all materials"
                        for (let i = 0; i < materials.length; ++i) {
                            materials[i]?.reset();
                        }
                    } else {
                        materials[element.index]?.reset();
                    }
                }
            }
            break;

        case PmxObject.Morph.Type.VertexMorph:
        case PmxObject.Morph.Type.UvMorph:
        case PmxObject.Morph.Type.AdditionalUvMorph1:
        case PmxObject.Morph.Type.AdditionalUvMorph2:
        case PmxObject.Morph.Type.AdditionalUvMorph3:
        case PmxObject.Morph.Type.AdditionalUvMorph4:
            {
                const morphTargets = morph.elements as MorphTarget[];
                for (let i = 0; i < morphTargets.length; ++i) morphTargets[i].influence = 0;
            }
            break;
        }
    }

    protected abstract _resetBoneMorph(morph: RuntimeMorph): void;

    private _applyMorph(morph: RuntimeMorph, weight: number): void {
        switch (morph.type) {
        case PmxObject.Morph.Type.GroupMorph:
            {
                const morphs = this._morphs;
                this._groupMorphFlatForeach(morph, (index, ratio) => {
                    const childMorph = morphs[index];
                    if (childMorph !== undefined) this._applyMorph(childMorph, weight * ratio);
                });
            }
            break;

        case PmxObject.Morph.Type.BoneMorph:
            this._applyBoneMorph(morph, weight);
            break;

        case PmxObject.Morph.Type.MaterialMorph:
            {
                const elements = morph.materialElements as readonly RuntimeMaterialMorphElement[];
                for (let i = 0; i < elements.length; ++i) {
                    const element = elements[i];
                    const materials = this._materials;
                    if (element.index === -1) { // -1 means "all materials"
                        for (let i = 0; i < materials.length; ++i) {
                            const material = materials[i];
                            if (material !== undefined) {
                                this._applyMaterialMorph(element, material, weight);
                            }
                        }
                    } else {
                        const material = materials[element.index];
                        if (material !== undefined) {
                            this._applyMaterialMorph(element, material, weight);
                        }
                    }
                }
            }
            break;

        case PmxObject.Morph.Type.VertexMorph:
        case PmxObject.Morph.Type.UvMorph:
        case PmxObject.Morph.Type.AdditionalUvMorph1:
        case PmxObject.Morph.Type.AdditionalUvMorph2:
        case PmxObject.Morph.Type.AdditionalUvMorph3:
        case PmxObject.Morph.Type.AdditionalUvMorph4:
            {
                const morphTargets = morph.elements as MorphTarget[];
                for (let i = 0; i < morphTargets.length; ++i) morphTargets[i].influence += weight;
            }
            break;
        }
    }

    protected abstract _applyBoneMorph(morph: RuntimeMorph, weight: number): void;

    private _applyMaterialMorph(
        materialMorph: RuntimeMaterialMorphElement,
        material: IMmdMaterialProxy,
        weight: number
    ): void {
        if (materialMorph.type === PmxObject.Morph.MaterialMorph.Type.Multiply) {
            if (materialMorph.diffuse !== null) {
                const diffuse = material.diffuse;
                for (let i = 0; i < 4; ++i) {
                    diffuse[i] = diffuse[i] + (diffuse[i] * materialMorph.diffuse[i] - diffuse[i]) * weight;
                }
            }

            if (materialMorph.specular !== null) {
                const specular = material.specular;
                for (let i = 0; i < 3; ++i) {
                    specular[i] = specular[i] + (specular[i] * materialMorph.specular[i] - specular[i]) * weight;
                }
            }

            if (materialMorph.shininess !== null) {
                material.shininess = material.shininess + (material.shininess * materialMorph.shininess - material.shininess) * weight;
            }

            if (materialMorph.ambient !== null) {
                const ambient = material.ambient;
                for (let i = 0; i < 3; ++i) {
                    ambient[i] = ambient[i] + (ambient[i] * materialMorph.ambient[i] - ambient[i]) * weight;
                }
            }

            if (materialMorph.edgeColor !== null) {
                const edgeColor = material.edgeColor;
                for (let i = 0; i < 4; ++i) {
                    edgeColor[i] = edgeColor[i] + (edgeColor[i] * materialMorph.edgeColor[i] - edgeColor[i]) * weight;
                }
            }

            if (materialMorph.edgeSize !== null) {
                material.edgeSize = material.edgeSize + (material.edgeSize * materialMorph.edgeSize - material.edgeSize) * weight;
            }

            if (materialMorph.textureColor !== null) {
                const textureColor = material.textureColor;
                for (let i = 0; i < 4; ++i) {
                    textureColor[i] = textureColor[i] + (textureColor[i] * materialMorph.textureColor[i] - textureColor[i]) * weight;
                }
            }

            if (materialMorph.sphereTextureColor !== null) {
                const sphereTextureColor = material.sphereTextureColor;
                for (let i = 0; i < 4; ++i) {
                    sphereTextureColor[i] = sphereTextureColor[i] + (sphereTextureColor[i] * materialMorph.sphereTextureColor[i] - sphereTextureColor[i]) * weight;
                }
            }

            if (materialMorph.toonTextureColor !== null) {
                const toonTextureColor = material.toonTextureColor;
                for (let i = 0; i < 4; ++i) {
                    toonTextureColor[i] = toonTextureColor[i] + (toonTextureColor[i] * materialMorph.toonTextureColor[i] - toonTextureColor[i]) * weight;
                }
            }
        } else /* if (materialMorph.type === PmxObject.Morph.MaterialMorph.Type.Add) */ {
            if (materialMorph.diffuse !== null) {
                const diffuse = material.diffuse;
                for (let i = 0; i < 4; ++i) {
                    diffuse[i] += materialMorph.diffuse[i] * weight;
                }
            }

            if (materialMorph.specular !== null) {
                const specular = material.specular;
                for (let i = 0; i < 3; ++i) {
                    specular[i] += materialMorph.specular[i] * weight;
                }
            }

            if (materialMorph.shininess !== null) {
                material.shininess += materialMorph.shininess * weight;
            }

            if (materialMorph.ambient !== null) {
                const ambient = material.ambient;
                for (let i = 0; i < 3; ++i) {
                    ambient[i] += materialMorph.ambient[i] * weight;
                }
            }

            if (materialMorph.edgeColor !== null) {
                const edgeColor = material.edgeColor;
                for (let i = 0; i < 4; ++i) {
                    edgeColor[i] += materialMorph.edgeColor[i] * weight;
                }
            }

            if (materialMorph.edgeSize !== null) {
                material.edgeSize += materialMorph.edgeSize * weight;
            }

            if (materialMorph.textureColor !== null) {
                const textureColor = material.textureColor;
                for (let i = 0; i < 4; ++i) {
                    textureColor[i] += materialMorph.textureColor[i] * weight;
                }
            }

            if (materialMorph.sphereTextureColor !== null) {
                const sphereTextureColor = material.sphereTextureColor;
                for (let i = 0; i < 4; ++i) {
                    sphereTextureColor[i] += materialMorph.sphereTextureColor[i] * weight;
                }
            }

            if (materialMorph.toonTextureColor !== null) {
                const toonTextureColor = material.toonTextureColor;
                for (let i = 0; i < 4; ++i) {
                    toonTextureColor[i] += materialMorph.toonTextureColor[i] * weight;
                }
            }
        }

        this._updatedMaterials.add(material);
    }
}
