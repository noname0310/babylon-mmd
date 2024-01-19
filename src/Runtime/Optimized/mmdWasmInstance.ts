import type { TypedArray, TypedArrayConstructor } from "./wasmTypedArray";
import { WasmTypedArray } from "./wasmTypedArray";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export type MmdWasmType = typeof import("./wasm") | typeof import("./wasm_debug");

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
    getWasmInstanceInner(): MmdWasmType;
}

/**
 * Load MMD WASM instance
 *
 * Wasm instance type is determined by the argument instanceType
 *
 * For example, if you want to use most stable MMD WASM instance, pass MmdWasmDebugInstanceType to instanceType.
 * @param instanceType MMD WASM instance type
 * @param threadCount Thread count for WASM threading (default: navigator.hardwareConcurrency)
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

    function createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): WasmTypedArray<T> {
        return new WasmTypedArray(typedArrayConstructor, memory, byteOffset, length);
    }

    (wasmBindgen as MmdWasmInstance).memory = memory;
    (wasmBindgen as MmdWasmInstance).createTypedArray = createTypedArray;

    await wasmBindgen.initThreadPool(threadCount);

    return wasmBindgen as MmdWasmInstance;
}
