import type { Nullable } from "@babylonjs/core/types";

import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import { PmxObject } from "@/Loader/Parser/pmxObject";
import type { ILogger } from "@/Runtime/ILogger";
import type { MmdMorphControllerBase } from "@/Runtime/mmdMorphControllerBase";

type MorphIndices = readonly number[];

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
    materials: MmdStandardMaterial[],
    morphController: MmdMorphControllerBase,
    morphIndices: readonly Nullable<MorphIndices>[],
    logger?: ILogger
): void {
    let allTextureColorPropertiesAreRecompiled = false;
    let allSphereTextureColorPropertiesAreRecompiled = false;
    let allToonTextureColorPropertiesAreRecompiled = false;
    const recompiledMaterials = new Set<string>();

    for (let i = 0; i < morphIndices.length; ++i) {
        const morphIndex = morphIndices[i];
        if (morphIndex === null) continue;

        for (let j = 0; j < morphIndex.length; ++j) {
            const morph = morphController.morphs[morphIndex[j]];
            if (morph.type === PmxObject.Morph.Type.MaterialMorph) {
                const elements = morph.materialElements!;
                for (let k = 0; k < elements.length; ++k) {
                    const element = elements[k];
                    if (element.textureColor !== null && !allTextureColorPropertiesAreRecompiled) {
                        const materialIndex = element.index;
                        if (element.index === -1) {
                            for (let l = 0; l < materials.length; ++l) {
                                materials[l].textureColor;
                            }
                            allTextureColorPropertiesAreRecompiled = true;
                        } else {
                            materials[materialIndex].textureColor;
                            recompiledMaterials.add(materialIndex.toString());
                        }
                    }

                    if (element.sphereTextureColor !== null && !allSphereTextureColorPropertiesAreRecompiled) {
                        const materialIndex = element.index;
                        if (element.index === -1) {
                            for (let l = 0; l < materials.length; ++l) {
                                materials[l].sphereTextureColor;
                            }
                            allSphereTextureColorPropertiesAreRecompiled = true;
                        } else {
                            materials[materialIndex].sphereTextureColor;
                            recompiledMaterials.add(materialIndex.toString());
                        }
                    }

                    if (element.toonTextureColor !== null && !allToonTextureColorPropertiesAreRecompiled) {
                        const materialIndex = element.index;
                        if (element.index === -1) {
                            for (let l = 0; l < materials.length; ++l) {
                                materials[l].toonTextureColor;
                            }
                            allToonTextureColorPropertiesAreRecompiled = true;
                        } else {
                            materials[materialIndex].toonTextureColor;
                            recompiledMaterials.add(materialIndex.toString());
                        }
                    }
                }
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
