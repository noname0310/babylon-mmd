import type { IMmdWasmInstanceType, MmdWasmType } from "../mmdWasmInstance";
import * as wasmBindgen from "../wasm/md";

/**
 * Multithreaded debug build MmdWasmInstanceType
 *
 * This wasm instance provides fast performance by performing worker-based multithreading
 *
 * Requirements for use:
 *
 * - Browser that supports WebAssembly and SharedArrayBuffer
 * - Serve page with https
 * - Use following headers in your server:
 *     ```http
 *     Cross-Origin-Opener-Policy: same-origin
 *     Cross-Origin-Embedder-Policy: require-corp
 *     ```
 */
export class MmdWasmInstanceTypeMD implements IMmdWasmInstanceType {
    public getWasmInstanceInner(): MmdWasmType {
        return wasmBindgen as MmdWasmType;
    }
}
