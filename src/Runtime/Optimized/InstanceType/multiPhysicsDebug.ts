import type { MmdWasmInstanceType, MmdWasmType } from "../mmdWasmInstance";
import * as wasmBindgen from "../wasm/mpd";

/**
 * Multithreaded debug build MmdWasmInstanceType with integrated bullet physics
 *
 * This wasm instance provides fast performance by performing worker-based multithreading with integrated bullet physics
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
export class MmdWasmInstanceTypeMPD implements MmdWasmInstanceType {
    public getWasmInstanceInner(): MmdWasmType {
        return wasmBindgen as MmdWasmType;
    }
}
