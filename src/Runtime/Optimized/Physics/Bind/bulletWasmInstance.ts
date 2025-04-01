import type { IWasmTypedArray } from "../../Misc/IWasmTypedArray";
import type { TypedArray, TypedArrayConstructor } from "../../Misc/wasmTypedArray";

/* eslint-disable @typescript-eslint/consistent-type-imports */
export type BulletWasmType =
    typeof import("../../wasm/mpr") |
    typeof import("../../wasm/mpd") |
    typeof import("../../wasm/spr") |
    typeof import("../../wasm/spd");
/* eslint-enable @typescript-eslint/consistent-type-imports */

/**
 * Bullet WASM instance
 *
 * entry point of the Bullet WASM
 */
export interface BulletWasmInstance extends BulletWasmType {
    memory: WebAssembly.Memory;

    createTypedArray<T extends TypedArray>(typedArrayConstructor: TypedArrayConstructor<T>, byteOffset: number, length: number): IWasmTypedArray<T>;
}

export interface BulletWasmInstanceType {
    /**
     * Get Bullet wasm-bindgen instance
     * @returns Bullet wasm-bindgen instance
     */
    getWasmInstanceInner(): BulletWasmType;
}
