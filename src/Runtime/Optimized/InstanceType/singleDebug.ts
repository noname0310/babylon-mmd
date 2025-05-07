import type { IMmdWasmInstanceType, MmdWasmType } from "../mmdWasmInstance";
import * as wasmBindgen from "../wasm/sd";

/**
 * Singlethreaded debug build MmdWasmInstanceType
 *
 * Requirements for use:
 *
 * - Browser that supports WebAssembly
 */
export class MmdWasmInstanceTypeSD implements IMmdWasmInstanceType {
    public getWasmInstanceInner(): MmdWasmType {
        return wasmBindgen as MmdWasmType;
    }
}
