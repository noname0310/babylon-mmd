import type { TypedArray, TypedArrayConstructor } from "./wasmTypedArray";
import { WasmTypedArray } from "./wasmTypedArray";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type MmdWasmType = typeof import("./wasm");

/**
 * MMD WASM instance
 *
 * entry point of the MMD WASM
 */
export interface MmdWasmInstance extends MmdWasmType {
    memory: WebAssembly.Memory;

    createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): WasmTypedArray<T>;
}

/**
 * Load MMD WASM instance
 * @returns MMD WASM instance
 */
export async function getMmdWasmInstance(): Promise<MmdWasmInstance> {
    const wasm = await import("./wasm");
    const wasmBg = await import("./wasm/index_bg.wasm");
    wasm.init();

    const memory = wasmBg.memory;

    function createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): WasmTypedArray<T> {
        return new WasmTypedArray(typedArrayConstructor, memory, byteOffset, length);
    }

    return {
        ...wasm,
        memory,
        createTypedArray
    };
}
