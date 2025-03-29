import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

import type { IMmdMaterialProxyConstructor } from "../IMmdMaterialProxy";
import type { RuntimeMorph } from "../mmdMorphControllerBase";
import { MmdMorphControllerBase } from "../mmdMorphControllerBase";
import type { IWasmTypedArray } from "./Misc/IWasmTypedArray";

/**
 * The MmdWasmMorphController uses `MorphTargetManager` to handle position uv morphs, while the material, bone, and group morphs are handled by CPU bound
 *
 * bone morphs are handled by WASM
 *
 * As a result, it reproduces the behavior of the MMD morph system
 */
export class MmdWasmMorphController extends MmdMorphControllerBase {
    private readonly _wasmMorphWeights: IWasmTypedArray<Float32Array>;
    private readonly _wasmMorphIndexMap: Int32Array;

    /**
     * Creates a new MmdWasmMorphController
     * @param wasmMorphWeights WASM side morph weights
     * @param wasmMorphIndexMap Mmd morph to WASM morph index map
     * @param materials MMD materials which are order of mmd metadata
     * @param meshes MMD meshes which are order of mmd metadata
     * @param materialProxyConstructor The constructor of `IMmdMaterialProxy`
     * @param morphsMetadata Morphs metadata
     * @param morphTargetManagers MorphTargetManagers
     */
    public constructor(
        wasmMorphWeights: IWasmTypedArray<Float32Array>,
        wasmMorphIndexMap: Int32Array,
        materials: readonly Material[],
        meshes: readonly Mesh[],
        materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<Material>>,
        morphsMetadata: readonly MmdModelMetadata.Morph[],
        morphTargetManagers: MorphTargetManager[]
    ) {
        super(null, materials, meshes, materialProxyConstructor, morphsMetadata, morphTargetManagers);

        this._wasmMorphWeights = wasmMorphWeights;
        this._wasmMorphIndexMap = wasmMorphIndexMap;
    }

    /**
     * Sets the weight of the morph
     *
     * If there are multiple morphs with the same name, all of them will be set to the same weight, this is the behavior of MMD
     *
     * IMPORTANT: when wasm runtime using buffered evaluation, this method must be called before waiting for the WasmMmdRuntime.lock
     * otherwise, it can cause a datarace
     * @param morphName Name of the morph
     * @param weight Weight of the morph
     */
    public override setMorphWeight(morphName: string, weight: number): void {
        const morphIndexMap = this._morphIndexMap;
        const morphIndices = morphIndexMap.get(morphName);
        if (morphIndices === undefined) return;

        const morphWeights = this._morphWeights;

        const wasmMorphWeights = this._wasmMorphWeights.array;
        const wasmMorphIndexMap = this._wasmMorphIndexMap;

        for (let i = 0; i < morphIndices.length; ++i) {
            const morphIndex = morphIndices[i];
            morphWeights[morphIndex] = weight;

            wasmMorphWeights[wasmMorphIndexMap[morphIndex]] = weight;
        }

        if (weight !== 0) {
            this._activeMorphs.add(morphName);
        }
    }

    /**
     * Sets the weight of the morph from the index
     *
     * This method is faster than `setMorphWeight` because it does not need to search the morphs with the given name
     *
     * IMPORTANT: when wasm runtime using buffere evaluation, this method with upadteWasm must be called before waiting for the WasmMmdRuntime.lock
     * otherwise, it can cause a datarace
     * @param morphIndex Index of the morph
     * @param weight Weight of the morph
     * @param updateWasm Whether to update the WASM side morph weight (default: true)
     */
    public override setMorphWeightFromIndex(morphIndex: number, weight: number, updateWasm = true): void {
        this._morphWeights[morphIndex] = weight;
        if (updateWasm) {
            this._wasmMorphWeights.array[this._wasmMorphIndexMap[morphIndex]] = weight;
        }

        if (weight !== 0) {
            this._activeMorphs.add(this._morphs[morphIndex].name);
        }
    }

    /**
     * Set the weights of all morphs to 0
     *
     * IMPORTANT: when wasm runtime using buffered evaluation, this method must be called before waiting for the WasmMmdRuntime.lock
     * otherwise, it can cause a datarace
     */
    public override resetMorphWeights(): void {
        super.resetMorphWeights();
        this._wasmMorphWeights.array.fill(0);
    }

    /**
     * Synchronize the morph weights to WASM side
     *
     * IMPORTANT: when wasm runtime using buffered evaluation, this method must be called before waiting for the WasmMmdRuntime.lock
     * otherwise, it can cause a datarace
     */
    public syncWasmMorphWeights(): void {
        const morphWeights = this._morphWeights;
        const wasmMorphWeights = this._wasmMorphWeights.array;
        const wasmMorphIndexMap = this._wasmMorphIndexMap;

        for (let i = 0; i < morphWeights.length; ++i) {
            wasmMorphWeights[wasmMorphIndexMap[i]] = morphWeights[i];
        }
    }

    protected override _resetBoneMorph(_morph: RuntimeMorph): void { }

    protected override _applyBoneMorph(_morph: RuntimeMorph, _weight: number): void { }

    /**
     * @internal
     * Morph index map from js morph index to wasm morph index
     */
    public get wasmMorphIndexMap(): ArrayLike<number> {
        return this._wasmMorphIndexMap;
    }
}
