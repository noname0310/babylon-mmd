import { memory } from "./wasm/index_bg.wasm";

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type MmdWasmType = typeof import("./wasm");

export interface MmdWasmInstance extends MmdWasmType {
    memory: WebAssembly.Memory;
}

export async function getMmdWasmInstance(): Promise<MmdWasmInstance> {
    const wasm = await import("./wasm");
    wasm.init();
    return {
        ...wasm,
        memory: memory
    };
}
