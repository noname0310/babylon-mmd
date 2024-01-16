import type { MmdWasmInstanceType } from "../mmdWasmInstance";

export class MmdWasmDebugInstanceType implements MmdWasmInstanceType {
    public getWasmInstanceUrl(): URL {
        return new URL("../wasm_debug/index_bg.wasm", import.meta.url);
    }
}
