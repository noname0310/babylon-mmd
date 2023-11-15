// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type MmdWasmType = typeof import("./wasm");

export interface MmdWasmInstance extends MmdWasmType {}

export function createMmdWasmInstance(): Promise<MmdWasmInstance> {
    return import("./wasm");
}
