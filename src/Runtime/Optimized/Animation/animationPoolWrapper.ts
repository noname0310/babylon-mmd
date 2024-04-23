import type { MmdWasmInstance } from "../mmdWasmInstance";

/**
 * Animation pool singleton
 */
export class AnimationPoolWrapper {
    private static readonly _Map = new Map<MmdWasmInstance, AnimationPoolWrapper>();

    public readonly instance: MmdWasmInstance;
    public readonly pool: InstanceType<MmdWasmInstance["AnimationPool"]>;
    private _referenceCount: number;

    private constructor(instance: MmdWasmInstance, pool: InstanceType<MmdWasmInstance["AnimationPool"]>) {
        this.instance = instance;
        this.pool = pool;
        this._referenceCount = 0;
    }

    /**
     * @internal
     */
    public addReference(): void {
        this._referenceCount += 1;
    }

    /**
     * @internal
     */
    public removeReference(): void {
        this._referenceCount -= 1;
        if (this._referenceCount === 0) {
            this.pool.free();
            AnimationPoolWrapper._Map.delete(this.instance);
        }
    }

    /**
     * Get animation pool
     * @param instance MMD WASM instance
     * @returns Animation pool for the WASM instance
     */
    public static Get(instance: MmdWasmInstance): AnimationPoolWrapper {
        let poolWrapper = this._Map.get(instance);
        if (!poolWrapper) {
            const pool = instance.createAnimationPool();
            poolWrapper = new AnimationPoolWrapper(instance, pool);
            this._Map.set(instance, poolWrapper);
        }
        return poolWrapper;
    }
}
