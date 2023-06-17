import type { MorphTargetManager } from "@babylonjs/core";

import type { MmdModelMetadata } from "@/loader/MmdModelMetadata";
import { PmxObject } from "@/loader/parser/PmxObject";

export class MmdMorphController {
    private readonly _morphTargetManager: MorphTargetManager;
    private readonly _morphTargetManagerIndexMap: Map<string, number>;
    private readonly _morphs: Map<string, readonly MmdModelMetadata.Morph[]>;
    private readonly _morphWeights: Map<string, number>;
    private readonly _activeMorphs: Set<string>;

    public constructor(
        morphTargetManager: MorphTargetManager,
        morphsMetadata: readonly MmdModelMetadata.Morph[]
    ) {
        this._morphTargetManager = morphTargetManager;
        const morphTargetManagerIndexMap = this._morphTargetManagerIndexMap = new Map<string, number>();
        for (let i = 0; i < morphTargetManager.numTargets; ++i) {
            const morphTarget = morphTargetManager.getTarget(i);
            morphTargetManagerIndexMap.set(morphTarget.name, i);
        }

        const morphs = this._morphs = new Map<string, MmdModelMetadata.Morph[]>();
        const morphWeights = this._morphWeights = new Map<string, number>();

        for (let i = 0; i < morphsMetadata.length; ++i) {
            const morph = morphsMetadata[i];

            let morphsByName = morphs.get(morph.name);
            if (morphsByName === undefined) {
                morphsByName = [];
                morphs.set(morph.name, morphsByName);
            }
            morphsByName.push(morph);

            morphWeights.set(morph.name, 0);
        }

        this._activeMorphs = new Set<string>();
    }

    public setMorphWeight(morphName: string, weight: number): void {
        const morphWeights = this._morphWeights;
        const morphWeight = morphWeights.get(morphName);
        if (morphWeight === undefined) return;

        if (morphWeight === weight) return;
        morphWeights.set(morphName, weight);

        if (weight !== 0) {
            this._activeMorphs.add(morphName);
        }
    }

    public getMorphWeight(morphName: string): number {
        const morphWeights = this._morphWeights;
        const morphWeight = morphWeights.get(morphName);
        if (morphWeight === undefined) return 0;
        return morphWeight;
    }

    public resetMorphWeights(): void {
        const morphWeights = this._morphWeights;
        for (const morphName of morphWeights.keys()) {
            morphWeights.set(morphName, 0);
        }

        this._activeMorphs.clear();
    }

    public update(): void {
        const morphTargetManager = this._morphTargetManager;
        const morphTargetManagerIndexMap = this._morphTargetManagerIndexMap;
        const morphs = this._morphs;
        const activeMorphs = this._activeMorphs;
        const morphWeights = this._morphWeights;

        for (const morphName of activeMorphs) {
            const morphWeight = morphWeights.get(morphName)!;

            const morphsByName = morphs.get(morphName)!;
            for (let i = 0; i < morphsByName.length; ++i) {
                const morph = morphsByName[i];

                switch (morph.type) {
                case PmxObject.Morph.Type.groupMorph:
                    {
                        //
                    }
                    break;

                case PmxObject.Morph.Type.vertexMorph:
                    morphTargetManager.getTarget(morphTargetManagerIndexMap.get(morph.name)!).influence = morphWeight;
                    break;

                case PmxObject.Morph.Type.boneMorph:
                    {
                        //
                    }
                    break;

                case PmxObject.Morph.Type.uvMorph:
                    morphTargetManager.getTarget(morphTargetManagerIndexMap.get(morph.name)!).influence = morphWeight;
                    break;

                case PmxObject.Morph.Type.materialMorph:
                    {
                        //
                    }
                    break;

                }
            }

            if (morphWeight === 0) {
                activeMorphs.delete(morphName);
            }
        }
    }

    public get morphs(): ReadonlyMap<string, readonly MmdModelMetadata.Morph[]> {
        return this._morphs;
    }
}
