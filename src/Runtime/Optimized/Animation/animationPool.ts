import type { MmdWasmInstance } from "../mmdWasmInstance";
import type { AnimationPool as WasmAnimationPool } from "../wasm";

export class AnimationPool {
    private static readonly _Map = new WeakMap<MmdWasmInstance, WasmAnimationPool>();

    public static Get(instance: MmdWasmInstance): WasmAnimationPool {
        let pool = this._Map.get(instance);
        if (!pool) {
            pool = instance.createAnimationPool();
            this._Map.set(instance, pool);
        }
        return pool;
    }
}
