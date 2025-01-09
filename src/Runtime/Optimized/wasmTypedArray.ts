import type { IWasmTypedArray } from "./IWasmTypedArray";

/**
 * Typed array
 */
export type TypedArray = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

/**
 * Typed array constructor
 */
export type TypedArrayConstructor<T extends TypedArray> = {
    new(buffer: ArrayBuffer, byteOffset?: number, length?: number): T;
    new(length: number): T;
};

/**
 * Safe typed array pointer for WASM
 */
export class WasmTypedArray<T extends TypedArray> implements IWasmTypedArray<T> {
    private readonly _memory: WebAssembly.Memory;
    private readonly _byteOffset: number;
    private readonly _length: number;

    private _array: T;

    /**
     * Create a safe typed array pointer for WASM
     *
     * @param typedArrayConstructor typed array constructor
     * @param memory WebAssembly memory
     * @param byteOffset byte offset of the typed array
     * @param length length of the typed array
     */
    public constructor(typedArrayConstructor: TypedArrayConstructor<T>, memory: WebAssembly.Memory, byteOffset: number, length: number) {
        this._memory = memory;
        this._byteOffset = byteOffset;
        this._length = length;

        this._array = length === 0
            ? new typedArrayConstructor(0)
            : new typedArrayConstructor(memory.buffer, byteOffset, length);
    }

    /**
     * Get the typed array
     */
    public get array(): T {
        if (this._array.length !== this._length) {
            this._array = new (this._array.constructor as TypedArrayConstructor<T>)(this._memory.buffer, this._byteOffset, this._length);
        }
        return this._array;
    }
}
