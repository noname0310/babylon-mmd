import type { IWasmTypedArray } from "./IWasmTypedArray";

/**
 * Spinlock for WASM runtime synchronization
 */
export class WasmSpinlock {
    private readonly _lock: IWasmTypedArray<Uint8Array>;

    /**
     * Creates a new WasmSpinlock with the 1 byte length lock array
     * @param lock Lock array
     */
    public constructor(lock: IWasmTypedArray<Uint8Array>) {
        this._lock = lock;
    }

    /**
     * waits for the lock to be released
     */
    public wait(): void {
        const lock = this._lock.array;
        // let locked = false;
        // const lockStartTime = performance.now();
        while (Atomics.load(lock, 0) !== 0) {
            // locked = true;
            // spin
        }
        // if (locked) {
        //     const lockTime = performance.now() - lockStartTime;
        //     console.trace(`Spinlock wait time: ${lockTime}ms`);
        // }
    }
}
