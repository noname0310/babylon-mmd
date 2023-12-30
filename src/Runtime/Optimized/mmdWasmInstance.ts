// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type MmdWasmType = typeof import("./wasm");

export interface MmdWasmInstance extends MmdWasmType {}

export async function createMmdWasmInstance(): Promise<MmdWasmInstance> {
    const wasm = await import("./wasm");
    wasm.init();
    return import("./wasm");
}
