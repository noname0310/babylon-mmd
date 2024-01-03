// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type MmdWasmType = typeof import("./wasm");

export interface MmdWasmInstance extends MmdWasmType {
    memory: WebAssembly.Memory;
}

export async function getMmdWasmInstance(): Promise<MmdWasmInstance> {
    const wasm = await import("./wasm");
    const wasmBg = await import("./wasm/index_bg.wasm");
    wasm.init();
    return {
        ...wasm,
        memory: wasmBg.memory
    };
}
