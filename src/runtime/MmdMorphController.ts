import type { MorphTargetManager } from "@babylonjs/core";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";
import { PmxObject } from "@/loader/parser/PmxObject";

import type { ILogger } from "./ILogger";

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
    private readonly _morphs: RuntimeMorph[];
    private readonly _morphIndexMap: Map<string, number[]>;
    private readonly _morphWeights: Float32Array;
    private readonly _activeMorphs: Set<string>;

    public constructor(
        morphTargetManager: MorphTargetManager,
        morphsMetadata: readonly MmdModelMetadata.Morph[],
        logger: ILogger
    ) {
        this._logger = logger;

        this._morphTargetManager = morphTargetManager;
        const morphs = this._morphs = this.createRuntimeMorphData(morphsMetadata);

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

    public update(): void {
        const morphTargetManager = this._morphTargetManager;
        const morphs = this._morphs;
        const morphIndexMap = this._morphIndexMap;
        const morphWeights = this._morphWeights;
        const activeMorphs = this._activeMorphs;

        for (const morphName of activeMorphs) {
            const morphIndices = morphIndexMap.get(morphName)!;
            for (let i = 0; i < morphIndices.length; ++i) {
                const morphIndex = morphIndices[i];
                const morph = morphs[morphIndex];
                const morphWeight = morphWeights[morphIndex];

                switch (morph.type) {
                case PmxObject.Morph.Type.groupMorph:
                    {
                        //
                    }
                    break;

                case PmxObject.Morph.Type.boneMorph:
                    {
                        //
                    }
                    break;

                case PmxObject.Morph.Type.materialMorph:
                    {
                        //
                    }
                    break;

                case PmxObject.Morph.Type.vertexMorph:
                case PmxObject.Morph.Type.uvMorph:
                    morphTargetManager.getTarget(morph.elements as number).influence = morphWeight;
                    break;
                }

                if (morphWeight === 0) {
                    activeMorphs.delete(morphName);
                }
            }
        }
    }

    public get morphs(): readonly ReadonlyRuntimeMorph[] {
        return this._morphs;
    }

    private createRuntimeMorphData(morphsMetadata: readonly MmdModelMetadata.Morph[]): RuntimeMorph[] {
        const morphs: RuntimeMorph[] = [];

        for (let i = 0; i < morphsMetadata.length; ++i) {
            const morphMetadata = morphsMetadata[i];

            const morph: RuntimeMorph = {
                name: morphMetadata.name,
                type: morphMetadata.type,
                elements: morphMetadata.elements as RuntimeMorph["elements"]
            };

            if (morphMetadata.type === PmxObject.Morph.Type.groupMorph) {
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
                if (morph.type !== PmxObject.Morph.Type.groupMorph) return;

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
}
