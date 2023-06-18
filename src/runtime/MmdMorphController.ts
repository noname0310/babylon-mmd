import type { Material } from "@babylonjs/core";
import { type MorphTargetManager, Quaternion, Vector3 } from "@babylonjs/core";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";
import { PmxObject } from "@/loader/parser/PmxObject";

import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxy, IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { MmdMultiMaterial, MmdSkeleton } from "./MmdMesh";

type RemoveReadonly<T> = {
    -readonly [K in keyof T]: T[K];
};

interface RuntimeMorph {
    name: string;
    type: PmxObject.Morph.Type;
    elements: readonly RemoveReadonly<PmxObject.Morph.GroupMorph>[]
        | readonly PmxObject.Morph.BoneMorph[]
        | readonly PmxObject.Morph.MaterialMorph[]
        | number; // MorphTargetManager morph target index
}

export interface ReadonlyRuntimeMorph {
    readonly name: string;
    readonly type: PmxObject.Morph.Type;
    readonly elements: readonly PmxObject.Morph.GroupMorph[]
        | readonly PmxObject.Morph.BoneMorph[]
        | readonly PmxObject.Morph.MaterialMorph[]
        | number; // MorphTargetManager morph target index
}

export class MmdMorphController {
    private readonly _logger: ILogger;

    private readonly _morphTargetManager: MorphTargetManager;
    private readonly _skeleton: MmdSkeleton;
    private readonly _materials: IMmdMaterialProxy[];

    private readonly _morphs: RuntimeMorph[];
    private readonly _morphIndexMap: Map<string, number[]>;
    private readonly _morphWeights: Float32Array;
    private readonly _activeMorphs: Set<string>;

    public constructor(
        morphTargetManager: MorphTargetManager,
        skeleton: MmdSkeleton,
        material: MmdMultiMaterial,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material>,
        morphsMetadata: readonly MmdModelMetadata.Morph[],
        logger: ILogger
    ) {
        this._logger = logger;

        this._morphTargetManager = morphTargetManager;
        this._skeleton = skeleton;

        const subMaterials = material.subMaterials;
        const materials = this._materials = new Array<IMmdMaterialProxy>(subMaterials.length);
        for (let i = 0; i < subMaterials.length; ++i) {
            materials[i] = new materialProxyConstructor(subMaterials[i]);
        }

        const morphs = this._morphs = this._createRuntimeMorphData(morphsMetadata);

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
    }

    public setMorphWeight(morphName: string, weight: number): void {
        const morphIndexMap = this._morphIndexMap;
        const morphIndices = morphIndexMap.get(morphName);
        if (morphIndices === undefined) return;

        const morphWeights = this._morphWeights;

        for (let i = 0; i < morphIndices.length; ++i) {
            morphWeights[morphIndices[i]] = weight;
        }

        if (weight !== 0) {
            this._activeMorphs.add(morphName);
        }
    }

    public getMorphWeight(morphName: string): number {
        const morphIndexMap = this._morphIndexMap;
        const morphIndices = morphIndexMap.get(morphName);
        if (morphIndices === undefined) return 0;

        return this._morphWeights[morphIndices[0]];
    }

    public resetMorphWeights(): void {
        this._morphWeights.fill(0);
    }

    private readonly _updatedMaterials = new Set<IMmdMaterialProxy>();

    public update(): void {
        const morphs = this._morphs;
        const morphIndexMap = this._morphIndexMap;
        const morphWeights = this._morphWeights;
        const activeMorphs = this._activeMorphs;

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

        const updatedMaterials = this._updatedMaterials;
        for (const updatedMaterial of updatedMaterials) {
            updatedMaterial.applyChanges();
        }
        updatedMaterials.clear();
    }

    public get morphs(): readonly ReadonlyRuntimeMorph[] {
        return this._morphs;
    }

    private _createRuntimeMorphData(morphsMetadata: readonly MmdModelMetadata.Morph[]): RuntimeMorph[] {
        const morphs: RuntimeMorph[] = [];

        for (let i = 0; i < morphsMetadata.length; ++i) {
            const morphMetadata = morphsMetadata[i];

            const morph: RuntimeMorph = {
                name: morphMetadata.name,
                type: morphMetadata.type,
                elements: morphMetadata.elements as RuntimeMorph["elements"]
            };

            if (morphMetadata.type === PmxObject.Morph.Type.GroupMorph) {
                const elements: RemoveReadonly<PmxObject.Morph.GroupMorph>[] = [];
                const groupMorphs = morphMetadata.elements as PmxObject.Morph.GroupMorph[];
                for (let j = 0; j < groupMorphs.length; ++j) {
                    const groupMorph = groupMorphs[j];

                    elements.push({
                        index: groupMorph.index,
                        ratio: groupMorph.ratio
                    });
                }
            }

            morphs.push(morph);
        }

        {
            const groupMorphStack: number[] = [];
            const fixLoopingGroupMorphs = (morphIndex: number): void => {
                const morph = morphs[morphIndex];
                if (morph.type !== PmxObject.Morph.Type.GroupMorph) return;

                const elements = morph.elements as readonly RemoveReadonly<PmxObject.Morph.GroupMorph>[];
                for (let i = 0; i < elements.length; ++i) {
                    const element = elements[i];

                    if (groupMorphStack.includes(element.index)) {
                        this._logger.warn(`Looping group morph detected resolves to -1: ${morph.name} -> ${morphs[element.index].name}`);
                        element.index = -1;
                    } else {
                        if (0 <= element.index) {
                            groupMorphStack.push(morphIndex);
                            fixLoopingGroupMorphs(element.index);
                            groupMorphStack.pop();
                        }
                    }
                }
            };

            for (let i = 0; i < morphs.length; ++i) {
                fixLoopingGroupMorphs(i);
                groupMorphStack.length = 0;
            }
        }

        return morphs;
    }

    private _groupMorphFlatForeach(
        groupMorph: RuntimeMorph,
        callback: (index: number, ratio: number) => void,
        ratio = 1
    ): void {
        const morphs = this._morphs;

        const elements = groupMorph.elements as readonly PmxObject.Morph.GroupMorph[];
        for (let i = 0; i < elements.length; ++i) {
            const element = elements[i];

            const childMorph = morphs[element.index];
            if (childMorph.type === PmxObject.Morph.Type.GroupMorph) {
                this._groupMorphFlatForeach(childMorph, callback, element.ratio * ratio);
            } else {
                callback(element.index, element.ratio * ratio);
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

        case PmxObject.Morph.Type.MaterialMorph:
            {
                const elements = morph.elements as readonly PmxObject.Morph.MaterialMorph[];
                for (let i = 0; i < elements.length; ++i) {
                    const element = elements[i];
                    this._materials[element.index].reset();
                }
            }
            break;

        case PmxObject.Morph.Type.VertexMorph:
        case PmxObject.Morph.Type.UvMorph:
            this._morphTargetManager.getTarget(morph.elements as number).influence = 0;
            break;
        }
    }

    private readonly _tempVector3 = new Vector3();
    private readonly _tempQuaternion = new Quaternion();

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
            {
                const bones = this._skeleton.bones;

                const elements = morph.elements as readonly PmxObject.Morph.BoneMorph[];
                for (let i = 0; i < elements.length; ++i) {
                    const element = elements[i];

                    const bone = bones[element.index];

                    const elementPosition = element.position;
                    const weightedElementPosition = this._tempVector3.copyFromFloats(
                        elementPosition[0] * weight,
                        elementPosition[1] * weight,
                        elementPosition[2] * weight
                    );
                    bone.position.addInPlace(weightedElementPosition);

                    Quaternion.SlerpToRef(
                        bone.rotationQuaternion,
                        this._tempQuaternion.copyFromFloats(
                            element.rotation[0],
                            element.rotation[1],
                            element.rotation[2],
                            element.rotation[3]
                        ),
                        weight,
                        bone.rotationQuaternion
                    );
                }
            }
            break;

        case PmxObject.Morph.Type.MaterialMorph:
            {
                const elements = morph.elements as readonly PmxObject.Morph.MaterialMorph[];
                for (let i = 0; i < elements.length; ++i) {
                    const element = elements[i];
                    const material = this._materials[element.index];

                    if (element.type === PmxObject.Morph.MaterialMorph.Type.Multiply) {
                        const diffuse = material.diffuse;
                        for (let i = 0; i < 4; ++i) {
                            diffuse[i] = diffuse[i] + (diffuse[i] * element.diffuse[i] - diffuse[i]) * weight;
                        }

                        const specular = material.specular;
                        for (let i = 0; i < 3; ++i) {
                            specular[i] = specular[i] + (specular[i] * element.specular[i] - specular[i]) * weight;
                        }

                        material.shininess = material.shininess + (material.shininess * element.shininess - material.shininess) * weight;

                        const ambient = material.ambient;
                        for (let i = 0; i < 3; ++i) {
                            ambient[i] = ambient[i] + (ambient[i] * element.ambient[i] - ambient[i]) * weight;
                        }

                        const edgeColor = material.edgeColor;
                        for (let i = 0; i < 4; ++i) {
                            edgeColor[i] = edgeColor[i] + (edgeColor[i] * element.edgeColor[i] - edgeColor[i]) * weight;
                        }

                        material.edgeSize = material.edgeSize + (material.edgeSize * element.edgeSize - material.edgeSize) * weight;

                        const textureColor = material.textureColor;
                        for (let i = 0; i < 4; ++i) {
                            textureColor[i] = textureColor[i] + (textureColor[i] * element.textureColor[i] - textureColor[i]) * weight;
                        }

                        const sphereTextureColor = material.sphereTextureColor;
                        for (let i = 0; i < 4; ++i) {
                            sphereTextureColor[i] = sphereTextureColor[i] + (sphereTextureColor[i] * element.sphereTextureColor[i] - sphereTextureColor[i]) * weight;
                        }

                        const toonTextureColor = material.toonTextureColor;
                        for (let i = 0; i < 4; ++i) {
                            toonTextureColor[i] = toonTextureColor[i] + (toonTextureColor[i] * element.toonTextureColor[i] - toonTextureColor[i]) * weight;
                        }
                    } else /* if (element.type === PmxObject.Morph.MaterialMorph.Type.add) */ {
                        const diffuse = material.diffuse;
                        for (let i = 0; i < 4; ++i) {
                            diffuse[i] += element.diffuse[i] * weight;
                        }

                        const specular = material.specular;
                        for (let i = 0; i < 3; ++i) {
                            specular[i] += element.specular[i] * weight;
                        }

                        material.shininess += element.shininess * weight;

                        const ambient = material.ambient;
                        for (let i = 0; i < 3; ++i) {
                            ambient[i] += element.ambient[i] * weight;
                        }

                        const edgeColor = material.edgeColor;
                        for (let i = 0; i < 4; ++i) {
                            edgeColor[i] += element.edgeColor[i] * weight;
                        }

                        material.edgeSize += element.edgeSize * weight;

                        const textureColor = material.textureColor;
                        for (let i = 0; i < 4; ++i) {
                            textureColor[i] += element.textureColor[i] * weight;
                        }

                        const sphereTextureColor = material.sphereTextureColor;
                        for (let i = 0; i < 4; ++i) {
                            sphereTextureColor[i] += element.sphereTextureColor[i] * weight;
                        }

                        const toonTextureColor = material.toonTextureColor;
                        for (let i = 0; i < 4; ++i) {
                            toonTextureColor[i] += element.toonTextureColor[i] * weight;
                        }
                    }

                    this._updatedMaterials.add(material);
                }
            }
            break;

        case PmxObject.Morph.Type.VertexMorph:
        case PmxObject.Morph.Type.UvMorph:
            this._morphTargetManager.getTarget(morph.elements as number).influence += weight;
            break;
        }
    }
}
