import type { TypedArray } from "./wasmTypedArray";

/**
 * Safe typed array pointer for WASM
 */
export interface IWasmTypedArray<T extends TypedArray> {
    /**
     * Get the typed array
     */
    readonly array: T;
}
