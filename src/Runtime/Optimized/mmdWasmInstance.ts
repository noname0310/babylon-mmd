import { wasm_bindgen } from "./wasm";
import type { TypedArray, TypedArrayConstructor } from "./wasmTypedArray";
import { WasmTypedArray } from "./wasmTypedArray";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type MmdWasmType = typeof import("./wasm").wasm_bindgen;

/**
 * MMD WASM instance
 *
 * entry point of the MMD WASM
 */
export interface MmdWasmInstance extends MmdWasmType {
    memory: WebAssembly.Memory;

    createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): WasmTypedArray<T>;
}

export interface MmdWasmInstanceType {
    getWasmInstanceUrl(): URL;
}

/**
 * Load MMD WASM instance
 * @returns MMD WASM instance
 */
export async function getMmdWasmInstance(instanceType: MmdWasmInstanceType): Promise<MmdWasmInstance> {
    const initOutput = await wasm_bindgen(instanceType.getWasmInstanceUrl());
    wasm_bindgen.init();

    const memory = initOutput.memory;

    function createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): WasmTypedArray<T> {
        return new WasmTypedArray(typedArrayConstructor, memory, byteOffset, length);
    }

    (wasm_bindgen as MmdWasmInstance).memory = memory;
    (wasm_bindgen as MmdWasmInstance).createTypedArray = createTypedArray;

    return wasm_bindgen as MmdWasmInstance;
}
