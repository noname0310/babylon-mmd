import type { IWasmTypedArray } from "./IWasmTypedArray";
import type { TypedArray, TypedArrayConstructor } from "./wasmTypedArray";

/**
 * Safe typed array pointer for WASM shared memory
 */
export class WasmSharedTypedArray<T extends TypedArray> implements IWasmTypedArray<T> {
    public readonly array: T;

    /**
     * Create a safe typed array pointer for WASM shared memory
     *
     * @param typedArrayConstructor typed array constructor
     * @param memory WebAssembly memory
     * @param byteOffset byte offset of the typed array
     * @param length length of the typed array
     */
    public constructor(typedArrayConstructor: TypedArrayConstructor<T>, memory: WebAssembly.Memory, byteOffset: number, length: number) {
        this.array = new typedArrayConstructor(memory.buffer, byteOffset, length);
    }
}
