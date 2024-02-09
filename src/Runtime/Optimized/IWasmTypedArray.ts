import type { TypedArray } from "./wasmTypedArray";

/**
 * Safe typed array pointer for WASM
 */
export interface IWasmTypedArray<T extends TypedArray> {
    readonly array: T;
}
