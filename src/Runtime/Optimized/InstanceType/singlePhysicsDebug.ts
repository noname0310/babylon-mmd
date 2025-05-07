import type { IMmdWasmInstanceType, MmdWasmType } from "../mmdWasmInstance";
import * as wasmBindgen from "../wasm/spd";

/**
 * Singlethreaded debug build MmdWasmInstanceType with integrated bullet physics
 *
 * Requirements for use:
 *
 * - Browser that supports WebAssembly
 */
export class MmdWasmInstanceTypeSPD implements IMmdWasmInstanceType {
    public getWasmInstanceInner(): MmdWasmType {
        return wasmBindgen as MmdWasmType;
    }
}
