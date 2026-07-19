import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import { MmdStandardMaterialProxy } from "./mmdStandardMaterialProxy";

/**
 * Globally shared MMD runtime settings
 *
 * This class is used to share settings across the MMD runtime
 */
export class MmdRuntimeShared {
    /**
     * Default value of `IMmdModelCreationOptions.materialProxyConstructor`
     */
    public static MaterialProxyConstructor: IMmdMaterialProxyConstructor<any> | null = null;
}

let _Registered = false;
/**
 * Register MmdStandardMaterialProxy as the default MMD runtime material proxy
 * Safe to call multiple times; only the first call has an effect.
 */
export function RegisterMmdRuntimeSharedDefaultMaterialProxy(): void {
    if (_Registered) {
        return;
    }
    _Registered = true;

    MmdRuntimeShared.MaterialProxyConstructor = MmdStandardMaterialProxy;
}
