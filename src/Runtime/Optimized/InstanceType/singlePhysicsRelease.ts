import type { MmdWasmInstanceType, MmdWasmType } from "../mmdWasmInstance";
import * as wasmBindgen from "../wasm/spr";

/**
 * Singlethreaded release build MmdWasmInstanceType with integrated bullet physics
 *
 * Requirements for use:
 *
 * - Browser that supports WebAssembly
 */
export class MmdWasmInstanceTypeSPR implements MmdWasmInstanceType {
    public getWasmInstanceInner(): MmdWasmType {
        return wasmBindgen as MmdWasmType;
    }
}
