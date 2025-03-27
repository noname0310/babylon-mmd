import type { IWasmTypedArray } from "./IWasmTypedArray";
import type { TypedArray } from "./wasmTypedArray";

export class WasmNullTypedArray<T extends TypedArray> implements IWasmTypedArray<T> {
    public readonly array: T;

    public constructor(array: T) {
        this.array = array;
    }
}
