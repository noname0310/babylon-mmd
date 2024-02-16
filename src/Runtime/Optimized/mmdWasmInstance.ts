import type { IWasmTypedArray } from "./IWasmTypedArray";
import { WasmSharedTypedArray } from "./wasmSharedTypedArray";
import type { TypedArray, TypedArrayConstructor } from "./wasmTypedArray";
import { WasmTypedArray } from "./wasmTypedArray";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export type MmdWasmType = typeof import("./wasm/mr") | typeof import("./wasm/md") | typeof import("./wasm/sr") | typeof import("./wasm/sd");

/**
 * MMD WASM instance
 *
 * entry point of the MMD WASM
 */
export interface MmdWasmInstance extends MmdWasmType {
    memory: WebAssembly.Memory;

    createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): IWasmTypedArray<T>;
}

export interface MmdWasmInstanceType {
    /**
     * Get MMD wasm-bindgen instance
     * @returns MMD wasm-bindgen instance
     */
    getWasmInstanceInner(): MmdWasmType;
}

/**
 * Load MMD WASM instance
 *
 * Wasm instance type is determined by the argument instanceType
 *
 * For example, if you want to use most stable MMD WASM instance, pass MmdWasmDebugInstanceType to instanceType
 * @param instanceType MMD WASM instance type
 * @param threadCount Thread count for WASM threading (default: navigator.hardwareConcurrency). threadCount must be greater than 0
 * @returns MMD WASM instance
 */
export async function getMmdWasmInstance(
    instanceType: MmdWasmInstanceType,
    threadCount = navigator.hardwareConcurrency
): Promise<MmdWasmInstance> {
    const wasmBindgen = instanceType.getWasmInstanceInner();
    const initOutput = await wasmBindgen.default();

    wasmBindgen.init();
    const memory = initOutput.memory;

    function createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): IWasmTypedArray<T> {
        return new WasmTypedArray(typedArrayConstructor, memory, byteOffset, length);
    }

    function createSharedTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): IWasmTypedArray<T> {
        return new WasmSharedTypedArray(typedArrayConstructor, memory, byteOffset, length);
    }

    (wasmBindgen as MmdWasmInstance).memory = memory;
    if (memory.buffer instanceof ArrayBuffer) {
        (wasmBindgen as MmdWasmInstance).createTypedArray = createTypedArray;
    } else {
        (wasmBindgen as MmdWasmInstance).createTypedArray = createSharedTypedArray;
    }

    await wasmBindgen.initThreadPool?.(threadCount);

    return wasmBindgen as MmdWasmInstance;
}
