import type { IWasmTypedArray } from "./Misc/IWasmTypedArray";
import { WasmSharedTypedArray } from "./Misc/wasmSharedTypedArray";
import type { TypedArray, TypedArrayConstructor } from "./Misc/wasmTypedArray";
import { WasmTypedArray } from "./Misc/wasmTypedArray";

/* eslint-disable @typescript-eslint/consistent-type-imports */
export type MmdWasmType =
    typeof import("./wasm/mpr") |
    typeof import("./wasm/mpd") |
    typeof import("./wasm/mr") |
    typeof import("./wasm/md") |
    typeof import("./wasm/spr") |
    typeof import("./wasm/spd") |
    typeof import("./wasm/sr") |
    typeof import("./wasm/sd");
/* eslint-enable @typescript-eslint/consistent-type-imports */

/**
 * MMD WASM instance
 *
 * entry point of the MMD WASM
 */
export interface IMmdWasmInstance extends MmdWasmType {
    memory: WebAssembly.Memory;

    createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): IWasmTypedArray<T>;
}

export interface IMmdWasmInstanceType {
    /**
     * Get MMD wasm-bindgen instance
     * @returns MMD wasm-bindgen instance
     */
    getWasmInstanceInner(): MmdWasmType;
}

const WasmInstanceMap = new WeakMap<MmdWasmType, Promise<IMmdWasmInstance>>();

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
export async function GetMmdWasmInstance(
    instanceType: IMmdWasmInstanceType,
    threadCount = navigator.hardwareConcurrency
): Promise<IMmdWasmInstance> {
    const wasmBindgen = instanceType.getWasmInstanceInner();

    {
        const instance = WasmInstanceMap.get(wasmBindgen);
        if (instance !== undefined) return instance;
    }

    let resolvePromise: (instance: IMmdWasmInstance | PromiseLike<IMmdWasmInstance>) => void = null!;
    WasmInstanceMap.set(wasmBindgen, new Promise<IMmdWasmInstance>(resolve => resolvePromise = resolve));

    const mmdWasmInstance = {...wasmBindgen} as IMmdWasmInstance;

    const initOutput = await mmdWasmInstance.default();

    mmdWasmInstance.init();
    const memory = initOutput.memory;

    function createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): IWasmTypedArray<T> {
        return new WasmTypedArray(typedArrayConstructor, memory, byteOffset, length);
    }

    function createSharedTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): IWasmTypedArray<T> {
        return new WasmSharedTypedArray(typedArrayConstructor, memory, byteOffset, length);
    }

    mmdWasmInstance.memory = memory;
    if (memory.buffer instanceof ArrayBuffer) {
        mmdWasmInstance.createTypedArray = createTypedArray;
    } else {
        mmdWasmInstance.createTypedArray = createSharedTypedArray;
    }

    await mmdWasmInstance.initThreadPool?.(threadCount);

    resolvePromise(mmdWasmInstance);

    return mmdWasmInstance;
}
