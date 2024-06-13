import type { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import { PmxObject } from "@/Loader/Parser/pmxObject";
import type { ILogger } from "@/Runtime/ILogger";
import type { MmdMorphControllerBase, ReadonlyRuntimeMorph } from "@/Runtime/mmdMorphControllerBase";

import type { MorphIndices } from "../IMmdRuntimeAnimation";

/**
 * Induces a recompilation of the `MmdStandardMaterial`.
 *
 * This method prevents frame drop during animation by inducing properties to be recompiled that are used in morph animation
 *
 * @param materials Materials
 * @param morphController Morph controller
 * @param morphIndices Morph indices to induce recompile
 * @param logger Logger
 */
export function induceMmdStandardMaterialRecompile(
    materials: readonly MmdStandardMaterial[],
    morphController: MmdMorphControllerBase,
    morphIndices: readonly Nullable<MorphIndices>[],
    logger?: ILogger
): void {
    let allTextureColorPropertiesAreRecompiled = false;
    let allSphereTextureColorPropertiesAreRecompiled = false;
    let allToonTextureColorPropertiesAreRecompiled = false;
    const recompiledMaterials = new Set<string>();

    const recompileMaterialMorph = (morph: ReadonlyRuntimeMorph): void => {
        const elements = morph.materialElements!;
        for (let k = 0; k < elements.length; ++k) {
            const element = elements[k];
            if (element.textureColor !== null && !allTextureColorPropertiesAreRecompiled) {
                const materialIndex = element.index;
                if (element.index === -1) {
                    for (let l = 0; l < materials.length; ++l) {
                        materials[l].textureMultiplicativeColor;
                    }
                    allTextureColorPropertiesAreRecompiled = true;
                } else {
                    materials[materialIndex].textureMultiplicativeColor;
                    recompiledMaterials.add(materialIndex.toString());
                }
            }

            if (element.sphereTextureColor !== null && !allSphereTextureColorPropertiesAreRecompiled) {
                const materialIndex = element.index;
                if (element.index === -1) {
                    for (let l = 0; l < materials.length; ++l) {
                        materials[l].sphereTextureMultiplicativeColor;
                    }
                    allSphereTextureColorPropertiesAreRecompiled = true;
                } else {
                    materials[materialIndex].sphereTextureMultiplicativeColor;
                    recompiledMaterials.add(materialIndex.toString());
                }
            }

            if (element.toonTextureColor !== null && !allToonTextureColorPropertiesAreRecompiled) {
                const materialIndex = element.index;
                if (element.index === -1) {
                    for (let l = 0; l < materials.length; ++l) {
                        materials[l].toonTextureMultiplicativeColor;
                    }
                    allToonTextureColorPropertiesAreRecompiled = true;
                } else {
                    materials[materialIndex].toonTextureMultiplicativeColor;
                    recompiledMaterials.add(materialIndex.toString());
                }
            }
        }
    };

    const isProcessedMorph = new Uint8Array(morphController.morphs.length);
    for (let i = 0; i < morphIndices.length; ++i) {
        const subMorphIndices = morphIndices[i];
        if (subMorphIndices === null) continue;

        for (let j = 0; j < subMorphIndices.length; ++j) {
            const subMorphIndex = subMorphIndices[j];
            if (isProcessedMorph[subMorphIndex] === 1) continue;
            isProcessedMorph[subMorphIndex] = 1;

            const morph = morphController.morphs[subMorphIndex];
            switch (morph.type) {
            case PmxObject.Morph.Type.GroupMorph: {
                const indices = morph.elements as Int32Array;
                for (let k = 0; k < indices.length; ++k) {
                    const subMorphIndex = indices[k];
                    if (isProcessedMorph[subMorphIndex] === 1) continue;
                    isProcessedMorph[subMorphIndex] = 1;

                    const subMorph = morphController.morphs[subMorphIndex];
                    if (subMorph !== undefined) {
                        switch (subMorph.type) {
                        case PmxObject.Morph.Type.MaterialMorph:
                            recompileMaterialMorph(subMorph);
                            break;
                        }
                    }
                }
            }
                break;
            case PmxObject.Morph.Type.MaterialMorph:
                recompileMaterialMorph(morph);
                break;
            }
        }

        if (allTextureColorPropertiesAreRecompiled
            && allSphereTextureColorPropertiesAreRecompiled
            && allToonTextureColorPropertiesAreRecompiled) {
            break;
        }
    }

    if (allTextureColorPropertiesAreRecompiled
        || allSphereTextureColorPropertiesAreRecompiled
        || allToonTextureColorPropertiesAreRecompiled) {
        logger?.log("All materials could be recompiled for morph animation");
    } else if (0 < recompiledMaterials.size) {
        logger?.log(`Materials ${Array.from(recompiledMaterials).join(", ")} could be recompiled for morph animation`);
    }
}

/**
 * Sets the `numMaxInfluencers` of the `MorphTargetManager` to the number of active morph targets in the morph animation
 *
 * @param morphController Morph controller
 * @param morphIndices Morph indices to induce recompile
 */
export function setMorphTargetManagersNumMaxInfluencers(
    morphController: MmdMorphControllerBase,
    morphIndices: readonly Nullable<MorphIndices>[]
): void {
    const morphTargetManagers = morphController.morphTargetManagers;
    const morphTargetManagersTargets: Set<MorphTarget>[] = new Array(morphTargetManagers.length);
    const activeTargetsForAnimation: Set<MorphTarget>[] = new Array(morphTargetManagers.length);
    for (let i = 0; i < morphTargetManagers.length; ++i) {
        const targets = morphTargetManagersTargets[i] = new Set<MorphTarget>();
        const activeTargets = activeTargetsForAnimation[i] = new Set<MorphTarget>();

        const morphTargetManager = morphTargetManagers[i];

        const numTargets = morphTargetManager.numTargets;
        for (let j = 0; j < numTargets; ++j) {
            const morphTarget = morphTargetManager.getTarget(j);

            targets.add(morphTarget);
            if (morphTarget.influence !== 0) activeTargets.add(morphTarget);
        }
    }

    {
        const morphs = morphController.morphs;
        for (let i = 0; i < morphs.length; ++i) {
            const morph = morphs[i];
            switch (morph.type) {
            case PmxObject.Morph.Type.VertexMorph:
            case PmxObject.Morph.Type.UvMorph:
                {
                    const elements = morph.elements as readonly MorphTarget[];
                    for (let k = 0; k < elements.length; ++k) {
                        const morphTarget = elements[k];

                        for (let i = 0; i < activeTargetsForAnimation.length; ++i) {
                            activeTargetsForAnimation[i].delete(morphTarget);
                        }
                    }
                }
                break;
            }
        }
    }

    const f = (morph: ReadonlyRuntimeMorph): void => {
        const elements = morph.elements as readonly MorphTarget[];
        for (let k = 0; k < elements.length; ++k) {
            const morphTarget = elements[k];

            for (let i = 0; i < morphTargetManagers.length; ++i) {
                if (morphTargetManagersTargets[i].has(morphTarget)) {
                    activeTargetsForAnimation[i].add(morphTarget);
                }
            }
        }
    };

    const isProcessedMorph = new Uint8Array(morphController.morphs.length);
    for (let i = 0; i < morphIndices.length; ++i) {
        const subMorphIndices = morphIndices[i];
        if (subMorphIndices === null) continue;

        for (let j = 0; j < subMorphIndices.length; ++j) {
            const subMorphIndex = subMorphIndices[j];
            if (isProcessedMorph[subMorphIndex] === 1) continue;
            isProcessedMorph[subMorphIndex] = 1;

            const morph = morphController.morphs[subMorphIndex];
            switch (morph.type) {
            case PmxObject.Morph.Type.GroupMorph: {
                const indices = morph.elements as Int32Array;
                for (let k = 0; k < indices.length; ++k) {
                    const subMorphIndex = indices[k];
                    if (isProcessedMorph[subMorphIndex] === 1) continue;
                    isProcessedMorph[subMorphIndex] = 1;

                    const subMorph = morphController.morphs[subMorphIndex];
                    if (subMorph !== undefined) {
                        switch (subMorph.type) {
                        case PmxObject.Morph.Type.VertexMorph:
                        case PmxObject.Morph.Type.UvMorph:
                            f(subMorph);
                            break;
                        }
                    }
                }
            }
                break;
            case PmxObject.Morph.Type.VertexMorph:
            case PmxObject.Morph.Type.UvMorph:
                f(morph);
                break;
            }
        }
    }

    for (let i = 0; i < morphTargetManagers.length; ++i) {
        morphTargetManagers[i].numMaxInfluencers = activeTargetsForAnimation[i].size;
    }
}
