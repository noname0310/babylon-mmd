import type { IMmdWasmInstanceType, MmdWasmType } from "../mmdWasmInstance";
import * as wasmBindgen from "../wasm/sr";

/**
 * Singlethreaded release build MmdWasmInstanceType
 *
 * Requirements for use:
 *
 * - Browser that supports WebAssembly
 */
export class MmdWasmInstanceTypeSR implements IMmdWasmInstanceType {
    public getWasmInstanceInner(): MmdWasmType {
        return wasmBindgen as MmdWasmType;
    }
}
