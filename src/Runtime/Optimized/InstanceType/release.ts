import type { MmdWasmInstanceType } from "../mmdWasmInstance";

export class MmdWasmReleaseInstanceType implements MmdWasmInstanceType {
    public getWasmInstanceUrl(): URL {
        return new URL("../wasm/index_bg.wasm", import.meta.url);
    }
}
