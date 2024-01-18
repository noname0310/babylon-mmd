import { wasm_bindgen } from "./wasm";
import type { TypedArray, TypedArrayConstructor } from "./wasmTypedArray";
import { WasmTypedArray } from "./wasmTypedArray";
import { WorkerPool } from "./Worker/workerPool";

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
    const initOutput = await wasm_bindgen(instanceType.getWasmInstanceUrl());

    const module = wasm_bindgen.init();
    const memory = initOutput.memory;

    function createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): WasmTypedArray<T> {
        return new WasmTypedArray(typedArrayConstructor, memory, byteOffset, length);
    }

    (wasm_bindgen as MmdWasmInstance).memory = memory;
    (wasm_bindgen as MmdWasmInstance).createTypedArray = createTypedArray;

    WorkerPool.Initialize(module, wasm_bindgen as MmdWasmInstance, threadCount);

    return wasm_bindgen as MmdWasmInstance;
}
